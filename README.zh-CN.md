[English](./README.md) | 简体中文 | [繁體中文](./docs/i18n/README.zh-TW.md)

# Roomy

原名 **Wider Gemini**。

一个用来调整 Gemini、ChatGPT、Claude 和 DeepSeek 对话宽度与阅读排版的 Chrome 扩展。每个网站分别记住各自的设置。

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-安装-4285F4)](https://chromewebstore.google.com/detail/apadogadaahdjhhmbdhkmdecbobijoed?utm_source=github&utm_medium=readme&utm_campaign=zh-cn)
[![GitHub Release 3.1.0](https://img.shields.io/badge/release-v3.1.0-blue)](https://github.com/Planetes1mal/roomy/releases/tag/v3.1.0)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

同一段完整的 Gemini 对话、同样的窗口大小：使用 Roomy 将对话宽度分别设为 700px 和 1200px。

| 700px | 1200px |
| :---: | :---: |
| [![700px 宽度的完整 Gemini 对话页面](./docs/images/conversation-before.png)](./docs/images/conversation-before.png) | [![1200px 宽度的同一完整 Gemini 对话页面](./docs/images/conversation-after.png)](./docs/images/conversation-after.png) |

## 功能

- **调整宽度**：在 Gemini、ChatGPT、Claude 或 DeepSeek 上按像素（`px`）或窗口比例（`%`）设置；每个网站分别保存范围和预设。
- **按网站启用或暂停**：网站名称旁的开关可暂停该网站的全部效果并恢复原页面，设置仍可编辑并会保留；宽度开关只关闭拓宽。遇到尚未识别的布局时保留原站宽度，并在弹窗中提示当前页未适配。
- **调整字号和间距**：每个网站都支持 75%–200% 字号，标题、代码和表格保持原有比例；可用阅读密度收紧间距，或手动设置行高和段落间距。
- **消息导航**：对话右侧的一列短刻度，点击即可跳到自己发送的消息，支持简短预览和键盘操作，适用于所有支持的网站。长对话最多显示当前消息附近的 20 个刻度；ChatGPT、Claude 和 DeepSeek 随滚动记住带稳定标识的消息，不自动扫描历史。可在弹窗中按网站关闭。
- **任务预设**：一步应用阅读、宽屏或大字设置，并可恢复该网站应用前的设置。
- **Gemini 代码自动换行**：长代码在对话区内折行显示。ChatGPT 保留代码块自带的换行按钮；Claude 没有换行按钮，长行在代码块内横向滚动；DeepSeek 自己会给代码换行。
- **用户消息铺满宽度**：让自己的消息和回答一样，左对齐并使用完整的对话宽度。
- **界面语言**：英文、简体中文、繁体中文、韩语、日语和西班牙语。默认跟随浏览器，也能手动选择。韩语、日语和西班牙语采用机器辅助翻译，欢迎母语者改进。

设置会自动保存，并应用到所选网站的已打开页面。ChatGPT、Claude 和 DeepSeek 的阅读设置保持默认值时，不改变原生字号、间距、代码格式和用户消息样式。

## 安装

在 [Chrome 应用商店](https://chromewebstore.google.com/detail/apadogadaahdjhhmbdhkmdecbobijoed?utm_source=github&utm_medium=readme&utm_campaign=zh-cn)点击 **添加至 Chrome** 即可安装。已经在用 Wider Gemini 的话，Chrome 会自动更新为 Roomy，并保留你的设置。

GitHub 版本与 Chrome 应用商店的更新时间可能不同。若要使用 3.1.0，请按下方方式安装对应的 GitHub 正式版。

<details>
<summary>手动安装</summary>

1. 到 [GitHub Releases](https://github.com/Planetes1mal/roomy/releases) 下载最新正式版的 `roomy-*.zip`。
2. 解压到一个固定位置，确认文件夹里有 `manifest.json`。
3. 打开 `chrome://extensions/`，开启右上角的 **开发者模式**。
4. 点击 **加载已解压的扩展程序**，选择刚才解压的文件夹。

若曾手动安装候选版，请用正式版文件替换并重新加载扩展；候选版不会自动升级。

</details>

## 使用

1. 打开 [Gemini](https://gemini.google.com/)、[ChatGPT](https://chatgpt.com/)、[Claude](https://claude.ai/) 或 [DeepSeek](https://chat.deepseek.com/)，点击浏览器工具栏里的 Roomy 图标。
2. 在支持的网站上打开时，弹窗直接进入该网站的设置；在其它页面则列出全部网站，点击一行进入它的设置页。选择 `px` 或 `%`，拖动宽度滑块，也可以直接点一个预设。
3. 展开 **文字与间距** 可以调整字号和阅读密度；在 Gemini 的设置页中还可以开启代码自动换行，ChatGPT 保留每个代码块自带的换行按钮，Claude 和 DeepSeek 的代码块保持原样。

新安装后，弹窗会从工具栏图标处自动打开一次，列出可添加的网站。点击 ChatGPT、Claude 或 DeepSeek 旁的 **允许** 并在 Chrome 的提示中确认，即可启用该网站。更新到新增了网站的版本时不会弹出任何内容，只在工具栏图标上显示“新”角标，下次打开弹窗后消失，列表里的新网站带“新”标记。授权之前，该网站一直留在“可添加的网站”分组里，并保留同一个按钮。

展开 **范围与预设** 可以调整宽度范围和 **管理预设**；每个网站的 `px` 和 `%` 各有一组独立预设。界面语言在网站列表底部切换。

使用**任务预设**可以一步切换版式：Gemini 有长文阅读、表格、代码和大字四种，ChatGPT、Claude 和 DeepSeek 有长文阅读、宽屏（表格与代码）和大字三种。先查看设置摘要，再点击应用；**恢复之前的设置**可以在本机恢复该网站应用前的版式，关闭弹窗后仍可使用。具体数值及恢复范围见[阅读指南](./docs/guides/reading-layout.md)。

网站列表底部的 **帮助与反馈** 提供排查说明，也可以预览并复制诊断设置。扩展作用于 Gemini、ChatGPT、Claude、DeepSeek 网页及通过 Chrome 安装的网站应用窗口，不会修改原生桌面应用或 Chrome 内置的 Gemini 面板。在 Claude 上只调整对话页和新对话页；项目、设置、Claude Code 和分享页保持原样，Artifacts 面板里的内容也不会被改动。在 DeepSeek 上调整对话页和新对话页。

## 隐私

Gemini 访问权限为必需。ChatGPT、Claude 和 DeepSeek 访问权限为可选：只有在弹窗中点击该网站旁的 **允许** 后，Chrome 才会请求授权。扩展使用 `activeTab` 在打开工具栏弹窗时识别当前网站，使用 `storage` 保存偏好、`scripting` 注册并补注入内容脚本。不收集或上传对话内容，也没有统计或追踪服务。

偏好设置通过 Chrome 的扩展存储保存；是否跨设备同步取决于你的浏览器同步设置。详见[隐私说明](./docs/PRIVACY.md)。

## 本地开发

项目使用原生 JavaScript、HTML 和 CSS，无需安装依赖或构建。

```bash
git clone https://github.com/Planetes1mal/roomy.git
```

在 `chrome://extensions/` 开启 **开发者模式**，点击 **加载已解压的扩展程序**，选择仓库文件夹。修改代码后，重新加载扩展并刷新受影响的 Gemini、ChatGPT、Claude 或 DeepSeek 页面。

内部迭代可运行 `node scripts/test.js --skip-packaging`，执行已有单元检查而不生成 ZIP。浏览器与发布检查见[贡献指南](./CONTRIBUTING.md)，版式规则见[工程与兼容性说明](./docs/engineering.md)。

## 反馈与贡献

遇到问题，可在弹窗的 **帮助与反馈** 中复制诊断设置，并附上操作步骤提交 [Issue](https://github.com/Planetes1mal/roomy/issues/new/choose)。分享截图前请移除私人信息。欢迎提交 Pull Request。

如果 Roomy 对你有帮助，可以在 GitHub 点一个 Star，让更多人发现它。

Star 完全自愿。想接收版本通知，请使用仓库的 **Watch → Custom → Releases** 设置，参见 [GitHub 通知说明](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications)。

本项目采用 [MIT 协议](./LICENSE)。
