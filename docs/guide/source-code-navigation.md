# 源码导航指南

本文帮助开发者快速在 lark-cli 源码中找到关键设计的实现，从文档到代码的完整导航。

> 📖 **前置阅读**：建议先阅读相应的设计文档，然后用本指南定位源码实现。

---

## 认证流程源码导航

### 文件结构

```
cmd/auth/                          # 认证命令
├── login.go                        # 登录命令入口（250+ 行）
├── logout.go                       # 登出命令
├── status.go                       # 认证状态查询
└── check.go                        # 权限检查

internal/auth/                      # 认证核心实现
├── device_flow.go                  # Device Flow 实现（293 行）
├── token_store.go                  # Token 存储和刷新（80 行）
├── credential_provider.go          # 凭证提供者链
└── transport.go                    # HTTP 传输层

internal/keychain/                  # 密钥存储
├── keychain.go                     # Keychain 接口定义
├── keychain_darwin.go              # macOS 实现（319 行）
├── keychain_linux.go               # Linux 实现（AES-256-GCM）
└── keychain_windows.go             # Windows 实现（DPAPI）
```

### 核心代码路径

#### 1. 登录流程入口

**文件**: `cmd/auth/login.go`

```
main() 
  ↓
cmd.Execute()
  ↓
cmd/auth/login.go:Run()
  ├─ 解析权限范围
  ├─ 调用 RequestDeviceAuthorization()
  ├─ 显示验证 URL
  ├─ 轮询 PollDeviceToken()
  ├─ 获取用户信息
  └─ 保存 Token 到 Keychain
```

**关键函数**:
- `Run(ctx context.Context, f *core.Factory) error` - 登录命令主逻辑
- `requestDeviceAuthorization(ctx context.Context, ...) (*DeviceAuthResp, error)` - 请求设备授权
- `pollDeviceToken(ctx context.Context, ...) (*TokenResp, error)` - 轮询获取 Token

#### 2. Device Flow 实现

**文件**: `internal/auth/device_flow.go` (293 行)

```go
// Device Flow 核心结构
type DeviceFlow struct {
    clientID     string
    clientSecret string
    endpoint     string
}

// 关键方法
func (df *DeviceFlow) RequestAuthorization(ctx context.Context, scopes []string) (*DeviceAuthResp, error)
func (df *DeviceFlow) PollToken(ctx context.Context, deviceCode string, interval time.Duration) (*TokenResp, error)
```

**实现细节**:
- 支持 `slow_down` 错误处理（自动增加轮询间隔）
- 支持上下文取消（用户按 Ctrl+C）
- 支持网络重试（指数退避）
- 超时控制（240 秒）

**代码位置**:
- 初始间隔设置: 第 45 行
- slow_down 处理: 第 120 行
- 超时控制: 第 135 行

#### 3. Token 存储和刷新

**文件**: `internal/auth/token_store.go` (80 行)

```go
// Token 存储结构
type StoredToken struct {
    AccessToken  string    `json:"access_token"`
    RefreshToken string    `json:"refresh_token"`
    ExpiresAt    time.Time `json:"expires_at"`
}

// 关键方法
func (ts *TokenStore) Get(ctx context.Context, key string) (*StoredToken, error)
func (ts *TokenStore) Set(ctx context.Context, key string, token *StoredToken) error
func (ts *TokenStore) NeedsRefresh(token *StoredToken) bool  // 提前 5 分钟刷新
```

**Keychain 集成**:
- 密钥格式: `{appId}:{userOpenId}`
- 存储位置: macOS Keychain / Linux 加密文件 / Windows Registry
- 加密方式: AES-256-GCM（Linux）

#### 4. Keychain 实现

**文件**: `internal/keychain/keychain_darwin.go` (319 行)

```go
// macOS Keychain 实现
type DarwinKeychain struct {
    // 使用系统 Keychain API
}

func (k *DarwinKeychain) Set(key, value string) error
func (k *DarwinKeychain) Get(key string) (string, error)
func (k *DarwinKeychain) Remove(key string) error
```

**Linux 实现**: `keychain_linux.go`
- 使用 AES-256-GCM 加密
- 存储位置: `~/.lark-cli/keychain/`
- 文件格式: Base64 编码的加密数据

