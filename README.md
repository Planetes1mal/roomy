English | [简体中文](./README.zh-CN.md) | [繁體中文](./docs/i18n/README.zh-TW.md)

# Roomy

Formerly **Wider Gemini**.

A Chrome extension for adjusting the width and reading layout of Gemini, ChatGPT, Claude and DeepSeek conversations. Each site remembers its own settings.

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install-4285F4)](https://chromewebstore.google.com/detail/apadogadaahdjhhmbdhkmdecbobijoed?utm_source=github&utm_medium=readme&utm_campaign=en)
[![GitHub Release 3.1.0](https://img.shields.io/badge/release-v3.1.0-blue)](https://github.com/Planetes1mal/roomy/releases/tag/v3.1.0)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

The same full Gemini conversation at the same window size, with the conversation width set to 700px and then 1200px using Roomy.

| 700px | 1200px |
| :---: | :---: |
| [![Full Gemini conversation at 700px width](./docs/images/conversation-before.png)](./docs/images/conversation-before.png) | [![The same full Gemini conversation at 1200px width](./docs/images/conversation-after.png)](./docs/images/conversation-after.png) |

## Features

- **Adjust the width**: On Gemini, ChatGPT, Claude or DeepSeek, set pixels (`px`) or a percentage of the window (`%`), and save separate limits and presets for each site.
- **Enable or pause by site**: The switch beside the site name pauses every effect on that site and restores the original page, while all settings stay editable and saved. A separate width switch turns off only widening. Unrecognized layouts keep their original width, with a notice in the popup for the current page.
- **Adjust text size and spacing**: On every supported site, scale message text from 75% to 200% while keeping headings, code, and tables in proportion, tighten spacing with reading density, or set line height and paragraph spacing manually.
- **Message navigation**: A thin column of ticks beside the conversation jumps to your messages on every supported site, with a short preview and keyboard support. Long conversations show at most 20 ticks around the current message. ChatGPT, Claude and DeepSeek remember messages with stable keys as you scroll, without scanning history automatically. Turn it off per site in the popup.
- **Task presets**: Apply a reading, wide, or large-text setup in one step and restore the previous settings for that site.
- **Wrap Gemini code**: Keep long lines of code within the conversation area. ChatGPT keeps its own per-block wrap button; Claude has no wrap button, so long lines scroll inside the code block; DeepSeek wraps code lines itself.
- **Full-width user messages**: Left-align your messages and give them the full conversation width, just like the replies.
- **Interface languages**: English, Simplified Chinese, Traditional Chinese, Korean, Japanese, and Spanish. Follow your browser's language or choose one manually. Korean, Japanese, and Spanish translations are machine-assisted; native-speaker improvements are welcome.

Settings are saved automatically, and changes apply to open pages for the selected site. At their defaults, the ChatGPT, Claude and DeepSeek reading controls leave the native text size, spacing, code formatting, and user-message layout unchanged.

## Installation

Open the [Chrome Web Store listing](https://chromewebstore.google.com/detail/apadogadaahdjhhmbdhkmdecbobijoed?utm_source=github&utm_medium=readme&utm_campaign=en) and click **Add to Chrome**. If you already use Wider Gemini, Chrome updates it to Roomy automatically and keeps your settings.

GitHub releases and Chrome Web Store updates can follow different schedules. For version 3.1.0, use the matching GitHub release below.

<details>
<summary>Manual installation</summary>

1. Download `roomy-*.zip` from the latest stable release on [GitHub Releases](https://github.com/Planetes1mal/roomy/releases).
2. Extract it to a folder you intend to keep. Make sure the folder contains `manifest.json`.
3. Open `chrome://extensions/` and enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the extracted folder.

If you manually installed a release candidate, replace its files with the stable release and reload the extension; candidates do not upgrade automatically.

</details>

## Usage

1. Open [Gemini](https://gemini.google.com/), [ChatGPT](https://chatgpt.com/), [Claude](https://claude.ai/) or [DeepSeek](https://chat.deepseek.com/) and click the Roomy icon in your browser toolbar.
2. On a supported site the popup opens that site's settings; elsewhere it lists all sites, and each row opens its page. Choose `px` or `%`, then move the width slider or click a preset.
3. Expand **Text & spacing** to adjust the font size and reading density. On Gemini you can also turn on code wrapping; ChatGPT keeps its own wrap button on each code block, and Claude's and DeepSeek's code blocks are left as they are.

After a new install, the popup opens once from the toolbar icon and lists the sites you can add. Click **Allow** next to ChatGPT, Claude or DeepSeek and confirm Chrome's prompt to turn that site on. After an update that adds a site, nothing opens: a **NEW** badge appears on the toolbar icon until you next open the popup, where the new site is marked in the list. Until access is granted, the site stays under **Websites you can add** with the same button.

Expand **Range & presets** for width limits and **Manage presets**. Each site and unit has its own presets. The language selector is at the bottom of the site list.

Use **Task presets** to change the layout in one step: long reading, tables, code, or large text on Gemini; long reading, wide (tables and code), or large text on ChatGPT, Claude and DeepSeek. Preview the settings, then apply them; **Restore previous settings** restores that site's previous layout on this device, even after closing the popup. See the [reading guide](./docs/guides/reading-layout.md) for the values and restore behavior.

Use **Help & feedback** at the bottom of the site list for troubleshooting or to preview and copy diagnostic settings. Roomy targets Gemini, ChatGPT, Claude and DeepSeek webpages, including Chrome-installed site app windows; it does not change native desktop apps or Chrome’s built-in Gemini panel. On Claude it adjusts conversations and the new-chat page; projects, settings, Claude Code and shared pages stay as they are, and the content of the Artifacts panel is never changed. On DeepSeek it adjusts conversations and the new-chat page.

## Privacy

Gemini access is required. ChatGPT, Claude and DeepSeek access is optional: Chrome asks for each only after you click **Allow** next to that site in the popup. The extension uses `activeTab` to identify the current site when you open the toolbar popup, `storage` for preferences, and `scripting` to register and restore content scripts. It does not collect or upload conversations, and it has no analytics or tracking services.

Preferences are saved in Chrome's extension storage. Whether they sync across devices depends on your browser's sync settings. See the [privacy policy](./docs/PRIVACY.md) for details.

## Local development

The project uses vanilla JavaScript, HTML, and CSS. No dependencies or build step are needed.

```bash
git clone https://github.com/Planetes1mal/roomy.git
```

Open `chrome://extensions/`, enable **Developer mode**, click **Load unpacked**, and select the repository folder. After changing the code, reload the extension and refresh the affected Gemini, ChatGPT, Claude or DeepSeek page.

For internal iterations, run `node scripts/test.js --skip-packaging` for the existing unit checks without creating a ZIP. See [Contributing](./CONTRIBUTING.md) for browser and release checks and [Engineering and compatibility](./docs/engineering.md) for layout boundaries.

## Feedback and contributions

If something looks wrong, open **Help & feedback** in the popup, copy the diagnostic settings, and include the steps in an [issue](https://github.com/Planetes1mal/roomy/issues/new/choose). Remove private information from screenshots before sharing. Pull requests are welcome.

If you find Roomy useful, a GitHub star helps other people discover it.

Stars are optional. To receive version notifications, use the repository's **Watch → Custom → Releases** setting; see [GitHub's notification guide](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications).

Licensed under the [MIT License](./LICENSE).
