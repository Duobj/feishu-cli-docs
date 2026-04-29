# 配置管理系统

本文讲解 lark-cli 如何设计和实现配置管理系统，包括配置结构、持久化、多应用支持、敏感数据处理等核心设计模式。

> 📖 **前置阅读**：建议先阅读 [命令系统设计](./command-system.md) 了解 CLI 架构。

---

## 配置系统概览

lark-cli 的配置系统需要解决以下问题：

| 问题 | 解决方案 |
|------|--------|
| 多应用管理 | 数组结构 + 名称/ID 查询 |
| 敏感数据安全 | Keychain 抽象 + 加密存储 |
| 数据一致性 | 原子写入 + 临时文件 |
| 配置初始化 | 交互式 TUI + Device Flow |
| 向后兼容 | 懒加载字段 + 默认值 |
| 用户体验 | 配置缓存 + 快速切换 |

---

## 配置文件结构

### 文件位置

```bash
# 默认位置
~/.lark-cli/config.json

# 自定义位置
export LARKSUITE_CLI_CONFIG_DIR=/path/to/config
```

### 配置结构

```json
{
  "strictMode": {
    "status": "off",
    "identity": null
  },
  "currentApp": "my-app-1",
  "previousApp": "my-app-2",
  "apps": [
    {
      "name": "my-app-1",
      "appId": "cli_xxx",
      "appSecret": {
        "ref": {
          "source": "keychain",
          "id": "appsecret:cli_xxx"
        }
      },
      "brand": "feishu",
      "lang": "zh",
      "defaultAs": "ou_xxx",
      "strictMode": null,
      "users": [
        {
          "userOpenId": "ou_xxx",
          "userName": "张三"
        },
        {
          "userOpenId": "ou_yyy",
          "userName": "李四"
        }
      ]
    },
    {
      "name": "my-app-2",
      "appId": "cli_yyy",
      "appSecret": {
        "ref": {
          "source": "keychain",
          "id": "appsecret:cli_yyy"
        }
      },
      "brand": "lark",
      "lang": "en",
      "defaultAs": "ou_yyy",
      "strictMode": null,
      "users": [
        {
          "userOpenId": "ou_yyy",
          "userName": "Li Si"
        }
      ]
    }
  ]
}
```

### 配置字段说明

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `strictMode` | Object | 全局严格模式设置 | `{"status": "off"}` |
| `currentApp` | String | 当前活跃应用名称 | `"my-app-1"` |
| `previousApp` | String | 上一个应用名称（用于快速切换） | `"my-app-2"` |
| `apps` | Array | 应用列表 | `[{...}, {...}]` |
| `apps[].name` | String | 应用显示名称 | `"my-app-1"` |
| `apps[].appId` | String | 应用 ID（唯一标识） | `"cli_xxx"` |
| `apps[].appSecret` | Object | 应用密钥（存储在 Keychain） | `{"ref": {...}}` |
| `apps[].brand` | String | 品牌（feishu/lark） | `"feishu"` |
| `apps[].lang` | String | 语言（zh/en） | `"zh"` |
| `apps[].defaultAs` | String | 默认身份（user/bot） | `"ou_xxx"` |
| `apps[].strictMode` | Object | 应用级严格模式（覆盖全局） | `null` |
| `apps[].users` | Array | 已登录用户列表 | `[{...}]` |

---

## 配置加载与保存

### 加载流程

```
应用启动
  ├─ 检查 LARKSUITE_CLI_CONFIG_DIR 环境变量
  ├─ 如果未设置，使用 ~/.lark-cli
  ├─ 读取 config.json
  ├─ 解析 JSON
  ├─ 验证结构（apps 非空）
  └─ 返回配置对象
```

### 加载策略

**无缓存设计**：
- 每次操作都从磁盘读取最新配置
- 避免内存缓存导致的不一致
- 适合多进程场景（多个 CLI 实例并发运行）