**关键代码**:
- 加密实现: 第 45-80 行
- 解密实现: 第 85-120 行
- 文件权限: 0600（仅所有者可读写）

### 调试技巧

```bash
# 查看 Token 存储位置
ls -la ~/.lark-cli/

# 查看 macOS Keychain 中的 Token
security find-generic-password -s "lark-cli" -a "cli_xxx:ou_yyy"

# 查看 Linux 加密文件
ls -la ~/.lark-cli/keychain/

# 启用调试日志
LARK_CLI_DEBUG=1 lark-cli auth login
```

---

## 配置系统源码导航

### 文件结构

```
internal/core/                     # 配置核心
├── config.go                       # 配置加载/保存（307+ 行）
├── secret_resolve.go               # 密钥解析（81 行）
├── factory.go                      # 依赖注入工厂
└── types.go                        # 配置数据结构

cmd/bootstrap.go                    # 启动阶段配置提取（31 行）

internal/vfs/                       # 文件系统抽象
└── localfileio/
    └── atomicwrite.go              # 原子写入实现
```

### 核心代码路径

#### 1. 配置加载流程

**文件**: `cmd/bootstrap.go` (31 行)

```
main()
  ↓
BootstrapInvocationContext()
  ├─ 提取 --profile 标志
  ├─ 设置到环境变量
  └─ 返回给 Factory
```

**关键函数**:
- `BootstrapInvocationContext(args []string) error` - 提取全局选项

**为什么两阶段启动？**
- 第一阶段（Bootstrap）: 提取 `--profile` 标志
- 第二阶段（Factory）: 加载对应应用的配置
- 确保配置提供者从一开始就看到正确的 profile

#### 2. 配置加载和保存

**文件**: `internal/core/config.go` (307+ 行)

```go
// 配置结构
type MultiAppConfig struct {
    StrictMode  *StrictMode `json:"strictMode"`
    CurrentApp  string      `json:"currentApp"`
    PreviousApp string      `json:"previousApp"`
    Apps        []AppConfig `json:"apps"`
}

// 关键方法
func LoadMultiAppConfig() (*MultiAppConfig, error)
func SaveMultiAppConfig(config *MultiAppConfig) error
```

**加载流程**:
1. 检查 `LARK_CONFIG_DIR` 环境变量
2. 默认位置: `~/.lark-cli/config.json`
3. 读取 JSON 文件
4. 验证结构（apps 非空）
5. 返回配置对象

**代码位置**:
- 环境变量检查: 第 45 行
- 默认路径: 第 50 行
- 文件读取: 第 55 行
- 验证逻辑: 第 70 行

#### 3. 原子写入实现

**文件**: `internal/vfs/localfileio/atomicwrite.go`

```go
// 原子写入流程
func AtomicWrite(path string, data []byte) error {
    // 1. 创建临时文件
    tmpFile, err := ioutil.TempFile(filepath.Dir(path), ".tmp")
    
    // 2. 写入数据
    _, err = tmpFile.Write(data)
    
    // 3. 设置权限（0600）
    os.Chmod(tmpFile.Name(), 0600)
    
    // 4. 同步到磁盘
    tmpFile.Sync()
    tmpFile.Close()
    
    // 5. 原子重命名
    return os.Rename(tmpFile.Name(), path)
}
```

**为什么需要原子写入？**
- 防止部分写入（进程崩溃时）
- 防止文件损坏（磁盘满或权限错误）
- 多进程安全（其他进程总是看到完整文件）

**代码位置**: 第 30-60 行

#### 4. 密钥解析

**文件**: `internal/core/secret_resolve.go` (81 行)

```go
// 密钥解析流程
func ResolveSecret(ref *SecretRef, keychain Keychain) (string, error) {
    if ref.Source == "keychain" {
        // 从 Keychain 读取
        return keychain.Get(ref.ID)
    }
    // 其他来源处理
}
```

**密钥格式**:
```json
{
  "appSecret": {
    "ref": {
      "source": "keychain",
      "id": "appsecret:cli_xxx"
    }
  }
}
```

### 调试技巧

```bash
# 查看配置文件
cat ~/.lark-cli/config.json | jq .

# 查看当前应用
lark-cli config show

# 查看所有应用
lark-cli profile list

# 验证配置有效性
lark-cli auth status
```

---

## 命令执行引擎源码导航

