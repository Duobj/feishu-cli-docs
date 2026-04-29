# 实现指南

本文讲解 lark-cli 的代码架构、目录结构、关键实现细节和测试策略。

> 📖 **前置阅读**：建议先阅读 [鉴权系统详细解读](./architecture.md) 理解架构设计。

---

## 代码架构

### 目录结构

```
lark-cli/
├── cmd/                              # 命令层
│   ├── root.go                       # 根命令 + 全局标志注册
│   ├── auth/                         # 认证命令组
│   │   ├── login.go                  # Device Flow 登录
│   │   ├── logout.go                 # 登出 + 清理 Token
│   │   ├── status.go                 # 登录状态查询
│   │   └── check.go                  # 权限检查
│   ├── config/                       # 配置命令组
│   │   ├── init.go                   # 交互式初始化
│   │   ├── get.go                    # 读取配置项
│   │   └── set.go                    # 修改配置项
│   └── profile/                      # 应用管理命令组
│       ├── list.go                   # 列出所有应用
│       └── use.go                    # 切换活跃应用
│
├── internal/                         # 内部实现（不对外暴露）
│   ├── auth/                         # 认证核心库
│   │   ├── device_flow.go            # Device Flow 轮询算法
│   │   ├── token_store.go            # Token 持久化 + 密钥链交互
│   │   ├── scope.go                  # Scope 工具函数
│   │   └── verify.go                 # Token 有效性验证
│   │
│   ├── credential/                   # 凭证提供者系统
│   │   ├── provider.go               # Provider 接口定义
│   │   ├── provider_chain.go         # 提供者链（顺序调用）
│   │   └── default_provider.go       # 默认 Keychain 提供者
│   │
│   ├── core/                         # 核心基础设施
│   │   ├── config.go                 # 配置加载/保存
│   │   ├── atomic_write.go           # 原子文件写入
│   │   └── secret_resolve.go         # SecretInput 解析
│   │
│   ├── keychain/                     # OS 密钥链抽象
│   │   ├── keychain.go               # 通用接口
│   │   ├── keychain_darwin.go        # macOS Keychain 实现
│   │   ├── keychain_linux.go         # Linux Secret Service 实现
│   │   └── keychain_windows.go       # Windows Credential Manager 实现
│   │
│   └── output/                       # 错误处理与输出
│       ├── errors.go                 # 错误类型定义
│       ├── lark_errors.go            # 飞书 API 错误码映射
│       ├── exitcode.go               # 退出码定义
│       └── output.go                 # 输出格式化
│
├── shortcuts/                        # 快捷命令实现
│   ├── calendar/                     # Calendar 服务快捷命令
│   │   ├── agenda.go                 # +agenda
│   │   ├── create.go                 # +create
│   │   └── freebusy.go               # +freebusy
│   ├── contact/                      # Contact 服务快捷命令
│   │   └── search_user.go            # +search-user
│   └── im/                           # IM 服务快捷命令
│       └── send.go                   # +send
│
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

### 分层架构

```
┌─────────────────────────────────────────┐
│  cmd/                                    │  ← 命令入口 + CLI 交互
│  shortcuts/                              │  ← 快捷命令定义
├─────────────────────────────────────────┤
│  internal/auth/      认证逻辑            │
│  internal/credential/ 凭证提供者         │  ← 业务逻辑
│  internal/core/      配置 + 基础设施      │
│  internal/output/    错误处理与输出       │
├─────────────────────────────────────────┤
│  internal/keychain/    OS 密钥链         │  ← 平台抽象
├─────────────────────────────────────────┤
│  飞书 OpenAPI / OAuth 端点               │  ← 外部服务
└─────────────────────────────────────────┘
```

**设计原则**：
- `cmd/` 只负责 CLI 交互（解析参数、格式化输出），不含业务逻辑
- `internal/` 包含所有业务逻辑，外部项目无法 import
- `shortcuts/` 是声明式命令定义，框架负责执行
- 每层只依赖下层，不允许跨层调用

---

## 关键代码路径

### 登录命令执行路径

```
cmd/auth/login.go:authLoginRun()
    ├─ f.Config()                           # 加载配置
    ├─ auth.RequestDeviceAuthorization()    # 请求设备授权
    │   └─ POST /oauth2/v2/device_authorization
    │       → device_code, user_code, verification_uri
    ├─ 输出验证 URL 给用户
    ├─ auth.PollDeviceToken()               # 轮询 Token
    │   ├─ 初始间隔: 5s
    │   ├─ 最大间隔: 60s
    │   ├─ 最大次数: 200
    │   ├─ slow_down → 间隔 +5s
    │   ├─ authorization_pending → 继续
    │   └─ access_denied → 返回错误
    ├─ auth.GetUserInfo()                   # 获取用户信息
    ├─ tokenStore.SetStoredToken()           # 持久化 Token 到密钥链
    └─ core.SyncLoginUserToProfile()         # 更新配置中的用户信息