```go
// ✓ 好：每次读取最新配置
func (f *Factory) Config() *Config {
    config, err := core.LoadMultiAppConfig()
    if err != nil {
        return nil
    }
    return config
}

// ✗ 不好：缓存导致不一致
var cachedConfig *Config

func (f *Factory) Config() *Config {
    if cachedConfig != nil {
        return cachedConfig  // 可能已过期
    }
    cachedConfig, _ = core.LoadMultiAppConfig()
    return cachedConfig
}
```

### 保存流程

```
修改配置
  ├─ 验证配置有效性
  ├─ 创建临时文件 (.config.json.*.tmp)
  ├─ 写入 JSON 数据
  ├─ 调用 Sync() 确保写入磁盘
  ├─ 原子重命名到最终路径
  └─ 清理临时文件
```

### 原子写入（Atomic Write）

原子写入是保证数据一致性的关键：

```go
// 伪代码
func AtomicWrite(path string, data []byte) error {
    // 1. 创建临时文件
    tmpFile, err := ioutil.TempFile(filepath.Dir(path), ".tmp")
    if err != nil {
        return err
    }
    defer os.Remove(tmpFile.Name())  // 失败时清理
    
    // 2. 写入数据
    if _, err := tmpFile.Write(data); err != nil {
        return err
    }
    
    // 3. 设置权限（0600 = 仅所有者可读写）
    if err := os.Chmod(tmpFile.Name(), 0600); err != nil {
        return err
    }
    
    // 4. 同步到磁盘
    if err := tmpFile.Sync(); err != nil {
        return err
    }
    
    tmpFile.Close()
    
    // 5. 原子重命名（操作系统保证原子性）
    return os.Rename(tmpFile.Name(), path)
}
```

**为什么需要原子写入？**

- **防止部分写入**：进程崩溃时，临时文件不会覆盖原配置
- **防止损坏**：即使磁盘满或权限错误，原配置保持完整
- **多进程安全**：其他进程总是看到完整的配置文件

---

## 敏感数据处理

### 问题：AppSecret 如何安全存储？

❌ **不安全的方式**：
```json
{
  "appSecret": "***"  // 明文存储在磁盘
}
```

✅ **安全的方式**：
```json
{
  "appSecret": {
    "ref": {
      "source": "keychain",
      "id": "appsecret:cli_xxx"
    }
  }
}
```

### SecretInput 联合类型

```go
type SecretInput struct {
    Plain string     // 明文（用于初始化）
    Ref   *SecretRef // 引用（用于存储）
}

type SecretRef struct {
    Source   string // "keychain" | "file"
    Provider string // 保留字段
    ID       string // Keychain 键或文件路径
}
```

### 敏感数据流程

```
用户输入 AppSecret
  ├─ 初始化时：Plain = "***"
  ├─ 保存前：转换为 Keychain 引用
  │  └─ 调用 Keychain.Set("appsecret:cli_xxx", "***")
  ├─ 保存到 config.json：只保存引用
  │  └─ {"ref": {"source": "keychain", "id": "appsecret:cli_xxx"}}
  │
  └─ 使用时：解析引用
     └─ 调用 Keychain.Get("appsecret:cli_xxx")
```

### Keychain 实现

lark-cli 使用跨平台 Keychain 抽象：

| 平台 | 实现 | 存储位置 |
|------|------|--------|
| macOS | System Keychain | `~/Library/Keychains/` |
| Linux | AES-256-GCM 加密文件 | `~/.lark-cli/keychain/` |
| Windows | DPAPI + Registry | Windows Registry |

**Keychain 键格式**：
```
appsecret:<appId>           # AppSecret
<appId>:<userOpenId>        # 用户 Access Token
```

**示例**：
```
appsecret:cli_xxx           # 应用 cli_xxx 的密钥
cli_xxx:ou_yyy              # 应用 cli_xxx 中用户 ou_yyy 的 Token
```

---

## 多应用管理

