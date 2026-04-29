# 设计你自己的业务服务 CLI

本文是 lark-cli 文档体系的**综合实战指南**。前面各章讲解了 lark-cli 每个模块怎么设计的，本章把所有模式串起来，手把手带你设计一套自己的业务服务 CLI。

> 📖 **前置阅读**：建议已完成中级学习路径（架构 + 命令系统 + 配置系统 + 错误处理 + 快捷命令开发）。

---

## 总体设计思路

设计一套业务服务 CLI，核心是回答四个问题：

| 问题 | 对应模块 | 关键决策 |
|------|---------|---------|
| 用户是谁？怎么认证？ | 鉴权系统 | OAuth / API Key / SSO |
| 能做什么？怎么组织？ | 命令系统 | 传统命令 vs 快捷命令 |
| 怎么配置？配置存哪？ | 配置系统 | JSON / YAML / 环境变量 |
| 出错了怎么办？ | 错误处理 | 退出码分类 / 错误恢复 |

下面按开发顺序，一步步完成设计。

---

## 第一步：定义命令结构

### 1.1 确定命令类型

一个好的业务服务 CLI 通常组合两类命令：

**传统命令**（子命令层级结构）：系统级操作
```
your-cli
├── auth login / logout / status    # 认证
├── config init / get / set          # 配置
└── profile list / use               # 环境管理
```

**快捷命令**（`+` 前缀，声明式）：业务操作
```
your-cli
├── user +search                     # 搜索用户
├── order +create                    # 创建订单
├── report +weekly                   # 周报生成
└── notify +send                     # 发送通知
```

### 1.2 快捷命令的设计准则

从 lark-cli 的快捷命令系统（见 [命令系统设计](./command-system.md)）提炼出以下准则：

```
一个快捷命令 = 名称 + 标志 + 验证 + 执行 + 输出
```

**命名规范**：
- 使用动词：`+search`、`+create`、`+list`
- 使用业务词汇：`+agenda`（而不是 `+list-events --type=agenda`）
- 一个快捷命令只做一件事

**标志设计**：
```
类型层次：string > int > bool > enum > datetime > file
输入来源：命令行参数 > 文件 > stdin > 环境变量
```

**设计检查清单**：
- [ ] 命令名是否直观？
- [ ] 必选参数是否已设为 required？
- [ ] 是否有合理默认值？
- [ ] 是否支持 `--json` 输出？
- [ ] 是否支持 `--dry-run` 预览？

### 1.3 实战：定义你的前 3 个快捷命令

以订单服务为例：

```go
// 快捷命令 1：创建订单
type CreateOrderShortcut struct {
    ProductID string `flag:"product-id" required:"true" desc:"产品 ID"`
    Quantity  int    `flag:"quantity" default:"1" desc:"数量"`
    DryRun    bool   `flag:"dry-run" desc:"预览模式，不实际创建"`
}

// 快捷命令 2：搜索订单
type SearchOrderShortcut struct {
    Status   string `flag:"status" enum:"pending,shipped,delivered" desc:"订单状态"`
    FromDate string `flag:"from" desc:"开始日期 (YYYY-MM-DD)"`
    Limit     int    `flag:"limit" default:"20" desc:"返回数量"`
}

// 快捷命令 3：订单报表
type OrderReportShortcut struct {
    Period string `flag:"period" enum:"daily,weekly,monthly" default:"weekly"`
    Format string `flag:"format" enum:"table,json,csv" default:"table"`
}
```

---

## 第二步：搭建鉴权系统

### 2.1 选择认证方式

| 场景 | 推荐方式 | 关键考量 |
|------|---------|---------|
| 交互式用户 | OAuth Device Flow | 无需浏览器回调 |
| AI Agent / CI | 环境变量 Token | 无交互 |
| 内部工具 | API Key | 简单直接 |
| 企业应用 | OAuth + 服务账号 | 多身份 |

lark-cli 使用 **OAuth Device Flow**（见 [鉴权系统详细解读](./architecture.md)），适合以下场景：
- 用户需要在终端完成认证
- 支持无人值守自动化（`--no-wait` 模式）
- 支持 Bot（租户）和 User 两种身份

### 2.2 实现 Device Flow

核心三步：

```
1. RequestDeviceAuthorization()
   POST /oauth/device/authorize
   → 返回 device_code, user_code, verification_uri

2. 展示验证 URL 给用户
   "请打开 https://example.com/activate 输入验证码 XXXX-XXXX"

3. PollToken()
   初始间隔 5s，最大间隔 60s
   处理 slow_down（+5s）/ authorization_pending（继续）/ access_denied（停止）
```

### 2.3 Token 生命周期管理

