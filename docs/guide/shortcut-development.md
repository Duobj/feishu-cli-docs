# 快捷命令开发实战

本文讲解如何从零开始开发 lark-cli 快捷命令，包括完整的开发流程、代码示例、常见模式和最佳实践。

> 📖 **前置阅读**：建议先阅读 [命令系统设计](./command-system.md) 了解快捷命令的基本概念。

---

## 快捷命令开发流程

### 完整开发链

```
1. 需求分析
   ├─ 确定服务和命令名
   ├─ 定义参数和权限
   └─ 规划输出格式

2. 定义快捷命令结构
   ├─ 创建 Shortcut 实例
   ├─ 定义 Flags
   └─ 声明权限范围

3. 实现业务逻辑
   ├─ Validate 钩子（参数验证）
   ├─ DryRun 钩子（显示将要执行的操作）
   └─ Execute 钩子（实际执行）

4. 注册快捷命令
   ├─ 在服务包中导出
   └─ 自动聚合到 register.go

5. 测试和调试
   ├─ 单元测试
   ├─ 集成测试
   └─ 手工测试

6. 提交和部署
   ├─ 代码审查
   ├─ 合并到主分支
   └─ 发布新版本
```

---

## 快捷命令基本结构

### Shortcut 结构定义

```go
type Shortcut struct {
    // 基本信息
    Service     string  // 服务名：calendar, im, doc, sheets 等
    Command     string  // 命令名：+agenda, +send, +create 等
    Description string  // 命令描述
    
    // 权限和风险
    Risk        string    // "read" | "write" | "high-risk-write"
    Scopes      []string  // 默认权限范围
    UserScopes  []string  // 用户身份权限（可覆盖 Scopes）
    BotScopes   []string  // Bot 身份权限（可覆盖 Scopes）
    AuthTypes   []string  // 支持的身份：["user", "bot"]
    
    // 参数定义
    Flags       []Flag    // 标志定义
    HasFormat   bool      // 是否自动注入 --format 标志
    Tips        []string  // 帮助提示
    
    // 业务逻辑钩子
    Validate    func(ctx context.Context, runtime *RuntimeContext) error
    DryRun      func(ctx context.Context, runtime *RuntimeContext) *DryRunAPI
    Execute     func(ctx context.Context, runtime *RuntimeContext) error
}

type Flag struct {
    Name     string    // 标志名
    Type     string    // "string" | "bool" | "int" | "string_array"
    Default  string    // 默认值
    Desc     string    // 帮助文本
    Hidden   bool      // 是否隐藏
    Required bool      // 是否必需
    Enum     []string  // 允许的值列表
    Input    []string  // 输入源：["file", "stdin"]
}
```

### Flag 类型说明

| 类型 | 示例 | 说明 |
|------|------|------|
| `string` | `--title "Meeting"` | 字符串参数 |
| `bool` | `--all-day` | 布尔标志 |
| `int` | `--limit 10` | 整数参数 |
| `string_array` | `--ids ou_1 --ids ou_2` | 重复字符串参数 |

### Input 支持

```bash
# 从文件读取
lark-cli im +send --text @message.txt

# 从标准输入读取
echo "Hello" | lark-cli im +send --text -

# 转义 @ 符号
lark-cli im +send --text "@@mention"  # 字面量 @mention
```

---

## 实战：创建日历快捷命令

### 步骤 1：定义快捷命令

创建文件 `shortcuts/calendar/calendar_create.go`：

