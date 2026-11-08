# Contributing to Roomy (formerly Wider Gemini)

Bug reports, translations, and focused fixes are welcome. Start with a reproducible problem or a small improvement to an existing feature. For a larger feature, open an issue describing the user task before implementing it.

## Run the extension

1. Clone this repository.
2. Open `chrome://extensions/` in Chrome and enable **Developer mode**.
3. Choose **Load unpacked** and select the repository folder.
4. Open [Gemini](https://gemini.google.com/), [ChatGPT](https://chatgpt.com/), [Claude](https://claude.ai/) or [DeepSeek](https://chat.deepseek.com/). After changing extension files, reload the extension and then reload the affected page.

The extension uses vanilla JavaScript, HTML, and CSS. There is no build step or npm install.

Runtime files live under `src/`: `background.js` handles startup injection and optional-site registration; `shared/` contains the site registry (`sites.js`) and settings normalization; `content/` contains the shared core (`core/`), the site adapters (`sites/`), the navigation rail and the standalone Gemini and ChatGPT scripts; `popup/` and `help/` contain their HTML, JS, and CSS. `manifest.json`, `_locales/`, and `icons/` remain at the repository root. Load that root folder, not `src/`; the release ZIP packages every js/css/html file under `src/` by directory rule and preserves the same layout.

To add a website, register it in `src/shared/sites.js`, write an adapter in `src/content/sites/`, add its fixture under `tests/e2e/fixtures/<id>/`, add its host to `optional_host_permissions` in `manifest.json`, and update the public docs. See [Core runtime and site adapters](docs/engineering.md#core-runtime-and-site-adapters).

## Run the existing checks

Use Node.js 24 for internal checks. Browser checks also need Chrome; they can load the source directory directly without making a release ZIP.

```sh
node scripts/test.js --skip-packaging
node tests/e2e/message-width.js
node tests/e2e/sites.js
```

The first command runs the existing unit checks while skipping ZIP packaging. The second runs synthetic Gemini layout scenarios in a real headless Chrome window; the third runs the shared scenario for every core-runtime site. Set `WG_CHROME` to your Chrome executable when it is not installed at the default Windows path.

When release validation is actually needed, `node scripts/test.js` keeps the full default suite, including packaging tests. Those checks also require PowerShell 7 (`pwsh`) or Windows PowerShell 5.1; `WG_POWERSHELL` selects the executable. CI retains the full suite.

```powershell
$env:WG_CHROME = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node tests/e2e/message-width.js
```

```sh
WG_CHROME="/path/to/chrome" node tests/e2e/message-width.js
```

Optional popup checks can also use the repository root directly:

```sh
node tests/e2e/package-load.js .
node tests/e2e/popup-language.js . local/popup-language-check
node tests/e2e/popup-sites.js . local/popup-sites-check
```

These use isolated browser profiles. Despite its name, `package-load.js` accepts any unpacked extension directory, including the source tree; the language and site-list checks store diagnostic screenshots under the ignored `local/` folder. None of these commands builds a ZIP.

For layout changes, also try the affected flow on the real Gemini, ChatGPT, Claude or DeepSeek website. Record the site, browser, OS, extension version, and steps in the PR. The existing Gemini fixtures do not establish ChatGPT compatibility, compatibility with every live site rollout, or macOS acceptance. See [engineering and compatibility notes](docs/engineering.md) for the supported boundaries and manual scenarios.

## Keep a change focused

- Follow the existing four-space JavaScript indentation and semicolon style.
- Keep runtime code dependency-free. Preserve live settings updates and idempotent content-script initialization.
- Keep overlays and dialogs outside conversation width overrides. Preserve the input, upload, and sidenav boundaries described in the engineering notes.
- Preserve independent site widths and legacy Gemini settings. Width changes on any site must not alter native attachment, menu, preview, side-panel or Canvas layouts. Never rename storage keys or the internal `wider-*`, `data-wg*` and `widerGemini*` identifiers.
- Reuse the existing checks. Add a regression case when a reproduced behavior needs one; routine wording and documentation changes do not need new tests.
- In a PR, explain the user-visible change, link its issue when applicable, and report which existing checks and manual flows you ran. Include before/after images for visible layout changes, with personal content removed.

Do not include private conversations, account details, tokens, or local diagnostic archives in an issue or commit. Keep local diagnostics and experimental browser scripts in the ignored `local/` folder.

The repository holds only the extension, its tests and build scripts, and the public documentation. Keep research, metrics, verification logs, experiments and other working notes in the ignored `local/` folder. `tests/repository-files.test.js` lists every public path and fails when anything else is committed; extend that list in the same PR when a new public file is genuinely needed.

## Translations

Locale dictionaries live in `_locales/<locale>/messages.json`; use the English keys as the source. Keep message keys and placeholders consistent, translate the meaning rather than the code identifiers, and check the popup at its actual size. New UI languages also need the language selector and language normalization updated. Include a native-speaker review when available, and identify machine-assisted translations that still need review.

The [Korean](./_locales/ko/messages.json), [Japanese](./_locales/ja/messages.json), and [Spanish](./_locales/es/messages.json) dictionaries are machine-assisted internal drafts awaiting native-speaker review. Review natural phrasing, technical terms, help text, and fit at the popup's actual size before treating them as release-ready. They do not include localized store materials or additional READMEs in this iteration.

Messages are site-independent: use `{site}` or `{sites}` placeholders instead of naming a website, so a new site needs no translation. `tests/locales.test.js` checks that all six dictionaries have the same keys and placeholders, that store and manifest strings fit their length limits, and that every key is used somewhere under `src/`. `node tests/e2e/popup-language.js` checks manual language switching and browser-language matching in a real popup. These checks establish loading and layout, not translation quality; native-speaker review is still pending.

## Releases

Maintainers update the manifest and dated changelog, run the checks, and tag a release. CI runs the same tests before building the release ZIP. The shared `scripts/package.ps1` validates versions and release notes and packages the runtime files by directory rule. The Release workflow then loads that exact ZIP in Chrome on Windows and attaches it to the GitHub Release. To rehearse a release without publishing, run the Release workflow manually from the Actions tab; it stops after the Chrome check. Dependabot opens one pull request a month when the workflow actions have updates. Ordinary contributions should leave version bumps and release tags to the maintainer.