```

### Token 解析路径（API 调用时）

```
快捷命令执行
    ├─ Factory.ResolveAs(userType)          # 确定使用 User 还是 Bot 身份
    ├─ CredentialProviderChain.ResolveToken()
    │   ├─ Extension Provider 1             # 依次尝试每个提供者
    │   ├─ Extension Provider 2
    │   └─ Default Provider
    │       ├─ TokenStore.GetStoredToken()
    │       │   └─ Keychain.Get(service, account)
    │       └─ 检查 Token 状态
    │           ├─ valid → 直接返回
    │           ├─ needs_refresh → 刷新后返回
    │           └─ expired → 返回错误
    └─ HTTP Header: Authorization: Bearer {token}
```

### 快捷命令执行路径

```
root.go: Execute()
    ├─ 解析命令行参数
    ├─ 加载配置文件
    ├─ 匹配快捷命令（如 +agenda）
    ├─ 实例化 Shortcut struct
    ├─ 解析 flags → 绑定到 struct 字段
    ├─ 执行验证钩子（Validate()）
    ├─ DryRun 检查 → 如果是 dry-run，打印预览并返回
    ├─ 执行 Execute()
    │   ├─ ResolveToken()
    │   ├─ 构建 API 请求
    │   ├─ 调用 API
    │   ├─ 处理错误（分类 + 恢复建议）
    │   └─ 格式化输出
    └─ 返回
```

---

## 实现细节

### Device Flow 轮询算法

```go
func PollDeviceToken(ctx context.Context, deviceCode string) (*Token, error) {
    interval := 5 * time.Second
    maxInterval := 60 * time.Second
    maxAttempts := 200

    for i := 0; i < maxAttempts; i++ {
        select {
        case <-ctx.Done():
            return nil, ctx.Err()
        case <-time.After(interval):
            token, err := exchangeToken(deviceCode)
            switch {
            case err == nil:
                return token, nil
            case errors.Is(err, ErrSlowDown):
                interval += 5 * time.Second      // 服务端要求降速
            case errors.Is(err, ErrAuthorizationPending):
                // 继续等待，间隔不变
            case errors.Is(err, ErrAccessDenied):
                return nil, err                   // 用户拒绝，立即返回
            default:
                if interval < maxInterval {
                    interval *= 2                 // 指数退避，上限 60s
                }
            }
        }
    }
    return nil, ErrTimeout
}
```

### Token 状态管理

```
valid (0 ~ ExpiresAt - 5min)
    │  Token 有效，直接使用
    │  5min 缓冲窗口防止边界竞态
    ↓
needs_refresh (ExpiresAt - 5min ~ ExpiresAt)
    │  自动使用 refresh_token 刷新
    ├─ 刷新成功 → valid
    └─ 刷新失败 → expired
        ↓
expired (ExpiresAt ~ RefreshExpiresAt)
    │  access_token 已过期
    │  仍可用 refresh_token 换取新 token
    ├─ 刷新成功 → valid
    └─ refresh_token 也过期 → 需要重新登录
