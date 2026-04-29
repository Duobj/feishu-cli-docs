# Calendar 服务开发指南

本文深入讲解如何开发 lark-cli Calendar 服务的快捷命令，包括时间处理、递归分割查询、并发优化、事务性操作等核心模式。

> 📖 **前置阅读**：建议先阅读 [快捷命令开发实战](./shortcut-development.md) 了解快捷命令框架。

---

## Calendar 服务概览

Calendar 服务提供 6 个快捷命令：

| 命令 | 功能 | 风险等级 | 关键特性 |
|------|------|---------|---------|
| `+agenda` | 查看日程 | read | 递归分割查询、去重排序 |
| `+create` | 创建事件 | write | 事务性操作、自动回滚 |
| `+freebusy` | 查询忙闲 | read | 时间范围查询 |
| `+room-find` | 查找会议室 | read | 并发查询（10 workers） |
| `+rsvp` | 回复邀请 | write | 简单状态更新 |
| `+suggestion` | 建议时间 | read | AI 指导、排除时间段 |

---

## 时间处理模式

### 多格式时间解析

Calendar 服务需要支持多种时间格式。使用 `common.ParseTime()` 函数：

```go
// 支持的格式
ParseTime("2026-01-02")                    // 日期 → 00:00:00
ParseTime("2026-01-02", "end")             // 日期 → 23:59:59
ParseTime("2026-01-02T15:04:05+08:00")     // ISO 8601 with TZ
ParseTime("2026-01-02T15:04:05")           // ISO 8601 without TZ
ParseTime("1742515200")                    // Unix 时间戳
```

### 时间范围处理

```go
// 提供默认值
func resolveStartEnd(runtime *common.RuntimeContext) (string, string) {
    startInput := runtime.Str("start")
    if startInput == "" {
        startInput = time.Now().Format("2006-01-02")  // 默认今天
    }
    
    endInput := runtime.Str("end")
    if endInput == "" {
        endInput = startInput  // 默认等于开始日期
    }
    
    return startInput, endInput
}
```

### 时区处理

```go
// 本地时区转换
func convertToLocalTime(timestamp string) string {
    ts, _ := strconv.ParseInt(timestamp, 10, 64)
    return time.Unix(ts, 0).Local().Format(time.RFC3339)
}

// 全天事件处理：调整结束日期 -1 秒
func adjustAllDayEndDate(dateStr string) string {
    t, _ := time.ParseInLocation("2006-01-02", dateStr, time.UTC)
    return t.Add(-1 * time.Second).Format("2006-01-02")
}
```

---

## 递归分割查询模式

### API 限制

Calendar API 有两个重要限制：

```go
const (
    maxInstanceViewSpanSeconds = 40 * 24 * 60 * 60  // 40 天限制
    minSplitWindowSeconds = 2 * 60 * 60              // 最小分割窗口 2 小时
)

// 错误代码
const (
    larkErrCalendarTimeRangeExceeded = 193103  // 时间范围超过 40 天
    larkErrCalendarTooManyInstances  = 193104  // 返回超过 1000 条实例
)
```

### 递归二分分割实现

