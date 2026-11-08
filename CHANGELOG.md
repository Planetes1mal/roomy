# Changelog

All notable changes to Roomy (formerly Wider Gemini) are documented in this file.

Release notes on GitHub are generated from the matching `## <release-version>` section when a `v<release-version>` tag is pushed. Candidate versions such as `2.6.0-rc.1` are marked as prereleases.

## 3.2.0 (2026-11-08)

Roomy now works on DeepSeek as well as Gemini, ChatGPT and Claude. DeepSeek access is optional: updating adds no permission warning, and Chrome asks for DeepSeek access only after you click **Allow** next to DeepSeek in the popup.

### Features

- DeepSeek support (chat.deepseek.com): conversation and composer width, font size, reading density, manual line height and paragraph spacing, full-width user messages, message navigation, and task presets (Long reading, Wide for tables and code, Large text). Text settings also apply to the reasoning shown above an answer. Message navigation keeps a tick for every message you have scrolled past, even after DeepSeek unloads it. On the new-chat page only the composer widens.

### Changes

- The store title is now "Roomy: Wide Mode for Gemini, ChatGPT, Claude & DeepSeek", translated for each interface language.

### Fixes

- On Claude, full-width user messages now stay full width after you switch conversations with the default text size and spacing.
- On Claude, turning off widening while message navigation stays on no longer keeps the page recalculating its layout on every frame when the rail needs extra room.

## 3.1.0 (2026-10-27)

Roomy now works on Claude as well as Gemini and ChatGPT. Claude access is optional: updating adds no permission warning, and Chrome asks for Claude access only after you click **Allow** next to Claude in the popup.

### Features

- Claude support (claude.ai): conversation and input width, font size, reading density, manual line height and paragraph spacing, full-width user messages, message navigation, and task presets (Long reading, Wide for tables and code, Large text). With the Artifacts panel open, the conversation fits the space beside it, and the panel and its content stay unchanged. Projects, settings, Claude Code and shared pages are left as they are.
- A new popup. On a supported site it opens that site's settings directly; elsewhere it lists every site under **Your websites** and **Websites you can add**, with an **Allow** button for each site that still needs access. **All websites** returns to the list from a site's settings.
- After an update that adds a website, a **NEW** badge appears on the toolbar icon until you next open the popup, where the new website is marked in the list. Nothing opens by itself.

### Changes

- The store title is now "Roomy: Wide Mode for Gemini, ChatGPT & Claude", translated for each interface language.
- In each site's settings, task presets sit right below the width controls, and **Text & spacing** shows its current values while collapsed. The language selector and **Help & feedback** are at the bottom of the site list.
- The help page and its settings report cover every supported website.

### Fixes

