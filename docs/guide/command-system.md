# 命令系统设计

本文讲解 lark-cli 如何设计和实现命令系统，包括命令组织、参数处理、执行流程等核心设计模式。这些模式可以直接应用到你自己的 CLI 项目中。

> 📖 **前置阅读**：建议先阅读 [实现指南](./implementation.md) 了解代码架构。

---

## 命令系统概览

lark-cli 采用**分层命令架构**，将命令分为三类：

```
lark-cli
├─ 传统命令（Traditional Commands）
│  ├─ config      # 配置管理
│  ├─ auth        # 认证
│  ├─ profile     # 应用管理
│  └─ api         # 通用 API 调用
│
├─ 服务命令（Service Commands）
│  ├─ calendar list-events
│  ├─ contact search-user
│  └─ doc get-content
│  （从 API 元数据动态生成）
│
└─ 快捷命令（Shortcuts）
   ├─ calendar +agenda
   ├─ contact +search-user
   ├─ im +send
   └─ doc +fetch
   （高频操作的简化接口）
```

---

## 命令组织架构

### 目录结构

```
cmd/
├── auth/              # 认证命令
│   ├── login.go
│   ├── logout.go
│   ├── status.go
│   └── check.go
├── config/            # 配置命令
├── profile/           # 应用管理
├── api/               # 通用 API 命令
├── service/           # 服务命令（动态生成）
├── bootstrap.go       # 全局标志预解析
├── global_flags.go    # 全局标志定义
└── root.go            # 根命令

shortcuts/
├── register.go        # 快捷命令聚合与注册
├── common/            # 共享工具
│   ├── types.go       # 快捷命令数据结构
│   └── runner.go      # 执行框架
├── calendar/          # 日历快捷命令
├── contact/           # 联系人快捷命令
├── doc/               # 文档快捷命令
├── im/                # 消息快捷命令
└── [其他服务]/        # 其他服务快捷命令
```

### 设计原则

**1. 按服务域组织**
- 每个服务（calendar、contact、doc 等）对应一个目录
- 同一服务的所有命令集中管理
- 便于扩展新服务

**2. 分离关注点**
- 传统命令：系统级操作（auth、config）
- 服务命令：通用 API 操作（自动生成）
- 快捷命令：高频业务操作（手工优化）

**3. 声明式定义**
- 命令定义为数据结构，不是代码
- 框架处理通用逻辑（认证、权限、输出）
- 业务逻辑集中在 Execute 函数

---

## 快捷命令系统

### 快捷命令定义

快捷命令是 lark-cli 的核心创新，使用 `+` 前缀表示：

```go
// shortcuts/calendar/calendar_agenda.go
var CalendarAgenda = common.Shortcut{
    // 基本信息
    Service:     "calendar",
    Command:     "+agenda",
    Description: "查看日历日程（默认今天）",
    
    // 风险等级（影响是否需要确认）
    Risk:        "read",  // "read" | "write" | "high-risk-write"
    
    // 权限范围
    Scopes:      []string{"calendar:calendar.event:read"},
    UserScopes:  []string{"calendar:calendar.event:read"},
    BotScopes:   []string{"calendar:calendar.event:read"},
    
    // 支持的身份
    AuthTypes:   []string{"user", "bot"},
    
    // 参数定义
    Flags: []common.Flag{
        {
            Name:     "start",
            Type:     "string",
            Desc:     "开始时间（ISO 8601 格式）",
            Required: false,
        },
        {
            Name:     "end",
            Type:     "string",
            Desc:     "结束时间（ISO 8601 格式）",
            Required: false,
        },
        {
            Name:    "calendar-id",
            Type:    "string",
            Desc:    "日历 ID（默认：主日历）",
            Default: "primary",
        },
    },
    
    // 自动注入标志
    HasFormat:   true,  // 自动添加 --format 标志
    
    // 业务逻辑钩子
    DryRun: func(ctx context.Context, runtime *Runtime) *DryRunAPI {
        // 返回将要执行的 API 调用
        return &DryRunAPI{
            Method: "GET",
            Path:   "/calendar/v4/calendars/primary/events",
            Params: map[string]string{
                "start_time": runtime.GetFlag("start"),
                "end_time":   runtime.GetFlag("end"),
            },
        }
    },
    
    Validate: func(ctx context.Context, runtime *Runtime) error {
        // 参数验证
        start := runtime.GetFlag("start")
        if start != "" {
            if _, err := time.Parse(time.RFC3339, start); err != nil {
                return fmt.Errorf("invalid start time: %w", err)
            }
        }
        return nil
    },
    
    Execute: func(ctx context.Context, runtime *Runtime) error {
        // 主业务逻辑
        client := runtime.LarkClient()
        
        events, err := client.Calendar.ListEvents(ctx, &calendar.ListEventsReq{
            CalendarId: runtime.GetFlag("calendar-id"),
            StartTime:  runtime.GetFlag("start"),
            EndTime:    runtime.GetFlag("end"),
        })
        if err != nil {
            return err
        }
        
        // 输出结果
        return runtime.OutFormat(events, nil, formatAgenda)
    },
}
```