```go
package calendar

import (
    "context"
    "fmt"
    "time"
    
    "github.com/larksuite/cli/shortcuts/common"
)

var Create = common.Shortcut{
    Service:     "calendar",
    Command:     "+create",
    Description: "Create a calendar event",
    Risk:        "write",
    
    // 权限范围
    Scopes:      []string{"calendar:calendar.event:write"},
    UserScopes:  []string{"calendar:calendar.event:write"},
    BotScopes:   []string{"calendar:calendar.event:write"},
    AuthTypes:   []string{"user", "bot"},
    
    // 参数定义
    Flags: []common.Flag{
        {
            Name:     "summary",
            Type:     "string",
            Desc:     "Event title",
            Required: true,
        },
        {
            Name:     "start",
            Type:     "string",
            Desc:     "Start time (ISO 8601 or date)",
            Required: true,
        },
        {
            Name:     "end",
            Type:     "string",
            Desc:     "End time (ISO 8601 or date)",
            Required: true,
        },
        {
            Name:     "description",
            Type:     "string",
            Desc:     "Event description",
            Required: false,
        },
        {
            Name:     "attendee-ids",
            Type:     "string",
            Desc:     "Attendee IDs (comma-separated)",
            Required: false,
        },
        {
            Name:     "calendar-id",
            Type:     "string",
            Desc:     "Calendar ID (default: primary)",
            Default:  "primary",
        },
        {
            Name:     "rrule",
            Type:     "string",
            Desc:     "Recurrence rule (RFC 5545)",
            Required: false,
        },
        {
            Name:     "yes",
            Type:     "bool",
            Desc:     "Skip confirmation for high-risk operations",
            Required: false,
        },
    },
    
    HasFormat: true,
    
    // 业务逻辑钩子
    Validate: validateCreateEvent,
    DryRun:   dryRunCreateEvent,
    Execute:  executeCreateEvent,
}

// 参数验证
func validateCreateEvent(ctx context.Context, runtime *common.RuntimeContext) error {
    // 验证时间格式
    start := runtime.Str("start")
    end := runtime.Str("end")
    
    if _, err := common.ParseTime(start); err != nil {
        return fmt.Errorf("invalid start time: %w", err)
    }
    
    if _, err := common.ParseTime(end); err != nil {
        return fmt.Errorf("invalid end time: %w", err)
    }
    
    // 验证参会人 ID 格式
    attendeeIds := runtime.Str("attendee-ids")
    if attendeeIds != "" {
        for _, id := range common.SplitCSV(attendeeIds) {
            if _, err := common.ValidateUserID(id); err != nil {
                return fmt.Errorf("invalid attendee ID %q: %w", id, err)
            }
        }
    }
    
    return nil
}

// 显示将要执行的操作
func dryRunCreateEvent(ctx context.Context, runtime *common.RuntimeContext) *common.DryRunAPI {
    d := common.NewDryRunAPI()
    d.Desc("Create a calendar event")
    d.POST("/open-apis/calendar/v4/calendars/:calendar_id/events")
    d.Set("calendar_id", runtime.Str("calendar-id"))
    
    // 显示请求体
    d.Body(map[string]interface{}{
        "summary":     runtime.Str("summary"),
        "start_time":  runtime.Str("start"),
        "end_time":    runtime.Str("end"),
        "description": runtime.Str("description"),
    })
    
    return d
}

// 执行业务逻辑
func executeCreateEvent(ctx context.Context, runtime *common.RuntimeContext) error {
    // 高风险操作确认
    if err := common.RequireConfirmation("write", runtime.Bool("yes"), "create event"); err != nil {
        return err
    }
    
    // 构建请求体
    eventData := map[string]interface{}{
        "summary":     runtime.Str("summary"),
        "description": runtime.Str("description"),
    }
    
    // 解析时间
    startTime, _ := common.ParseTime(runtime.Str("start"))
    endTime, _ := common.ParseTime(runtime.Str("end"))
    
    eventData["start_time"] = map[string]interface{}{
        "timestamp": fmt.Sprintf("%d", startTime.Unix()),
    }
    eventData["end_time"] = map[string]interface{}{
        "timestamp": fmt.Sprintf("%d", endTime.Unix()),
    }
    
    // 添加参会人
    if attendeeIds := runtime.Str("attendee-ids"); attendeeIds != "" {
        attendees := []map[string]interface{}{}
        for _, id := range common.SplitCSV(attendeeIds) {
            attendees = append(attendees, map[string]interface{}{
                "open_id": id,
            })
        }
        eventData["attendees"] = attendees
    }
    
    // 添加重复规则
    if rrule := runtime.Str("rrule"); rrule != "" {
        eventData["recurrence"] = map[string]interface{}{
            "recurrence_rule": rrule,
        }
    }
    
    // 调用 API
    data, err := runtime.CallAPI(
        "POST",
        "/open-apis/calendar/v4/calendars/:calendar_id/events",
        map[string]interface{}{"user_id_type": "open_id"},
        eventData,
    )
    if err != nil {
        return err
    }
    
    // 输出结果
    return runtime.OutFormat(data, nil, func(w io.Writer) {
        eventId := common.GetString(data, "event_id")
        summary := common.GetString(data, "summary")
        fmt.Fprintf(w, "✓ Event created\n")
        fmt.Fprintf(w, "  ID: %s\n", eventId)
        fmt.Fprintf(w, "  Title: %s\n", summary)
    })
}
```

