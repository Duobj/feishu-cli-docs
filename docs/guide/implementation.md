# 实现指南

## 代码架构

### 目录结构

```
cmd/auth/                          # 命令层
├── login.go                       # 登录命令实现
├── logout.go                      # 登出命令实现
├── status.go                      # 状态查询
├── check.go                       # 权限检查

internal/auth/                     # 认证核心库
├── device_flow.go                 # Device Flow 实现
├── token_store.go                 # Token 存储
├── scope.go                       # Scope 工具
├── verify.go                      # Token 验证

internal/credential/               # 凭证提供者
├── credential_provider.go         # 提供者链
├── default_provider.go            # 默认提供者

internal/core/                     # 配置管理
├── config.go                      # 配置加载/保存

internal/keychain/                 # 密钥链
├── keychain.go                    # 接口定义
├── keychain_darwin.go             # macOS 实现
├── keychain_linux.go              # Linux 实现
```

---

## 关键代码路径

### 登录命令执行路径

```
cmd/auth/login.go:authLoginRun()
    ├─ f.Config()
    ├─ RequestDeviceAuthorization()
    ├─ PollDeviceToken()
    ├─ getUserInfo()
    ├─ SetStoredToken()
    └─ syncLoginUserToProfile()
```

### Token 解析路径

```
API 调用
    ├─ Factory.ResolveAs()
    ├─ CredentialProvider.ResolveToken()
    ├─ GetStoredToken()
    └─ OS 密钥链
```

---

## 实现细节

### Device Flow 轮询算法

- 初始间隔：5 秒
- 最大间隔：60 秒
- 最大轮询次数：200 次
- 处理 slow_down 错误：间隔 +5 秒
- 处理 authorization_pending：继续轮询
- 处理 access_denied：立即返回错误

### Token 状态管理

```
valid (0 ~ ExpiresAt - 5min)
    ↓
needs_refresh (ExpiresAt - 5min ~ ExpiresAt)
    ├─ 自动刷新 → valid
    └─ 刷新失败 → expired
        ↓
expired (ExpiresAt ~ RefreshExpiresAt)
    ├─ 使用 refresh_token 刷新 → valid
    └─ refresh_token 也过期 → 需要重新登录
```

---

## 常见问题

### Q1: 如何在 CI/CD 中使用 lark-cli？

使用 `--no-wait` 模式获取 device_code：

```bash
DEVICE_CODE=$(lark-cli auth login --no-wait --json | jq -r '.device_code')
lark-cli auth login --device-code $DEVICE_CODE
```

或使用环境变量提供 Token：

```bash
export LARKSUITE_CLI_TOKEN="uat_xxx"
lark-cli calendar +agenda
```

### Q2: 如何处理 Token 过期？

系统会自动刷新 Token。如果刷新失败，会返回错误提示用户重新登录。

### Q3: 如何安全地存储 AppSecret？

不要在配置文件中存储 AppSecret。使用以下方式之一：

1. 环境变量：`export LARKSUITE_CLI_APP_SECRET="xxx"`
2. 密钥管理系统：`export LARKSUITE_CLI_APP_SECRET=$(vault kv get -field=secret secret/lark-cli)`
3. 自定义凭证提供者：实现 `extension/credential.Provider` 接口

---

## 性能优化

### Token 缓存
- Token 在内存中缓存（sync.Once）
- 避免重复的 Keychain 查询
- 单个 CLI 调用内有效

### 配置缓存
- 配置在内存中缓存
- 避免重复的文件 I/O

### HTTP 连接复用
- 使用 HTTP Keep-Alive
- 连接池管理