```

**并发安全**：Token 刷新使用 `sync.Mutex` 保护，避免多个 goroutine 同时刷新。

### 原子写入机制

```go
func AtomicWrite(path string, data []byte) error {
    tmpPath := path + ".tmp"

    // 1. 写入临时文件
    if err := os.WriteFile(tmpPath, data, 0600); err != nil {
        return err
    }

    // 2. 强制刷盘
    if err := syscall.Fsync(fd); err != nil {
        return err
    }

    // 3. 原子重命名
    return os.Rename(tmpPath, path)
}
```

**为什么不能直接用 `os.WriteFile`**：
- 如果进程在写入中途崩溃，原文件损坏
- 两个进程同时写入，内容交错
- 原子重命名保证读取方要么看到旧版本，要么看到新版本，不会看到半写版本

### 敏感数据保护

```go
// SecretInput 支持三种输入源
type SecretInput string

func (s SecretInput) Resolve() (string, error) {
    switch {
    case strings.HasPrefix(string(s), "@keychain:"):
        path := strings.TrimPrefix(string(s), "@keychain:")
        return keychain.Get(path)
    case strings.HasPrefix(string(s), "@env:"):
        varName := strings.TrimPrefix(string(s), "@env:")
        return os.Getenv(varName), nil
    case strings.HasPrefix(string(s), "@plain:"):
        return strings.TrimPrefix(string(s), "@plain:"), nil
    default:
        return string(s), nil
    }
}
```

**安全规则**：
- 配置文件中只存引用（`@keychain:xxx` 或 `@env:XXX`），不存明文密钥
- `@plain:` 前缀仅在开发环境使用，CI 中触发告警
- 日志输出自动屏蔽 `SecretInput` 类型的值

---

## 测试策略

### 测试金字塔

```
        /\
       /E2E\        少量（~10%）：真实 OAuth 端点
      /------\
     / 集成测试 \    中等（~30%）：模拟 HTTP + 真实文件系统
    /----------\
   /  单元测试    \   大量（~60%）：纯逻辑验证
  /--------------\
```

### 单元测试

**测试内容**：纯逻辑，Mock 所有外部依赖

```go
// Token 状态转换测试
func TestTokenStateTransition(t *testing.T) {
    tests := []struct {
        name      string
        token     *Token
        wantState TokenState
    }{
        {
            name:      "valid token",
            token:     &Token{ExpiresAt: time.Now().Add(1 * time.Hour)},
            wantState: StateValid,
        },
        {
            name:      "needs refresh (within 5min window)",
            token:     &Token{ExpiresAt: time.Now().Add(2 * time.Minute)},
            wantState: StateNeedsRefresh,
        },
        {
            name:      "expired",
            token:     &Token{ExpiresAt: time.Now().Add(-1 * time.Hour)},
            wantState: StateExpired,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := tt.token.State(); got != tt.wantState {
                t.Errorf("State() = %v, want %v", got, tt.wantState)
            }
        })
    }
}

// 参数验证测试（表驱动）
func TestValidateScope(t *testing.T) {
    tests := []struct {
        name    string
        scope   string
        wantErr bool
    }{
        {"valid", "calendar:events:write", false},
        {"empty", "", true},
        {"no colon", "invalidscope", true},
        {"too many parts", "a:b:c:d", true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidateScope(tt.scope)
            if (err != nil) != tt.wantErr {
                t.Errorf("ValidateScope(%q) error = %v, wantErr %v", tt.scope, err, tt.wantErr)
            }
        })
    }
}

// 错误分类测试
func TestLarkErrorMapping(t *testing.T) {
    tests := []struct {
        apiCode  string
        wantCode int
        wantType string
    }{
        {"230001", 2, "auth"},
        {"230002", 2, "permission"},
        {"999914", 2, "mfa"},
        {"500000", 4, "server_error"},
    }
    for _, tt := range tests {
        t.Run(tt.apiCode, func(t *testing.T) {
            err := MapLarkError(tt.apiCode, "test message")
            if err.Code != tt.wantCode {
                t.Errorf("Code = %d, want %d", err.Code, tt.wantCode)
            }
            if err.Type != tt.wantType {
                t.Errorf("Type = %s, want %s", err.Type, tt.wantType)
            }
        })
    }
}
```

### 集成测试

**测试内容**：真实文件系统、模拟 HTTP 服务、真实密钥链（测试环境）

```go
// 配置原子写入 + 读取一致性
func TestAtomicWriteAndRead(t *testing.T) {
    dir := t.TempDir()
    configPath := filepath.Join(dir, "config.json")

    cfg := &Config{
        Apps: map[string]App{
            "default": {AppID: "test-app", BaseURL: "https://api.example.com"},
        },
    }

    // 写入
    if err := cfg.Save(configPath); err != nil {
        t.Fatalf("Save() error = %v", err)
    }

    // 并发写入 + 读取（验证不会读到半写状态）
    var wg sync.WaitGroup
    for i := 0; i < 100; i++ {
        wg.Add(2)
        go func() { defer wg.Done(); cfg.Save(configPath) }()
        go func() { defer wg.Done(); LoadConfig(configPath) }()
    }
    wg.Wait()

    // 最终读取应该成功
    loaded, err := LoadConfig(configPath)
    if err != nil {
        t.Fatalf("LoadConfig() after concurrent writes error = %v", err)
    }
    if loaded.Apps["default"].AppID != "test-app" {
        t.Errorf("AppID = %s, want test-app", loaded.Apps["default"].AppID)
    }
}

