# 场景和流程图

> 📖 **前置阅读**：建议先阅读 [鉴权系统详细解读](./architecture.md) 了解认证流程基础。

## 完整流程图

### 登录流程

```
lark-cli auth login
    ↓
解析权限范围
    ↓
RequestDeviceAuthorization()
    ↓
显示 verification_uri 给用户
    ↓
用户在浏览器中打开 URL 并授权
    ↓
PollDeviceToken()
    ├─ 初始间隔: 5 秒
    ├─ 最大间隔: 60 秒
    └─ 超时: 240 秒
    ↓
获取 access_token 和 refresh_token
    ↓
getUserInfo()
    ↓
SetStoredToken() 保存到 OS Keychain
    ↓
syncLoginUserToProfile() 更新 config.json
    ↓
登录完成
```

### API 调用流程

```
lark-cli calendar +agenda
    ↓
Factory.Config() 加载 config.json
    ↓
Factory.ResolveAs() 检查身份
    ↓
CredentialProvider.ResolveToken() 获取 Token
    ↓
检查 Token 状态
    ├─ valid: 直接使用
    ├─ needs_refresh: 自动刷新
    └─ expired: 提示重新登录
    ↓
调用 Lark API
    ↓
返回结果
```

---

## 实际场景

### 场景 1: 人类用户的典型工作流

```bash
# 1. 初始化
$ lark-cli config init
[lark-cli] 应用创建成功

# 2. 登录
$ lark-cli auth login --recommend
[lark-cli] 授权成功！
[lark-cli] 用户: 张三 (ou_xxx)

# 3. 使用 CLI
$ lark-cli calendar +agenda
09:00 - 10:00  团队会议
14:00 - 15:00  一对一

# 4. 查看认证状态
$ lark-cli auth status
{
  "appId": "cli_xxx",
  "identity": "user",
  "userName": "张三",
  "tokenStatus": "valid"
}

# 5. 登出
$ lark-cli auth logout
[lark-cli] 已登出
```

### 场景 2: AI Agent 的自动化工作流

```bash
# 1. 初始化（后台运行）
$ lark-cli config init --new &

# 2. 登录（无等待模式）
$ DEVICE_CODE=$(lark-cli auth login --no-wait --json | jq -r '.device_code')

# 3. 等待用户授权

# 4. 恢复轮询
$ lark-cli auth login --device-code $DEVICE_CODE

# 5. 执行任务
$ lark-cli calendar +agenda --json
{
  "events": [...]
}
```

### 场景 3: 多应用管理

```bash
# 1. 创建第一个应用
$ lark-cli config init

# 2. 创建第二个应用
$ lark-cli profile add

# 3. 列出所有应用
$ lark-cli profile list
my-app-1  cli_app1  ✓
my-app-2  cli_app2

# 4. 切换应用
$ lark-cli profile use my-app-2

# 5. 为新应用登录
$ lark-cli auth login
```

### 场景 4: 权限检查和升级

```bash
# 1. 检查当前权限
$ lark-cli auth check --scope "calendar:calendar:read"
ok: true

# 2. 检查不足的权限
$ lark-cli auth check --scope "calendar:calendar:write"
ok: false
missing: ["calendar:calendar:write"]

# 3. 升级权限
$ lark-cli auth login --scope "calendar:calendar:write"

# 4. 验证权限已升级
$ lark-cli auth check --scope "calendar:calendar:write"
ok: true
```

---

## 故障排查

### 问题 1: 登录超时

**症状：** authorization timed out

**原因：** 用户未在浏览器中完成授权、网络不稳定、设备码过期

**解决方案：**
```bash
lark-cli auth login
# 或使用 --no-wait 模式
DEVICE_CODE=$(lark-cli auth login --no-wait --json | jq -r '.device_code')
lark-cli auth login --device-code $DEVICE_CODE
```

### 问题 2: 权限不足

**症状：** insufficient permissions

**原因：** Token 中没有所需权限

**解决方案：**
```bash
lark-cli auth status
lark-cli auth login --scope "calendar:calendar:write"
lark-cli auth check --scope "calendar:calendar:write"
```

### 问题 3: 密钥链错误

**症状：** keychain access failed

**原因：** OS 密钥链被锁定或无访问权限

**解决方案：**
```bash
security unlock-keychain  # macOS
lark-cli config init      # 重新初始化
```

---

## 下一步

- [文档索引](./index.md) - 返回文档索引查看完整学习路径
- [设计你自己的 CLI](./design-your-own-cli.md) - 将所有模式应用到自己的项目
- [命令速查表](/reference/commands) - 快速查找常用命令