### 文件结构

```
cmd/
├── root.go                         # 根命令和全局错误处理（392 行）
├── bootstrap.go                    # 启动阶段配置提取（31 行）
├── global_flags.go                 # 全局标志定义
└── [service]/                      # 服务命令

shortcuts/common/                   # 快捷命令框架
├── runner.go                       # 运行时上下文（887 行）
├── types.go                        # Shortcut 和 Flag 定义
├── validate.go                     # 参数验证工具
└── common.go                       # 通用工具函数
```

### 核心代码路径

#### 1. 根命令和全局错误处理

**文件**: `cmd/root.go` (392 行)

```go
// 根命令结构
type RootCmd struct {
    factory *core.Factory
}

// 关键方法
func (r *RootCmd) Execute(ctx context.Context) error
func (r *RootCmd) handleRootError(err error) int  // 错误处理和 JSON 包装
```

**执行流程**:
```
Execute()
  ├─ BootstrapInvocationContext()
  ├─ NewDefault(Factory)
  ├─ 构建命令树
  ├─ Cobra.Execute()
  └─ handleRootError()
```

**全局错误处理**:
- 检查是否为 SecurityPolicyError
- 转换为 ExitError
- 应用错误增强
- 写入 JSON 信封到 stderr
- 返回退出码

**代码位置**:
- 错误处理: 第 280-350 行
- JSON 包装: 第 360-380 行

#### 2. 快捷命令运行时

**文件**: `shortcuts/common/runner.go` (887 行)

```go
// 运行时上下文
type RuntimeContext struct {
    // 参数访问
    Cmd *cobra.Command
    
    // API 客户端
    larkClient *lark.Client
    
    // 身份信息
    identity string
    account  *Account
}

// 关键方法
func (ctx *RuntimeContext) Str(name string) string
func (ctx *RuntimeContext) CallAPI(method, path string, query, body interface{}) (interface{}, error)
func (ctx *RuntimeContext) OutFormat(data interface{}, meta *output.Meta, prettyFn func(w io.Writer))
```

**执行管道**:
```
runShortcut()
  ├─ 身份解析 (resolveShortcutIdentity)
  ├─ 配置加载 (f.Config())
  ├─ 权限检查 (checkShortcutScopes)
  ├─ 运行时上下文创建 (newRuntimeContext)
  ├─ 枚举值验证 (validateEnumFlags)
  ├─ 输入标志解析 (resolveInputFlags)
  ├─ 自定义验证 (s.Validate)
  ├─ Dry-Run 处理 (handleShortcutDryRun)
  ├─ 高风险确认 (RequireConfirmation)
  ├─ 执行 (s.Execute)
  └─ 输出格式化
```

**代码位置**:
- 执行管道: 第 150-250 行
- 参数访问: 第 300-350 行
- API 调用: 第 400-500 行
- 输出格式化: 第 600-700 行

#### 3. 参数验证

**文件**: `shortcuts/common/validate.go`

```go
// 参数验证工具
func MutuallyExclusive(rt *RuntimeContext, flags ...string) error
func AtLeastOne(rt *RuntimeContext, flags ...string) error
func ExactlyOne(rt *RuntimeContext, flags ...string) error
func ValidatePageSize(rt *RuntimeContext, name string, def, min, max int) (int, error)
```

**使用示例**:
```go
Validate: func(ctx context.Context, runtime *common.RuntimeContext) error {
    if err := common.ExactlyOne(runtime, "flag1", "flag2"); err != nil {
        return err
    }
    return nil
}
```

#### 4. 权限检查

**文件**: `shortcuts/common/runner.go` - `checkShortcutScopes` 函数

```go
// 权限检查流程
func checkShortcutScopes(f *core.Factory, ctx context.Context, ...) error {
    // 1. 获取当前 Token
    token, err := f.ResolveToken(ctx, identity)
    
    // 2. 提取 Token 中的权限
    grantedScopes := extractScopes(token)
    
    // 3. 检查是否包含所有必需权限
    missing := findMissing(requiredScopes, grantedScopes)
    
    // 4. 如果缺少权限，返回错误并建议升级
    if len(missing) > 0 {
        return output.ErrWithHint(..., "missing scope(s): " + strings.Join(missing, ", "))
    }
}
```

**代码位置**: 第 450-500 行

