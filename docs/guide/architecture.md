# 鉴权系统详细解读

## 架构概览

lark-cli 的鉴权体系采用**分层设计**，从上到下分为：

```
Command Layer (auth login/logout/...)
    ↓
Credential Provider (凭证提供者链)
├─ Extension Providers (插件)
└─ Default Provider (默认)
    ↓
Token Store (Token 存储)
├─ Keychain (OS 原生密钥链)
└─ Config (配置文件)
    ↓
OAuth Endpoints (飞书 OAuth 服务)
├─ Device Authorization
└─ Token Exchange
```

### 核心特点

- **Device Flow OAuth**：支持无浏览器自动化场景（AI Agent）
- **多身份支持**：User（用户）和 Bot（租户）两种身份
- **多应用配置**：支持多个飞书应用的并行管理
- **安全存储**：使用 OS 原生密钥链存储敏感信息
- **自动刷新**：Token 过期前自动刷新

---

## 核心流程

### 登录流程（Device Flow）

```
lark-cli auth login [--scope/--domain/--recommend]
    ↓
Step 1: 请求设备授权
    └─ RequestDeviceAuthorization()
       ├─ POST /oauth2/v2/device_authorization
       └─ 返回: device_code, user_code, verification_uri
    ↓
Step 2: 显示验证 URL
    └─ 用户在浏览器打开 verification_uri_complete
    ↓
Step 3: 轮询 Token 端点
    └─ PollDeviceToken()
       ├─ 初始间隔: 5 秒
       ├─ 最大间隔: 60 秒
       └─ 超时: 240 秒
    ↓
Step 4: 获取用户信息
    └─ getUserInfo()
    ↓
Step 5: 存储 Token
    └─ SetStoredToken() 保存到 OS Keychain
    ↓
Step 6: 更新配置
    └─ syncLoginUserToProfile()
```

---

## Token 生命周期

```
授予时间 (GrantedAt)
    ├─ 0 ~ (ExpiresAt - 5min)
    │  └─ 状态: valid → 直接使用
    ├─ (ExpiresAt - 5min) ~ ExpiresAt
    │  └─ 状态: needs_refresh → 自动刷新
    ├─ ExpiresAt ~ RefreshExpiresAt
    │  └─ 状态: expired (但可刷新) → 刷新获取新 Token
    └─ RefreshExpiresAt 之后
       └─ 状态: expired → 提示用户重新登录
```

---

## 身份管理

### User（用户身份）
- **Token 类型**：UAT (User Access Token)
- **获取方式**：Device Flow OAuth 登录
- **权限范围**：用户授予的权限
- **使用场景**：需要用户权限的操作
- **存储**：Keychain（加密）

### Bot（租户身份）
- **Token 类型**：TAT (Tenant Access Token)
- **获取方式**：应用凭证（AppID + AppSecret）
- **权限范围**：应用配置的权限
- **使用场景**：后台任务、系统操作
- **存储**：不需要存储（从 AppSecret 动态生成）

---

## 安全机制

### 密钥链存储

#### 跨平台支持
- **macOS**：系统 Keychain
- **Linux**：AES-256-GCM 加密文件
- **Windows**：DPAPI + Registry

### Token 掩码

日志输出时隐藏 Token，防止敏感信息泄露。

### 严格模式

限制 AI Agent 的身份选择，防止 Agent 滥用权限。

---

## 最佳实践

### 安全性
- ✅ 使用 OS 密钥链存储 Token
- ✅ 定期检查 Token 状态
- ✅ 不要在日志中输出完整 Token
- ✅ 使用严格模式限制 AI Agent 权限
- ❌ 不要在配置文件中存储 Token
- ❌ 不要共享 AppSecret

### 权限管理
```bash
lark-cli auth login --domain calendar    # 只请求必要的权限
lark-cli auth status                     # 检查当前权限
lark-cli auth check --scope "..."        # 验证特定权限
```

---

## 下一步

- [实现指南](./implementation.md) - 了解代码架构和目录结构
- [命令系统设计](./command-system.md) - 学习命令组织方式
- [场景和流程图](./scenarios.md) - 通过可视化理解完整流程