### 步骤 2：注册快捷命令

在 `shortcuts/calendar/calendar.go` 中导出：

```go
package calendar

func Shortcuts() []common.Shortcut {
    return []common.Shortcut{
        Agenda,
        Create,  // 新增
        Freebusy,
        RoomFind,
        RSVP,
        Suggestion,
    }
}
```

快捷命令会自动在 `shortcuts/register.go` 中聚合和注册，无需额外配置。

### 步骤 3：测试快捷命令

```bash
# 显示帮助
lark-cli calendar +create --help

# 验证参数
lark-cli calendar +create \
  --summary "Team Meeting" \
  --start "2026-04-24T09:00:00Z" \
  --end "2026-04-24T10:00:00Z"

# 显示将要执行的操作
lark-cli calendar +create \
  --summary "Team Meeting" \
  --start "2026-04-24T09:00:00Z" \
  --end "2026-04-24T10:00:00Z" \
  --dry-run

# 创建事件
lark-cli calendar +create \
  --summary "Team Meeting" \
  --start "2026-04-24T09:00:00Z" \
  --end "2026-04-24T10:00:00Z" \
  --attendee-ids "ou_xxx,ou_yyy" \
  --yes

# JSON 输出
lark-cli calendar +create \
  --summary "Team Meeting" \
  --start "2026-04-24T09:00:00Z" \
  --end "2026-04-24T10:00:00Z" \
  --format json
```

---

## 常见实现模式

### 模式 1：参数验证

```go
// 互斥检查
if err := common.MutuallyExclusive(runtime, "flag1", "flag2"); err != nil {
    return err
}

// 至少一个
if err := common.AtLeastOne(runtime, "flag1", "flag2"); err != nil {
    return err
}

// 恰好一个
if err := common.ExactlyOne(runtime, "flag1", "flag2"); err != nil {
    return err
}

// 页面大小验证
pageSize, err := common.ValidatePageSize(runtime, "page-size", 20, 1, 200)

// 危险字符检查
if err := common.RejectDangerousChars("--summary", value); err != nil {
    return err
}
```

### 模式 2：时间处理

```go
// 支持多种格式
t1, _ := common.ParseTime("2026-01-01")                    // 日期
t2, _ := common.ParseTime("2026-01-01T15:04:05+08:00")     // ISO 8601
t3, _ := common.ParseTime("1704067200")                    // Unix 时间戳

// 日期转换为日期末尾
t4, _ := common.ParseTime("2026-01-01", "end")  // 23:59:59
```

### 模式 3：ID 验证

```go
// Chat ID 验证
chatId, err := common.ValidateChatID(input)  // 检查 oc_ 前缀

// User ID 验证
userId, err := common.ValidateUserID(input)  // 检查 ou_ 前缀
```

### 模式 4：CSV 解析

```go
// 逗号分隔列表解析
ids := common.SplitCSV("ou_123,ou_456,ou_789")
// 自动去除空格和空项
```

### 模式 5：嵌套数据提取

```go
// 安全的嵌套访问
name := common.GetString(data, "user", "profile", "name")
count := common.GetFloat(data, "stats", "total")
items := common.GetSlice(data, "results", "items")

// 迭代 map 切片
common.EachMap(items, func(m map[string]interface{}) {
    // 处理每个 map
})
```

### 模式 6：文件上传

```go
// 单次上传（< 20MB）
fileId, err := common.UploadDriveMediaAll(runtime, common.DriveMediaUploadAllConfig{
    FilePath:   path,
    FileName:   name,
    FileSize:   size,
    ParentType: "folder",
    ParentNode: &folderId,
})

// 分片上传（> 20MB）
session, err := common.InitDriveMediaMultipartUpload(...)
err = common.UploadDriveMediaPart(...)
fileId, err := common.FinishDriveMediaMultipartUpload(...)
```