```go
func fetchInstanceViewRange(ctx context.Context, runtime *common.RuntimeContext,
    calendarId string, startTime, endTime int64, depth int) ([]map[string]interface{}, error) {
    
    // 递归深度限制
    if depth > 10 {
        return nil, output.Errorf(output.ExitInternal, "recursion_limit",
            "too many splits for instance_view")
    }
    
    span := endTime - startTime
    
    // 策略1：时间范围超过 40 天 → 二分分割
    if span > maxInstanceViewSpanSeconds {
        mid := startTime + span/2
        left, err := fetchInstanceViewRange(ctx, runtime, calendarId, startTime, mid, depth+1)
        if err != nil {
            return nil, err
        }
        right, err := fetchInstanceViewRange(ctx, runtime, calendarId, mid+1, endTime, depth+1)
        if err != nil {
            return nil, err
        }
        return append(left, right...), nil
    }
    
    // 调用 API
    result, err := runtime.RawAPI("GET",
        fmt.Sprintf("/open-apis/calendar/v4/calendars/%s/events/instance_view",
            validate.EncodePathSegment(calendarId)),
        map[string]interface{}{
            "start_time": fmt.Sprintf("%d", startTime),
            "end_time":   fmt.Sprintf("%d", endTime),
        }, nil)
    
    if err != nil {
        // 处理错误代码 193103（时间范围超过限制）
        if isTimeRangeExceededError(err) {
            mid := startTime + span/2
            if mid <= startTime {
                return nil, output.Errorf(output.ExitAPI, "api_error",
                    "query failed: time range exceeds 40-day limit")
            }
            // 递归分割
            left, _ := fetchInstanceViewRange(ctx, runtime, calendarId, startTime, mid, depth+1)
            right, _ := fetchInstanceViewRange(ctx, runtime, calendarId, mid+1, endTime, depth+1)
            return append(left, right...), nil
        }
        
        // 处理错误代码 193104（超过 1000 条实例）
        if isTooManyInstancesError(err) {
            if span <= minSplitWindowSeconds {
                return nil, output.Errorf(output.ExitAPI, "api_error",
                    "query failed: more than 1000 instances in the time range")
            }
            // 继续分割
            mid := startTime + span/2
            left, _ := fetchInstanceViewRange(ctx, runtime, calendarId, startTime, mid, depth+1)
            right, _ := fetchInstanceViewRange(ctx, runtime, calendarId, mid+1, endTime, depth+1)
            return append(left, right...), nil
        }
        
        return nil, err
    }
    
    return extractItems(result), nil
}
```

### 去重和排序

```go
func dedupeAndSortItems(items []map[string]interface{}) []map[string]interface{} {
    // 去重：使用 event_id + start_time + end_time 作为 key
    seen := make(map[string]bool)
    var result []map[string]interface{}
    
    for _, e := range items {
        eventId, _ := e["event_id"].(string)
        startMap, _ := e["start_time"].(map[string]interface{})
        endMap, _ := e["end_time"].(map[string]interface{})
        startTs, _ := startMap["timestamp"].(string)
        endTs, _ := endMap["timestamp"].(string)
        
        key := eventId + "|" + startTs + "|" + endTs
        if !seen[key] {
            seen[key] = true
            result = append(result, e)
        }
    }
    
    // 按开始时间排序
    sort.Slice(result, func(i, j int) bool {
        si, _ := result[i]["start_time"].(map[string]interface{})
        sj, _ := result[j]["start_time"].(map[string]interface{})
        ti, _ := si["timestamp"].(string)
        tj, _ := sj["timestamp"].(string)
        ni, _ := strconv.ParseInt(ti, 10, 64)
        nj, _ := strconv.ParseInt(tj, 10, 64)
        return ni < nj
    })
    
    return result
}
```

---

## 并发查询优化

### 信号量模式

Calendar 的 `+room-find` 命令需要查询多个时间槽的会议室可用性。使用信号量模式控制并发度：

```go
const roomFindWorkers = 10  // 并发度为 10

func collectRoomFindResults(slots []roomFindSlot, limit int,
    fetch func(roomFindSlot) ([]*roomFindSuggestion, error)) (*roomFindOutput, error) {
    
    if limit <= 0 {
        limit = 1
    }
    
    out := &roomFindOutput{
        TimeSlots: make([]*roomFindTimeSlot, 0, len(slots)),
    }
    
    var wg sync.WaitGroup
    var mu sync.Mutex
    var firstErr error
    sem := make(chan struct{}, limit)  // 信号量通道
    
    for _, slot := range slots {
        wg.Add(1)
        sem <- struct{}{}  // 获取信号量
        
        go func(slot roomFindSlot) {
            defer wg.Done()
            defer func() { <-sem }()  // 释放信号量
            
            suggestions, err := fetch(slot)
            mu.Lock()
            defer mu.Unlock()
            
            if err != nil {
                if firstErr == nil {
                    firstErr = err
                }
                return
            }
            
            out.TimeSlots = append(out.TimeSlots, &roomFindTimeSlot{
                Start:        slot.Start,
                End:          slot.End,
                MeetingRooms: suggestions,
            })
        }(slot)
    }
    
    wg.Wait()
    
    if firstErr != nil {
        return nil, firstErr
    }
    
    // 按时间排序结果
    sort.Slice(out.TimeSlots, func(i, j int) bool {
        return out.TimeSlots[i].Start < out.TimeSlots[j].Start
    })
    
    return out, nil
}
```

### 错误处理策略

- 使用 `sync.Mutex` 保护共享状态
- 记录第一个错误，继续处理其他任务
- 所有 goroutine 完成后返回第一个错误
- 不会因为单个任务失败而中断其他任务