// 凭证提供者链 fallback
func TestProviderChainFallback(t *testing.T) {
    provider1 := &mockProvider{err: errors.New("vault unreachable")}
    provider2 := &mockProvider{token: &Token{AccessToken: "test-token"}}

    chain := NewChain(provider1, provider2)
    token, err := chain.ResolveToken(context.Background())

    if err != nil {
        t.Fatalf("ResolveToken() error = %v", err)
    }
    if token.AccessToken != "test-token" {
        t.Errorf("AccessToken = %s, want test-token", token.AccessToken)
    }
}
```

### E2E 测试

**测试内容**：完整流程，使用模拟 OAuth 服务

```bash
#!/bin/bash
# e2e/test_login_flow.sh

# 启动模拟 OAuth 服务
docker run -d --name mock-oauth -p 8080:8080 mock-oauth-server

# 初始化
lark-cli config init --non-interactive \
    --app-id test-app \
    --app-secret test-secret

# 登录（使用 --no-wait 模式供 CI 使用）
DEVICE_CODE=$(lark-cli auth login --no-wait --json | jq -r '.device_code')
lark-cli auth login --device-code "$DEVICE_CODE"

# 验证状态
lark-cli auth status --json | jq -e '.state == "valid"'

# 执行快捷命令
lark-cli calendar +agenda --json | jq -e '.events'

# 清理
docker rm -f mock-oauth
```

### 测试覆盖率目标

| 模块 | 单元测试覆盖率 | 集成测试覆盖 |
|------|:---:|:---:|
| internal/auth | ≥ 90% | 核心流程 |
| internal/core | ≥ 85% | 原子操作 |
| internal/credential | ≥ 80% | 提供者链 |
| internal/errors | ≥ 95% | - |
| shortcuts | ≥ 75% | 每个命令的 E2E |

---

## 性能优化

### Token 缓存
- Token 在内存中缓存（`sync.Once`）
- 避免重复的 Keychain 查询（每次查询 ~10-50ms）
- 单个 CLI 调用内有效

### 配置缓存
- 配置文件仅在首次访问时读取
- 单次 CLI 调用中后续访问直接使用内存缓存
- 写入操作绕过缓存，直接操作文件

### HTTP 连接复用
- 使用全局 `http.Client` 实例
- 启用 HTTP Keep-Alive
- 连接池最大 100 个空闲连接
- 空闲连接超时 90 秒

### 并发查询优化
```go
// 信号量模式：限制并发数为 10
sem := make(chan struct{}, 10)
for _, query := range queries {
    sem <- struct{}{}
    go func(q Query) {
        defer func() { <-sem }()
        result, err := client.Do(q)
        // 收集结果
    }(query)
}
```

---

## 下一步

- [命令系统设计](./command-system.md) - 深入理解命令的组织方式和执行引擎
- [配置管理系统](./config-system.md) - 了解配置的加载、验证和原子写入
- [错误处理体系](./error-handling.md) - 掌握两层错误分类和恢复建议生成
- [快捷命令开发实战](./shortcut-development.md) - 动手开发一个新快捷命令
- [设计你自己的 CLI](./design-your-own-cli.md) - 把所有模式应用到你自己的项目中