### 应用查询

应用通过两种方式查询：

**1. 按名称查询（优先）**
```bash
lark-cli profile use my-app-1
# 查询 apps[].name == "my-app-1"
```

**2. 按 AppID 查询（备选）**
```bash
lark-cli profile use cli_xxx
# 如果名称未找到，查询 apps[].appId == "cli_xxx"
```

### 应用切换

```bash
# 列出所有应用
$ lark-cli profile list
┌──────────────┬──────────────┬────────────┐
│ 名称         │ AppID        │ 当前       │
├──────────────┼──────────────┼────────────┤
│ my-app-1     │ cli_xxx      │ ✓          │
│ my-app-2     │ cli_yyy      │            │
└──────────────┴──────────────┴────────────┘

# 切换应用
$ lark-cli profile use my-app-2
[lark-cli] 已切换到 my-app-2

# 快速切换回上一个应用
$ lark-cli profile use -
[lark-cli] 已切换到 my-app-1
```

### 应用切换实现

```go
// 保存当前应用为 previousApp
config.PreviousApp = config.CurrentApp

// 设置新应用
config.CurrentApp = newAppName

// 保存配置
SaveMultiAppConfig(config)
```

---

## 配置初始化

### 初始化模式

#### 1. 交互式初始化（默认）

```bash
$ lark-cli config init
? 选择操作方式:
  > 创建新应用
    使用现有应用

# 选择"创建新应用"
? 应用名称: my-app-1
? 品牌: (feishu/lark) feishu
? 语言: (zh/en) zh

# 打开浏览器进行授权...
```

#### 2. 非交互式初始化

```bash
lark-cli config init \
  --app-id cli_xxx \
  --app-secret-stdin \
  --brand feishu \
  --lang zh < secret.txt
```

#### 3. 创建新应用（Device Flow）

```bash
$ lark-cli config init --new
[lark-cli] 打开浏览器访问: https://open.feishu.cn/app/cli?...
[lark-cli] 请输入 user_code: ABC123
[lark-cli] 应用创建成功
[lark-cli] AppID: cli_xxx
[lark-cli] AppSecret: ***
```

#### 4. 添加新应用到现有配置

```bash
$ lark-cli profile add
? 应用名称: my-app-2
? 品牌: lark
? 语言: en
? 使用现有应用还是创建新应用?
  > 使用现有应用
    创建新应用
```

### 初始化流程图

```
config init
  ├─ 检查是否已有配置
  ├─ 如果有：选择"添加新应用"或"替换"
  ├─ 如果无：创建新配置
  │
  ├─ 选择应用来源
  │  ├─ 创建新应用 → Device Flow
  │  └─ 使用现有应用 → 手工输入
  │
  ├─ 输入应用信息
  │  ├─ 应用名称
  │  ├─ AppID
  │  ├─ AppSecret
  │  ├─ 品牌（feishu/lark）
  │  └─ 语言（zh/en）
  │
  ├─ 保存 AppSecret 到 Keychain
  ├─ 保存配置到 config.json
  └─ 完成
```

---

## 配置验证

### 应用名称验证

应用名称需要满足以下条件：

