# 错误处理体系

本文讲解 lark-cli 如何设计和实现错误处理系统，包括错误分类、退出码、错误增强、权限错误处理、API 错误映射等核心设计模式。

> 📖 **前置阅读**：建议先阅读 [命令系统设计](./command-system.md) 了解 CLI 架构。

---

## 错误处理系统概览

lark-cli 的错误处理需要解决以下问题：

| 问题 | 解决方案 |
|------|--------|
| 错误分类 | 两层分类：粗粒度退出码 + 细粒度错误类型 |
| API 错误映射 | 40+ 飞书错误码映射到用户友好的消息 |
| 权限错误 | 自动提取所需权限，生成升级命令 |
| 安全策略 | 特殊处理安全策略错误（MFA、访问控制） |
| 错误恢复 | 为每个错误提供可操作的建议 |
| 结构化输出 | 统一的 JSON 错误信封 |

---

## 错误分类系统

### 两层分类模型

lark-cli 使用**两层分类**来平衡机器可读性和人类可读性：

**第一层：退出码（Exit Code）**
- 粗粒度分类，用于脚本判断
- 范围：0-5

**第二层：错误类型（Error Type）**
- 细粒度分类，用于 JSON 输出
- 范围：permission、auth、validation、api_error、network 等

### 退出码

```go
const (
    ExitOK         = 0  // 成功
    ExitAPI        = 1  // API 错误（权限、未找到、冲突、限流等）
    ExitValidation = 2  // 参数验证失败
    ExitAuth       = 3  // 认证失败（Token 无效/过期）
    ExitNetwork    = 4  // 网络错误（连接超时、DNS 失败）
    ExitInternal   = 5  // 内部错误（不应该发生）
)
```

### 错误类型

```
permission          # 权限不足
auth                # 认证失败
validation          # 参数验证失败
api_error           # API 错误
network             # 网络错误
config              # 配置错误
app_status          # 应用状态错误
rate_limit          # 限流
conflict            # 冲突
not_found           # 未找到
cross_tenant_unit   # 跨租户/单元
cross_brand         # 跨品牌
```

### 错误结构

```go
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
```

---

## 飞书 API 错误码映射

### 认证错误

| 错误码 | 含义 | 处理方式 |
|--------|------|--------|
| 99991661 | Token 缺失 | 提示登录 |
| 99991671 | Token 格式错误 | 提示重新登录 |
| 99991668 | Token 无效/过期 | 提示重新登录 |
| 99991663 | Access Token 无效 | 提示重新登录 |
| 99991677 | Token 已过期 | 提示刷新或重新登录 |

### 权限错误

| 错误码 | 含义 | 处理方式 |
|--------|------|--------|
| 99991672 | 应用权限未启用 | 提示管理员在后台启用 |
| 99991676 | Token 缺少所需权限 | 提示用户重新授权 |
| 99991679 | 用户未授权 | 提示用户重新授权 |
| 230027 | 用户未授权 | 提示用户重新授权 |

### 应用状态错误

| 错误码 | 含义 | 处理方式 |
|--------|------|--------|
| 99991543 | AppID/Secret 错误 | 检查配置 |
| 99991662 | 应用已禁用/未安装 | 检查开发者后台 |
| 99991673 | 应用状态不可用 | 稍后重试 |

### 刷新 Token 错误

| 错误码 | 含义 | 处理方式 |
|--------|------|--------|
| 20026 | Refresh Token 无效 | 重新登录 |
| 20037 | Refresh Token 已过期 | 重新登录 |
| 20064 | Refresh Token 已撤销 | 重新登录 |
| 20073 | Refresh Token 已使用 | 重新登录 |
| 20050 | 刷新服务器错误 | 可重试 |

### 其他错误

| 错误码 | 含义 | 处理方式 |
|--------|------|--------|
| 99991400 | 限流 | 稍后重试 |
| 1061045 | 资源竞争 | 稍后重试 |
| 1064510 | 跨租户/单元不支持 | 检查操作范围 |
| 1064511 | 跨品牌不支持 | 检查操作范围 |

---

## 错误增强系统

### 权限错误增强

权限错误是最常见的错误，lark-cli 对其进行特殊处理：

```
API 返回权限错误
  ├─ 提取所需权限
  ├─ 生成管理后台链接
  ├─ 根据身份生成恢复建议
  └─ 返回增强的错误信息
```

#### 权限错误增强流程