### 调试技巧

```bash
# 显示快捷命令帮助
lark-cli calendar +create --help

# 显示将要执行的操作
lark-cli calendar +create --summary "Meeting" --start "2026-04-24T09:00:00Z" --end "2026-04-24T10:00:00Z" --dry-run

# 启用调试日志
LARK_CLI_DEBUG=1 lark-cli calendar +create --summary "Meeting" --start "2026-04-24T09:00:00Z" --end "2026-04-24T10:00:00Z"

# JSON 输出便于解析
lark-cli calendar +create --summary "Meeting" --start "2026-04-24T09:00:00Z" --end "2026-04-24T10:00:00Z" --format json | jq .
```

---

## 错误处理源码导航

### 文件结构

```
internal/output/                   # 错误处理
├── errors.go                       # 错误结构定义（136 行）
├── lark_errors.go                  # API 错误码映射（80 行）
├── exitcode.go                     # 退出码定义（17 行）
└── output.go                       # 输出格式化

cmd/root.go                         # 全局错误处理（第 280-380 行）
```

### 核心代码路径

#### 1. 错误结构定义

**文件**: `internal/output/errors.go` (136 行)

```go
// 错误结构
type ExitError struct {
    Code   int          // 退出码（0-5）
    Detail *ErrDetail   // 结构化错误信息
    Err    error        // 底层错误
    Raw    bool         // 是否跳过增强处理
}

type ErrDetail struct {
    Type       string      // 错误类型
    Code       int         // 飞书 API 错误码
    Message    string      // 用户友好的消息
    Hint       string      // 恢复建议
    ConsoleURL string      // 管理后台链接
    Detail     interface{} // 原始 API 错误详情
}

// 关键方法
func ErrValidation(msg string, args ...interface{}) error
func ErrAuth(msg string, args ...interface{}) error
func ErrAPI(code int, msg string, detail interface{}) error
func ErrWithHint(exitCode int, errType, message, hint string) error
```

**代码位置**:
- 错误结构: 第 10-40 行
- 错误构造函数: 第 50-100 行
- JSON 序列化: 第 110-136 行

#### 2. 退出码定义

**文件**: `internal/output/exitcode.go` (17 行)

```go
const (
    ExitOK         = 0  // 成功
    ExitAPI        = 1  // API 错误
    ExitValidation = 2  // 参数验证失败
    ExitAuth       = 3  // 认证失败
    ExitNetwork    = 4  // 网络错误
    ExitInternal   = 5  // 内部错误
)
```

#### 3. API 错误码映射

**文件**: `internal/output/lark_errors.go` (80 行)

```go
// 错误码映射
var LarkErrorCodeMap = map[int]string{
    99991661: "token_missing",
    99991671: "token_format_error",
    99991668: "token_invalid_or_expired",
    99991663: "access_token_invalid",
    99991677: "token_expired",
    99991672: "app_permission_not_enabled",
    99991676: "token_missing_scope",
    99991679: "user_not_authorized",
    // ... 更多错误码
}

// 关键方法
func ClassifyLarkError(code int) string
func GetLarkErrorMessage(code int) string
```

**代码位置**: 第 10-80 行

#### 4. 权限错误增强

**文件**: `cmd/root.go` - `enhancePermissionError` 函数

```go
// 权限错误增强流程
func enhancePermissionError(exitErr *output.ExitError, ...) *output.ExitError {
    // 1. 检查是否为权限错误
    if exitErr.Detail.Type != "permission" {
        return exitErr
    }
    
    // 2. 提取所需权限
    requiredScopes := extractScopes(exitErr.Detail.Detail)
    
    // 3. 生成管理后台链接
    consoleURL := buildConsoleURL(appID, requiredScopes)
    
    // 4. 生成恢复建议
    hint := fmt.Sprintf(
        "run `lark-cli auth login --scope \"%s\"`",
        strings.Join(requiredScopes, " "),
    )
    
    // 5. 返回增强的错误
    exitErr.Detail.ConsoleURL = consoleURL
    exitErr.Detail.Hint = hint
    return exitErr
}
```

**代码位置**: `cmd/root.go` 第 320-360 行

#### 5. 全局错误处理

**文件**: `cmd/root.go` - `handleRootError` 方法

```go
// 全局错误处理流程
func (r *RootCmd) handleRootError(err error) int {
    // 1. 检查是否为 SecurityPolicyError
    if secErr, ok := err.(*SecurityPolicyError); ok {
        // 处理安全策略错误
        return handleSecurityPolicyError(secErr)
    }
    
    // 2. 转换为 ExitError
    exitErr := toExitError(err)
    
    // 3. 应用错误增强
    if !exitErr.Raw {
        exitErr = enhanceError(exitErr)
    }
    
    // 4. 写入 JSON 信封到 stderr
    writeErrorEnvelope(exitErr)
    
    // 5. 返回退出码
    return exitErr.Code
}
```

**代码位置**: `cmd/root.go` 第 280-350 行

### 调试技巧

```bash
# 查看错误详情
lark-cli calendar +create --summary "Meeting" --start "invalid" --end "2026-04-24T10:00:00Z" 2>&1 | jq .