```go
func ValidateProfileName(name string) error {
    // 1. 长度限制
    if len(name) == 0 || len(name) > 64 {
        return fmt.Errorf("name must be 1-64 characters")
    }
    
    // 2. 禁止控制字符
    for _, r := range name {
        if r < 0x20 || r == 0x7F {
            return fmt.Errorf("name contains control characters")
        }
    }
    
    // 3. 禁止 Shell 特殊字符
    forbidden := " \t/\\\"'`$#!&|;(){}[]<>?*~"
    if strings.ContainsAny(name, forbidden) {
        return fmt.Errorf("name contains forbidden characters: %s", forbidden)
    }
    
    return nil
}
```

**有效的名称**：
- `my-app-1` ✓
- `生产环境` ✓（支持 Unicode）
- `app_prod` ✓
- `my app` ✗（包含空格）
- `app/prod` ✗（包含 `/`）

### 密钥匹配验证

防止手工编辑 config.json 导致的不一致：

```go
func ValidateSecretKeyMatch(appId string, secretRef *SecretRef) error {
    if secretRef.Source != "keychain" {
        return nil  // 非 Keychain 来源不验证
    }
    
    expectedKey := fmt.Sprintf("appsecret:%s", appId)
    if secretRef.ID != expectedKey {
        return fmt.Errorf("secret key mismatch: expected %s, got %s",
            expectedKey, secretRef.ID)
    }
    
    return nil
}
```

---

## 配置默认值

### 字段默认值

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `brand` | `"feishu"` | 飞书品牌 |
| `lang` | `"zh"` | 中文 |
| `defaultAs` | `""` | 自动检测 |
| `strictMode` | `"off"` | 无限制 |

### 默认值解析

```go
func (c *AppConfig) GetBrand() string {
    if c.Brand != "" {
        return c.Brand
    }
    return "feishu"  // 默认值
}

func (c *AppConfig) GetLang() string {
    if c.Lang != "" {
        return c.Lang
    }
    return "zh"  // 默认值
}

func (c *AppConfig) GetDefaultAs() string {
    if c.DefaultAs != "" {
        return c.DefaultAs
    }
    return ""  // 自动检测
}
```

---

## 配置迁移

### 向后兼容策略

lark-cli 采用**懒加载**策略处理配置升级：

**1. 新字段自动添加**
```go
// 旧配置没有 strictMode 字段
// 加载时自动初始化为默认值
if config.StrictMode == nil {
    config.StrictMode = &StrictMode{Status: "off"}
}
```

**2. 旧字段自动清理**
```go
// 当 AppId 变更时，清理旧 Keychain 条目
oldKey := fmt.Sprintf("appsecret:%s", oldAppId)
keychain.Remove(oldKey)  // 最佳努力，错误忽略
```

**3. 配置版本化（可选）**
```json
{
  "version": "1.0",
  "apps": [...]
}
```

### 迁移示例

**从 v0.9 升级到 v1.0**：

```
v0.9 配置：
{
  "appId": "cli_xxx",
  "appSecret": "***",
  "users": [...]
}

↓ 自动迁移

v1.0 配置：
{
  "currentApp": "default",
  "apps": [
    {
      "name": "default",
      "appId": "cli_xxx",
      "appSecret": {"ref": {"source": "keychain", "id": "appsecret:cli_xxx"}},
      "users": [...]
    }
  ]
}
```

---

## 配置命令

### 配置初始化

```bash
# 交互式初始化
lark-cli config init

# 创建新应用
lark-cli config init --new

# 非交互式初始化
lark-cli config init \
  --app-id cli_xxx \
  --app-secret-stdin \
  --brand feishu

# 添加新应用
lark-cli profile add
```

### 配置查看

```bash
# 查看当前配置
lark-cli config show

# 查看所有应用
lark-cli profile list

# 查看当前应用信息
lark-cli auth status
```

### 配置修改

```bash
# 切换应用
lark-cli profile use my-app-2

# 快速切换回上一个应用
lark-cli profile use -

# 重命名应用
lark-cli profile rename my-app-1 production

# 删除应用
lark-cli profile remove my-app-2
```

---

## 最佳实践

### 1. 配置文件权限

```bash
# ✓ 好：仅所有者可读写
-rw------- 1 user staff config.json

# ✗ 不好：其他用户可读
-rw-r--r-- 1 user staff config.json
```

### 2. 敏感数据处理

```go
// ✓ 好：使用 Keychain 存储密钥
appSecret := &SecretInput{
    Ref: &SecretRef{
        Source: "keychain",
        ID:     fmt.Sprintf("appsecret:%s", appId),
    },
}