```go
func enrichPermissionError(apiErr *LarkError) *ErrDetail {
    // 1. 提取所需权限
    requiredScopes := extractScopes(apiErr.Detail)
    
    // 2. 根据错误码判断类型
    if apiErr.Code == 99991672 {
        // 应用权限未启用 → 管理员需要在后台启用
        return &ErrDetail{
            Type:    "permission",
            Code:    apiErr.Code,
            Message: "应用权限未启用",
            Hint:    "请管理员在开发者后台启用所需权限",
            ConsoleURL: buildConsoleURL(requiredScopes),
        }
    } else if apiErr.Code == 99991679 {
        // 用户未授权 → 用户需要重新授权
        return &ErrDetail{
            Type:    "permission",
            Code:    apiErr.Code,
            Message: "用户未授权",
            Hint:    fmt.Sprintf(
                "run `lark-cli auth login --scope \"%s\"`",
                strings.Join(requiredScopes, " "),
            ),
            ConsoleURL: buildConsoleURL(requiredScopes),
        }
    }
    
    return nil
}
```

#### 权限错误示例

**场景 1：应用权限未启用**

```json
{
  "ok": false,
  "identity": "bot",
  "error": {
    "type": "permission",
    "code": 99991672,
    "message": "应用权限未启用",
    "hint": "请管理员在开发者后台启用所需权限",
    "console_url": "https://open.feishu.cn/page/scope-apply?app_id=cli_xxx&scopes=calendar:calendar.event:read"
  }
}
```

**场景 2：用户权限不足**

```json
{
  "ok": false,
  "identity": "user",
  "error": {
    "type": "permission",
    "code": 99991679,
    "message": "用户未授权",
    "hint": "run `lark-cli auth login --scope \"calendar:calendar.event:read\"`",
    "console_url": "https://open.feishu.cn/page/scope-apply?app_id=cli_xxx&scopes=calendar:calendar.event:read"
  }
}
```

### 其他错误增强

**认证错误**
```json
{
  "ok": false,
  "error": {
    "type": "auth",
    "code": 99991668,
    "message": "Token 已过期",
    "hint": "run `lark-cli auth login` to re-authorize"
  }
}
```

**参数验证错误**
```json
{
  "ok": false,
  "error": {
    "type": "validation",
    "code": 0,
    "message": "invalid date format: expected ISO 8601, got \"2026-13-01\"",
    "hint": "Example: 2026-04-24T09:00:00Z"
  }
}
```

**网络错误**
```json
{
  "ok": false,
  "error": {
    "type": "network",
    "code": 0,
    "message": "connection timeout",
    "hint": "please check your network connection and try again"
  }
}
```

---

## 安全策略错误处理

### 安全策略错误类型

飞书支持安全策略（如 MFA、IP 白名单等），违反策略时返回特殊错误：

| 错误码 | 含义 | 处理方式 |
|--------|------|--------|
| 21000 | 需要挑战（MFA/验证） | 打开挑战 URL |
| 21001 | 访问被拒绝 | 显示拒绝原因 |

### 安全策略错误处理

```go
type SecurityPolicyError struct {
    Code         string  // "challenge_required" | "access_denied"
    Message      string
    ChallengeURL string  // 用户需要打开的 URL
    Hint         string
    Retryable    bool
}
```

### 安全策略错误输出

```json
{
  "ok": false,
  "error": {
    "type": "auth_error",
    "code": "challenge_required",
    "message": "需要完成身份验证",
    "challenge_url": "https://...",
    "hint": "请打开上述链接完成验证，然后重试",
    "retryable": true
  }
}
```

### 安全策略错误处理流程

```
HTTP 响应
  ├─ 检查响应码是否为 21000 或 21001
  ├─ 如果是，解析为 SecurityPolicyError
  ├─ 验证 challenge_url 是 HTTPS
  ├─ 返回特殊错误信封
  └─ 用户打开 URL 完成验证后重试
