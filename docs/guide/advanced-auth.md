# 高级认证系统

lark-cli 的认证系统采用 OAuth 2.0 Device Flow，专为 CLI 和无浏览器环境设计。本文深入讲解认证的核心机制。

## Device Flow 详解

### 为什么使用 Device Flow？

传统 OAuth 流程需要在本地启动 HTTP 服务器监听回调，但 CLI 环境中：
- 用户可能在远程服务器上运行 CLI
- 防火墙可能阻止本地端口
- 无法保证本地端口可用

Device Flow 解决这个问题：用户在浏览器中授权，CLI 通过轮询获取结果。

### 完整流程

```
┌─────────────────────────────────────────────────────────────┐
│                  lark-cli auth login                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  RequestDeviceAuthorization()         │
        │  POST /oauth2/v2/device_authorization │
        │  ├─ client_id: appId                  │
        │  ├─ scope: 权限范围                   │
        │  └─ 自动添加: offline_access          │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  返回响应                              │
        │  ├─ device_code: 设备标识             │
        │  ├─ user_code: 用户输入码             │
        │  ├─ verification_uri: 授权 URL        │
        │  ├─ expires_in: 过期时间              │
        │  └─ interval: 轮询间隔                │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  显示给用户                            │
        │  "打开浏览器访问: https://..."        │
        │  "输入代码: ABC123"                   │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  用户在浏览器中打开 URL                │
        │  输入 user_code 并授权                 │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  PollDeviceToken()                    │
        │  轮询 /oauth2/v2/token                │
        │  ├─ device_code: 设备标识             │
        │  ├─ client_id: appId                  │
        │  └─ client_secret: appSecret          │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  轮询状态                              │
        │  ├─ authorization_pending: 继续等待   │
        │  ├─ slow_down: 增加轮询间隔           │
        │  ├─ access_denied: 用户拒绝           │
        │  └─ 成功: 返回 access_token           │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  获取用户信息                          │
        │  GET /authen/v1/user_info             │
        │  使用 access_token 获取 open_id       │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  保存到 Keychain                       │
        │  Key: {appId}:{userOpenId}            │
        │  Value: JSON(token data)              │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  更新 config.json                     │
        │  ├─ Users: [{userOpenId, userName}]  │
        │  └─ DefaultAs: userOpenId             │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  登录完成                              │
        └───────────────────────────────────────┘
```

### 轮询策略

lark-cli 使用智能轮询策略：

```go
初始间隔: 5 秒
最大间隔: 60 秒
超时时间: 240 秒（4 分钟）

轮询逻辑:
1. 发送轮询请求
2. 如果返回 slow_down，增加间隔
3. 如果返回 authorization_pending，继续轮询
4. 如果返回 access_token，停止轮询
5. 如果超过 240 秒，超时失败
```

**为什么这样设计？**

- 初始 5 秒：快速响应用户授权
- 最大 60 秒：避免过度轮询
- slow_down 处理：服务器可以动态调整轮询频率
- 240 秒超时：防止无限等待

---

## Token 生命周期

### Token 类型

lark-cli 支持两种 Token：

| Token 类型 | 说明 | 获取方式 | 用途 |
|-----------|------|--------|------|
| **UAT** (User Access Token) | 用户身份 Token | Device Flow | 代表用户调用 API |
| **TAT** (Tenant Access Token) | 应用身份 Token | App Credentials | 代表应用调用 API |

### Token 状态机

```
┌─────────────┐
│   获取新    │
│   Token     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Token 有效期内                      │
│  ├─ access_token: 有效              │
│  ├─ refresh_token: 有效             │
│  └─ 状态: valid                     │
└──────┬──────────────────────────────┘
       │
       │ (距离过期 < 5 分钟)
       ▼
┌─────────────────────────────────────┐
│  需要刷新                            │
│  ├─ 自动调用 RefreshToken()         │
│  ├─ 使用 refresh_token 获取新 Token │
│  └─ 状态: needs_refresh             │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Token 已过期                        │
│  ├─ access_token: 无效              │
│  ├─ refresh_token: 无效             │
│  └─ 状态: expired                   │
└──────┬──────────────────────────────┘
       │
       │ (需要重新登录)
       ▼
┌─────────────┐
│  重新登录   │
└─────────────┘
```

