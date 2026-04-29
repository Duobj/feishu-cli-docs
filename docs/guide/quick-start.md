# 快速开始

欢迎来到 feishu-cli 源码学习指南！本文档将帮助你快速上手 lark-cli 的鉴权系统。

## 初级用户

如果你是第一次接触 lark-cli，建议按以下步骤开始：

### 1. 第一次使用

```bash
# 初始化应用
lark-cli config init

# 登录
lark-cli auth login --recommend

# 验证
lark-cli auth status

# 开始使用
lark-cli calendar +agenda
```

### 2. 查看快速参考

前往 [命令速查表](/reference/commands) 了解常用命令。

### 3. 遇到问题

查看 [故障排查](/reference/troubleshooting) 获取帮助。

---

## 中级开发者

如果你需要修改或扩展鉴权系统：

### 1. 理解架构

阅读 [鉴权系统详细解读](/guide/architecture) 了解系统设计。

### 2. 学习实现

查看 [实现指南](/guide/implementation) 学习代码细节。

### 3. 查看场景

参考 [场景和流程图](/guide/scenarios) 理解实际应用。

---

## 高级系统设计者

如果你需要深入研究整个系统：

1. 完整阅读 [鉴权系统详细解读](/guide/architecture)
2. 深入学习 [实现指南](/guide/implementation)
3. 研究 [场景和流程图](/guide/scenarios) 中的所有场景
4. 查看源代码实现

---

## 学习路径

### 初级（新手用户）
- 预计时间：30 分钟
- 内容：快速参考 → 常用命令 → 第一次使用

### 中级（开发者）
- 预计时间：6-7 小时
- 内容：架构概览 → 核心流程 → 命令系统 → 配置系统 → 错误处理 → 快捷命令开发 → 流程图

### 高级（系统设计者）
- 预计时间：20-25 小时
- 内容：完整文档 → 实现细节 → 所有场景 → 源码导航 → 设计你自己的 CLI

---

## 下一步

- [查看文档索引](/guide/index)
- [查看命令参考](/reference/commands)
- [查看常见问题](/reference/faq)