---

## 事务性操作

### 创建事件 + 添加参会人 + 自动回滚

`+create` 命令需要支持事务性操作：创建事件后添加参会人，如果失败则自动回滚。

```go
Execute: func(ctx context.Context, runtime *common.RuntimeContext) error {
    // 1. 创建事件
    eventData := map[string]interface{}{
        "summary":     runtime.Str("summary"),
        "description": runtime.Str("description"),
        "start_time":  map[string]interface{}{"timestamp": startTs},
        "end_time":    map[string]interface{}{"timestamp": endTs},
    }
    
    data, err := runtime.CallAPI("POST",
        fmt.Sprintf("/open-apis/calendar/v4/calendars/%s/events", calendarId),
        map[string]interface{}{"user_id_type": "open_id"},
        eventData)
    if err != nil {
        return err
    }
    
    eventId := common.GetString(data, "event_id")
    
    // 2. 添加参会人（如果指定）
    if attendeeIds := runtime.Str("attendee-ids"); attendeeIds != "" {
        attendees := []map[string]interface{}{}
        for _, id := range common.SplitCSV(attendeeIds) {
            attendees = append(attendees, map[string]interface{}{
                "open_id": id,
            })
        }
        
        _, err = runtime.CallAPI("POST",
            fmt.Sprintf("/open-apis/calendar/v4/calendars/%s/events/%s/attendees", calendarId, eventId),
            map[string]interface{}{"user_id_type": "open_id"},
            map[string]interface{}{
                "attendees":         attendees,
                "need_notification": true,
            })
        
        if err != nil {
            // 3. 回滚：删除已创建的事件
            _, rollbackErr := runtime.RawAPI("DELETE",
                fmt.Sprintf("/open-apis/calendar/v4/calendars/%s/events/%s", calendarId, eventId),
                map[string]interface{}{"need_notification": false}, nil)
            
            if rollbackErr != nil {
                return output.Errorf(output.ExitAPI, "api_error",
                    "failed to add attendees: %v; rollback also failed, orphan event_id=%s needs manual cleanup",
                    rollbackErr, eventId)
            }
            
            return output.Errorf(output.ExitAPI, "api_error",
                "failed to add attendees: %v; event rolled back successfully", err)
        }
    }
    
    return runtime.OutFormat(data, nil, formatCreateEvent)
}
```

---

## 身份和权限处理

### User vs Bot 差异

Calendar 命令默认要求用户身份，防止自动回退到 Bot 身份：

```go
func rejectCalendarAutoBotFallback(runtime *common.RuntimeContext) error {
    if runtime == nil || !runtime.IsBot() || hasExplicitBotFlag(runtime.Cmd) {
        return nil  // 用户身份或显式指定 bot，允许
    }
    
    if runtime.Factory == nil || !runtime.Factory.IdentityAutoDetected {
        return nil  // 身份未自动检测，允许
    }
    
    // 自动检测到 bot 身份时拒绝
    msg := "calendar commands require a valid user login by default; " +
           "when no valid user login state is available, auto identity falls back to bot " +
           "and may operate on the bot calendar instead of your own."
    hint := "restore user login: `lark-cli auth login --domain calendar`\n" +
            "intentional bot usage: rerun with `--as bot`"
    return output.ErrWithHint(output.ExitAuth, "calendar_user_login_required", msg, hint)
}
```

### 权限范围要求

```go
// +agenda (查看日程)
Scopes: []string{"calendar:calendar.event:read"}

// +create (创建事件)
Scopes: []string{"calendar:calendar.event:create", "calendar:calendar.event:update"}

// +freebusy (查询忙闲)
Scopes: []string{"calendar:calendar.free_busy:read"}

// +room-find (查找会议室)
Scopes: []string{"calendar:calendar.free_busy:read"}

// +rsvp (回复邀请)
Scopes: []string{"calendar:calendar.event:reply"}

// +suggestion (建议时间)
Scopes: []string{"calendar:calendar.free_busy:read"}
```

### 身份特定逻辑

