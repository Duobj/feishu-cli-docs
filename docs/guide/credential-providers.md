# 凭证提供者系统

lark-cli 采用**提供者链模式**管理凭证，支持灵活的凭证来源扩展。本文讲解如何理解和扩展凭证系统。

> 📖 **前置阅读**：建议先阅读 [鉴权系统详细解读](./architecture.md) 了解基础概念。

---

## 提供者链工作原理

### 凭证解析流程

当 lark-cli 需要凭证时，会按顺序查询提供者链：

```
API 调用需要凭证
    ↓
CredentialProvider.ResolveToken()
    ↓
遍历提供者链
    ├─ Extension Provider 1 (自定义)
    │   ├─ 能处理? → 返回凭证
    │   └─ 不能? → 继续下一个
    ├─ Extension Provider 2 (自定义)
    │   ├─ 能处理? → 返回凭证
    │   └─ 不能? → 继续下一个
    └─ Default Provider (内置)
        ├─ 从 Keychain 加载
        └─ 返回凭证或错误
```

### 提供者接口

每个提供者需要实现两个方法：

```go
type Provider interface {
    // 解析账户信息（用户或应用）
    ResolveAccount(ctx context.Context, hint string) (*Account, error)
    
    // 解析 Token
    ResolveToken(ctx context.Context, account *Account) (*Token, error)
}
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| `ctx` | 上下文，用于超时控制 |
| `hint` | 身份提示（"user" 或 "bot"） |
| `account` | 账户信息（用户 OpenID 或应用 ID） |

---

## 内置提供者

### 1. 环境变量提供者

**位置：** `/extension/credential/env/env.go`

**用途：** 从环境变量读取凭证，适合 CI/CD 和自动化场景

**支持的环境变量：**

```bash
# 用户 Token
LARK_USER_ACCESS_TOKEN=u-xxx
LARK_USER_REFRESH_TOKEN=ur-xxx

# 应用凭证
LARK_APP_ID=cli_xxx
LARK_APP_SECRET=***

# 租户 Token
LARK_TENANT_ACCESS_TOKEN=t-xxx
```

**使用示例：**

```bash
# 方式 1: 使用用户 Token
export LARK_USER_ACCESS_TOKEN="u-xxx"
lark-cli calendar +agenda

# 方式 2: 使用应用凭证
export LARK_APP_ID="cli_xxx"
export LARK_APP_SECRET="***"
lark-cli calendar +agenda

# 方式 3: 在 CI/CD 中
LARK_USER_ACCESS_TOKEN=${{ secrets.LARK_TOKEN }} lark-cli calendar +agenda
```

### 2. 默认提供者

**位置：** `/internal/credential/default_provider.go`

**用途：** 从 OS Keychain 读取凭证

**工作流程：**

1. 检查 config.json 中的 `defaultAs` 字段
2. 从 Keychain 查询 `{appId}:{userOpenId}` 的 Token
3. 检查 Token 状态（valid/needs_refresh/expired）
4. 如果需要刷新，自动调用 RefreshToken()

---

## 自定义提供者开发

### 场景 1: 从密钥管理服务读取凭证

例如从 AWS Secrets Manager 读取 Token：

```go
package aws_provider

import (
    "context"
    "github.com/aws/aws-sdk-go-v2/service/secretsmanager"
)

type AWSProvider struct {
    client *secretsmanager.Client
}

func (p *AWSProvider) ResolveAccount(ctx context.Context, hint string) (*Account, error) {
    // 从 AWS 获取账户信息
    secret, err := p.client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
        SecretId: "lark-cli/account",
    })
    if err != nil {
        return nil, err
    }
    
    // 解析并返回账户
    return parseAccount(secret.SecretString)
}

func (p *AWSProvider) ResolveToken(ctx context.Context, account *Account) (*Token, error) {
    // 从 AWS 获取 Token
    secret, err := p.client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
        SecretId: fmt.Sprintf("lark-cli/token/%s", account.ID),
    })
    if err != nil {
        return nil, err
    }
    
    return parseToken(secret.SecretString)
}
```

**注册提供者：**

```go
import "github.com/larksuite/cli/extension/credential"

