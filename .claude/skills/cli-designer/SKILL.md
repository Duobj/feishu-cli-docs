---
name: cli-designer
description: 设计并实现业务服务 CLI。当用户想为自己的业务服务创建 CLI 工具、需要设计命令行界面、或说"帮我做一个 CLI"时使用。
argument-hint: [业务描述]
---

# CLI Designer

引导用户一步步设计并实现自己的业务服务 CLI。参照 lark-cli 架构模式，适用于 Go + Cobra 技术栈。

## 工作流

按以下 7 步推进，每步完成后请用户确认再继续。

### 第 0 步：需求调研

先问清楚三个问题：

1. **你的服务是什么？** 提供哪些 API？（比如：订单管理、用户系统、内容发布）
2. **用户怎么认证？** API Key / OAuth / Token / 无认证？
3. **最核心的 3 个操作是什么？** 用户最常做的事情

根据答案，规划命令结构。

### 第 1 步：设计命令结构

输出两组命令：

**系统命令**（子命令层级）：
```
mycli
├── auth login          # 认证
├── auth status         # 状态查询
├── config init         # 初始化配置
└── config list         # 列出配置
```

**业务快捷命令**（`+` 前缀，声明式）：
```
mycli
├── order +create       # 创建订单
├── order +search       # 搜索订单
└── report +weekly      # 周报
```

设计原则：一个快捷命令只做一件事，命名使用业务词汇。

### 第 2 步：搭建鉴权系统

根据用户的认证方式，选择对应方案：

| 认证方式 | 实现要点 |
|---------|---------|
| OAuth Device Flow | 适合 CLI，无需浏览器回调。三步：RequestDeviceAuth → 展示验证码 → PollToken |
| API Key | 最简单，从环境变量或配置文件读取 |
| Token 直接提供 | CI/CD 场景，通过环境变量注入 |

生成核心代码：Device Flow 轮询算法、Token 生命周期管理（valid → needs_refresh → expired）、密钥链安全存储。

### 第 3 步：设计配置系统

输出配置文件结构和关键实现：

```json
{
  "current_profile": "default",
  "profiles": [
    {
      "name": "default",
      "base_url": "https://api.example.com",
      "api_key": "@keychain:mycli/api-key"
    }
  ],
  "preferences": {
    "output_format": "json"
  }
}
```

关键模式：
- **原子写入**：临时文件 → 同步 → 重命名
- **SecretInput 联合类型**：`@keychain:path` / `@env:VAR` / `@plain:text`
- **无缓存加载**：每次读取直接解析文件，避免多进程并发不一致

### 第 4 步：构建错误处理系统

生成两层错误分类：

**退出码**（给脚本用）：
```go
const (
    ExitOK         = 0  // 成功
    ExitAPI        = 1  // API / 通用错误
    ExitValidation = 2  // 参数验证失败
    ExitAuth       = 3  // 认证失败
    ExitNetwork    = 4  // 网络错误
    ExitInternal   = 5  // 内部错误
)
```

**错误类型**（给用户看）：每种错误必须有 `code` + `type` + `message` + `recovery`（恢复建议）。

### 第 5 步：实现快捷命令框架

生成一个声明式快捷命令的完整示例。核心理念：用 struct 标签定义命令，框架负责执行。

```go
type CreateOrderShortcut struct {
    ProductID string `flag:"product-id" required:"true" desc:"产品 ID"`
    Quantity  int    `flag:"quantity" default:"1" desc:"数量"`
    DryRun    bool   `flag:"dry-run" desc:"预览模式"`
}

func (s *CreateOrderShortcut) Execute(ctx context.Context) error {
    // 1. 解析 Token
    // 2. 构建请求
    // 3. 调用 API
    // 4. 处理错误
    // 5. 格式化输出
}
```

### 第 6 步：生成项目骨架

输出完整目录结构：

```
mycli/
├── cmd/                  # 命令入口
│   ├── root.go
│   └── auth/
│       ├── login.go
│       └── status.go
├── internal/
│   ├── auth/             # 认证逻辑
│   ├── core/             # 配置管理
│   └── output/           # 错误处理
├── shortcuts/            # 快捷命令
├── go.mod
├── Makefile
└── README.md
```

生成关键文件的完整代码。

### 第 7 步：打包与发布

输出 Makefile 构建脚本、GoReleaser 配置、一键安装脚本 `install.sh`。

---

## 设计模式速查

以下模式来自 lark-cli，适用于任何业务服务 CLI：

| 模式 | 使用场景 |
|------|---------|
| **提供者链** | 多种密钥来源，按序尝试 |
| **声明式框架** | 用 struct 标签定义命令 |
| **Device Flow** | 无需浏览器的 OAuth |
| **原子写入** | 配置文件安全写入 |
| **两层错误** | 退出码（脚本）+ 类型（用户） |
| **递归分割** | 处理 API 时间/数量限制 |
| **信号量并发** | 批量 API 调用的并发控制 |
| **事务回滚** | 多步写操作的失败恢复 |

---

## 技术栈

- **语言**：Go
- **CLI 框架**：Cobra（`github.com/spf13/cobra`）
- **配置**：JSON + OS 密钥链
- **构建**：GoReleaser + GitHub Actions

如果用户偏好其他语言（Python/Click、Rust/clap、Node.js/oclif），适配对应技术栈。

## 注意事项

- 每步输出代码后，确认用户满意再继续
- 敏感信息（Token、密钥）绝不硬编码
- 第一个版本只做核心流程，不要过度设计
- 每个快捷命令必须支持 `--help`、`--json`、`--dry-run`