### Token 刷新机制

**关键特性：提前 5 分钟刷新**

```go
// Token 刷新判断逻辑
if token.ExpiresAt - now < 5 * time.Minute {
    // 自动刷新
    newToken = RefreshToken(token.RefreshToken)
}
```

**为什么提前 5 分钟？**

- 避免 Token 在 API 调用中过期
- 给网络延迟留出缓冲时间
- 提供更好的用户体验（无感知刷新）

### Token 存储

**Keychain 存储格式**

```
Key: {appId}:{userOpenId}
Value: {
  "access_token": "u-xxx",
  "refresh_token": "ur-xxx",
  "expires_at": "2026-04-23T10:30:00Z",
  "refresh_expires_at": "2026-05-23T10:30:00Z",
  "token_type": "Bearer",
  "scope": "calendar:calendar:read im:message:send ..."
}
```

**跨平台支持**

| 平台 | 存储方式 | 说明 |
|------|--------|------|
| macOS | Keychain | 系统原生密钥链 |
| Linux | 加密文件 | `~/.lark-cli/keychain.db` (AES-256) |
| Windows | DPAPI + Registry | Windows 数据保护 API |

---

## 多应用管理

### 应用配置结构

```json
{
  "currentApp": "my-app-1",
  "previousApp": "my-app-2",
  "apps": {
    "my-app-1": {
      "appId": "cli_xxx",
      "appSecret": "***",
      "brand": "feishu",
      "lang": "zh",
      "users": [
        {
          "userOpenId": "ou_xxx",
          "userName": "张三"
        }
      ],
      "defaultAs": "ou_xxx"
    },
    "my-app-2": {
      "appId": "cli_yyy",
      "appSecret": "***",
      "brand": "lark",
      "lang": "en",
      "users": [
        {
          "userOpenId": "ou_yyy",
          "userName": "Li Si"
        }
      ],
      "defaultAs": "ou_yyy"
    }
  }
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

## 身份解析

### 身份类型

lark-cli 支持两种身份：

| 身份类型 | Token 来源 | 用途 | 权限范围 |
|---------|----------|------|--------|
| **User** | UAT (Device Flow) | 代表用户操作 | 用户权限 |
| **Bot** | TAT (App Credentials) | 代表应用操作 | 应用权限 |

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

## 权限管理

### 权限检查

```bash
# 检查是否有特定权限
$ lark-cli auth check --scope "calendar:calendar:read"
{
  "ok": true,
  "granted": ["calendar:calendar:read"],
  "missing": []
}

# 检查多个权限
$ lark-cli auth check --scope "calendar:calendar:read calendar:calendar:write"
{
  "ok": false,
  "granted": ["calendar:calendar:read"],
  "missing": ["calendar:calendar:write"],
  "suggestion": "lark-cli auth login --scope \"calendar:calendar:write\""
}
```

### 权限升级

```bash
# 升级权限
$ lark-cli auth login --scope "calendar:calendar:write"
[lark-cli] 打开浏览器访问: https://...
[lark-cli] 授权成功！
[lark-cli] 新权限: calendar:calendar:read calendar:calendar:write

# 验证权限已升级
$ lark-cli auth check --scope "calendar:calendar:write"
{
  "ok": true,
  "granted": ["calendar:calendar:write"],
  "missing": []
}
```

### 权限范围

常见权限范围：

```
# 日历
calendar:calendar:read          # 读取日历
calendar:calendar:write         # 编辑日历

# 消息
im:message:send                 # 发送消息
im:message:read                 # 读取消息

# 文档
drive:drive:read                # 读取云空间
drive:drive:write               # 编辑云空间

# 通讯录
contact:user:read               # 读取用户信息
contact:department:read         # 读取部门信息

# 离线访问
offline_access                  # 获取 refresh_token
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