func init() {
    credential.Register(&AWSProvider{
        client: createAWSClient(),
    })
}
```

### 场景 2: 从 HashiCorp Vault 读取凭证

```go
package vault_provider

import (
    "context"
    "github.com/hashicorp/vault/api"
)

type VaultProvider struct {
    client *api.Client
    path   string
}

func (p *VaultProvider) ResolveToken(ctx context.Context, account *Account) (*Token, error) {
    secret, err := p.client.Logical().ReadWithContext(ctx, 
        fmt.Sprintf("%s/%s", p.path, account.ID))
    if err != nil {
        return nil, err
    }
    
    return parseTokenFromVault(secret.Data)
}
```

### 场景 3: 从本地加密文件读取凭证

```go
package file_provider

import (
    "context"
    "crypto/aes"
    "os"
)

type FileProvider struct {
    keyPath string
}

func (p *FileProvider) ResolveToken(ctx context.Context, account *Account) (*Token, error) {
    // 读取加密文件
    encrypted, err := os.ReadFile(p.keyPath)
    if err != nil {
        return nil, err
    }
    
    // 解密
    decrypted, err := decrypt(encrypted)
    if err != nil {
        return nil, err
    }
    
    return parseToken(decrypted)
}
```

---

## 提供者链配置

### 注册多个提供者

```go
import "github.com/larksuite/cli/extension/credential"

func init() {
    // 优先级 1: 环境变量
    credential.Register(&EnvProvider{})
    
    // 优先级 2: AWS Secrets Manager
    credential.Register(&AWSProvider{})
    
    // 优先级 3: 本地文件
    credential.Register(&FileProvider{})
    
    // 优先级 4: 默认提供者（Keychain）
    // 自动注册，无需显式调用
}
```

**查询顺序：**

1. 环境变量提供者 - 检查 `LARK_USER_ACCESS_TOKEN` 等
2. AWS 提供者 - 查询 AWS Secrets Manager
3. 文件提供者 - 读取本地加密文件
4. 默认提供者 - 从 Keychain 读取

**第一个能返回有效凭证的提供者获胜。**

---

## 实战场景

### 场景 1: CI/CD 流程

**需求：** 在 GitHub Actions 中使用 lark-cli

**方案：** 使用环境变量提供者

```yaml
name: Lark CLI in CI

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup lark-cli
        run: npm install -g @larksuite/cli
      
      - name: Run lark-cli
        env:
          LARK_USER_ACCESS_TOKEN: ${{ secrets.LARK_TOKEN }}
        run: |
          lark-cli calendar +agenda
          lark-cli im +send --text "Build completed"
```

### 场景 2: 多环境凭证管理

**需求：** 开发、测试、生产环境使用不同的凭证

**方案：** 使用自定义提供者从配置服务读取

```go
type ConfigServiceProvider struct {
    env string // "dev", "test", "prod"
}

func (p *ConfigServiceProvider) ResolveToken(ctx context.Context, account *Account) (*Token, error) {
    // 从配置服务读取对应环境的凭证
    url := fmt.Sprintf("https://config.example.com/lark/%s/%s", p.env, account.ID)
    return fetchTokenFromConfigService(url)
}
```

**使用：**

```bash
# 开发环境
LARK_ENV=dev lark-cli calendar +agenda

# 生产环境
LARK_ENV=prod lark-cli calendar +agenda
```

### 场景 3: 自动化脚本中的凭证轮换

**需求：** 定期更新 Token，避免过期

**方案：** 自定义提供者实现 Token 刷新逻辑

```go
type RefreshingProvider struct {
    store TokenStore
}

