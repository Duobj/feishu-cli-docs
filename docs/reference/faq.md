# 常见问题

## 认证相关

### Q: 如何在 CI/CD 中使用 lark-cli？

**A:** 使用 `--no-wait` 模式获取 device_code，然后在浏览器中完成授权：

```bash
DEVICE_CODE=$(lark-cli auth login --no-wait --json | jq -r '.device_code')
lark-cli auth login --device-code $DEVICE_CODE
```

或者使用环境变量提供 Token：

```bash
export LARK_USER_ACCESS_TOKEN="uat_xxx"
lark-cli calendar +agenda
```

### Q: 如何处理 Token 过期？

**A:** 系统会自动刷新 Token。如果刷新失败，会返回错误提示用户重新登录。

### Q: 如何安全地存储 AppSecret？

**A:** 不要在配置文件中存储 AppSecret。使用以下方式之一：

1. 环境变量：`export LARK_APP_SECRET="xxx"`
2. 密钥管理系统：`export LARK_APP_SECRET=$(vault kv get -field=secret secret/lark-cli)`
3. 自定义凭证提供者：实现 `extension/credential.Provider` 接口

---

## 多应用管理

### Q: 如何在多个应用间切换？

**A:** 使用 profile 命令：

```bash
# 列出所有应用
lark-cli profile list

# 切换应用
lark-cli profile use my-app

# 查看当前应用
lark-cli profile current
```

### Q: 如何创建新应用？

**A:** 使用以下命令：

```bash
lark-cli profile add
```

---

## 权限相关

### Q: 如何检查当前权限？

**A:** 使用以下命令：

```bash
lark-cli auth status
```

### Q: 如何升级权限？

**A:** 使用以下命令：

```bash
lark-cli auth login --scope "calendar:calendar:write"
```

### Q: 如何检查特定权限？

**A:** 使用以下命令：

```bash
lark-cli auth check --scope "calendar:calendar:read"
```

---

## 身份相关

### Q: User 和 Bot 身份有什么区别？

**A:** 
- **User**：用户身份，需要通过 Device Flow OAuth 登录，权限由用户授予
- **Bot**：租户身份，使用应用凭证（AppID + AppSecret），权限由应用配置

### Q: 如何强制使用特定身份？

**A:** 使用 `--as` 标志：

```bash
lark-cli calendar +agenda --as user    # 强制用户身份
lark-cli calendar +agenda --as bot     # 强制 Bot 身份
lark-cli calendar +agenda --as auto    # 自动检测
```