```

---

## 错误恢复建议

### 按错误类型的恢复建议

| 错误类型 | 恢复建议 |
|---------|--------|
| auth | `lark-cli auth login` 重新授权 |
| permission | 检查应用权限或重新授权 |
| config | 检查 app_id/app_secret：`lark-cli config set` |
| app_status | 应用已禁用或未安装，检查开发者后台 |
| rate_limit | 请稍后重试 |
| conflict | 请稍后重试，避免并发重复请求 |
| cross_tenant_unit | 在同一租户和地域/单元内操作 |
| cross_brand | 在同一品牌环境内操作 |
| network | 检查网络连接后重试 |

### 恢复建议生成

```go
func generateHint(errType string, errCode int, detail interface{}) string {
    switch errType {
    case "auth":
        return "run `lark-cli auth login` to re-authorize"
    case "permission":
        if scopes := extractScopes(detail); len(scopes) > 0 {
            return fmt.Sprintf(
                "run `lark-cli auth login --scope \"%s\"`",
                strings.Join(scopes, " "),
            )
        }
        return "check app permissions or re-authorize"
    case "config":
        return "check app_id / app_secret: lark-cli config set"
    case "app_status":
        return "app is disabled or not installed — check developer console"
    case "rate_limit":
        return "please try again later"
    case "conflict":
        return "please retry later and avoid concurrent duplicate requests"
    case "cross_tenant_unit":
        return "operate on source and target within the same tenant and region/unit"
    case "cross_brand":
        return "operate on source and target within the same brand environment"
    case "network":
        return "please check your network connection and try again"
    default:
        return ""
    }
}
```

---

## 错误输出格式

### 成功响应

```json
{
  "ok": true,
  "identity": "user",
  "data": {
    "events": [...]
  },
  "meta": {
    "count": 10
  },
  "_notice": {
    "update": {
      "version": "1.0.13",
      "url": "https://github.com/larksuite/cli/releases/tag/v1.0.13"
    }
  }
}
```

### 错误响应

```json
{
  "ok": false,
  "identity": "user",
  "error": {
    "type": "permission",
    "code": 99991679,
    "message": "用户未授权",
    "hint": "run `lark-cli auth login --scope \"calendar:calendar.event:read\"`",
    "console_url": "https://open.feishu.cn/page/scope-apply?...",
    "detail": {
      "permission_violations": [
        {
          "scope": "calendar:calendar.event:read",
          "reason": "user_not_authorized"
        }
      ]
    }
  },
  "_notice": {...}
}
```

### 安全策略错误响应

```json
{
  "ok": false,
  "error": {
    "type": "auth_error",
    "code": "challenge_required",
    "message": "需要完成身份验证",
    "challenge_url": "https://...",
    "hint": "请打开上述链接完成验证，然后重试",
    "retryable": true
  }
}
```

---

## 错误处理最佳实践

### 1. 错误构造

```go
// ✓ 好：使用错误构造函数
return output.ErrAPI(99991679, "user not authorized", detail)

// ✗ 不好：直接返回 error
return fmt.Errorf("permission denied")
```

### 2. 错误分类

```go
// ✓ 好：明确分类
if isValidationError(err) {
    return output.ErrValidation("invalid parameter: %v", err)
} else if isAuthError(err) {
    return output.ErrAuth("authentication failed: %v", err)
} else if isNetworkError(err) {
    return output.ErrNetwork("network error: %v", err)
}

// ✗ 不好：混淆分类
return output.ErrAPI(0, fmt.Sprintf("error: %v", err), nil)
```

### 3. 错误增强

```go
// ✓ 好：提供恢复建议
return output.ErrWithHint(
    output.ExitAuth,
    "auth",
    "token expired",
    "run `lark-cli auth login` to re-authorize",
)

// ✗ 不好：没有恢复建议
return output.ErrAuth("token expired")
```

### 4. 权限错误处理

```go
// ✓ 好：提取权限并生成升级命令
if isPermissionError(err) {
    scopes := extractRequiredScopes(err)
    hint := fmt.Sprintf(
        "run `lark-cli auth login --scope \"%s\"`",
        strings.Join(scopes, " "),
    )
    return output.ErrWithHint(
        output.ExitAPI,
        "permission",
        err.Message,
        hint,
    )
}

// ✗ 不好：通用权限错误消息
return output.ErrAPI(err.Code, "permission denied", nil)
```

### 5. 错误日志

```go
// ✓ 好：记录完整错误信息用于调试
log.Debugf("API error: code=%d, message=%s, detail=%v",
    err.Code, err.Message, err.Detail)

// ✗ 不好：不记录错误
// 用户无法调试
```

### 6. 错误恢复

```go
// ✓ 好：提供可重试的错误
if isRetryableError(err) {
    return output.ErrWithHint(
        output.ExitAPI,
        "rate_limit",
        "rate limit exceeded",
        "please try again later",
    )
}

// ✗ 不好：所有错误都当作不可重试
return output.ErrAPI(err.Code, err.Message, nil)
```

---

## 错误处理流程

### 命令执行错误处理

```
命令执行
  ├─ 业务逻辑
  │  └─ 返回 error
  │
  ├─ 根命令处理器
  │  ├─ 检查是否为 SecurityPolicyError
  │  ├─ 转换为 ExitError
  │  ├─ 应用错误增强
  │  ├─ 写入错误信封到 stderr
  │  └─ 返回退出码
  │
  └─ 进程退出
```

### 错误增强流程

```
ExitError
  ├─ 检查 Raw 标志
  ├─ 如果 Raw=true，跳过增强
  ├─ 否则应用增强
  │  ├─ 权限错误 → 提取权限、生成链接
  │  ├─ 认证错误 → 生成登录建议
  │  ├─ 其他错误 → 生成通用建议
  │  └─ 添加系统通知
  │
  └─ 返回增强的错误信息
```

---

## 实战：实现自己的错误处理系统

### 步骤 1：定义错误类型

```go
type ErrorType string