### 快捷命令的优势

| 特性 | 传统命令 | 快捷命令 |
|------|--------|--------|
| 定义方式 | 代码 | 数据结构 |
| 参数处理 | 手工 | 自动 |
| 权限检查 | 手工 | 自动 |
| 输出格式 | 手工 | 自动 |
| 错误处理 | 手工 | 自动 |
| 代码行数 | 200+ | 50-100 |

### 快捷命令注册流程

```
shortcuts/register.go
  ├─ 聚合所有服务的快捷命令
  │  ├─ calendar.Shortcuts()
  │  ├─ contact.Shortcuts()
  │  ├─ doc.Shortcuts()
  │  └─ ...
  │
  ├─ 按服务分组
  │  ├─ calendar: [+agenda, +create, ...]
  │  ├─ contact: [+search-user, ...]
  │  └─ ...
  │
  └─ 挂载到命令树
     ├─ 查找或创建服务命令
     ├─ 为每个快捷命令创建 Cobra 命令
     └─ 注册参数和执行函数
```

---

## 参数处理系统

### 参数定义

参数通过声明式结构定义，支持多种类型和验证：

```go
type Flag struct {
    Name     string      // 参数名
    Type     string      // 类型：string | bool | int | string_array
    Default  string      // 默认值
    Desc     string      // 描述
    Hidden   bool        // 是否隐藏
    Required bool        // 是否必需
    Enum     []string    // 枚举值（用于验证）
    Input    []string    // 输入方式：["file", "stdin"]
}
```

### 参数类型

**基础类型**
```bash
# string
lark-cli calendar +agenda --start "2026-04-24T09:00:00Z"

# bool
lark-cli calendar +agenda --all-day

# int
lark-cli contact +search-user --limit 10

# string_array
lark-cli doc +fetch --fields "title,content,updated_at"
```

**特殊输入方式**
```bash
# 从文件读取
lark-cli im +send --text @message.txt

# 从标准输入读取
echo "Hello" | lark-cli im +send --text -

# 枚举值验证
lark-cli calendar +agenda --order "asc"  # ✓
lark-cli calendar +agenda --order "invalid"  # ✗ 错误
```

### 参数解析流程

```
命令行输入
  ├─ 预解析全局标志（--profile）
  ├─ 加载配置
  ├─ 解析快捷命令参数
  ├─ 验证枚举值
  ├─ 解析输入标志（@file、-）
  ├─ 执行自定义验证
  └─ 传递给业务逻辑
```

---

## 命令执行流程

### 完整执行链

