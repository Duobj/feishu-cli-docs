import{_ as s,c as n,o as a,a as l}from"./app.be9cc0e4.js";const d=JSON.parse('{"title":"\u573A\u666F\u548C\u6D41\u7A0B\u56FE","description":"","frontmatter":{},"headers":[{"level":2,"title":"\u5B8C\u6574\u6D41\u7A0B\u56FE","slug":"\u5B8C\u6574\u6D41\u7A0B\u56FE","link":"#\u5B8C\u6574\u6D41\u7A0B\u56FE","children":[{"level":3,"title":"\u767B\u5F55\u6D41\u7A0B","slug":"\u767B\u5F55\u6D41\u7A0B","link":"#\u767B\u5F55\u6D41\u7A0B","children":[]},{"level":3,"title":"API \u8C03\u7528\u6D41\u7A0B","slug":"api-\u8C03\u7528\u6D41\u7A0B","link":"#api-\u8C03\u7528\u6D41\u7A0B","children":[]}]},{"level":2,"title":"\u5B9E\u9645\u573A\u666F","slug":"\u5B9E\u9645\u573A\u666F","link":"#\u5B9E\u9645\u573A\u666F","children":[{"level":3,"title":"\u573A\u666F 1: \u4EBA\u7C7B\u7528\u6237\u7684\u5178\u578B\u5DE5\u4F5C\u6D41","slug":"\u573A\u666F-1-\u4EBA\u7C7B\u7528\u6237\u7684\u5178\u578B\u5DE5\u4F5C\u6D41","link":"#\u573A\u666F-1-\u4EBA\u7C7B\u7528\u6237\u7684\u5178\u578B\u5DE5\u4F5C\u6D41","children":[]},{"level":3,"title":"\u573A\u666F 2: AI Agent \u7684\u81EA\u52A8\u5316\u5DE5\u4F5C\u6D41","slug":"\u573A\u666F-2-ai-agent-\u7684\u81EA\u52A8\u5316\u5DE5\u4F5C\u6D41","link":"#\u573A\u666F-2-ai-agent-\u7684\u81EA\u52A8\u5316\u5DE5\u4F5C\u6D41","children":[]},{"level":3,"title":"\u573A\u666F 3: \u591A\u5E94\u7528\u7BA1\u7406","slug":"\u573A\u666F-3-\u591A\u5E94\u7528\u7BA1\u7406","link":"#\u573A\u666F-3-\u591A\u5E94\u7528\u7BA1\u7406","children":[]},{"level":3,"title":"\u573A\u666F 4: \u6743\u9650\u68C0\u67E5\u548C\u5347\u7EA7","slug":"\u573A\u666F-4-\u6743\u9650\u68C0\u67E5\u548C\u5347\u7EA7","link":"#\u573A\u666F-4-\u6743\u9650\u68C0\u67E5\u548C\u5347\u7EA7","children":[]}]},{"level":2,"title":"\u6545\u969C\u6392\u67E5","slug":"\u6545\u969C\u6392\u67E5","link":"#\u6545\u969C\u6392\u67E5","children":[{"level":3,"title":"\u95EE\u9898 1: \u767B\u5F55\u8D85\u65F6","slug":"\u95EE\u9898-1-\u767B\u5F55\u8D85\u65F6","link":"#\u95EE\u9898-1-\u767B\u5F55\u8D85\u65F6","children":[]},{"level":3,"title":"\u95EE\u9898 2: \u6743\u9650\u4E0D\u8DB3","slug":"\u95EE\u9898-2-\u6743\u9650\u4E0D\u8DB3","link":"#\u95EE\u9898-2-\u6743\u9650\u4E0D\u8DB3","children":[]},{"level":3,"title":"\u95EE\u9898 3: \u5BC6\u94A5\u94FE\u9519\u8BEF","slug":"\u95EE\u9898-3-\u5BC6\u94A5\u94FE\u9519\u8BEF","link":"#\u95EE\u9898-3-\u5BC6\u94A5\u94FE\u9519\u8BEF","children":[]}]}],"relativePath":"guide/scenarios.md"}'),p={name:"guide/scenarios.md"},e=l(`<h1 id="\u573A\u666F\u548C\u6D41\u7A0B\u56FE" tabindex="-1">\u573A\u666F\u548C\u6D41\u7A0B\u56FE <a class="header-anchor" href="#\u573A\u666F\u548C\u6D41\u7A0B\u56FE" aria-hidden="true">#</a></h1><h2 id="\u5B8C\u6574\u6D41\u7A0B\u56FE" tabindex="-1">\u5B8C\u6574\u6D41\u7A0B\u56FE <a class="header-anchor" href="#\u5B8C\u6574\u6D41\u7A0B\u56FE" aria-hidden="true">#</a></h2><h3 id="\u767B\u5F55\u6D41\u7A0B" tabindex="-1">\u767B\u5F55\u6D41\u7A0B <a class="header-anchor" href="#\u767B\u5F55\u6D41\u7A0B" aria-hidden="true">#</a></h3><div class="language-"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki"><code><span class="line"><span style="color:#A6ACCD;">lark-cli auth login</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">\u89E3\u6790\u6743\u9650\u8303\u56F4</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">RequestDeviceAuthorization()</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">\u663E\u793A verification_uri \u7ED9\u7528\u6237</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">\u7528\u6237\u5728\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00 URL \u5E76\u6388\u6743</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">PollDeviceToken()</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u251C\u2500 \u521D\u59CB\u95F4\u9694: 5 \u79D2</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u251C\u2500 \u6700\u5927\u95F4\u9694: 60 \u79D2</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2514\u2500 \u8D85\u65F6: 240 \u79D2</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">\u83B7\u53D6 access_token \u548C refresh_token</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">getUserInfo()</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">SetStoredToken() \u4FDD\u5B58\u5230 OS Keychain</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">syncLoginUserToProfile() \u66F4\u65B0 config.json</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">\u767B\u5F55\u5B8C\u6210</span></span>
<span class="line"><span style="color:#A6ACCD;"></span></span></code></pre></div><h3 id="api-\u8C03\u7528\u6D41\u7A0B" tabindex="-1">API \u8C03\u7528\u6D41\u7A0B <a class="header-anchor" href="#api-\u8C03\u7528\u6D41\u7A0B" aria-hidden="true">#</a></h3><div class="language-"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki"><code><span class="line"><span style="color:#A6ACCD;">lark-cli calendar +agenda</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">Factory.Config() \u52A0\u8F7D config.json</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">Factory.ResolveAs() \u68C0\u67E5\u8EAB\u4EFD</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">CredentialProvider.ResolveToken() \u83B7\u53D6 Token</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">\u68C0\u67E5 Token \u72B6\u6001</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u251C\u2500 valid: \u76F4\u63A5\u4F7F\u7528</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u251C\u2500 needs_refresh: \u81EA\u52A8\u5237\u65B0</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2514\u2500 expired: \u63D0\u793A\u91CD\u65B0\u767B\u5F55</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">\u8C03\u7528 Lark API</span></span>
<span class="line"><span style="color:#A6ACCD;">    \u2193</span></span>
<span class="line"><span style="color:#A6ACCD;">\u8FD4\u56DE\u7ED3\u679C</span></span>
<span class="line"><span style="color:#A6ACCD;"></span></span></code></pre></div><hr><h2 id="\u5B9E\u9645\u573A\u666F" tabindex="-1">\u5B9E\u9645\u573A\u666F <a class="header-anchor" href="#\u5B9E\u9645\u573A\u666F" aria-hidden="true">#</a></h2><h3 id="\u573A\u666F-1-\u4EBA\u7C7B\u7528\u6237\u7684\u5178\u578B\u5DE5\u4F5C\u6D41" tabindex="-1">\u573A\u666F 1: \u4EBA\u7C7B\u7528\u6237\u7684\u5178\u578B\u5DE5\u4F5C\u6D41 <a class="header-anchor" href="#\u573A\u666F-1-\u4EBA\u7C7B\u7528\u6237\u7684\u5178\u578B\u5DE5\u4F5C\u6D41" aria-hidden="true">#</a></h3><div class="language-bash"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki"><code><span class="line"><span style="color:#676E95;"># 1. \u521D\u59CB\u5316</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli config init</span></span>
<span class="line"><span style="color:#89DDFF;">[</span><span style="color:#A6ACCD;">lark-cli</span><span style="color:#89DDFF;">]</span><span style="color:#A6ACCD;"> \u5E94\u7528\u521B\u5EFA\u6210\u529F</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 2. \u767B\u5F55</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli auth login --recommend</span></span>
<span class="line"><span style="color:#89DDFF;">[</span><span style="color:#A6ACCD;">lark-cli</span><span style="color:#89DDFF;">]</span><span style="color:#A6ACCD;"> \u6388\u6743\u6210\u529F\uFF01</span></span>
<span class="line"><span style="color:#89DDFF;">[</span><span style="color:#A6ACCD;">lark-cli</span><span style="color:#89DDFF;">]</span><span style="color:#A6ACCD;"> \u7528\u6237: \u5F20\u4E09 </span><span style="color:#89DDFF;">(</span><span style="color:#A6ACCD;">ou_xxx</span><span style="color:#89DDFF;">)</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 3. \u4F7F\u7528 CLI</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli calendar +agenda</span></span>
<span class="line"><span style="color:#A6ACCD;">09:00 - 10:00  \u56E2\u961F\u4F1A\u8BAE</span></span>
<span class="line"><span style="color:#A6ACCD;">14:00 - 15:00  \u4E00\u5BF9\u4E00</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 4. \u67E5\u770B\u8BA4\u8BC1\u72B6\u6001</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli auth status</span></span>
<span class="line"><span style="color:#89DDFF;">{</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">appId</span><span style="color:#89DDFF;">&quot;</span><span style="color:#A6ACCD;">: </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">cli_xxx</span><span style="color:#89DDFF;">&quot;</span><span style="color:#A6ACCD;">,</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">identity</span><span style="color:#89DDFF;">&quot;</span><span style="color:#A6ACCD;">: </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">user</span><span style="color:#89DDFF;">&quot;</span><span style="color:#A6ACCD;">,</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">userName</span><span style="color:#89DDFF;">&quot;</span><span style="color:#A6ACCD;">: </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">\u5F20\u4E09</span><span style="color:#89DDFF;">&quot;</span><span style="color:#A6ACCD;">,</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">tokenStatus</span><span style="color:#89DDFF;">&quot;</span><span style="color:#A6ACCD;">: </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">valid</span><span style="color:#89DDFF;">&quot;</span></span>
<span class="line"><span style="color:#89DDFF;">}</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 5. \u767B\u51FA</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli auth </span><span style="color:#82AAFF;">logout</span></span>
<span class="line"><span style="color:#89DDFF;">[</span><span style="color:#A6ACCD;">lark-cli</span><span style="color:#89DDFF;">]</span><span style="color:#A6ACCD;"> \u5DF2\u767B\u51FA</span></span>
<span class="line"></span></code></pre></div><h3 id="\u573A\u666F-2-ai-agent-\u7684\u81EA\u52A8\u5316\u5DE5\u4F5C\u6D41" tabindex="-1">\u573A\u666F 2: AI Agent \u7684\u81EA\u52A8\u5316\u5DE5\u4F5C\u6D41 <a class="header-anchor" href="#\u573A\u666F-2-ai-agent-\u7684\u81EA\u52A8\u5316\u5DE5\u4F5C\u6D41" aria-hidden="true">#</a></h3><div class="language-bash"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki"><code><span class="line"><span style="color:#676E95;"># 1. \u521D\u59CB\u5316\uFF08\u540E\u53F0\u8FD0\u884C\uFF09</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli config init --new </span><span style="color:#89DDFF;">&amp;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 2. \u767B\u5F55\uFF08\u65E0\u7B49\u5F85\u6A21\u5F0F\uFF09</span></span>
<span class="line"><span style="color:#A6ACCD;">$ DEVICE_CODE=</span><span style="color:#89DDFF;">$(</span><span style="color:#C3E88D;">lark-cli auth login --no-wait --json </span><span style="color:#89DDFF;">|</span><span style="color:#C3E88D;"> jq -r </span><span style="color:#89DDFF;">&#39;</span><span style="color:#C3E88D;">.device_code</span><span style="color:#89DDFF;">&#39;)</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 3. \u7B49\u5F85\u7528\u6237\u6388\u6743</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 4. \u6062\u590D\u8F6E\u8BE2</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli auth login --device-code </span><span style="color:#89DDFF;">$</span><span style="color:#A6ACCD;">DEVICE_CODE</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 5. \u6267\u884C\u4EFB\u52A1</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli calendar +agenda --json</span></span>
<span class="line"><span style="color:#89DDFF;">{</span></span>
<span class="line"><span style="color:#A6ACCD;">  </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">events</span><span style="color:#89DDFF;">&quot;</span><span style="color:#A6ACCD;">: </span><span style="color:#89DDFF;">[</span><span style="color:#A6ACCD;">...</span><span style="color:#89DDFF;">]</span></span>
<span class="line"><span style="color:#89DDFF;">}</span></span>
<span class="line"></span></code></pre></div><h3 id="\u573A\u666F-3-\u591A\u5E94\u7528\u7BA1\u7406" tabindex="-1">\u573A\u666F 3: \u591A\u5E94\u7528\u7BA1\u7406 <a class="header-anchor" href="#\u573A\u666F-3-\u591A\u5E94\u7528\u7BA1\u7406" aria-hidden="true">#</a></h3><div class="language-bash"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki"><code><span class="line"><span style="color:#676E95;"># 1. \u521B\u5EFA\u7B2C\u4E00\u4E2A\u5E94\u7528</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli config init</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 2. \u521B\u5EFA\u7B2C\u4E8C\u4E2A\u5E94\u7528</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli profile add</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 3. \u5217\u51FA\u6240\u6709\u5E94\u7528</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli profile list</span></span>
<span class="line"><span style="color:#A6ACCD;">my-app-1  cli_app1  \u2713</span></span>
<span class="line"><span style="color:#A6ACCD;">my-app-2  cli_app2</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 4. \u5207\u6362\u5E94\u7528</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli profile use my-app-2</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 5. \u4E3A\u65B0\u5E94\u7528\u767B\u5F55</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli auth login</span></span>
<span class="line"></span></code></pre></div><h3 id="\u573A\u666F-4-\u6743\u9650\u68C0\u67E5\u548C\u5347\u7EA7" tabindex="-1">\u573A\u666F 4: \u6743\u9650\u68C0\u67E5\u548C\u5347\u7EA7 <a class="header-anchor" href="#\u573A\u666F-4-\u6743\u9650\u68C0\u67E5\u548C\u5347\u7EA7" aria-hidden="true">#</a></h3><div class="language-bash"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki"><code><span class="line"><span style="color:#676E95;"># 1. \u68C0\u67E5\u5F53\u524D\u6743\u9650</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli auth check --scope </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">calendar:calendar:read</span><span style="color:#89DDFF;">&quot;</span></span>
<span class="line"><span style="color:#A6ACCD;">ok: </span><span style="color:#82AAFF;">true</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 2. \u68C0\u67E5\u4E0D\u8DB3\u7684\u6743\u9650</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli auth check --scope </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">calendar:calendar:write</span><span style="color:#89DDFF;">&quot;</span></span>
<span class="line"><span style="color:#A6ACCD;">ok: </span><span style="color:#82AAFF;">false</span></span>
<span class="line"><span style="color:#A6ACCD;">missing: </span><span style="color:#89DDFF;">[</span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">calendar:calendar:write</span><span style="color:#89DDFF;">&quot;</span><span style="color:#89DDFF;">]</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 3. \u5347\u7EA7\u6743\u9650</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli auth login --scope </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">calendar:calendar:write</span><span style="color:#89DDFF;">&quot;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#676E95;"># 4. \u9A8C\u8BC1\u6743\u9650\u5DF2\u5347\u7EA7</span></span>
<span class="line"><span style="color:#A6ACCD;">$ lark-cli auth check --scope </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">calendar:calendar:write</span><span style="color:#89DDFF;">&quot;</span></span>
<span class="line"><span style="color:#A6ACCD;">ok: </span><span style="color:#82AAFF;">true</span></span>
<span class="line"></span></code></pre></div><hr><h2 id="\u6545\u969C\u6392\u67E5" tabindex="-1">\u6545\u969C\u6392\u67E5 <a class="header-anchor" href="#\u6545\u969C\u6392\u67E5" aria-hidden="true">#</a></h2><h3 id="\u95EE\u9898-1-\u767B\u5F55\u8D85\u65F6" tabindex="-1">\u95EE\u9898 1: \u767B\u5F55\u8D85\u65F6 <a class="header-anchor" href="#\u95EE\u9898-1-\u767B\u5F55\u8D85\u65F6" aria-hidden="true">#</a></h3><p><strong>\u75C7\u72B6\uFF1A</strong> authorization timed out</p><p><strong>\u539F\u56E0\uFF1A</strong> \u7528\u6237\u672A\u5728\u6D4F\u89C8\u5668\u4E2D\u5B8C\u6210\u6388\u6743\u3001\u7F51\u7EDC\u4E0D\u7A33\u5B9A\u3001\u8BBE\u5907\u7801\u8FC7\u671F</p><p><strong>\u89E3\u51B3\u65B9\u6848\uFF1A</strong></p><div class="language-bash"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki"><code><span class="line"><span style="color:#A6ACCD;">lark-cli auth login</span></span>
<span class="line"><span style="color:#676E95;"># \u6216\u4F7F\u7528 --no-wait \u6A21\u5F0F</span></span>
<span class="line"><span style="color:#A6ACCD;">DEVICE_CODE=</span><span style="color:#89DDFF;">$(</span><span style="color:#C3E88D;">lark-cli auth login --no-wait --json </span><span style="color:#89DDFF;">|</span><span style="color:#C3E88D;"> jq -r </span><span style="color:#89DDFF;">&#39;</span><span style="color:#C3E88D;">.device_code</span><span style="color:#89DDFF;">&#39;)</span></span>
<span class="line"><span style="color:#A6ACCD;">lark-cli auth login --device-code </span><span style="color:#89DDFF;">$</span><span style="color:#A6ACCD;">DEVICE_CODE</span></span>
<span class="line"></span></code></pre></div><h3 id="\u95EE\u9898-2-\u6743\u9650\u4E0D\u8DB3" tabindex="-1">\u95EE\u9898 2: \u6743\u9650\u4E0D\u8DB3 <a class="header-anchor" href="#\u95EE\u9898-2-\u6743\u9650\u4E0D\u8DB3" aria-hidden="true">#</a></h3><p><strong>\u75C7\u72B6\uFF1A</strong> insufficient permissions</p><p><strong>\u539F\u56E0\uFF1A</strong> Token \u4E2D\u6CA1\u6709\u6240\u9700\u6743\u9650</p><p><strong>\u89E3\u51B3\u65B9\u6848\uFF1A</strong></p><div class="language-bash"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki"><code><span class="line"><span style="color:#A6ACCD;">lark-cli auth status</span></span>
<span class="line"><span style="color:#A6ACCD;">lark-cli auth login --scope </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">calendar:calendar:write</span><span style="color:#89DDFF;">&quot;</span></span>
<span class="line"><span style="color:#A6ACCD;">lark-cli auth check --scope </span><span style="color:#89DDFF;">&quot;</span><span style="color:#C3E88D;">calendar:calendar:write</span><span style="color:#89DDFF;">&quot;</span></span>
<span class="line"></span></code></pre></div><h3 id="\u95EE\u9898-3-\u5BC6\u94A5\u94FE\u9519\u8BEF" tabindex="-1">\u95EE\u9898 3: \u5BC6\u94A5\u94FE\u9519\u8BEF <a class="header-anchor" href="#\u95EE\u9898-3-\u5BC6\u94A5\u94FE\u9519\u8BEF" aria-hidden="true">#</a></h3><p><strong>\u75C7\u72B6\uFF1A</strong> keychain access failed</p><p><strong>\u539F\u56E0\uFF1A</strong> OS \u5BC6\u94A5\u94FE\u88AB\u9501\u5B9A\u6216\u65E0\u8BBF\u95EE\u6743\u9650</p><p><strong>\u89E3\u51B3\u65B9\u6848\uFF1A</strong></p><div class="language-bash"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki"><code><span class="line"><span style="color:#A6ACCD;">security unlock-keychain  </span><span style="color:#676E95;"># macOS</span></span>
<span class="line"><span style="color:#A6ACCD;">lark-cli config init      </span><span style="color:#676E95;"># \u91CD\u65B0\u521D\u59CB\u5316</span></span>
<span class="line"></span></code></pre></div>`,33),o=[e];function c(t,r,i,D,C,y){return a(),n("div",null,o)}const h=s(p,[["render",c]]);export{d as __pageData,h as default};
