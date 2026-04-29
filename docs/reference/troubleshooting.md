# 故障排查

## 常见问题速查

| 问题 | 症状 | 解决方案 |
|------|------|---------|
| 未登录 | not_logged_in | lark-cli auth login |
| Token 过期 | token_expired | lark-cli auth login |
| 权限不足 | insufficient_scope | lark-cli auth login --scope "..." |
| 密钥链错误 | keychain_error | lark-cli config init |
| 超时 | timeout | 重试或检查网络 |
| 配置错误 | parse_error | lark-cli config init |

---

## 问题排查流程

```
遇到问题
    ├─ 步骤 1: 检查错误消息
    │  └─ 记录完整错误信息
    ├─ 步骤 2: 检查认证状态
    │  └─ lark-cli auth status
    ├─ 步骤 3: 验证 Token
    │  └─ lark-cli auth status --verify
    ├─ 步骤 4: 检查权限
    │  └─ lark-cli auth check --scope "..."
    ├─ 步骤 5: 查看日志
    │  └─ # 开启详细日志输出（示例，实际 CLI 版本请参考最新文档）
lark-cli auth status --verbose
    └─ 步骤 6: 重新初始化
       └─ lark-cli config init
```

---

## 具体问题解决

### 问题 1: 登录超时

**症状：**
```
[lark-cli] 等待授权...
[lark-cli] ERROR: authorization timed out
```

**原因：**
- 用户未在浏览器中完成授权
- 网络连接不稳定
- 设备码已过期

**解决方案：**
```bash
# 重新尝试登录
lark-cli auth login

# 或使用 --no-wait 模式
DEVICE_CODE=$(lark-cli auth login --no-wait --json | jq -r '.device_code')
# 等待用户授权
lark-cli auth login --device-code $DEVICE_CODE
```

### 问题 2: 权限不足

**症状：**
```
[lark-cli] ERROR: insufficient permissions
Missing: calendar:calendar:write
```

**原因：**
- Token 中没有所需的权限
- 权限未被应用授予

**解决方案：**
```bash
# 检查当前权限
lark-cli auth status

# 升级权限
lark-cli auth login --scope "calendar:calendar:write"

# 验证权限
lark-cli auth check --scope "calendar:calendar:write"
```

### 问题 3: 密钥链错误

**症状：**
```
[lark-cli] ERROR: keychain access failed
Hint: Check if the OS keychain is locked or accessible
```

**原因：**
- OS 密钥链被锁定
- 进程没有访问密钥链的权限
- 在沙箱环境中运行

**解决方案：**
```bash
# macOS: 解锁密钥链
security unlock-keychain

# 重新初始化配置
lark-cli config init

# 在沙箱外运行
# 或确保进程有密钥链访问权限
```

### 问题 4: 配置文件损坏

**症状：**
```
[lark-cli] ERROR: failed to parse config
```

**原因：**
- config.json 格式错误
- 文件被意外修改

**解决方案：**
```bash
# 备份旧配置
cp ~/.lark-cli/config.json ~/.lark-cli/config.json.bak

# 重新初始化
lark-cli config init

# 如果需要恢复
cp ~/.lark-cli/config.json.bak ~/.lark-cli/config.json
```

### 问题 5: 多个应用冲突

**症状：**
```
[lark-cli] ERROR: ambiguous profile
Multiple apps found, please specify --profile
```

**原因：**
- 有多个应用配置
- 未指定当前应用

**解决方案：**
```bash
# 列出所有应用
lark-cli profile list

# 指定应用
lark-cli --profile my-app calendar +agenda

# 或设置默认应用
lark-cli profile use my-app
```

### 问题 6: Token 刷新失败

**症状：**
```
[lark-cli] WARN: token refresh failed
[lark-cli] ERROR: token expired
```

**原因：**
- refresh_token 已过期
- 网络连接问题
- 应用权限被撤销

**解决方案：**
```bash
# 重新登录
lark-cli auth login

# 检查 Token 状态
lark-cli auth status --verify

# 查看详细错误
lark-cli auth status
```

---

## 调试技巧

### 启用调试日志

```bash
# 开启详细日志输出（示例，实际 CLI 版本请参考最新文档）
lark-cli auth status --verbose
lark-cli calendar +agenda
```

### 查看配置文件

```bash
lark-cli config show
```

### 验证 Token 有效性

```bash
lark-cli auth status --verify
```