```
main()
  ├─ cmd.Execute()
  │
  ├─ BootstrapInvocationContext()
  │  └─ 提取 --profile 标志
  │
  ├─ NewDefault(Factory)
  │  └─ 创建依赖注入容器
  │
  ├─ 构建命令树
  │  ├─ AddCommand(config)
  │  ├─ AddCommand(auth)
  │  ├─ AddCommand(api)
  │  ├─ RegisterServiceCommands()
  │  └─ RegisterShortcuts()
  │
  ├─ Cobra.Execute()
  │  └─ 路由到对应命令
  │
  └─ handleRootError()
     └─ 错误处理和 JSON 包装
```

### 快捷命令执行链

```
runShortcut()
  ├─ 解析身份
  │  └─ --as > config.defaultAs > 自动检测
  │
  ├─ 加载配置
  │  └─ 从 config.json 读取
  │
  ├─ 检查权限范围
  │  └─ 验证 Token 是否有所需权限
  │
  ├─ 创建执行上下文
  │  └─ RuntimeContext（提供 API 客户端、参数访问等）
  │
  ├─ 验证参数
  │  ├─ 枚举值验证
  │  ├─ 文件/stdin 解析
  │  └─ 自定义验证钩子
  │
  ├─ 处理 --dry-run
  │  └─ 显示将要执行的 API 调用
  │
  ├─ 高风险操作确认
  │  └─ high-risk-write 需要用户确认
  │
  ├─ 执行业务逻辑
  │  └─ Shortcut.Execute()
  │
  └─ 格式化输出
     └─ JSON | NDJSON | Table | CSV
```

### 执行上下文（RuntimeContext）

快捷命令执行时获得一个 RuntimeContext，提供便利的 API：

```go
type Runtime struct {
    // 参数访问
    GetFlag(name string) string
    GetFlagInt(name string) int
    GetFlagBool(name string) bool
    GetFlagArray(name string) []string
    
    // API 客户端
    LarkClient() *lark.Client
    HttpClient() *http.Client
    
    // 身份信息
    Identity() string  // "user" | "bot"
    Account() *Account
    
    // 输出
    OutFormat(data interface{}, meta interface{}, formatter Formatter) error
    OutJSON(data interface{}) error
    OutTable(data interface{}, columns []string) error
    
    // 日志
    Log(msg string)
    Logf(format string, args ...interface{})
}
```

---

## 输出格式系统

### 支持的格式

```bash
# JSON（默认）
lark-cli calendar +agenda --format json

# 换行分隔的 JSON（流式处理）
lark-cli calendar +agenda --format ndjson

# 表格（人类可读）
lark-cli calendar +agenda --format table

# CSV（数据导出）
lark-cli calendar +agenda --format csv
```

### JSON 包装格式

所有输出都被包装在统一的 JSON 信封中：

```json
{
  "ok": true,
  "identity": "user",
  "data": {
    "events": [
      {
        "id": "event_123",
        "title": "Team Meeting",
        "start_time": "2026-04-24T09:00:00Z"
      }
    ]
  },
  "meta": {
    "count": 1,
    "total": 100,
    "page": 1
  },
  "_notice": {
    "update": {
      "version": "1.0.13",
      "url": "https://github.com/larksuite/cli/releases/tag/v1.0.13"
    }
  }
}
```

### 自定义格式化

快捷命令可以定义自定义格式化函数

```go
func formatAgenda(data interface{}) string {
    events := data.([]*calendar.Event)
    
    var buf strings.Builder
    buf.WriteString("┌─────────────────────────────────────┐\n")
    buf.WriteString("│ 今天的日程                          │\n")
    buf.WriteString("├─────────────────────────────────────┤\n")
    
    for _, event := range events {
        buf.WriteString(fmt.Sprintf("│ %s - %s  %s\n",
            event.StartTime.Format("15:04"),
            event.EndTime.Format("15:04"),
            event.Title,
        ))
    }
    
    buf.WriteString("└─────────────────────────────────────┘\n")
    return buf.String()
}
```

---

## 错误处理系统

### 错误分类

