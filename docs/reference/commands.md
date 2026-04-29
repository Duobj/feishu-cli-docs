# 命令速查表

## 初始化和配置

| 命令 | 用途 |
|------|------|
| lark-cli config init | 创建新应用配置 |
| lark-cli config show | 显示当前配置 |
| lark-cli profile list | 列出所有应用 |
| lark-cli profile use | 切换应用 |
| lark-cli profile add | 添加新应用 |

## 认证管理

| 命令 | 用途 |
|------|------|
| lark-cli auth login | 用户登录 |
| lark-cli auth login --recommend | 推荐权限登录 |
| lark-cli auth login --scope | 指定权限 |
| lark-cli auth logout | 登出 |
| lark-cli auth status | 查看状态 |
| lark-cli auth check | 检查权限 |

## 高级选项

| 选项 | 用途 |
|------|------|
| --as user | 强制用户身份 |
| --as bot | 强制 Bot 身份 |
| --as auto | 自动检测身份 |
| --profile | 指定应用 |
| --json | JSON 输出 |

---

## 常用命令组合

### 第一次使用

```bash
lark-cli config init
lark-cli auth login --recommend
lark-cli auth status
lark-cli calendar +agenda
```

### 升级权限

```bash
lark-cli auth status
lark-cli auth check --scope "calendar:calendar:write"
lark-cli auth login --scope "calendar:calendar:write"
```

### 多应用管理

```bash
lark-cli profile add
lark-cli profile list
lark-cli profile use my-app-2
lark-cli auth login
```

### AI Agent 集成

```bash
lark-cli config init --new &
DEVICE_CODE=$(lark-cli auth login --no-wait --json | jq -r '.device_code')
lark-cli auth login --device-code $DEVICE_CODE
lark-cli calendar +agenda --json
```

---

## 环境变量

| 变量 | 用途 |
|------|------|
| LARK_USER_ACCESS_TOKEN | 提供 User Access Token (UAT) |
| LARK_APP_SECRET | 提供 AppSecret |
| LARK_CONFIG_DIR | 配置目录 |
| LARK_DEBUG | 启用调试 |

---

## 安全检查清单

### 认证安全
- [ ] 使用强密码保护 AppSecret
- [ ] 定期轮换 AppSecret
- [ ] 不要在代码中硬编码 Token
- [ ] 使用环境变量或密钥管理系统

### 存储安全
- [ ] 使用 OS 原生密钥链
- [ ] 不要在配置文件中存储 Token
- [ ] 限制配置文件权限（600）
- [ ] 不要提交 config.json 到版本控制

### 权限安全
- [ ] 只请求必要的权限
- [ ] 定期审查授予的权限
- [ ] 及时撤销不需要的权限
- [ ] 使用严格模式限制 Agent 权限