```
valid (0 ~ ExpiresAt - 5min)
    ↓ 自动刷新
needs_refresh (ExpiresAt - 5min ~ ExpiresAt)
    ↓ 刷新失败
expired (ExpiresAt ~ RefreshExpiresAt)
    ↓ refresh_token 也过期
需要重新登录
```

**关键实现细节**：
- Token 刷新设置 5 分钟缓冲窗口，避免边界竞态
- refresh_token 过期后引导用户重新登录，而非静默失败
- CI/CD 场景使用环境变量注入 Token，跳过 Device Flow

### 2.4 安全存储

使用 OS 原生密钥链（见 [凭证提供者系统](./credential-providers.md)）：

```
存储层级：
1. 密钥链（macOS Keychain / Linux Secret Service / Windows Credential Manager）
   → 存储 Token、AppSecret
2. 配置文件（JSON）
   → 存储应用配置、用户偏好（不存储密钥）
3. 环境变量
   → CI/CD 覆盖
```

**设计原则**：
- 密钥永不落盘（明文）
- 配置文件可版本控制（敏感字段引用密钥链，用 `SecretInput` 联合类型）
- 支持自定义提供者（AWS Secrets Manager、Vault 等）

### 2.5 凭证提供者链

```
Extension Provider 1 → Extension Provider 2 → ... → Default Provider
       (Vault)               (AWS SM)                   (Keychain)
```

每个提供者只需实现：
```go
type Provider interface {
    Name() string                                                   // 提供者名称
    ResolveAccount(ctx context.Context) (*Account, error)           // 解析账户
    ResolveToken(ctx context.Context, req TokenSpec) (*Token, error) // 解析 Token
}
```

返回约定：返回 `nil, nil` 表示跳过，由下一提供者继续；返回 `nil, &BlockError{}` 则阻止后续提供者。

**为什么要用链？**
- 不同环境用不同的密钥来源（开发用 Keychain，生产用 Vault）
- 提供者按注册顺序依次尝试，找到有效凭证就返回
- 新增提供者只需实现接口，零侵入

---

## 第三步：设计配置系统

### 3.1 配置结构设计

一个良好的业务服务 CLI 配置分为三层：

```json
{
  "apps": {
    "default": {
      "app_id": "xxx",
      "app_secret": "@keychain:lark-cli/app-secret",
      "base_url": "https://api.example.com"
    },
    "staging": {
      "app_id": "yyy",
      "app_secret": "@env:STAGING_APP_SECRET",
      "base_url": "https://api-staging.example.com"
    }
  },
  "users": {
    "default": {
      "access_token": "@keychain:lark-cli/default/token",
      "user_type": "user"
    }
  },
  "preferences": {
    "output_format": "json",
    "color": true
  }
}
```

### 3.2 关键设计决策

**1. 原子写入**（见 [配置管理系统](./config-system.md)）
```
写入流程：临时文件 → 同步到磁盘 → 原子重命名
原因：防止写入中断导致配置文件损坏
```

**2. 无缓存加载**
```
每次读取直接解析文件，不维护内存缓存
原因：支持多个 CLI 进程并发访问，避免缓存不一致
```

**3. 敏感数据的 SecretInput 联合类型**
```go
type SecretInput string
// 支持三种来源：
// "@keychain:path"        → 从 OS 密钥链读取
// "@env:VAR_NAME"          → 从环境变量读取
// "@plain:text"            → 直接存储（不安全，仅开发环境）
```

### 3.3 多环境策略

| 策略 | 实现方式 | 适用场景 |
|------|---------|---------|
| 多应用配置 | `apps: [{ name: "default" }, { name: "staging" }]` | 同一 CLI 连接多个环境 |
| 配置文件覆盖 | 环境变量 `YOUR_CLI_CONFIG` 指定路径 | CI/CD 不同配置 |
| Profile 切换 | `your-cli profile use staging` | 快速切换 |

---

## 第四步：构建错误处理系统

### 4.1 错误分类

采用**两层分类模型**（见 [错误处理体系](./error-handling.md)）：

**第一层 - 退出码**（给脚本用）：
```
0  → 成功
1  → API / 通用错误（权限、未找到、冲突、限流等）
2  → 参数验证失败
3  → 认证失败（Token 无效/过期）
4  → 网络错误（连接超时、DNS 失败）
5  → 内部错误（不应发生，如 panic）
```

**第二层 - 细粒度错误类型**（给用户看）：
```
PermissionError  → 权限不足 + 自动提取所需 scope + 生成升级命令
AuthError        → Token 过期 + 建议重新登录
ValidationError  → 参数错误 + 指出具体哪个参数
APIError         → API 返回错误码 + 映射为用户友好消息
NetworkError     → 连接失败 + 重试建议
```

### 4.2 错误输出格式