```go
// +freebusy：bot 必须指定 --user-id
if userId == "" && runtime.IsBot() {
    return common.FlagErrorf("--user-id is required for bot identity")
}

// +create：非 bot 自动包含当前用户
if !runtime.IsBot() {
    currentUserId := runtime.UserOpenId()
    // 添加到参会人列表
}

// +suggestion：非 bot 自动加入参会人列表
if !runtime.IsBot() {
    userOpenId := runtime.UserOpenId()
    req.AttendeeUserIds = append(req.AttendeeUserIds, userOpenId)
}
```

---

## 错误处理

### 常见错误类型

```go
// API 错误代码
const (
    larkErrCalendarTimeRangeExceeded = 193103  // 时间范围超过 40 天
    larkErrCalendarTooManyInstances  = 193104  // 返回超过 1000 条实例
)

// 检查错误代码
func isTimeRangeExceededError(err error) bool {
    if exitErr, ok := err.(*output.ExitError); ok {
        return exitErr.Detail.Code == larkErrCalendarTimeRangeExceeded
    }
    return false
}

func isTooManyInstancesError(err error) bool {
    if exitErr, ok := err.(*output.ExitError); ok {
        return exitErr.Detail.Code == larkErrCalendarTooManyInstances
    }
    return false
}
```

### 用户友好的错误消息

```go
// 时间范围超过限制
"query failed: time range exceeds 40-day limit, please narrow the range"

// 实例过多
"query failed: more than 1000 instances in the time range, please narrow the range"

// 递归深度超限
"too many splits for instance_view"

// 身份问题
"calendar commands require a valid user login by default; when no valid user login state is available, " +
"auto identity falls back to bot and may operate on the bot calendar instead of your own. " +
"Run `lark-cli auth login --domain calendar` for your calendar, or rerun with `--as bot` if bot identity is intentional."

// 验证错误
"invalid attendee id format %q: should start with 'ou_', 'oc_', or 'omm_'"
"end time must be after start time"
"--user-id is required for bot identity"
```

---

## 实战：开发 +list-events 快捷命令

### 需求分析

创建一个 `+list-events` 命令，列出指定日期范围内的所有事件，支持：
- 时间范围查询（默认今天）
- 按标题过滤
- 按状态过滤（confirmed/cancelled）
- 支持多种输出格式

### 实现步骤

```go
package calendar

import (
    "context"
    "fmt"
    "sort"
    "strconv"
    "strings"
    "time"
    
    "github.com/larksuite/cli/shortcuts/common"
)

var ListEvents = common.Shortcut{
    Service:     "calendar",
    Command:     "+list-events",
    Description: "List calendar events in a date range",
    Risk:        "read",
    
    Scopes:      []string{"calendar:calendar.event:read"},
    AuthTypes:   []string{"user", "bot"},
    HasFormat:   true,
    
    Flags: []common.Flag{
        {
            Name:     "start",
            Type:     "string",
            Desc:     "Start date (default: today)",
            Required: false,
        },
        {
            Name:     "end",
            Type:     "string",
            Desc:     "End date (default: same as start)",
            Required: false,
        },
        {
            Name:     "title",
            Type:     "string",
            Desc:     "Filter by event title (substring match)",
            Required: false,
        },
        {
            Name:     "status",
            Type:     "string",
            Desc:     "Filter by status (confirmed/cancelled)",
            Required: false,
            Enum:     []string{"confirmed", "cancelled"},
        },
        {
            Name:     "calendar-id",
            Type:     "string",
            Desc:     "Calendar ID (default: primary)",
            Default:  "primary",
        },
    },
    
    Validate: validateListEvents,
    DryRun:   dryRunListEvents,
    Execute:  executeListEvents,
}

func validateListEvents(ctx context.Context, runtime *common.RuntimeContext) error {
    // 检查身份
    if err := rejectCalendarAutoBotFallback(runtime); err != nil {
        return err
    }
    
    // 验证时间格式
    if start := runtime.Str("start"); start != "" {
        if _, err := common.ParseTime(start); err != nil {
            return fmt.Errorf("invalid start date: %w", err)
        }
    }
    
    if end := runtime.Str("end"); end != "" {
        if _, err := common.ParseTime(end); err != nil {
            return fmt.Errorf("invalid end date: %w", err)
        }
    }
    
    return nil
}

func dryRunListEvents(ctx context.Context, runtime *common.RuntimeContext) *common.DryRunAPI {
    d := common.NewDryRunAPI()
    d.Desc("List calendar events")
    d.GET("/open-apis/calendar/v4/calendars/:calendar_id/events/instance_view")
    d.Set("calendar_id", runtime.Str("calendar-id"))
    return d
}

func executeListEvents(ctx context.Context, runtime *common.RuntimeContext) error {
    calendarId := runtime.Str("calendar-id")
    
    // 解析时间范围
    startInput, endInput := resolveStartEnd(runtime)
    startTime, _ := common.ParseTime(startInput)
    endTime, _ := common.ParseTime(endInput, "end")
    
    // 调用 API（使用递归分割）
    items, err := fetchInstanceViewRange(ctx, runtime, calendarId,
        parseUnixTime(startTime), parseUnixTime(endTime), 0)
    if err != nil {
        return err
    }
    
    // 去重和排序
    items = dedupeAndSortItems(items)
    
    // 过滤
    titleFilter := runtime.Str("title")
    statusFilter := runtime.Str("status")
    
    var filtered []map[string]interface{}
    for _, item := range items {
        // 标题过滤
        if titleFilter != "" {
            summary, _ := item["summary"].(string)
            if !strings.Contains(strings.ToLower(summary), strings.ToLower(titleFilter)) {
                continue
            }
        }
        
        // 状态过滤
        if statusFilter != "" {
            status, _ := item["status"].(string)
            if status != statusFilter {
                continue
            }
        }
        
        filtered = append(filtered, item)
    }
    
    // 输出
    return runtime.OutFormat(filtered, &common.Meta{Count: len(filtered)}, func(w io.Writer) {
        if len(filtered) == 0 {
            fmt.Fprintln(w, "No events found")
            return
        }
        
        var rows []map[string]interface{}
        for _, e := range filtered {
            eventId, _ := e["event_id"].(string)
            summary, _ := e["summary"].(string)
            if summary == "" {
                summary = "(untitled)"
            }
            
            startMap, _ := e["start_time"].(map[string]interface{})
            startTs, _ := startMap["timestamp"].(string)
            startStr := convertToLocalTime(startTs)
            
            rows = append(rows, map[string]interface{}{
                "event_id": eventId,
                "summary":  summary,
                "start":    startStr,
            })
        }
        
        common.PrintTable(w, rows)
        fmt.Fprintf(w, "\n%d event(s) total\n", len(filtered))
    })
}
```

