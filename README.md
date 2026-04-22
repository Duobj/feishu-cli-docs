# feishu-cli 源码学习

lark-cli 鉴权系统完整学习资料库。

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run docs:dev

# 访问 http://localhost:5173
```

### 构建

```bash
# 构建静态网站
npm run docs:build

# 预览构建结果
npm run docs:preview
```

## 部署

本项目使用 GitHub Pages 自动部署。当你推送到 `main` 分支时，GitHub Actions 会自动构建并部署网站。

### 首次部署步骤

1. 创建 GitHub 仓库
2. 推送代码到 `main` 分支
3. 在 GitHub 仓库设置中启用 GitHub Pages（选择 `gh-pages` 分支）
4. 网站将在 `https://your-username.github.io/feishu-cli-docs/` 上线

## 文档结构

```
docs/
├── index.md                    # 首页
├── guide/                      # 指南
│   ├── quick-start.md         # 快速开始
│   ├── index.md               # 文档索引
│   ├── architecture.md        # 鉴权系统详细解读
│   ├── implementation.md      # 实现指南
│   └── scenarios.md           # 场景和流程图
└── reference/                 # 参考
    ├── commands.md            # 命令速查表
    ├── faq.md                 # 常见问题
    └── troubleshooting.md     # 故障排查
```

## 编辑文档

所有文档都是 Markdown 格式，位于 `docs/` 目录下。编辑后保存，开发服务器会自动刷新。

## 技术栈

- [VitePress](https://vitepress.dev/) - 静态网站生成器
- [Vue 3](https://vuejs.org/) - 前端框架
- [GitHub Pages](https://pages.github.com/) - 托管平台

## 许可证

MIT
