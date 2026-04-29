# 认证实战指南

本文基于 [鉴权系统详细解读](./architecture.md) 的理论基础，提供实战场景和常见问题解决方案。

> 📖 **前置阅读**：建议先阅读 [鉴权系统详细解读](./architecture.md) 了解 Device Flow、Token 生命周期等基础概念。

---

## 多应用管理

### 应用配置结构

```json
{
  "currentApp": "my-app-1",
  "previousApp": "my-app-2",
  "apps": [
    {
      "name": "my-app-1",
      "appId": "cli_xxx",
      "appSecret": {
        "ref": {
          "source": "keychain",
          "id": "appsecret:cli_xxx"
        }
      },
      "brand": "feishu",
      "lang": "zh",
      "defaultAs": "ou_xxx",
      "users": [
        {
          "userOpenId": "ou_xxx",
          "userName": "张三"
        }
      ]
    },
    {
      "name": "my-app-2",
      "appId": "cli_yyy",
      "appSecret": {
        "ref": {
          "source": "keychain",
          "id": "appsecret:cli_yyy"
        }
      },
      "brand": "lark",
      "lang": "en",
      "defaultAs": "ou_yyy",
      "users": [
        {
          "userOpenId": "ou_yyy",
          "userName": "Li Si"
        }
      ]
    }
  ]
}
```

### 应用切换流程

```bash
# 1. 列出所有应用
$ lark-cli profile list
┌──────────────┬──────────────┬────────────┐
│ 名称         │ AppID        │ 当前       │
├──────────────┼──────────────┼────────────┤
│ my-app-1     │ cli_xxx      │ ✓          │
│ my-app-2     │ cli_yyy      │            │
└──────────────┴──────────────┴────────────┘

# 2. 切换应用
$ lark-cli profile use my-app-2
[lark-cli] 已切换到 my-app-2

# 3. 验证切换
$ lark-cli auth status
{
  "appId": "cli_yyy",
  "brand": "lark",
  "identity": "user",
  "userName": "Li Si",
  "userOpenId": "ou_yyy"
}
```

### 多用户支持

同一个应用可以有多个用户登录：

```bash
# 1. 第一个用户登录
$ lark-cli auth login
[lark-cli] 授权成功！用户: 张三 (ou_xxx)

# 2. 第二个用户登录（同一应用）
$ lark-cli auth login
[lark-cli] 授权成功！用户: 李四 (ou_yyy)

# 3. 查看所有用户
$ lark-cli auth list
┌──────────────┬──────────────┐
│ 用户名       │ OpenID       │
├──────────────┼──────────────┤
│ 张三         │ ou_xxx       │
│ 李四         │ ou_yyy       │
└──────────────┴──────────────┘

# 4. 切换用户
$ lark-cli calendar +agenda --as ou_yyy
```

---

## 身份切换实战

### 身份解析优先级

```
1. 严格模式强制身份
   └─ 如果设置了 --strict-user 或 --strict-bot，只能使用该身份

2. 显式 --as 标志
   └─ lark-cli calendar +agenda --as ou_xxx

3. 配置文件默认值
   └─ config.json 中的 defaultAs

4. 自动检测
   └─ 检查可用的 Token 类型
   └─ 优先使用 UAT（用户身份）
   └─ 如果没有 UAT，使用 TAT（应用身份）
```

### 身份检测示例

```bash
# 场景 1: 只有用户 Token
$ lark-cli calendar +agenda
# 自动使用用户身份

# 场景 2: 只有应用 Token
$ lark-cli calendar +agenda
# 自动使用应用身份

# 场景 3: 两种 Token 都有
$ lark-cli calendar +agenda
# 默认使用用户身份（优先级更高）

# 场景 4: 显式指定身份
$ lark-cli calendar +agenda --as bot
# 强制使用应用身份
```

### 严格模式

严格模式限制只能使用特定身份：

```bash
# 设置严格模式（仅用户）
$ lark-cli config set strict-user true

# 之后所有命令都只能使用用户身份
$ lark-cli calendar +agenda
# ✓ 成功（使用用户身份）

$ lark-cli calendar +agenda --as bot
# ✗ 错误：严格模式下不允许使用 bot 身份
```

---

## 权限实战

### 场景 1: API 调用返回权限不足