const (
    ErrorTypeValidation ErrorType = "validation"
    ErrorTypeAuth       ErrorType = "auth"
    ErrorTypePermission ErrorType = "permission"
    ErrorTypeAPI        ErrorType = "api_error"
    ErrorTypeNetwork    ErrorType = "network"
)

type AppError struct {
    Type    ErrorType
    Code    int
    Message string
    Hint    string
    Detail  interface{}
}
```

### 步骤 2：定义退出码

```go
const (
    ExitOK         = 0
    ExitAPI        = 1
    ExitValidation = 2
    ExitAuth       = 3
    ExitNetwork    = 4
)

func (e *AppError) ExitCode() int {
    switch e.Type {
    case ErrorTypeValidation:
        return ExitValidation
    case ErrorTypeAuth:
        return ExitAuth
    case ErrorTypeNetwork:
        return ExitNetwork
    default:
        return ExitAPI
    }
}
```

### 步骤 3：实现错误构造函数

```go
func NewValidationError(msg string) *AppError {
    return &AppError{
        Type:    ErrorTypeValidation,
        Message: msg,
        Hint:    "check your input parameters",
    }
}

func NewAuthError(msg string) *AppError {
    return &AppError{
        Type:    ErrorTypeAuth,
        Message: msg,
        Hint:    "run `myapp auth login` to re-authorize",
    }
}

func NewPermissionError(msg string, requiredScopes []string) *AppError {
    hint := fmt.Sprintf(
        "run `myapp auth login --scope \"%s\"`",
        strings.Join(requiredScopes, " "),
    )
    return &AppError{
        Type:    ErrorTypePermission,
        Message: msg,
        Hint:    hint,
    }
}
```

### 步骤 4：实现错误输出

```go
func (e *AppError) MarshalJSON() ([]byte, error) {
    return json.Marshal(map[string]interface{}{
        "ok": false,
        "error": map[string]interface{}{
            "type":    e.Type,
            "code":    e.Code,
            "message": e.Message,
            "hint":    e.Hint,
            "detail":  e.Detail,
        },
    })
}

func (e *AppError) String() string {
    return fmt.Sprintf("[%s] %s\nHint: %s", e.Type, e.Message, e.Hint)
}
```

### 步骤 5：在命令中使用

```go
func (cmd *MyCommand) Run(ctx context.Context) error {
    // 参数验证
    if cmd.Name == "" {
        return NewValidationError("name is required")
    }
    
    // 权限检查
    if !hasPermission(ctx, "write") {
        return NewPermissionError(
            "insufficient permissions",
            []string{"resource:write"},
        )
    }
    
    // 业务逻辑
    if err := doSomething(ctx); err != nil {
        if isAuthError(err) {
            return NewAuthError(err.Error())
        }
        return NewAPIError(err)
    }
    
    return nil
}
```

---

## 常见错误处理模式

### 模式 1：错误链传播

```go
// ✓ 好：保留错误链
if err := callAPI(); err != nil {
    return fmt.Errorf("failed to call API: %w", err)
}

// ✗ 不好：丢失错误链
if err := callAPI(); err != nil {
    return fmt.Errorf("failed to call API")
}
```

### 模式 2：错误分类

```go
// ✓ 好：根据错误类型分类处理
if err := callAPI(); err != nil {
    if isPermissionError(err) {
        return NewPermissionError(err.Error(), extractScopes(err))
    } else if isAuthError(err) {
        return NewAuthError(err.Error())
    }
    return NewAPIError(err)
}

// ✗ 不好：统一处理所有错误
if err := callAPI(); err != nil {
    return NewAPIError(err)
}
```

### 模式 3：错误恢复

```go
// ✓ 好：提供恢复建议
if err := callAPI(); err != nil {
    if isRateLimitError(err) {
        return &AppError{
            Message: "rate limit exceeded",
            Hint:    "please try again in 60 seconds",
        }
    }
    return err
}

// ✗ 不好：没有恢复建议
if err := callAPI(); err != nil {
    return err
}
```

---

## 相关资源

- [命令系统设计](./command-system.md) - CLI 命令架构
- [配置管理系统](./config-system.md) - 配置设计
- [实现指南](./implementation.md) - 代码架构详解
- [源码位置](https://github.com/larksuite/cli/tree/main/internal/output) - GitHub 仓库

---

## 下一步

- [快捷命令开发实战](./shortcut-development.md) - 动手开发一个新快捷命令
- [Calendar 服务开发指南](./calendar-service-guide.md) - 深入学习服务特定开发模式
- 源码参考：[错误类型定义](https://github.com/larksuite/cli/blob/main/internal/output/errors.go)、[API 错误映射](https://github.com/larksuite/cli/blob/main/internal/output/lark_errors.go)
