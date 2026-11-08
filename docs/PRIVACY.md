# Privacy Policy

**Effective date:** November 8, 2026

This policy describes how the **Roomy** browser extension, formerly named Wider Gemini (“Extension”, “we”, “us”), handles information when you use it. It is provided in English and Chinese; both sections have the same meaning.

---

## English

### 1. Who we are

Roomy (formerly Wider Gemini) is an open-source Chrome extension that adjusts layout and styling on [Google Gemini](https://gemini.google.com/), [ChatGPT](https://chatgpt.com/), [Claude](https://claude.ai/) and [DeepSeek](https://chat.deepseek.com/). It is distributed through the Chrome Web Store and other channels chosen by the publisher.

### 2. Information the Extension processes

The Extension **does not** collect, sell, or transmit your personal data, chat content, or browsing history to us or to analytics services for the Extension’s own purposes.

**Local settings.** The Extension uses the browser’s extension storage API (`chrome.storage`, including sync where your browser profile supports it) only to save **your preferences**, such as each site's width, limits, preset buttons, reading settings, Enable switch and message navigation, plus Gemini's code-wrap option and your interface language. That data is managed by your browser and remains under your control.

Applying a task preset on any supported website also saves that site's previous layout in device-local extension storage (`chrome.storage.local`) so you can restore it after reopening the popup. Each site keeps one snapshot, which contains layout preferences only, is replaced by the next task-preset application on that site, and is removed when restored. It does not contain conversation content or sync as part of this undo feature. After installing or updating, the Extension also stores one small marker per newly supported website in `chrome.storage.local`, noting whether it came from a new install or an update, so that the notice and toolbar badge appear once; a marker is removed when you open the popup or allow that website's access.

**Site access.** Gemini access (`https://gemini.google.com/*`) is required. ChatGPT access (`https://chatgpt.com/*`), Claude access (`https://claude.ai/*`) and DeepSeek access (`https://chat.deepseek.com/*`) are optional and requested separately, only when you click **Allow** for that website in the popup. The Extension inspects page structure and applies CSS only on permitted sites. `activeTab` identifies the current site when you open the toolbar popup. The `scripting` permission restores missing content scripts when the extension starts, installs, or updates; `storage` saves preferences. No browsing-history `tabs` permission is requested. The Extension does **not** collect or transmit your prompts, replies, uploaded files, or other page content.

**Optional diagnostic copy.** The help page can display the extension version, browser name and version, platform, interface language, which optional websites have access, and each website's Enable switch, width, range, and reading settings on your device. It excludes conversations, page URLs, titles, browsing history, and custom preset names. Nothing is sent automatically: copying only puts the displayed text on your clipboard. You choose whether to share it in a public GitHub issue.

### 3. Third parties

Google operates Gemini and Chrome; OpenAI operates ChatGPT; Anthropic operates Claude; DeepSeek operates DeepSeek. Their handling of data is governed by [Google’s policies](https://policies.google.com/), [OpenAI’s privacy policy](https://openai.com/policies/privacy-policy/), [Anthropic’s privacy policy](https://www.anthropic.com/legal/privacy), [DeepSeek’s privacy policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html), and your browser settings. The Extension does not add its own remote tracking or advertising SDKs.

### 4. Children’s privacy

The Extension is not directed at children under 13 (or the age required in your jurisdiction). We do not knowingly collect personal information from children through the Extension.

### 5. Changes

We may update this policy when the Extension’s behavior or legal requirements change. The effective date at the top will be revised when we do.

### 6. Contact

Questions about this policy or the Extension may be reported via the GitHub repository’s issue tracker maintained by the project.

---

## 中文

### 1. 主体说明

**Roomy**（原名 Wider Gemini）是一款开源 Chrome 扩展，用于调整 [Google Gemini](https://gemini.google.com/)、[ChatGPT](https://chatgpt.com/)、[Claude](https://claude.ai/) 和 [DeepSeek](https://chat.deepseek.com/) 网页上的版式与样式。扩展通过 Chrome 应用商店及发布者选择的其他渠道分发。

### 2. 扩展处理的信息

本扩展**不会**出于自身功能目的，向开发者或第三方分析服务收集、出售或传输您的个人数据、对话内容或浏览记录。

**本地设置。** 扩展仅通过浏览器提供的扩展存储接口（`chrome.storage`，在您的浏览器配置支持时含同步）保存**您的偏好设置**，例如各网站的宽度、范围、预设按钮、阅读设置、启用开关和消息导航，以及 Gemini 的代码换行选项和界面语言。数据由浏览器管理，并由您本人控制。

在任一受支持的网站上应用任务预设时，还会在本机扩展存储（`chrome.storage.local`）保留该网站应用前的版式，方便重新打开弹窗后恢复。每个网站只保留一份快照，仅包含版式偏好，在该网站下一次应用任务预设时会被替换，恢复后会被删除；不包含对话内容，这项撤销功能也不会同步该快照。安装或更新后，扩展还会在 `chrome.storage.local` 中为每个新支持的网站保存一个小标记（记录这次是新安装还是更新），让提示和工具栏角标只出现一次；打开弹窗或允许访问该网站后，相应标记即被删除。

**网站访问范围。** Gemini 访问权限（`https://gemini.google.com/*`）为必选。ChatGPT 访问权限（`https://chatgpt.com/*`）、Claude 访问权限（`https://claude.ai/*`）与 DeepSeek 访问权限（`https://chat.deepseek.com/*`）为可选，各自单独请求，仅在您点击弹窗中该网站旁的 **允许** 时请求。扩展只在已获授权的网站检查页面结构并注入 CSS 等调整。`activeTab` 用于在打开工具栏弹窗时识别当前网站。`scripting` 权限用于在扩展启动、安装或更新时补注入未加载的内容脚本；`storage` 用于保存偏好。不申请读取浏览记录的 `tabs` 权限。扩展**不会**收集或传输您的提问、回答、上传文件或其他页面内容。

**可选的诊断复制。** 帮助页可以在本机显示扩展版本、浏览器名称和版本、平台、界面语言、哪些可选网站已获授权，以及各网站的启用开关、宽度、范围和阅读设置，不包含对话、页面网址、标题、浏览记录或自定义预设名称。不会自动发送任何内容；复制操作仅将已显示的文本放入剪贴板。是否将其分享至公开的 GitHub Issue，由您自行决定。

### 3. 第三方

Gemini 与 Chrome 由 Google 运营，ChatGPT 由 OpenAI 运营，Claude 由 Anthropic 运营，DeepSeek 由深度求索运营；相关数据处理受 [Google 政策](https://policies.google.com/)、[OpenAI 隐私政策](https://openai.com/policies/privacy-policy/)、[Anthropic 隐私政策](https://www.anthropic.com/legal/privacy)、[DeepSeek 隐私政策](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html)及您的浏览器设置约束。本扩展不内置额外的远程追踪或广告 SDK。

### 4. 儿童隐私

本扩展不面向未满 13 周岁（或您所在地法律规定的最低年龄）的儿童。我们不会通过本扩展故意收集儿童的个人信息。

### 5. 变更

当扩展行为或适用法律要求变化时，我们可能更新本政策；更新时会修改文首的生效日期。

### 6. 联系方式

如对本政策或扩展有疑问，可通过项目在 GitHub 上维护的 Issue 渠道反馈。
