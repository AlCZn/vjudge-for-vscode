import * as vscode from "vscode";
import { VJudgeClient, LoginResult } from "../core/vjudgeClient";

let clientInstance: VJudgeClient | null = null;

export function setClient(client: VJudgeClient) {
  clientInstance = client;
}

/**
 * 登录命令 - 支持两种登录方式
 */
export async function loginCommand() {
  console.log("[VJudge] loginCommand 被调用");

  if (!clientInstance) {
    console.error("[VJudge] clientInstance 为 null");
    vscode.window.showErrorMessage("❌ VJudge 客户端未初始化");
    return;
  }

  console.log("[VJudge] 当前登录状态:", clientInstance.getLoginStatus());

  // 检查是否已登录
  if (clientInstance.getLoginStatus()) {
    const choice = await vscode.window.showQuickPick(["保持登录", "重新登录"], {
      placeHolder: "您已经登录 VJudge，选择操作",
    });

    if (choice === "保持登录") {
      return;
    }
  }

  console.log("[VJudge] 显示登录方式选择");

  // 选择登录方式
  const loginMethod = await vscode.window.showQuickPick(
    [
      {
        label: "🍪 使用浏览器 Cookie 登录",
        description: "从浏览器复制 Cookie 粘贴",
        value: "cookie",
      },
      {
        label: "🔑 使用密码登录（目前不行）",
        description: "用户名密码登录（暂不可用）",
        value: "password",
      },
    ],
    {
      placeHolder: "选择登录方式",
      ignoreFocusOut: true,
    },
  );

  if (!loginMethod) {
    return;
  }

  if (loginMethod.value === "cookie") {
    await cookieLogin(clientInstance);
  } else if (loginMethod.value === "password") {
    // 密码登录暂时不可用
    vscode.window
      .showWarningMessage(
        "⚠️ 密码登录暂时不可用（Cloudflare 验证问题），请使用浏览器 Cookie 登录",
        "了解详情",
      )
      .then((selection) => {
        if (selection === "了解详情") {
          vscode.window.showInformationMessage(
            "VJudge 使用了 Cloudflare 防护，需要先通过浏览器验证。\n" +
              "请先在浏览器中登录 VJudge，然后复制 Cookie 使用。",
          );
        }
      });
    // 可以重新打开登录选择
    await loginCommand();
  }
}

/**
 * Cookie 登录
 */
async function cookieLogin(client: VJudgeClient) {
  // 显示提示信息
  const instruction = await vscode.window.showInformationMessage(
    "📋 请从浏览器复制 Cookie",
    { modal: true },
    "如何获取 Cookie？",
    "我已准备好",
  );

  if (instruction === "如何获取 Cookie？") {
    vscode.window.showInformationMessage(
      "1. 在浏览器中打开 https://vjudge.net 并登录\n" +
        "2. 按 F12 打开开发者工具\n" +
        "3. 切换到 Application (Chrome) 或 Storage (Edge)\n" +
        "4. 选择 Cookies → https://vjudge.net\n" +
        "5. 复制所有 Cookie（格式: name1=value1; name2=value2; ...）",
      { modal: true },
    );
    // 重新获取 Cookie
    await cookieLogin(client);
    return;
  }

  // 获取 Cookie 输入
  const cookieString = await vscode.window.showInputBox({
    prompt: "请粘贴从浏览器复制的 Cookie",
    placeHolder: "JSESSIONID=xxx; cf_clearance=xxx; ...",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return "请输入 Cookie";
      }
      // 简单验证：检查是否包含常见的 Cookie 字段
      if (!value.includes("JSESSIONID") && !value.includes("cf_clearance")) {
        return "Cookie 可能不完整，请确保包含 JSESSIONID 或 cf_clearance";
      }
      return null;
    },
  });

  if (!cookieString) {
    vscode.window.showWarningMessage("已取消登录");
    return;
  }

  // 显示登录进度
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "正在验证 Cookie...",
      cancellable: false,
    },
    async (progress) => {
      progress.report({ increment: 0 });

      try {
        // 设置 Cookie
        await client.setManualCookie(cookieString);
        progress.report({ increment: 50 });

        // 验证登录状态
        const isValid = await client.checkLoginStatus();
        progress.report({ increment: 100 });

        if (isValid) {
          // ✅ 获取用户名
          const username = await client.getUsername();

          // 更新状态栏
          vscode.commands.executeCommand("vjudge.updateStatusBar");
          // 刷新活动栏视图
          vscode.commands.executeCommand("vjudge.refreshView");

          // ✅ 显示带用户名的欢迎信息
          if (username) {
            vscode.window.showInformationMessage(
              `✅ 登录成功！欢迎回来，${username} 🎉`,
            );
          } else {
            vscode.window.showInformationMessage(
              "✅ Cookie 验证成功！已登录 VJudge",
            );
          }
        } else {
          vscode.window.showErrorMessage("❌ Cookie 无效或已过期，请重新获取");
          // 清除无效 Cookie
          await client.clearCookies();
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`❌ 设置 Cookie 失败: ${error.message}`);
      }
    },
  );
}

/**
 * 登出命令
 */
export async function logoutCommand() {
  if (!clientInstance) {
    vscode.window.showErrorMessage("❌ VJudge 客户端未初始化");
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    "确认登出 VJudge？",
    { modal: true },
    "确认登出",
  );

  if (confirm === "确认登出") {
    await clientInstance.logout();
    vscode.window.showInformationMessage("已登出 VJudge");

    vscode.commands.executeCommand("vjudge.updateStatusBar");
    vscode.commands.executeCommand("vjudge.refreshView");
  }
}

/**
 * 检查登录状态命令
 */
export async function checkStatusCommand() {
  if (!clientInstance) {
    vscode.window.showErrorMessage("❌ VJudge 客户端未初始化");
    return;
  }

  const isLoggedIn = await clientInstance.checkLoginStatus();

  if (isLoggedIn) {
    // ✅ 获取并显示用户名
    const username = await clientInstance.getUsername();
    if (username) {
      vscode.window.showInformationMessage(
        `✅ 已登录 VJudge，当前用户: ${username}`,
      );
    } else {
      vscode.window.showInformationMessage("✅ VJudge 已登录");
    }
  } else {
    const selection = await vscode.window.showWarningMessage(
      "❌ VJudge 未登录",
      { modal: false },
      "登录",
    );
    if (selection === "登录") {
      vscode.commands.executeCommand("vjudge.login");
    }
  }

  vscode.commands.executeCommand("vjudge.refreshView");
}
