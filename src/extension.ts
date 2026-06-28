import * as vscode from "vscode";
import { VJudgeClient } from "./core/vjudgeClient";
import { initCookieJar } from "./core/cookieManager";
import {
  loginCommand,
  logoutCommand,
  checkStatusCommand,
  setClient,
} from "./commands/login";
import { initStatusBar, updateStatusBar } from "./commands/statusBar";
import { registerVJudgeView } from "./views/vjudgeView";

let client: VJudgeClient | null = null;

export async function activate(context: vscode.ExtensionContext) {
  console.log("VJudge extension is now active!");
  vscode.window.showInformationMessage("🚀 VJudge 扩展已激活！");

  initCookieJar();

  client = new VJudgeClient(context);
  setClient(client);

  initStatusBar(context, client);
  registerVJudgeView(context, client);

  // ✅ 改成箭头函数包装，确保 client 正确传递
  const loginCmd = vscode.commands.registerCommand("vjudge.login", async () => {
    console.log("[VJudge] login command triggered");
    await loginCommand();
  });

  const logoutCmd = vscode.commands.registerCommand(
    "vjudge.logout",
    async () => {
      console.log("[VJudge] logout command triggered");
      await logoutCommand();
    },
  );

  const checkStatusCmd = vscode.commands.registerCommand(
    "vjudge.checkStatus",
    async () => {
      console.log("[VJudge] checkStatus command triggered");
      await checkStatusCommand();
    },
  );

  const updateStatusBarCmd = vscode.commands.registerCommand(
    "vjudge.updateStatusBar",
    () => {
      if (client) {
        updateStatusBar(client);
      }
    },
  );

  // 清除 Cookie 命令（调试用）
  const clearCookiesCmd = vscode.commands.registerCommand(
    "vjudge.clearCookies",
    async () => {
      if (client) {
        await client.clearCookies();
        vscode.window.showInformationMessage("Cookie 已清除");
        vscode.commands.executeCommand("vjudge.updateStatusBar");
        vscode.commands.executeCommand("vjudge.refreshView");
      }
    },
  );

  const submitCmd = vscode.commands.registerCommand("vjudge.submit", () => {
    if (!client?.getLoginStatus()) {
      vscode.window.showWarningMessage("请先登录 VJudge");
      vscode.commands.executeCommand("vjudge.login");
      return;
    }
    vscode.window.showInformationMessage("提交功能开发中...");
  });

  const selectOJCmd = vscode.commands.registerCommand(
    "vjudge.selectOJ",
    (ojId: string, ojName: string) => {
      vscode.window.showInformationMessage(`已选择 ${ojName} (${ojId})`);
    },
  );

  const settingsCmd = vscode.commands.registerCommand(
    "vjudge.openSettings",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "@ext:vjudge-for-vscode",
      );
    },
  );

  context.subscriptions.push(
    loginCmd,
    logoutCmd,
    checkStatusCmd,
    updateStatusBarCmd,
    clearCookiesCmd,
    submitCmd,
    selectOJCmd,
    settingsCmd,
  );

  // 启动时检查登录状态
  await checkStatusCommand();
}

export function deactivate() {
  console.log("VJudge extension deactivated");
  if (client) {
    client = null;
  }
}
