import * as vscode from "vscode";
import { VJudgeClient } from "../core/vjudgeClient";

// 树节点类型枚举
export enum TreeNodeType {
  OJ = "oj",
  Problem = "problem",
  Submission = "submission",
  Action = "action",
}

// 树节点接口 - 扩展 TreeItem
export interface TreeNode extends vscode.TreeItem {
  type: TreeNodeType;
  id?: string;
  parentId?: string;
  children?: TreeNode[];
}

/**
 * VJudge 树数据提供器
 */
export class VJudgeTreeDataProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeNode | undefined | void
  > = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | void> =
    this._onDidChangeTreeData.event;

  private client: VJudgeClient;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext, client: VJudgeClient) {
    this.context = context;
    this.client = client;
  }

  /**
   * 刷新视图
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * 获取树节点
   */
  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  /**
   * 获取子节点
   */
  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      // 根节点
      return this.getRootItems();
    }

    // 如果有子节点，返回子节点
    if (element.children) {
      return element.children;
    }

    return [];
  }

  /**
   * 获取根节点
   */
  private async getRootItems(): Promise<TreeNode[]> {
    const isLoggedIn = this.client.getLoginStatus();
    let username = "";

    if (isLoggedIn) {
      username = (await this.client.getUsername()) || "";
    }

    // ✅ 状态节点 - 直接显示用户名
    const statusItem: TreeNode = {
      label: isLoggedIn ? `👤 ${username || "已登录"}` : "❌ 未登录",
      type: TreeNodeType.Action,
      id: "status",
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      command: {
        command: "vjudge.checkStatus",
        title: "检查登录状态",
      },
      iconPath: new vscode.ThemeIcon(isLoggedIn ? "account" : "warning"),
      tooltip: isLoggedIn && username ? `当前用户: ${username}` : "未登录",
    };

    // 2. 登录/登出按钮
    const authItem: TreeNode = {
      label: isLoggedIn ? "🚪 登出" : "🔑 登录",
      type: TreeNodeType.Action,
      id: "auth",
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      command: {
        command: isLoggedIn ? "vjudge.logout" : "vjudge.login",
        title: isLoggedIn ? "登出" : "登录",
      },
      iconPath: new vscode.ThemeIcon(isLoggedIn ? "sign-out" : "sign-in"),
    };

    // 3. 提交代码
    const submitItem: TreeNode = {
      label: "📤 提交代码",
      type: TreeNodeType.Action,
      id: "submit",
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      command: {
        command: "vjudge.submit",
        title: "提交代码",
      },
      iconPath: new vscode.ThemeIcon("cloud-upload"),
    };

    // 4. 最近提交
    const recentItem: TreeNode = {
      label: "📋 最近提交",
      type: TreeNodeType.OJ,
      id: "recent",
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      iconPath: new vscode.ThemeIcon("history"),
      children: [],
    };

    // 5. 支持的 OJ 列表
    const ojItem: TreeNode = {
      label: "🌐 支持的 OJ",
      type: TreeNodeType.OJ,
      id: "ojs",
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      iconPath: new vscode.ThemeIcon("globe"),
      children: [],
    };

    // 如果已登录，添加子节点
    if (isLoggedIn) {
      recentItem.children = [
        this.createSubmissionItem("HDU 1000", "AC", "C++"),
        this.createSubmissionItem("POJ 1000", "WA", "C"),
        this.createSubmissionItem("Codeforces 1A", "AC", "C++"),
      ];

      ojItem.children = [
        this.createOJItem("HDU", "hdu"),
        this.createOJItem("POJ", "poj"),
        this.createOJItem("Codeforces", "cf"),
        this.createOJItem("AtCoder", "atcoder"),
        this.createOJItem("NowCoder", "nowcoder"),
      ];
    }

    return [statusItem, authItem, submitItem, recentItem, ojItem];
  }

  /**
   * 创建提交记录节点
   */
  private createSubmissionItem(
    title: string,
    status: string,
    language: string,
  ): TreeNode {
    const statusIcons: { [key: string]: string } = {
      AC: "check",
      WA: "close",
      TLE: "clock",
      MLE: "database",
      RE: "debug",
      CE: "error",
    };

    const statusDescriptions: { [key: string]: string } = {
      AC: "✅ Accepted",
      WA: "❌ Wrong Answer",
      TLE: "⏱️ Time Limit Exceeded",
      MLE: "💾 Memory Limit Exceeded",
      RE: "💥 Runtime Error",
      CE: "🔧 Compile Error",
    };

    return {
      label: `${title}`,
      type: TreeNodeType.Submission,
      id: `sub-${title}`,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      description: status,
      tooltip: `${title}\n状态: ${statusDescriptions[status] || status}\n语言: ${language}`,
      iconPath: new vscode.ThemeIcon(statusIcons[status] || "question"),
      contextValue: "submission",
    };
  }

  /**
   * 创建 OJ 节点
   */
  private createOJItem(name: string, id: string): TreeNode {
    return {
      label: name,
      type: TreeNodeType.OJ,
      id: id,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      iconPath: new vscode.ThemeIcon("link"),
      command: {
        command: "vjudge.selectOJ",
        title: "选择 OJ",
        arguments: [id, name],
      },
      contextValue: "oj",
    };
  }
}