统一 JSON 信封模式：
```json
{
  "error": {
    "code": 2,
    "type": "permission",
    "message": "需要权限: calendar:events:write",
    "recovery": {
      "suggestion": "运行以下命令升级权限",
      "command": "your-cli auth login --scope calendar:events:write"
    }
  }
}
```

**每条错误必须包含**：
- `code`：退出码
- `type`：错误类型
- `message`：用户友好消息
- `recovery`：恢复建议（suggestion + 可执行的命令）

### 4.3 API 错误码映射

```go
var apiErrorMap = map[string]UserError{
    "230001": {Code: 2, Message: "Token 无效或已过期", Recovery: "请运行 auth login"},
    "230002": {Code: 2, Message: "权限不足",          Recovery: "请运行 auth login --scope <scope>"},
    "999914": {Code: 2, Message: "需要 MFA 验证",     Recovery: "请通过安全设置完成验证"},
    "500000": {Code: 4, Message: "服务暂时不可用",    Recovery: "请稍后重试"},
}
```

---

## 第五步：连接业务 API

### 5.1 API 客户端设计

```go
type Client struct {
    BaseURL       string
    TokenProvider credential.Provider
    HTTPClient    *http.Client
}

func (c *Client) Do(ctx context.Context, method, path string, body interface{}) (*Response, error) {
    token, err := c.TokenProvider.ResolveToken(ctx)
    if err != nil {
        return nil, &AuthError{Message: "获取 Token 失败", Cause: err}
    }

    req, _ := http.NewRequestWithContext(ctx, method, c.BaseURL+path, body)
    req.Header.Set("Authorization", "Bearer "+token.AccessToken)

    resp, err := c.HTTPClient.Do(req)
    // 处理 401 → 刷新 Token 重试
    // 处理 403 → 权限错误
    // 处理 429 → 限速，指数退避
    // 处理 5xx → 重试
    return parseResponse(resp)
}
```

### 5.2 处理 API 限制

lark-cli 的 Calendar 服务展示了处理 API 限制的经典模式（见 [Calendar 服务开发指南](./calendar-service-guide.md)）：

**递归分割查询**（处理时间范围限制）：
```
API 限制：每次查询最大 40 天
你的需求：查一年

策略：二分分割
120 天 → 60 天 × 2 → 30 天 × 4 → 15 天 × 8
每个 30 天段都符合 40 天限制
```

**并发控制**（处理速率限制）：
```
信号量模式：10 个工作线程
→ 去重 → 排序 → 合并返回
```

### 5.3 通用的 API 调用模式

| 模式 | 描述 | 使用场景 |
|------|------|---------|
| 分页遍历 | 自动处理 cursor/offset | 列表查询 |
| 重试 + 退避 | 指数退避，最多 3 次 | 网络抖动 |
| 并发 + 合并 | 信号量限制并发，合并结果 | 批量查询 |
| 事务回滚 | 失败时撤销已执行操作 | 写操作链 |
| 幂等键 | 客户端生成唯一 key | 防止重复创建 |

---

## 第六步：测试策略

### 6.1 测试金字塔

```
        /\
       /E2E\        少量端到端测试（真实 API 环境）
      /------\
     / 集成测试 \    中等数量（模拟服务 + 真实配置）
    /----------\
   /  单元测试    \   大量（纯逻辑，无外部依赖）
  /--------------\
```

### 6.2 各层测试要点

**单元测试**：
- Token 生命周期状态转换
- 参数验证逻辑
- 错误分类逻辑
- 输出格式转换（JSON/Table/CSV）

**集成测试**：
- 配置文件读写 + 原子性验证
- Token 存储 + 密钥链交互
- 凭证提供者链的 fallback 行为
- HTTP 客户端的重试逻辑

**E2E 测试**：
- 完整 Device Flow 登录流程（用模拟 OAuth 端点）
- 快捷命令端到端执行
- 多身份切换场景

### 6.3 关键测试模式

```go
// 1. 表驱动测试（参数验证）
func TestValidateProductID(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        wantErr bool
    }{
        {"valid", "PROD-12345", false},
        {"empty", "", true},
        {"too long", strings.Repeat("x", 101), true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := validateProductID(tt.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("validateProductID(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
            }
        })
    }
}

// 2. 接口 Mock（凭证提供者）
type mockProvider struct {
    token *Token
    err   error
}
func (m *mockProvider) ResolveToken(ctx context.Context) (*Token, error) {
    return m.token, m.err
}

// 3. HTTP Mock（API 客户端）
// 使用 httptest.NewServer 模拟 API 响应
```

---

## 第七步：打包与分发

### 7.1 目录结构模板

