// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as cheerio from "cheerio";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

interface VJudgeLoginPayload {
  username: string;
  password: string;
  remember?: boolean;
}

const VJUDGE_ROOT_PAGE = "https://vjudge.net/";

interface FetchResult {
  html: string;
  cookies: string[];
}

async function fetchHtml(url: string): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const request = (parsed.protocol === "https:" ? https : http).request(
      {
        host: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          "User-Agent": "VSCode-VJudge-Extension",
        },
      },
      (res) => {
        const setCookie = res.headers["set-cookie"];
        const cookies = Array.isArray(setCookie)
          ? setCookie
          : setCookie
            ? [setCookie]
            : [];

        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
          } else {
            resolve({ html: body, cookies });
          }
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

function buildCookieHeader(cookies: string[]): string {
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

function extractLoginForm(html: string): {
  action: string;
  hiddenFields: Record<string, string>;
} {
  const $ = cheerio.load(html);
  const form = $('form[action*="/user/login"], form[action*="login"]').first();
  const action = form.attr("action") || "/user/login";
  const hiddenFields: Record<string, string> = {};

  form.find('input[type="hidden"]').each((_, element) => {
    const name = $(element).attr("name");
    const value = $(element).attr("value") || "";
    if (name) {
      hiddenFields[name] = value;
    }
  });

  return { action, hiddenFields };
}

async function loginVJudge(payload: VJudgeLoginPayload): Promise<string> {
  const { html, cookies } = await fetchHtml(VJUDGE_ROOT_PAGE);
  const { action, hiddenFields } = extractLoginForm(html);
  const actionUrl = new URL(action, VJUDGE_ROOT_PAGE).toString();

  const form = new URLSearchParams();
  Object.entries(hiddenFields).forEach(([key, value]) => {
    form.set(key, value);
  });
  form.set("username", payload.username);
  form.set("password", payload.password);
  form.set("remember", payload.remember ? "1" : "0");

  const data = form.toString();
  const parsed = new URL(actionUrl);
  const cookieHeader = buildCookieHeader(cookies);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        host: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(data),
          "User-Agent": "VSCode-VJudge-Extension",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve(body);
        });
      },
    );

    request.on("error", reject);
    request.write(data);
    request.end();
  });
}

class VJudgeTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.ProviderResult<vscode.TreeItem[]> {
    const loginItem = new vscode.TreeItem(
      "VJudge 登录",
      vscode.TreeItemCollapsibleState.None,
    );
    loginItem.command = {
      command: "vjudge-for-vscode.loginVjudge",
      title: "VJudge 登录",
    };
    loginItem.iconPath = new vscode.ThemeIcon("sign-in");
    return [loginItem];
  }
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "vjudgeView",
      new VJudgeTreeDataProvider(),
    ),
  );
  console.log(
    'Congratulations, your extension "vjudge-for-vscode" is now active!',
  );

  const helloDisposable = vscode.commands.registerCommand(
    "vjudge-for-vscode.helloWorld",
    () => {
      vscode.window.showInformationMessage(
        "Hello World from VJudge for VSCode!",
      );
    },
  );

  const loginDisposable = vscode.commands.registerCommand(
    "vjudge-for-vscode.loginVjudge",
    async () => {
      const username = await vscode.window.showInputBox({
        prompt: "请输入 VJudge 用户名",
      });
      if (!username) {
        return;
      }

      const password = await vscode.window.showInputBox({
        prompt: "请输入 VJudge 密码",
        password: true,
      });
      if (!password) {
        return;
      }

      try {
        const result = await loginVJudge({
          username,
          password,
          remember: true,
        });
        console.log("VJudge 登录响应：", result);
        vscode.window.showInformationMessage(
          "VJudge 登录请求已发送，请检查输出日志确认是否成功。",
        );
      } catch (error) {
        console.error("VJudge 登录失败：", error);
        vscode.window.showErrorMessage("VJudge 登录失败，请检查网络或凭据。");
      }
    },
  );

  context.subscriptions.push(helloDisposable, loginDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