# 查看权限错误
lark-cli calendar +create --summary "Meeting" --start "2026-04-24T09:00:00Z" --end "2026-04-24T10:00:00Z" 2>&1 | jq '.error'

# 查看退出码
lark-cli calendar +create --summary "Meeting" --start "invalid" --end "2026-04-24T10:00:00Z"
echo $?  # 显示退出码
```

---

## 快速导航表

| 功能 | 文件 | 行数 | 关键函数 |
|------|------|------|---------|
| 登录 | `cmd/auth/login.go` | 250+ | `Run()` |
| Device Flow | `internal/auth/device_flow.go` | 293 | `RequestAuthorization()`, `PollToken()` |
| Token 存储 | `internal/auth/token_store.go` | 80 | `Get()`, `Set()`, `NeedsRefresh()` |
| Keychain (macOS) | `internal/keychain/keychain_darwin.go` | 319 | `Set()`, `Get()`, `Remove()` |
| 配置加载 | `internal/core/config.go` | 307+ | `LoadMultiAppConfig()`, `SaveMultiAppConfig()` |
| 原子写入 | `internal/vfs/localfileio/atomicwrite.go` | - | `AtomicWrite()` |
| 根命令 | `cmd/root.go` | 392 | `Execute()`, `handleRootError()` |
| 快捷命令运行时 | `shortcuts/common/runner.go` | 887 | `runShortcut()`, `RuntimeContext` |
| 参数验证 | `shortcuts/common/validate.go` | - | `ExactlyOne()`, `AtLeastOne()` |
| 错误结构 | `internal/output/errors.go` | 136 | `ErrValidation()`, `ErrAPI()` |
| 错误码映射 | `internal/output/lark_errors.go` | 80 | `ClassifyLarkError()` |
| 退出码 | `internal/output/exitcode.go` | 17 | 常量定义 |

---

## 学习路径

### 初级：理解整体架构

1. 阅读 `cmd/root.go` - 理解命令执行流程
2. 阅读 `cmd/bootstrap.go` - 理解两阶段启动
3. 阅读 `internal/output/exitcode.go` - 理解退出码

**预计时间**: 30 分钟

### 中级：深入理解认证和配置

1. 阅读 `internal/auth/device_flow.go` - 学习 Device Flow
2. 阅读 `internal/core/config.go` - 学习配置管理
3. 阅读 `internal/keychain/keychain_darwin.go` - 学习密钥存储

**预计时间**: 2 小时

### 高级：掌握快捷命令框架

1. 阅读 `shortcuts/common/runner.go` - 学习运行时上下文
2. 阅读 `shortcuts/common/validate.go` - 学习参数验证
3. 阅读具体快捷命令实现（如 `shortcuts/calendar/calendar_create.go`）

**预计时间**: 3 小时

---

## 相关资源

- [鉴权系统详细解读](./architecture.md) - 认证系统设计
- [配置管理系统](./config-system.md) - 配置系统设计
- [命令系统设计](./command-system.md) - 命令系统设计
- [错误处理体系](./error-handling.md) - 错误处理设计
- [快捷命令开发实战](./shortcut-development.md) - 快捷命令开发指南
- [GitHub 源码](https://github.com/larksuite/cli) - 完整源码

---

## 下一步

- 选择一个感兴趣的模块，按照导航路径阅读源码
- 尝试修改一个快捷命令或添加新功能
- 在 GitHub 上提交 Pull Request