### 模式 7：权限自动授予

```go
// Bot 创建资源后自动授予当前用户权限
grant := common.AutoGrantCurrentUserDrivePermission(runtime, token, "docx")
// 返回 {status, perm, message, user_open_id}
```

### 模式 8：并发查询

```go
// 使用 goroutine 池并发查询
output, err := collectResults(items, 10, func(item Item) (Result, error) {
    // 并发度限制为 10
    return fetchResult(item)
})
```

### 模式 9：输出格式化

```go
// 支持多种格式
runtime.OutFormat(data, &output.Meta{Count: len(data)}, func(w io.Writer) {
    // Pretty 格式化
    for _, item := range data {
        fmt.Fprintf(w, "- %s\n", item.Name)
    }
})

// 自动支持 --format json|table|csv|ndjson|--jq
```

### 模式 10：错误处理

```go
// 验证错误
return output.ErrValidation("invalid value: %s", val)

// API 错误
return output.ErrAPI(code, "API error message", detail)

// 认证错误
return output.ErrAuth("authentication failed: %s", err)

// 带提示的错误
return output.ErrWithHint(exitCode, errorType, message, hint)
```

---

## 高级特性

### 1. DryRun 支持

DryRun 钩子显示将要执行的操作，用户可以用 `--dry-run` 标志预览：

```go
DryRun: func(ctx context.Context, runtime *common.RuntimeContext) *common.DryRunAPI {
    d := common.NewDryRunAPI()
    d.Desc("Create a calendar event")
    d.POST("/open-apis/calendar/v4/calendars/:calendar_id/events")
    d.Set("calendar_id", runtime.Str("calendar-id"))
    d.Body(eventData)
    return d
}
```

使用：
```bash
lark-cli calendar +create --summary "Meeting" --start "2026-04-24T09:00:00Z" --end "2026-04-24T10:00:00Z" --dry-run
```

### 2. 高风险操作确认

对于写操作，可以要求用户确认：

```go
if err := common.RequireConfirmation("high-risk-write", runtime.Bool("yes"), "delete event"); err != nil {
    return err
}
```

使用：
```bash
# 需要确认
lark-cli calendar +delete --event-id xxx

# 跳过确认
lark-cli calendar +delete --event-id xxx --yes
```

### 3. 权限范围检查

快捷命令框架自动检查权限，但也可以手工检查：

```go
// 快速本地检查
missing, err := checkScopePrereqs(f, ctx, appID, identity, requiredScopes)
if len(missing) > 0 {
    return output.ErrWithHint(..., "missing scope(s): " + strings.Join(missing, ", "))
}
```

### 4. MCP 工具调用

快捷命令可以调用 MCP 工具：

```go
result, err := common.CallMCPTool(runtime, "create-doc", map[string]interface{}{
    "markdown": content,
    "title":    title,
})
```

### 5. 输入标志处理

支持从文件或标准输入读取参数：

```bash
# 从文件读取
lark-cli im +send --text @message.txt

# 从标准输入读取
echo "Hello" | lark-cli im +send --text -
```

---

## 最佳实践

### 1. 命令命名

```go
// ✓ 好：动词 + 名词
"+create-event"
"+search-user"
"+send-message"

// ✗ 不好：模糊的名称
"+do-something"
"+handle"
```

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
Scopes:     []string{"calendar:calendar.event:read"},
UserScopes: []string{"calendar:calendar.event:read"},
BotScopes:  []string{"calendar:calendar.event:read"},

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

### 6. 参数验证

```go
// ✓ 好：在 Validate 钩子中验证
Validate: func(ctx context.Context, runtime *common.RuntimeContext) error {
    if err := common.ExactlyOne(runtime, "flag1", "flag2"); err != nil {
        return err
    }
    return nil
}

// ✗ 不好：在 Execute 中验证
Execute: func(ctx context.Context, runtime *common.RuntimeContext) error {
    if flag1 == "" && flag2 == "" {
        return fmt.Errorf("flag1 or flag2 required")
    }
    // ...
}
```

