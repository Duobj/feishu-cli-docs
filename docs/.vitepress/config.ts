import { defineConfig } from 'vitepress'

export default defineConfig({
  outDir: '../dist',
  title: 'feishu-cli 源码学习',
  description: 'lark-cli 鉴权系统完整学习资料库',
  base: '/feishu-cli-docs/',
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/guide/quick-start' },
      { text: '参考', link: '/reference/commands' },
      { text: 'GitHub', link: 'https://github.com/larksuite/cli' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: '入门',
          items: [
            { text: '快速开始', link: '/guide/quick-start' },
            { text: '文档索引', link: '/guide/index' }
          ]
        },
        {
          text: '深入理解',
          items: [
            { text: '鉴权系统详细解读', link: '/guide/architecture' },
            { text: '高级认证系统', link: '/guide/advanced-auth' },
            { text: '凭证提供者系统', link: '/guide/credential-providers' },
            { text: '命令系统设计', link: '/guide/command-system' },
            { text: '配置管理系统', link: '/guide/config-system' },
            { text: '实现指南', link: '/guide/implementation' },
            { text: '场景和流程图', link: '/guide/scenarios' }
          ]
        }
      ],
      '/reference/': [
        {
          text: '参考',
          items: [
            { text: '命令速查表', link: '/reference/commands' },
            { text: '常见问题', link: '/reference/faq' },
            { text: '故障排查', link: '/reference/troubleshooting' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/larksuite/cli' }
    ]
  }
})
