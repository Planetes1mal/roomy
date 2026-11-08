# Read tables, code, and long answers more comfortably

[繁體中文](./reading-layout.zh-TW.md)

The steps below use Gemini as the example; the ChatGPT, Claude and DeepSeek sections at the end cover what differs on those sites. Open a conversation on **gemini.google.com**, then open Roomy from Chrome's extensions menu or its pinned toolbar icon. Keep an existing answer visible while changing a setting: you do not need to ask Gemini to generate it again. Changes are saved and applied to open Gemini tabs; cross-device synchronization depends on your browser's sync settings.

The steps below use individual controls. They also work when your installed version does not have newer task presets or help features. Suggested values are starting points, not a claim that one layout suits every screen.

## A comparison table is too narrow

Use an answer with several columns, such as a comparison of three tools by purpose, cost, limitations, setup, and alternatives.

1. Open the popup and choose **px** under **Width unit**.
2. Set **Chat width** to **1200 px**, using the slider or a matching preset. If your presets were renamed, use the numeric width instead.
3. Close the popup and inspect the same table. Compare whether headings are easier to scan and whether fewer cells wrap across multiple lines.
4. If you frequently resize the window, try **%** and **90%** instead. The percentage is based on the browser viewport width; sidebars, padding, and the available content area can make the visible result narrower.

The width is a requested layout limit, not a promise of 1200 visible pixels inside a smaller window. Very wide tables can still require horizontal scrolling within the table. Making the browser window wider or closing Gemini's sidebar may help; increasing the setting beyond the available space cannot create more screen area.

Keep the font at 100% for the first comparison. Once the columns fit as well as the window permits, adjust the text size separately so you can tell which change helped.

## A long code line keeps disappearing off the right edge

1. Scroll to an answer containing a code block with a long line.
2. Start with a width that fits your window, for example **1200 px** on a wide display.
3. Turn on **Code auto wrap**. Close the popup and check that the long line continues onto additional visual lines.
4. Turn it off when you need to inspect the original line layout, aligned columns, or indentation without soft wrapping.

Wrapping changes the presentation; the extension does not rewrite the code text. A wrapped code block becomes taller, so it can require more vertical scrolling. This control targets code blocks, not every embedded editor or canvas Gemini may display. If only a particular embedded view ignores it, report that view rather than assuming the whole extension failed.

## Text is too small, but browser zoom makes everything larger

Use **Font size** in the extension to adjust conversation text without changing the browser's page zoom setting.

1. Keep your browser at a comfortable zoom level. For a controlled comparison, use the same browser zoom before and after.
2. Try **110%** or **115%** in **Font size**. The available range is **75%–200%**, in 5-point steps.
3. Keep **Reading density** at **0** as a starting point. If paragraphs then feel too far apart, adjust density; use **Advanced spacing** when you want separate line-height and paragraph-spacing controls.
4. Use **Reset font size** to return the extension's font setting to **100%**.

This affects supported conversation text, including code and headings; it does not scale Chrome's toolbar or the extension popup. Enlarging text can make tables and code wrap more, so recheck those parts of the answer. Font size is independent of paragraph spacing: at Auto density 0, native paragraph gaps remain unchanged and native line-height proportions scale with the text. Higher density gradually compresses prose spacing. Code blocks and table cells keep their native line-height proportions at every density and manual line height; inline code follows its paragraph. Moving either Advanced spacing slider applies both displayed values manually; Reset spacing returns to Auto at the current density.

For a simple long-answer starting point, try **1000 px / 110% font / density 0 / code wrap off**. To return to native reading typography after experimenting, set density to 0 and font size to 100%, then expand **Advanced spacing** and click **Reset spacing** to clear custom spacing. Collapsing that panel only hides the controls; it does not reset them. Width and code wrapping remain separate choices.

## A setting appears to do nothing

Work through the following checks on the same answer:

1. **Check the page.** The supported site is `gemini.google.com`. A Chrome-installed app for that site is also supported. This does not establish support for a separate native Gemini desktop app, AI Studio, or Chrome's built-in Gemini side panel.
2. **Check the extension.** Confirm Roomy is enabled in Chrome. If it was just installed or updated, refresh the Gemini page once and try again. Routine setting changes should apply without a reload.
3. **Make the difference visible.** Compare 800 px and 1200 px in a sufficiently wide window. If your custom width range excludes a value, choose two values inside that range. On a narrow window, both settings can be limited by the same available space.
4. **Identify the view.** Ordinary conversations, Notebook pages, and Deep Research can have different layouts. The current implementation applies a separate 1600 px width when it detects the Deep Research response view, so a slider change there may not match an ordinary conversation.
5. **Check overlapping layout tools.** If you use another Gemini theme, width extension, or user style, temporarily turn off that specific layout customization and compare again. Report whether the problem only occurs with both enabled.
6. **Provide a small reproduction.** Include the page type, approximate window size, width value/unit, font size, wrap state, and steps. If sharing an image, remove private conversations and account details first.