### 7. 权限错误处理

```go
// ✓ 好：提取权限并生成升级命令
if isPermissionError(err) {
    scopes := extractRequiredScopes(err)
    hint := fmt.Sprintf(
        "run `lark-cli auth login --scope \"%s\"`",
        strings.Join(scopes, " "),
    )
    return output.ErrWithHint(output.ExitAPI, "permission", err.Message, hint)
}

// ✗ 不好：通用权限错误消息
return output.ErrAPI(err.Code, "permission denied", nil)
```

---

## 调试和测试

### 调试技巧

```bash
# 显示详细日志和调试输出
lark-cli calendar +create --summary "Meeting" --start "2026-04-24T09:00:00Z" --end "2026-04-24T10:00:00Z" --verbose

# 显示 HTTP 请求/响应追踪
lark-cli calendar +create --summary "Meeting" --start "2026-04-24T09:00:00Z" --end "2026-04-24T10:00:00Z" --trace

# 显示将要执行的操作
lark-cli calendar +create --summary "Meeting" --start "2026-04-24T09:00:00Z" --end "2026-04-24T10:00:00Z" --dry-run

# JSON 输出便于解析
lark-cli calendar +create --summary "Meeting" --start "2026-04-24T09:00:00Z" --end "2026-04-24T10:00:00Z" --format json | jq .
```

### 单元测试

```go
func TestValidateCreateEvent(t *testing.T) {
    tests := []struct {
        name    string
        flags   map[string]interface{}
        wantErr bool
    }{
        {
            name: "valid event",
            flags: map[string]interface{}{
                "summary": "Meeting",
                "start":   "2026-04-24T09:00:00Z",
                "end":     "2026-04-24T10:00:00Z",
            },
            wantErr: false,
        },
        {
            name: "invalid start time",
            flags: map[string]interface{}{
                "summary": "Meeting",
                "start":   "invalid",
                "end":     "2026-04-24T10:00:00Z",
            },
            wantErr: true,
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            runtime := newMockRuntime(tt.flags)
            err := validateCreateEvent(context.Background(), runtime)
            if (err != nil) != tt.wantErr {
                t.Errorf("validateCreateEvent() error = %v, wantErr %v", err, tt.wantErr)
            }
        })
    }
}
```

---

## 常见问题

### Q1: 如何支持多个身份（User 和 Bot）？

```go
AuthTypes: []string{"user", "bot"},

// 在 Execute 中检查身份
if runtime.IsBot() {
    // Bot 特定逻辑
} else {
    // User 特定逻辑
}
```

### Q2: 如何处理分页？

```go
// 提取分页元数据
hasMore, pageToken := common.PaginationMeta(data)

// 生成分页提示
hint := common.PaginationHint(data, count)
```

### Q3: 如何处理大文件上传？

```go
// 自动选择上传方式
fileId, err := common.UploadDriveMediaAll(runtime, config)
// 内部自动处理单次/分片上传
```

### Q4: 如何支持 JQ 过滤？

```go
// 自动支持 --jq 标志
HasFormat: true

// 使用
lark-cli calendar +agenda --jq '.events[] | select(.summary | contains("Meeting"))'
```

### Q5: 如何处理权限不足？

```go
// 框架自动检查权限，如果不足会返回错误
// 错误消息会包含升级命令

// 手工检查
missing, err := checkScopePrereqs(f, ctx, appID, identity, requiredScopes)
if len(missing) > 0 {
    return output.ErrWithHint(..., "missing scope(s): " + strings.Join(missing, ", "))
}
```

---

## 相关资源

- [命令系统设计](./command-system.md) - CLI 命令架构
- [实现指南](./implementation.md) - 代码架构详解
- [源码位置](https://github.com/larksuite/cli/tree/main/shortcuts) - GitHub 仓库

---

## 下一步

- 查看 [快捷命令实现](https://github.com/larksuite/cli/tree/main/shortcuts) 学习具体例子
- 研究 [参数处理](https://github.com/larksuite/cli/blob/main/shortcuts/common/runner.go) 的细节
- 学习 [错误处理](https://github.com/larksuite/cli/blob/main/internal/output/errors.go) 的最佳实践