---

## 最佳实践

### 1. 时间处理

```go
// ✓ 好：支持多种格式
startTime, _ := common.ParseTime(runtime.Str("start"))

// ✗ 不好：只支持一种格式
t, _ := time.Parse(time.RFC3339, runtime.Str("start"))
```

### 2. 大数据查询

```go
// ✓ 好：递归分割处理 API 限制
items, err := fetchInstanceViewRange(ctx, runtime, calendarId, start, end, 0)

// ✗ 不好：一次性查询，可能超过 API 限制
items, err := runtime.CallAPI("GET", "/open-apis/calendar/v4/calendars/.../events/instance_view", ...)
```

### 3. 并发优化

```go
// ✓ 好：使用信号量控制并发度
sem := make(chan struct{}, 10)

// ✗ 不好：无限制并发
go func() { ... }()
```

### 4. 事务性操作

```go
// ✓ 好：失败时自动回滚
if err != nil {
    rollback()
    return err
}

// ✗ 不好：不处理失败状态
createEvent()
addAttendees()
```

### 5. 身份检查

```go
// ✓ 好：防止自动回退到 bot
if err := rejectCalendarAutoBotFallback(runtime); err != nil {
    return err
}

// ✗ 不好：不检查身份
// 直接使用 runtime.IsBot()
```

---

## 相关资源

- [快捷命令开发实战](./shortcut-development.md) - 快捷命令框架
- [源码导航指南](./source-code-navigation.md) - 源码位置
- [GitHub 源码](https://github.com/larksuite/cli/tree/main/shortcuts/calendar) - Calendar 实现

---

## 下一步

- [高级认证系统](./advanced-auth.md) - 掌握多应用管理和身份切换
- [凭证提供者系统](./credential-providers.md) - 学习自定义密钥来源
- [设计你自己的 CLI](./design-your-own-cli.md) - 将服务开发模式应用到自己的项目
- 源码参考：[calendar_agenda.go](https://github.com/larksuite/cli/blob/main/shortcuts/calendar/calendar_agenda.go)、[calendar_create.go](https://github.com/larksuite/cli/blob/main/shortcuts/calendar/calendar_create.go)
