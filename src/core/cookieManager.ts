import { CookieJar, Cookie } from "tough-cookie";
import * as vscode from "vscode";

const COOKIE_STORAGE_KEY = "vjudge.cookies";
let cookieJar: CookieJar | null = null;

/**
 * 初始化 Cookie Jar
 */
export function initCookieJar(): CookieJar {
  if (!cookieJar) {
    cookieJar = new CookieJar();
  }
  return cookieJar;
}

/**
 * 从 VSCode SecretStorage 加载 Cookie
 */
export async function loadCookiesFromStorage(
  context: vscode.ExtensionContext,
): Promise<boolean> {
  try {
    const jar = initCookieJar();
    const saved = await context.secrets.get(COOKIE_STORAGE_KEY);

    if (saved) {
      const cookieData = JSON.parse(saved);
      for (const cookieStr of cookieData) {
        // 使用 setCookie 而不是 setCookieSync（更安全）
        await jar.setCookie(cookieStr, "https://vjudge.net");
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to load cookies:", error);
    return false;
  }
}

/**
 * 保存 Cookie 到 VSCode SecretStorage
 */
export async function saveCookiesToStorage(
  context: vscode.ExtensionContext,
): Promise<void> {
  try {
    const jar = initCookieJar();
    const cookies = await jar.getCookies("https://vjudge.net");

    // 序列化为字符串数组
    const cookieStrings = cookies.map(
      (cookie: Cookie) => `${cookie.key}=${cookie.value}`,
    );

    await context.secrets.store(
      COOKIE_STORAGE_KEY,
      JSON.stringify(cookieStrings),
    );
  } catch (error) {
    console.error("Failed to save cookies:", error);
    throw error;
  }
}

/**
 * 获取 Cookie Jar 实例
 */
export function getCookieJar(): CookieJar {
  if (!cookieJar) {
    throw new Error("CookieJar not initialized");
  }
  return cookieJar;
}

/**
 * 清除所有 Cookie
 */
export async function clearCookies(
  context: vscode.ExtensionContext,
): Promise<void> {
  try {
    const jar = initCookieJar();

    // 先获取所有 cookie
    const cookies = await jar.getCookies("https://vjudge.net");

    // 逐个删除（使用 removeAllCookies 或手动删除）
    // 新版本推荐使用 removeAllCookies
    await jar.removeAllCookies();

    // 从存储中删除
    await context.secrets.delete(COOKIE_STORAGE_KEY);

    console.log("All cookies cleared");
  } catch (error) {
    console.error("Failed to clear cookies:", error);
    throw error;
  }
}

/**
 * 获取所有 Cookie 的字符串表示（用于调试）
 */
export async function getCookieStrings(): Promise<string[]> {
  try {
    const jar = initCookieJar();
    const cookies = await jar.getCookies("https://vjudge.net");
    return cookies.map((cookie: Cookie) => `${cookie.key}=${cookie.value}`);
  } catch (error) {
    console.error("Failed to get cookies:", error);
    return [];
  }
}