- Widening a Gemini conversation no longer enlarges generated images. They keep Gemini's own size and line up with the response text; pausing Roomy restores Gemini's centered layout ([#12](https://github.com/Planetes1mal/roomy/issues/12)).

### Refactor

- Supported websites are now described in one place, and Claude runs on a shared layout engine, so adding websites needs less site-specific code. Gemini and ChatGPT behave as before.

## 3.0.1 (2026-10-22)

### Fixes

- The help page's ChatGPT link is now translated, like the Gemini link next to it.

### Other

- The help page's review link uses the extension ID, so it keeps working if the store name changes.
- Console messages from the extension now start with `[Roomy]`.
- Release packages on GitHub are named `roomy-<version>.zip`; earlier releases keep their `wider-gemini-*.zip` names.

## 3.0.0 (2026-10-15)

Wider Gemini is now **Roomy**, and it works on ChatGPT as well as Gemini. The extension ID, saved Gemini settings and store reviews are unchanged. ChatGPT access is optional: updating from 2.8.0 adds no permission warning, and Chrome asks for ChatGPT access only after you click **Allow ChatGPT access** in the popup.

### Features

- ChatGPT support: conversation and input width, font size, reading density, manual line height and paragraph spacing, full-width user messages, and task presets (Long reading, Wide for tables and code, Large text). Each site keeps its own width, limits, presets, reading settings and one-step Restore.
- Gemini / ChatGPT tabs in the popup, with an Enable switch for each site that pauses every effect while keeping all settings.
- Message navigation on Gemini and ChatGPT: a thin column of ticks beside the conversation jumps to your messages, with previews and keyboard controls. Long conversations show at most 20 ticks around the current message.
- After a new install, the popup opens once from the toolbar to offer ChatGPT access. Updates from 2.x open nothing and show a **NEW** badge on the toolbar icon until the popup is next opened. Until access is granted, the popup's ChatGPT tab shows a dot and keeps the button.

### Changes

- Renamed to Roomy. The store title is “Roomy: Wide Mode for Gemini & ChatGPT”, translated for each interface language. The popup and help page now show the extension icon.
- The popup reports when an open page still runs an older extension version instead of reloading it.

### Fixes

- ChatGPT width and reading support follows its new message structure, works when signed out, and leaves ChatGPT's code-wrap buttons, formulas, message toolbars and composer unchanged.
- Gemini keeps code-block and table line heights proportional at every font size and density; inline code follows the surrounding text.
- Gemini keeps a text prompt's navigation preview while the prompt is being edited.
- Text measurements for reading settings run only when a font size or spacing setting is in use, so default settings add no per-message work.
- Gemini navigation stays reachable in narrow windows with widening turned off.
- After the extension updates or reloads, already-open Gemini and ChatGPT tabs no longer show a second navigation bar or receive stale widths from the previous version's script; the old script stops as soon as the new one starts.
- Jumping to the earliest loaded message stays on target when Gemini or ChatGPT loads earlier history during the scroll; after the scroll ends, the target is realigned whenever the content height changes within five seconds, unless you scroll yourself.
- The help page's description of the settings report now lists everything the report contains.

## 3.0.0-rc.2 (2026-10-02)

Internal candidate distributed from the `chatgpt-width-support` branch without a release tag or GitHub Release. Numeric version remains `3.0.0`; replace the files and reload the extension to update a manual installation.

### Features

- Added per-site message navigation with previews, keyboard controls and an earlier-history marker for Gemini, ordinary ChatGPT, Dots and Page quick chat.
- Limited long-conversation navigation to at most 20 ticks around the current message. ChatGPT remembers keyed messages encountered while scrolling and relocates unmounted targets with bounded retries that user input can cancel, without automatically scanning history.

### Fixes

- Updated ChatGPT reading and width support for its new message structure and scoped layout changes to the active conversation surface.
- Mounted Page quick-chat navigation and previews inside the floating chat so they follow moves and resizes and remain clickable. Navigation adds missing space to native transcript padding and does not trigger chat dragging.
- Kept Gemini navigation accessible in narrow windows with widening disabled by adding matching conversation/input gutters, restored when widening is enabled, navigation is disabled or the site is paused.
- Prevented dense magnified ticks from overlapping and improved preview placement, dark-theme visibility and Dots Reply surface detection.

## 3.0.0-rc.1 (2026-09-29)

Internal candidate for manual installation. This is not a stable Chrome Web Store release. Chrome uses numeric version `3.0.0`; later candidates and the final `3.0.0` build require manually replacing the files and reloading the extension.

### Features

- Added ChatGPT conversation and input width controls, with separate width, unit, limits, and presets for each site. Existing Gemini settings are preserved.
- Added Gemini / ChatGPT tabs to the popup, with width controls first, collapsible advanced settings, and consistent styling for dropdowns, inputs, and toggles.
- Added ChatGPT reading controls: font size, reading density, manual line height and paragraph spacing, and full-width user messages. Headings, code, and tables keep their proportions; code lines, table rows, formulas, message toolbars, and the composer keep native spacing. At their defaults nothing changes, and ChatGPT's own code-wrap button is left untouched.
- Added ChatGPT task presets (Long reading, Wide for tables and code, Large text). Each site keeps its own one-step Restore, which survives reopening the popup and reports interrupted saves instead of restoring stale values.
- Added an Enable switch for each site below the site tabs. Turning it off pauses every extension effect on that site, including Gemini's code-wrap and reading styles, while all settings remain editable and saved; editing or applying a task never re-enables the site. The separate width switch still turns off only widening. Unrecognized layouts retain their original width and show a current-page notice in the popup.
- The popup reports when an open page still runs an older extension version instead of reloading it.
- Extended startup injection to ChatGPT pages and added each site's Enable switch and ChatGPT width, range, and reading values to the optional local diagnostic report. Custom preset names and page content remain excluded.

### Refactor

- Organized runtime files under `src/`, separating shared settings, site content scripts, popup, and help. The manifest stays at the repository root, and loading or packaging the extension still requires no build step.
- Removed repetitive guidance from the popup while retaining actionable page-status and error notices.

### Other

- Redesigned the 16px, 48px, and 128px extension icons, with editable SVG sources and a rendering script.
- Updated all three READMEs with full-page screenshots of the same Gemini conversation at 700px and 1200px, with the account avatar removed.

## 2.8.0 (2026-09-24)

### Fixes

- Base automatic reading density on each message's native spacing, with gradual low-density steps. Font-only changes preserve native paragraph gaps and proportional line height; manual spacing still supports an exact 0px gap.
- Keep saved Auto density percentages, interpreted using the new relative curve; saved explicit manual spacing values are unchanged.
- Save width, text size, and reading density when a slider is released, so closing the popup immediately does not discard the change.
- Preserve literal custom preset names and keep default preset names translated after editing or resetting presets.
- Update both numeric width inputs to the selected unit's limits, so valid percentage widths are accepted.
- Realign image captions when conversation width changes, including settings received from another tab.
- Avoid reading computed styles for unrelated elements during file dragging. Existing drag behavior and width rules are preserved.

### Features

- Added task presets for long reading, tables, code, and large text, with a settings preview, explicit Apply, and one previous layout that can be restored on the same device after reopening the popup. Custom width limits and unrelated preferences are preserved.
- Added local help and feedback with troubleshooting and optional issue, source, and review links. The popup and help support English, Simplified Chinese, Traditional Chinese, Korean, Japanese, and Spanish, with browser-language matching and manual selection. Korean, Japanese, and Spanish translations are machine-assisted; native-speaker improvements are welcome.
- Added a diagnostic settings preview that users can copy into a bug report. It contains extension/browser versions and layout preferences, without conversations, page URLs, titles, or custom preset names. Reports are not sent automatically.

### Other

- Added English and Traditional Chinese reading guides. No extension telemetry is added.
- Added `--skip-packaging` to the test runner for internal iterations; the default CI and release suite is unchanged.
- Added the existing regression checks to the source tree, CI before release packaging, and contribution documentation.
- Preserved PR #10's conversation-width, input, upload, and overlay boundaries while changing the reading-density/font-size mechanism.

If you manually installed a 2.8.0 release candidate, replace/reload it with the stable files; Chrome compares the numeric version and does not automatically upgrade that candidate to this build.

## 2.7.0 (2026-09-16)

### Features

- Added Traditional Chinese (Taiwan) to the popup, with automatic browser-language matching and manual selection.

### Other

- Updated the language dropdown and its option list to match the popup's styling.
- Renamed the automatic language option to "Follow browser" to clarify how it works.
- Rewrote the English and Simplified Chinese READMEs, added a Traditional Chinese README, and included a before-and-after screenshot.

## 2.6.0 (2026-09-15)

### Fixes

- Improved width adjustment for Gemini's updated layouts, including response text, code blocks, and tables.
- Improved alignment of message actions, thinking indicators, and image captions.
- Fixed messages and the input bar narrowing while dragging a local file over the input area.

### Other

- Thanks to @PANPEIWEN for the Gemini layout compatibility improvements in [#10](https://github.com/Planetes1mal/roomy/pull/10).

## 2.6.0-rc.1 (2026-09-08)

### Fixes

- Improved width adjustment compatibility with updated Gemini layouts.

Pre-release for testing. Feedback from affected macOS users is welcome.

## 2.5.0 (2026-09-03)

### Features

- Settings changes now apply live in every open Gemini tab and installed app window instead of reloading each tab after every change. A tab is only reloaded as a fallback when it cannot receive the update.

### Fixes

- Fixed the extension not applying when Gemini is opened as an installed Chrome app (PWA) until the page is refreshed. At browser startup the Gemini window can finish loading before the extension does, so it never received the content script; a new background service worker now injects it into any Gemini page that is already open when the extension starts, installs, or updates.

- Fixed the content script initializing twice on every page load (both `DOMContentLoaded` and `load` triggered it), which attached duplicate observers and drag listeners.

### Other

- Added the `scripting` permission and an explicit host permission for `gemini.google.com` for the startup re-injection. The host was already covered by the content script, so this does not add a new permission warning.

## 2.4.0 (2026-08-12)

### Features

- Added a **Font size** control (75–200%) that scales message text, user messages, headings, and code proportionally without zooming the whole page.

- Added a **UI language** setting — the popup follows your browser language with an English fallback for non-Chinese and non-English locales, and you can manually switch between English and Chinese (or back to follow-system).

## 2.3.0 (2026-06-21)

### Features

- Added an optional **User Message Full Width** toggle so user messages fill the conversation width and left-align (keeping their bubble background) to match AI responses.

## 2.2.0 (2026-05-29)

### Features

- Added `px` / `%` width units so Gemini width can adapt to the current browser tab viewport.

- Added reading density controls with compactness, line-height, and paragraph-spacing settings.

### Fixes

- Preserved table, Notebook input, Drive picker, upload, drag-and-drop, and Deep Research layout guardrails during the width settings refactor.

- Fixed preset edit mode layout clipping rows inside the 4-column preset grid.

- Split preset defaults by unit: `px` presets keep the original 800 / 1000 / 1200 / 1350 / 2000 values, while `%` presets default to 50 / 70 / 80 / 90 / 100.

- Fixed reading density `0%` applying extra paragraph and list spacing; default density now leaves Gemini's native message spacing unchanged.

- Fixed reading density compactness mapping so low positive values no longer become looser than Gemini's native spacing, and expanded density styling to Gemini's current message, markdown, user text, table, and code nodes.

### Other

- Updated release packaging so the GitHub Release ZIP includes the shared settings utility used by the extension manifest.

## 2.1.2 (2026-05-24)

### Fixes

- Fixed Notebook Sources button being partially hidden behind the input bar when using custom Gemini widths.

- Fixed notebook input area overlapping page content when attaching files or using input features on notebook pages.

- Scoped input and upload width rules to inner input elements inside `input-container`, preserving native Gemini notebook layout without affecting Drive picker dialogs fixed in v2.1.1.

## 2.1.1 (2026-05-18)

### Fixes

- Fixed Google Drive "Add from Drive" picker layout being clipped when using custom Gemini widths.

- Removed global overlay/dialog width overrides to avoid affecting third-party Gemini dialogs.

## 2.1.0 (2026-03-23)

### Fixes

- Fixed table width not adapting to conversation area width.

- Improved CSS outer container constraint handling.

### Refactor

- Optimized width setting logic.

### Other

- Updated README.md.
