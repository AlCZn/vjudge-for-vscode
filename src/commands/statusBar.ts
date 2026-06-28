import * as vscode from "vscode";
import { VJudgeClient } from "../core/vjudgeClient";

let statusBarItem: vscode.StatusBarItem;

/**
 * 初始化状态栏
 */
export function initStatusBar(
  context: vscode.ExtensionContext,
  client: VJudgeClient,
) {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "vjudge.checkStatus";
  statusBarItem.name = "VJudge Status";
  context.subscriptions.push(statusBarItem);

  updateStatusBar(client);
}

/**
 * 更新状态栏{}
 */
export async function updateStatusBar(client: VJudgeClient) {
  if (!statusBarItem) {
    return;
  }

  try {
    const isLoggedIn = await client.checkLoginStatus();

    if (isLoggedIn) {
      // ✅ 尝试获取用户名
      let username = await client.getUsername();

      // 如果获取不到用户名，使用默认显示
      if (!username) {
        username = "已登录";
      }

      statusBarItem.text = `$(check) VJudge: ${username}`;
      statusBarItem.tooltip = `VJudge 已登录 (${username})`;
      statusBarItem.backgroundColor = undefined;
    } else {
      statusBarItem.text = "$(warning) VJudge";
      statusBarItem.tooltip = "VJudge 未登录，点击登录";
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground",
      );
    }
    statusBarItem.show();
  } catch (error) {
    console.error("Failed to update status bar:", error);
  }
}
