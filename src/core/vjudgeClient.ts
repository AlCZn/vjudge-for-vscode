import axios, { AxiosInstance } from "axios";
import {
  getCookieJar,
  saveCookiesToStorage,
  loadCookiesFromStorage,
  clearCookies,
} from "./cookieManager";
import * as vscode from "vscode";

export interface LoginResult {
  success: boolean;
  message?: string;
  statusCode?: number;
  data?: any;
  error?: string;
}

export class VJudgeClient {
  private client: AxiosInstance;
  private context: vscode.ExtensionContext;
  private isLoggedIn: boolean = false;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    this.client = axios.create({
      baseURL: "https://vjudge.net",
      withCredentials: true,
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0",
        Accept: "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "X-Requested-With": "XMLHttpRequest",
        Referer: "https://vjudge.net/",
      },
    });

    // 添加请求拦截器，自动添加 Cookie
    this.client.interceptors.request.use(async (config) => {
      const jar = getCookieJar();
      const cookies = await jar.getCookies("https://vjudge.net");
      if (cookies.length > 0) {
        const cookieString = cookies
          .map((c) => `${c.key}=${c.value}`)
          .join("; ");
        config.headers["Cookie"] = cookieString;
      }
      return config;
    });

    // 添加响应拦截器，自动保存 Cookie
    this.client.interceptors.response.use(async (response) => {
      const setCookie = response.headers["set-cookie"];
      if (setCookie) {
        const jar = getCookieJar();
        for (const cookieStr of setCookie) {
          await jar.setCookie(cookieStr, "https://vjudge.net");
        }
        await saveCookiesToStorage(this.context);
      }
      return response;
    });

    this.initializeSession();
  }

  private async initializeSession() {
    try {
      const loaded = await loadCookiesFromStorage(this.context);
      if (loaded) {
        const valid = await this.checkLoginStatus();
        this.isLoggedIn = valid;
        if (valid) {
          console.log("VJudge session restored");
        } else {
          console.log("VJudge session expired");
        }
      }
    } catch (error) {
      console.error("Failed to initialize session:", error);
      this.isLoggedIn = false;
    }
  }

  /**
   * 手动设置 Cookie（从浏览器复制）
   */
  async setManualCookie(cookieString: string): Promise<void> {
    const jar = getCookieJar();

    // 清除所有旧 Cookie
    await jar.removeAllCookies();

    // 解析 Cookie 字符串并设置
    // 支持格式: "name1=value1; name2=value2; ..."
    const cookies = cookieString
      .split(";")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    for (const cookie of cookies) {
      try {
        await jar.setCookie(cookie, "https://vjudge.net");
      } catch (error) {
        console.warn("[VJudge] 跳过无效 Cookie:", cookie, error);
      }
    }

    // 保存到持久化存储
    await saveCookiesToStorage(this.context);

    // 验证登录状态
    // 在 setManualCookie 方法中，找到这行：
    this.isLoggedIn = await this.checkLoginStatus();

    // 在这行后面添加：
    // 清除缓存的用户名
    this.cachedUsername = null;

    // 如果登录成功，预获取用户名
    if (this.isLoggedIn) {
      await this.getUsername();
    }

    console.log("[VJudge] 手动 Cookie 已设置，登录状态:", this.isLoggedIn);
  }

  /**
   * 清除所有 Cookie
   */
  async clearCookies(): Promise<void> {
    await clearCookies(this.context);
    const jar = getCookieJar();
    await jar.removeAllCookies();
    this.isLoggedIn = false;
    console.log("[VJudge] 所有 Cookie 已清除");
  }

  /**
   * 登录 - 用户名密码方式（保留但标记为不可用）
   */
  async login(username: string, password: string): Promise<LoginResult> {
    try {
      console.log(`[VJudge] 尝试登录用户: ${username}`);

      // 1. 先访问主页获取 JSESSIONID
      const homeResponse = await this.client.get("/");
      console.log(`[VJudge] 主页状态: ${homeResponse.status}`);

      // 2. 提交登录请求
      const startTime = Date.now();
      const response = await this.client.post(
        "/user/login",
        `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          },
        },
      );
      const elapsed = Date.now() - startTime;

      // 3. 解析响应
      const data = response.data;
      console.log(`[VJudge] 登录响应:`, {
        status: response.status,
        statusText: response.statusText,
        data: data,
        elapsed: `${elapsed}ms`,
      });

      if (response.status === 200) {
        if (data && data.status === "success") {
          await saveCookiesToStorage(this.context);
          this.isLoggedIn = true;
          await this.checkLoginStatus();

          return {
            success: true,
            message: data.msg || "登录成功！",
            statusCode: response.status,
            data: data,
          };
        } else {
          this.isLoggedIn = false;
          return {
            success: false,
            message: data?.msg || "登录失败，请检查用户名和密码",
            statusCode: response.status,
            data: data,
            error: data?.msg || "认证失败",
          };
        }
      } else {
        this.isLoggedIn = false;
        return {
          success: false,
          message: `服务器返回错误: ${response.status} ${response.statusText}`,
          statusCode: response.status,
          data: data,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error: any) {
      this.isLoggedIn = false;
      console.error("[VJudge] 登录异常:", error);

      if (error.response) {
        const statusCode = error.response.status;
        const statusText = error.response.statusText;
        const data = error.response.data;

        let errorMessage = "";
        switch (statusCode) {
          case 401:
            errorMessage = "认证失败，用户名或密码错误";
            break;
          case 403:
            errorMessage = "访问被拒绝，请检查账户权限";
            break;
          case 404:
            errorMessage = "登录接口不存在";
            break;
          case 500:
            errorMessage = "服务器内部错误，请稍后重试";
            break;
          default:
            errorMessage = `服务器错误: ${statusCode} ${statusText}`;
        }

        return {
          success: false,
          message: errorMessage,
          statusCode: statusCode,
          data: data,
          error: errorMessage,
        };
      } else if (error.request) {
        return {
          success: false,
          message: "网络连接失败，请检查网络设置",
          statusCode: 0,
          error: "Network Error: No response received",
        };
      } else {
        return {
          success: false,
          message: `请求配置错误: ${error.message}`,
          statusCode: 0,
          error: error.message,
        };
      }
    }
  }

  /**
   * 检查登录状态
   */
  async checkLoginStatus(): Promise<boolean> {
    try {
      const response = await this.client.get("/status", {
        maxRedirects: 0,
        validateStatus: (status) => status === 200 || status === 302,
      });

      if (response.status === 302) {
        const location = response.headers.location || "";
        if (location.includes("login")) {
          this.isLoggedIn = false;
          return false;
        }
      }

      if (typeof response.data === "string") {
        if (
          response.data.includes("login") &&
          response.data.includes("password")
        ) {
          this.isLoggedIn = false;
          return false;
        }
      }

      this.isLoggedIn = true;
      return true;
    } catch (error: any) {
      if (error.response && error.response.status === 302) {
        const location = error.response.headers.location || "";
        if (location.includes("login")) {
          this.isLoggedIn = false;
          return false;
        }
      }

      this.isLoggedIn = false;
      return false;
    }
  }

  getLoginStatus(): boolean {
    return this.isLoggedIn;
  }

  // 在 getLoginStatus() 方法后面添加：

  /**
   * 获取当前登录用户信息
   */
  async getUserInfo(): Promise<{ username: string; nickname?: string } | null> {
    try {
      console.log("[VJudge] 开始获取用户信息...");

      // 从 /status 页面解析
      const response = await this.client.get("/status");
      const html = response.data;
      console.log("[VJudge] /status 页面长度:", html.length);

      // ✅ 方法1：查找 id="userNameDropdown" 的 a 标签
      const userMatch = html.match(/id="userNameDropdown"[^>]*>([^<]+)<\/a>/i);
      if (userMatch) {
        const username = userMatch[1].trim();
        console.log("[VJudge] 找到用户名:", username);
        return { username: username };
      }

      // 方法2：查找包含 userNameDropdown 的任意标签
      const userMatch2 = html.match(/userNameDropdown[^>]*>([^<]+)</i);
      if (userMatch2) {
        const username = userMatch2[1].trim();
        console.log("[VJudge] 方法2找到用户名:", username);
        return { username: username };
      }

      // 方法3：从 Cookie 中提取
      const jar = getCookieJar();
      const cookies = await jar.getCookies("https://vjudge.net");
      console.log(
        "[VJudge] 当前 Cookie:",
        cookies.map((c) => `${c.key}=${c.value}`),
      );
      for (const cookie of cookies) {
        if (cookie.key === "username" || cookie.key.includes("user")) {
          console.log("[VJudge] 从Cookie找到用户名:", cookie.value);
          return { username: cookie.value };
        }
      }

      console.log("[VJudge] 所有方法都未找到用户名");
      return null;
    } catch (error) {
      console.error("[VJudge] 获取用户信息失败:", error);
      return null;
    }
  }

  /**
   * 获取用户名（带缓存）
   */
  private cachedUsername: string | null = null;

  async getUsername(): Promise<string | null> {
    // 如果有缓存，直接返回
    if (this.cachedUsername) {
      return this.cachedUsername;
    }

    // 从服务器获取
    const info = await this.getUserInfo();
    if (info) {
      this.cachedUsername = info.username;
      return info.username;
    }

    return null;
  }

  async logout(): Promise<void> {
    try {
      await this.client.get("/user/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      this.isLoggedIn = false;
      await clearCookies(this.context);
    }
  }

  getClient(): AxiosInstance {
    return this.client;
  }

  async submit(params: any): Promise<any> {
    if (!this.isLoggedIn) {
      throw new Error("请先登录 VJudge");
    }
    return { success: false, message: "提交功能开发中" };
  }
}
