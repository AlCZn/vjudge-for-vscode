import * as vscode from "vscode";
import { VJudgeTreeDataProvider } from "../providers/treeDataProvider";
import { VJudgeClient } from "../core/vjudgeClient";

export function registerVJudgeView(
  context: vscode.ExtensionContext,
  client: VJudgeClient,
): VJudgeTreeDataProvider {
  // 创建树数据提供器
  const treeDataProvider = new VJudgeTreeDataProvider(context, client);

  // 注册树视图
  const treeView = vscode.window.createTreeView("vjudgeView", {
    treeDataProvider: treeDataProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView);

  // 注册刷新命令
  const refreshCommand = vscode.commands.registerCommand(
    "vjudge.refreshView",
    () => {
      treeDataProvider.refresh();
    },
  );

  context.subscriptions.push(refreshCommand);

  // 监听登录状态变化，自动刷新视图
  // 这里可以添加事件监听

  return treeDataProvider;
}