// ✗ 不好：明文存储
appSecret := &SecretInput{
    Plain: "***",  // 写入磁盘
}
```

### 3. 原子写入

```go
// ✓ 好：使用原子写入
err := atomicWrite(configPath, data)

// ✗ 不好：直接写入
err := ioutil.WriteFile(configPath, data, 0600)
```

### 4. 配置验证

```go
// ✓ 好：保存前验证
if err := ValidateProfileName(name); err != nil {
    return err
}
SaveMultiAppConfig(config)

// ✗ 不好：保存后验证
SaveMultiAppConfig(config)
if err := ValidateProfileName(name); err != nil {
    return err
}
```

### 5. 错误处理

```go
// ✓ 好：区分可恢复和不可恢复错误
if err := keychain.Set(key, value); err != nil {
    if isKeychainLocked(err) {
        return fmt.Errorf("keychain locked: %w", err)
    }
    // 其他错误也返回
    return err
}

// ✗ 不好：忽略错误
keychain.Set(key, value)  // 错误被忽略
```

---

## 设计模式

### 1. 联合类型（Union Type）

使用 `SecretInput` 支持多种存储方式：

```go
type SecretInput struct {
    Plain string     // 明文
    Ref   *SecretRef // 引用
}

// 使用时检查哪个字段非空
if input.Plain != "" {
    // 使用明文
} else if input.Ref != nil {
    // 使用引用
}
```

### 2. 原子操作

使用临时文件 + 重命名实现原子写入：

```
Write → Sync → Rename
```

### 3. 多层级配置

全局配置 + 应用级配置 + 用户级配置：

```
Global StrictMode
    ↓
App StrictMode (覆盖全局)
    ↓
User Identity (最终决定)
```

### 4. 懒加载

配置升级时自动初始化新字段：

```go
if config.StrictMode == nil {
    config.StrictMode = &StrictMode{Status: "off"}
}
```

---

## 实战：实现自己的配置系统

### 步骤 1：定义配置结构

```go
type Config struct {
    CurrentProfile string
    Profiles       []Profile
}

type Profile struct {
    Name   string
    ApiKey string  // 存储在 Keychain
    Endpoint string
}
```

### 步骤 2：实现加载和保存

```go
func LoadConfig() (*Config, error) {
    data, err := ioutil.ReadFile(configPath())
    if err != nil {
        return nil, err
    }
    
    var config Config
    if err := json.Unmarshal(data, &config); err != nil {
        return nil, err
    }
    
    return &config, nil
}

func SaveConfig(config *Config) error {
    data, err := json.MarshalIndent(config, "", "  ")
    if err != nil {
        return err
    }
    
    return atomicWrite(configPath(), data)
}
```

### 步骤 3：实现敏感数据处理

```go
func (p *Profile) SetApiKey(key string) error {
    return keychain.Set(fmt.Sprintf("myapp:%s", p.Name), key)
}

func (p *Profile) GetApiKey() (string, error) {
    return keychain.Get(fmt.Sprintf("myapp:%s", p.Name))
}
```

### 步骤 4：实现验证

```go
func ValidateProfile(p *Profile) error {
    if p.Name == "" {
        return fmt.Errorf("profile name required")
    }
    if p.Endpoint == "" {
        return fmt.Errorf("endpoint required")
    }
    return nil
}
```

---

## 相关资源

- [命令系统设计](./command-system.md) - CLI 命令架构
- [实现指南](./implementation.md) - 代码架构详解
- [源码位置](https://github.com/larksuite/cli/tree/main/internal/core) - GitHub 仓库

---

## 下一步

- [错误处理体系](./error-handling.md) - 学习 CLI 的错误处理设计
- 源码参考：[配置加载](https://github.com/larksuite/cli/blob/main/internal/core/config.go)、[原子写入](https://github.com/larksuite/cli/blob/main/internal/vfs/localfileio/atomicwrite.go)、[Keychain](https://github.com/larksuite/cli/blob/main/internal/keychain/keychain.go)