```go
type ExitError struct {
    Code   int          // 退出码
    Detail *ErrDetail   // 结构化错误信息
    Err    error        // 底层错误
}

type ErrDetail struct {
    Type       string      // 错误类型
    Code       int         // 飞书 API 错误码
    Message    string      // 错误消息
    Hint       string      // 用户友好的提示
    ConsoleURL string      // 管理后台链接
    Detail     interface{} // 原始 API 错误详情
}
```

### 错误类型和退出码

| 错误类型 | 退出码 | 示例 | 处理方式 |
|---------|--------|------|--------|
| Validation | 2 | 参数格式错误 | 显示参数提示 |
| Auth | 3 | Token 过期 | 提示重新登录 |
| Permission | 3 | 权限不足 | 显示所需权限和升级命令 |
| Network | 4 | 网络错误 | 显示重试提示 |
| API | 1 | 服务器错误 | 显示错误详情 |

### 权限错误增强

权限错误会自动提取所需权限并生成升级命令：

```json
{
  "ok": false,
  "identity": "user",
  "error": {
    "type": "permission",
    "code": 99991679,
    "message": "User not authorized: required scope calendar:calendar.event:read",
    "hint": "run `lark-cli auth login --scope \"calendar:calendar.event:read\"`",
    "console_url": "https://open.feishu.cn/page/scope-apply?..."
  }
}
```

### 错误处理最佳实践

```go
// ✓ 好：明确区分"无法处理"和"处理失败"
func (s *Shortcut) Execute(ctx context.Context, runtime *Runtime) error {
    // 无法处理：返回 nil（让下一个处理器尝试）
    if !canHandle(runtime) {
        return nil
    }
    
    // 处理失败：返回错误
    data, err := fetchData(ctx)
    if err != nil {
        return fmt.Errorf("failed to fetch data: %w", err)
    }
    
    return runtime.OutFormat(data, nil, formatter)
}

// ✗ 不好：吞掉错误
func (s *Shortcut) Execute(ctx context.Context, runtime *Runtime) error {
    data, _ := fetchData(ctx)  // 错误被忽略
    return runtime.OutFormat(data, nil, formatter)
}
```

---

## 设计模式

### 1. 工厂模式（Factory Pattern）

集中管理依赖注入：

```go
type Factory struct {
    config     *Config
    httpClient *http.Client
    larkClient *lark.Client
}

func (f *Factory) Config() *Config {
    if f.config == nil {
        f.config = loadConfig()
    }
    return f.config
}

func (f *Factory) LarkClient() *lark.Client {
    if f.larkClient == nil {
        f.larkClient = lark.NewClient(f.Config())
    }
    return f.larkClient
}
```

### 2. 声明式框架（Declarative Framework）

命令定义为数据，框架处理通用逻辑：

```go
// 定义（数据）
var MyCommand = common.Shortcut{
    Service: "calendar",
    Command: "+agenda",
    Flags: []common.Flag{...},
    Execute: func(ctx, runtime) error { ... },
}

// 框架处理（通用逻辑）
- 参数解析
- 权限检查
- 输出格式化
- 错误处理
```

### 3. 中间件模式（Middleware Pattern）

命令执行前后的通用处理：

```
执行前
├─ 身份解析
├─ 权限检查
├─ 参数验证
└─ 配置加载

执行
└─ 业务逻辑

执行后
├─ 输出格式化
├─ 错误处理
└─ 日志记录
```

### 4. 元数据驱动（Metadata-Driven）

服务命令从 API 元数据动态生成：

```go
// 元数据定义
{
  "service": "calendar",
  "resources": [
    {
      "name": "events",
      "methods": [
        {
          "name": "list",
          "path": "/calendar/v4/calendars/{calendar_id}/events",
          "scopes": ["calendar:calendar.event:read"]
        }
      ]
    }
  ]
}

// 自动生成命令
calendar list-events --calendar-id xxx
```

---

## 实战：添加新的快捷命令

### 步骤 1：定义快捷命令

```go
// shortcuts/contact/contact_search_user.go
package contact

import "github.com/larksuite/cli/shortcuts/common"