```
your-cli/
├── cmd/                    # 命令入口
│   ├── root.go            # 根命令
│   └── auth/              # 认证命令组
│       ├── login.go
│       └── status.go
├── internal/
│   ├── auth/              # 认证核心逻辑
│   │   ├── device_flow.go
│   │   └── token_store.go
│   ├── core/
│   │   └── config.go      # 配置管理
│   ├── credential/        # 凭证提供者
│   │   └── provider.go
│   └── errors/
│       ├── codes.go       # 退出码定义
│       └── recovery.go    # 错误恢复建议
├── shortcuts/             # 快捷命令定义
│   ├── user_search.go
│   └── order_create.go
├── go.mod
├── Makefile
└── README.md
```

### 7.2 发布检查清单

- [ ] 所有快捷命令有 `--help` 文档
- [ ] 支持 `--json` / `--format table` 输出
- [ ] 敏感信息不打印到日志
- [ ] 配置文件有合理默认值
- [ ] 错误消息包含恢复建议
- [ ] 支持 `--dry-run` 预览模式
- [ ] 支持 `--no-color` 无颜色输出
- [ ] 二进制支持 `--version`
- [ ] 提供一键安装脚本

### 7.3 一键安装脚本

```bash
#!/bin/bash
# install.sh
VERSION=$(curl -s https://api.github.com/repos/your-org/your-cli/releases/latest | jq -r .tag_name)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
URL="https://github.com/your-org/your-cli/releases/download/${VERSION}/your-cli_${OS}_${ARCH}.tar.gz"
curl -sL $URL | tar xz -C /usr/local/bin
echo "your-cli ${VERSION} 安装完成"
```

---

## 设计模式速查表

以下模式在 lark-cli 各个模块中出现，可以直接复用到你的项目：

| 模式 | 出处 | 一句话描述 | 何时使用 |
|------|------|-----------|---------|
| **提供者链** | [凭证提供者](./credential-providers.md) | 多个提供者按顺序尝试，找到第一个有效结果 | 多种密钥来源、多级缓存 |
| **声明式框架** | [命令系统](./command-system.md) | 用 struct 标签声明命令定义，框架负责执行 | 大量结构相似的命令 |
| **Device Flow** | [鉴权系统](./architecture.md) | 无需浏览器回调的 OAuth 流程 | CLI 工具、无头环境 |
| **中间件管道** | [命令系统](./command-system.md) | 命令执行前后插入通用逻辑 | 日志、权限检查、限速 |
| **联合类型** | [配置系统](./config-system.md) | 一个字段支持多种输入源 | 敏感数据跨环境管理 |
| **原子写入** | [配置系统](./config-system.md) | 临时文件→同步→重命名 | 配置、状态文件 |
| **两层错误** | [错误处理](./error-handling.md) | 退出码（给脚本）+ 细粒度类型（给用户） | 所有 CLI 工具 |
| **递归分割** | [Calendar 指南](./calendar-service-guide.md) | 二分分割大数据查询以适应 API 限制 | 有时间/数量限制的 API |
| **信号量并发** | [Calendar 指南](./calendar-service-guide.md) | 固定数量的工作线程并发查询 | 批量 API 调用 |
| **事务回滚** | [Calendar 指南](./calendar-service-guide.md) | 失败时撤销已执行操作 | 多步写操作 |
| **错误恢复** | [错误处理](./error-handling.md) | 错误附带升级命令 | 权限不足、Token 过期 |
| **元数据驱动** | [命令系统](./command-system.md) | 从 API 元数据自动生成命令 | 大量服务命令 |

---

## 开发路线图

按以下顺序逐步构建你的 CLI：

```
第 1 周：项目骨架
  ├── 初始化 go module
  ├── 搭建命令框架（root.go + 子命令注册）
  ├── 实现 auth login/logout（最简单的认证）
  └── 实现 config init/get

第 2 周：核心功能
  ├── 实现完整 Device Flow
  ├── 实现 Token 存储（先文件，后密钥链）
  ├── 实现第一个快捷命令（+search）
  └── 实现 JSON/Table 双格式输出

第 3 周：健壮性
  ├── 实现错误分类 + 恢复建议
  ├── 实现凭证提供者链
  ├── 实现配置原子写入
  └── 添加 3-5 个快捷命令

第 4 周：打磨
  ├── 编写测试（单元 + 集成）
  ├── 编写文档
  ├── 打包脚本 + CI/CD
  └── 发布第一个版本
```

---

## 下一步

完成本文学习后：
- **实践**：用本文的模板开始搭建你自己的 CLI 项目
- **参考**：遇到具体问题时查阅 [命令系统设计](./command-system.md)、[配置管理系统](./config-system.md)、[错误处理体系](./error-handling.md) 的详细内容
- **深入**：研究 [Calendar 服务开发指南](./calendar-service-guide.md) 了解真实的服务开发案例
- **对照**：使用 [源码导航指南](./source-code-navigation.md) 对照 lark-cli 的实际源码实现