If your version includes **Help & feedback**, open it and choose **Generate report**. Review the preview before selecting **Copy report** and pasting it into a [GitHub issue](https://github.com/Planetes1mal/roomy/issues). The report includes extension version, browser major version, platform, and layout settings; it excludes conversation content, page URLs, titles, and custom preset names. It is not sent automatically. Older versions can use the same issue link with the settings written manually.

## Reference settings

| Situation | Suggested first comparison | What to inspect |
|---|---|---|
| Several table columns | 1200 px, font 100% | Column labels and cell wrapping; remaining horizontal scroll |
| Long code | 1200 px, wrap on, font 100% | Long-line visibility and additional vertical height |
| Long prose | 1000 px, font 110%, density 0 | Comfortable line length and paragraph separation |
| Resizable window | 90%, font 100% | Fit after changing window size and sidebar state |

Fresh installs start at **1000 px**, **100% font**, **density 0**, **custom spacing off**, and **code wrapping off**. Existing installations retain their saved settings. These suggestions do not change the defaults or claim verified behavior on every operating system.

## Task presets

**Task presets** combines the same individual controls. Select a task to see its summary; nothing changes until you click **Apply**.

| Task | Requested width | Font | Code wrapping |
|---|---|---|---|
| Long reading | 1000 px | 110% | On |
| Tables | 90% | 100% | Off |
| Code | 90% | 100% | On |
| Large text | 1000 px | 140% | On |

Every task sets density to 0 and clears custom spacing. Actual width respects your saved minimum and maximum limits. Your named width presets, range limits, interface language, and user-message full-width choice are preserved.

**Restore previous settings** restores the width, font, spacing, and code-wrapping settings saved immediately before the latest task application on this device. The single saved snapshot survives closing the popup. Restoring also replaces any later manual changes to those four setting groups; it is not a multi-step history.

Maintainer references: [settings defaults and normalization](../../src/shared/settings-utils.js), [layout rules](../../src/content/gemini-content.css), [content behavior](../../src/content/gemini-content.js), and [diagnostic report fields](../../src/help/help.js).

## ChatGPT

Open ChatGPT's page in the popup (from the site list, or directly when ChatGPT is the current tab), then click **Allow ChatGPT access** and confirm Chrome's prompt if access has not been granted yet. Font size, reading density, Advanced spacing, and full-width user messages work as described above, with separate saved values for ChatGPT. Density and manual spacing change prose only: code lines, table rows, and formulas keep ChatGPT's own spacing. ChatGPT has no extension code-wrap switch; use the wrap button on each code block.

| Task | Requested width | Font |
|---|---|---|
| Long reading | 1000 px | 110% |
| Wide (tables & code) | 90% | 100% |
| Large text | 1000 px | 140% |

Use the switch beside the site name at the top of its page to compare with the original page: turning it off pauses everything on that site while keeping your settings.

## Claude

Open Claude's page in the popup (from the site list, or directly when claude.ai is the current tab), then click **Allow Claude access** and confirm Chrome's prompt if access has not been granted yet. Width, font size, reading density, Advanced spacing, full-width user messages and message navigation work as described above, with separate saved values for Claude. Density and manual spacing change prose only: code lines, table rows and formulas keep Claude's own spacing. Claude has no code-wrap control at all, so long code lines scroll inside the block.

| Task | Requested width | Font |
|---|---|---|
| Long reading | 1000 px | 110% |
| Wide (tables & code) | 90% | 100% |
| Large text | 1000 px | 140% |

Roomy adjusts Claude's conversation pages and the new-chat page. When the Artifacts panel is open, the conversation is capped at the space left beside the panel; the panel itself and its content are not changed. Projects, settings, Claude Code and shared pages keep their native layout, and the popup says so.

## DeepSeek

Open DeepSeek's page in the popup (from the site list, or directly when chat.deepseek.com is the current tab), then click **Allow DeepSeek access** and confirm Chrome's prompt if access has not been granted yet. Width, font size, reading density, Advanced spacing, full-width user messages and message navigation work as described above, with separate saved values for DeepSeek. Density and manual spacing change prose only: code lines, table rows and formulas keep DeepSeek's own spacing. DeepSeek wraps long code lines itself, so there is no code-wrap control.

| Task | Requested width | Font |
|---|---|---|
| Long reading | 1000 px | 110% |
| Wide (tables & code) | 90% | 100% |
| Large text | 1000 px | 140% |

Roomy adjusts DeepSeek's conversation pages and the new-chat page; the composer widens together with the conversation. The reasoning shown above an answer follows the same text settings as the answer.