当执行命令时遇到权限错误：

```bash
$ lark-cli calendar +agenda
[lark-cli] ERROR: permission denied
Hint: Missing scopes: calendar:calendar:read
Console: https://open.feishu.cn/app/cli_xxx/permission

# 按照提示升级权限
$ lark-cli auth login --scope "calendar:calendar:read"
[lark-cli] 打开浏览器访问: https://...
[lark-cli] 授权成功！

# 重试命令
$ lark-cli calendar +agenda
```

### 场景 2: 预先检查权限

在执行自动化脚本前，先检查权限：

```bash
#!/bin/bash

# 检查所需权限
REQUIRED_SCOPES="calendar:calendar:read im:message:send"

if ! lark-cli auth check --scope "$REQUIRED_SCOPES" | grep -q '"ok": true'; then
  echo "权限不足，请升级"
  lark-cli auth login --scope "$REQUIRED_SCOPES"
  exit 1
fi

# 权限充足，继续执行
lark-cli calendar +agenda
lark-cli im +send --text "Hello"
```

### 场景 3: 多应用不同权限

不同应用可能有不同的权限配置：

```bash
# 应用 1: 仅日历权限
$ lark-cli profile use app-calendar
$ lark-cli auth login --scope "calendar:calendar:read"

# 应用 2: 仅消息权限
$ lark-cli profile use app-messaging
$ lark-cli auth login --scope "im:message:send"

# 应用 3: 完整权限
$ lark-cli profile use app-full
$ lark-cli auth login --recommend
```

---

## 故障排查

### 问题 1: 登录超时

**症状：**
```
[lark-cli] 等待授权...
[lark-cli] ERROR: authorization timed out
```

**原因：**
- 用户未在浏览器中完成授权
- 网络连接不稳定
- 超过 240 秒未授权

**解决方案：**
```bash
# 重新登录
$ lark-cli auth login
```

### 问题 2: Token 过期

**症状：**
```
[lark-cli] ERROR: token expired
```

**原因：**
- Token 已过期
- Refresh token 也已过期

**解决方案：**
```bash
# 重新登录
$ lark-cli auth login
```

### 问题 3: 权限不足

**症状：**
```
[lark-cli] ERROR: permission denied
Hint: Missing scopes: calendar:calendar:write
Console: https://open.feishu.cn/app/cli_xxx/permission
```

**原因：**
- 当前 Token 没有所需权限

**解决方案：**
```bash
# 升级权限
$ lark-cli auth login --scope "calendar:calendar:write"
```

### 问题 4: Keychain 访问失败

**症状：**
```
[lark-cli] ERROR: keychain access failed
```

**原因：**
- macOS Keychain 被锁定
- Linux 密钥链文件损坏
- Windows DPAPI 不可用

**解决方案：**
```bash
# 重新初始化配置
$ lark-cli config init
```

---

## 最佳实践

### 1. 定期检查 Token 状态

```bash
$ lark-cli auth status
```

### 2. 使用最小权限原则

只请求必要的权限：

```bash
$ lark-cli auth login --scope "calendar:calendar:read"
```

### 3. 多应用隔离

为不同用途创建不同的应用：

```bash
# 个人使用
$ lark-cli profile add personal
$ lark-cli auth login

# 自动化脚本
$ lark-cli profile add automation
$ lark-cli auth login
```

### 4. 定期轮换凭证

对于生产环境，定期更新应用密钥。

### 5. 监控权限变化

```bash
$ lark-cli auth scopes
```

---

## 相关命令

```bash
# 认证相关
lark-cli auth login              # 登录
lark-cli auth logout             # 登出
lark-cli auth status             # 查看状态
lark-cli auth list               # 列出用户
lark-cli auth check              # 检查权限
lark-cli auth scopes             # 查看权限范围

# 配置相关
lark-cli config init             # 初始化配置
lark-cli config show             # 查看配置
lark-cli profile list            # 列出应用
lark-cli profile use             # 切换应用
lark-cli profile add             # 添加应用
```

---

## 下一步

- [凭证提供者系统](./credential-providers.md) - 了解如何扩展认证
- [快速参考](../reference/commands.md) - 查看完整命令列表
- [故障排查](../reference/troubleshooting.md) - 解决常见问题