func (p *RefreshingProvider) ResolveToken(ctx context.Context, account *Account) (*Token, error) {
    token, err := p.store.Get(account.ID)
    if err != nil {
        return nil, err
    }
    
    // 如果 Token 即将过期，主动刷新
    if token.ExpiresAt.Sub(time.Now()) < 5*time.Minute {
        newToken, err := p.refreshToken(token.RefreshToken)
        if err != nil {
            return nil, err
        }
        p.store.Set(account.ID, newToken)
        return newToken, nil
    }
    
    return token, nil
}
```

---

## 最佳实践

### 1. 错误处理

提供者应该明确区分"无法处理"和"处理失败"：

```go
func (p *CustomProvider) ResolveToken(ctx context.Context, account *Account) (*Token, error) {
    // 无法处理：返回 nil, nil（让下一个提供者尝试）
    if !p.canHandle(account) {
        return nil, nil
    }
    
    // 处理失败：返回错误
    token, err := p.fetchToken(account)
    if err != nil {
        return nil, fmt.Errorf("failed to fetch token: %w", err)
    }
    
    return token, nil
}
```

### 2. 超时控制

始终尊重 context 的超时设置：

```go
func (p *CustomProvider) ResolveToken(ctx context.Context, account *Account) (*Token, error) {
    // 使用 context 的超时
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()
    
    return p.fetchTokenWithContext(ctx, account)
}
```

### 3. 日志记录

记录提供者的行为，便于调试：

```go
func (p *CustomProvider) ResolveToken(ctx context.Context, account *Account) (*Token, error) {
    log.Debugf("CustomProvider: resolving token for %s", account.ID)
    
    token, err := p.fetchToken(account)
    if err != nil {
        log.Debugf("CustomProvider: failed to resolve token: %v", err)
        return nil, err
    }
    
    log.Debugf("CustomProvider: successfully resolved token")
    return token, nil
}
```

### 4. 安全性

- 不要在日志中输出完整 Token
- 使用 Token 掩码：`u-xxx...xxx`
- 敏感信息存储在安全位置（Keychain、Vault 等）
- 定期轮换凭证

---

## 故障排查

### 问题 1: 提供者未被调用

**症状：** 自定义提供者的代码未执行

**原因：** 提供者未正确注册

**解决方案：**

```go
// 确保 init() 函数被调用
func init() {
    credential.Register(&CustomProvider{})
}

// 在 main.go 中导入包
import _ "your-module/custom-provider"
```

### 问题 2: 提供者返回过期 Token

**症状：** API 调用返回 401 Unauthorized

**原因：** 提供者返回的 Token 已过期

**解决方案：**

```go
func (p *CustomProvider) ResolveToken(ctx context.Context, account *Account) (*Token, error) {
    token, err := p.fetchToken(account)
    if err != nil {
        return nil, err
    }
    
    // 检查 Token 是否有效
    if token.ExpiresAt.Before(time.Now()) {
        return nil, fmt.Errorf("token expired at %v", token.ExpiresAt)
    }
    
    return token, nil
}
```

### 问题 3: 提供者链顺序错误

**症状：** 错误的提供者被使用

**原因：** 提供者注册顺序不对

**解决方案：**

```go
// 正确的顺序：特定 → 通用 → 默认
func init() {
    // 1. 最特定的提供者（环境变量）
    credential.Register(&EnvProvider{})
    
    // 2. 中等特定的提供者（密钥管理服务）
    credential.Register(&VaultProvider{})
    
    // 3. 通用提供者（本地文件）
    credential.Register(&FileProvider{})
    
    // 4. 默认提供者（Keychain）- 自动注册
}
```

---

## 相关资源

- [鉴权系统详细解读](./architecture.md) - 理论基础
- [认证实战指南](./advanced-auth.md) - 实战场景
- [源码位置](https://github.com/larksuite/cli/tree/main/extension/credential) - GitHub 仓库

---

## 下一步

- 查看 [环境变量提供者源码](https://github.com/larksuite/cli/blob/main/extension/credential/env/env.go)
- 学习 [默认提供者实现](https://github.com/larksuite/cli/blob/main/internal/credential/default_provider.go)
- 贡献自己的提供者到社区