var SearchUser = common.Shortcut{
    Service:     "contact",
    Command:     "+search-user",
    Description: "搜索用户",
    Risk:        "read",
    Scopes:      []string{"contact:user.base:read"},
    AuthTypes:   []string{"user", "bot"},
    HasFormat:   true,
    
    Flags: []common.Flag{
        {
            Name:     "query",
            Type:     "string",
            Desc:     "搜索关键词",
            Required: true,
        },
        {
            Name:    "limit",
            Type:    "int",
            Desc:    "返回结果数量",
            Default: "10",
        },
    },
    
    Execute: func(ctx context.Context, runtime *Runtime) error {
        query := runtime.GetFlag("query")
        limit := runtime.GetFlagInt("limit")
        
        client := runtime.LarkClient()
        users, err := client.Contact.SearchUsers(ctx, &contact.SearchUsersReq{
            Query: query,
            Limit: limit,
        })
        if err != nil {
            return err
        }
        
        return runtime.OutFormat(users, nil, formatUsers)
    },
}

func formatUsers(data interface{}) string {
    // 自定义表格格式
    users := data.([]*contact.User)
    // ... 格式化逻辑
}
```

### 步骤 2：注册快捷命令

```go
// shortcuts/contact/contact.go
package contact

func Shortcuts() []common.Shortcut {
    return []common.Shortcut{
        SearchUser,
        // 其他快捷命令...
    }
}
```

### 步骤 3：自动注册

快捷命令会在 `shortcuts/register.go` 中自动聚合和注册，无需额外配置。

### 步骤 4：测试

```bash
# 测试快捷命令
lark-cli contact +search-user --query "张三" --limit 5

# 测试 --dry-run
lark-cli contact +search-user --query "张三" --dry-run

# 测试 JSON 输出
lark-cli contact +search-user --query "张三" --format json
```

---

## 最佳实践

### 1. 命令命名

- 快捷命令：动词 + 名词（`+search-user`、`+create-event`）
- 参数名：使用连字符（`--calendar-id`、`--start-time`）
- 避免缩写（`--id` 不如 `--calendar-id` 清晰）

### 2. 参数设计

```go
// ✓ 好：清晰的参数名和默认值
Flags: []common.Flag{
    {Name: "calendar-id", Default: "primary"},
    {Name: "limit", Default: "10"},
}

// ✗ 不好：模糊的参数名
Flags: []common.Flag{
    {Name: "id"},
    {Name: "n"},
}
```

### 3. 权限声明

```go
// ✓ 好：明确声明所需权限
Scopes: []string{"calendar:calendar.event:read"},
UserScopes: []string{"calendar:calendar.event:read"},
BotScopes: []string{"calendar:calendar.event:read"},

// ✗ 不好：权限不清晰
Scopes: []string{"calendar:*"},
```

### 4. 错误消息

```go
// ✓ 好：提供可操作的提示
return fmt.Errorf("invalid date format: expected ISO 8601, got %q\nExample: 2026-04-24T09:00:00Z", input)

// ✗ 不好：模糊的错误
return fmt.Errorf("invalid date")
```

### 5. 输出格式

```go
// ✓ 好：支持多种格式
HasFormat: true,  // 自动支持 --format json|table|csv|ndjson

// ✗ 不好：只支持一种格式
// 手工处理输出格式
```

---

## 相关资源

- [实现指南](./implementation.md) - 代码架构详解
- [认证实战指南](./advanced-auth.md) - 身份和权限处理
- [凭证提供者系统](./credential-providers.md) - 扩展认证
- [源码位置](https://github.com/larksuite/cli/tree/main/cmd) - GitHub 仓库

---

## 下一步

- 查看 [快捷命令实现](https://github.com/larksuite/cli/tree/main/shortcuts) 学习具体例子
- 研究 [参数处理](https://github.com/larksuite/cli/blob/main/shortcuts/common/runner.go) 的细节
- 学习 [错误处理](https://github.com/larksuite/cli/blob/main/internal/output/errors.go) 的最佳实践
