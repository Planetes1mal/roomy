(function () {
    'use strict';

    const assert = require('assert');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const { spawn } = require('child_process');
    assert(process.argv[2] && process.argv[3], 'Provide the extension and screenshot directories');
    const extension = path.resolve(process.argv[2]);
    const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
    const screenshots = path.resolve(process.argv[3]);
    fs.mkdirSync(screenshots, { recursive: true });
    const dictionaries = Object.fromEntries(['en', 'zh_CN', 'zh_TW', 'ko', 'ja', 'es'].map(locale => [locale,
        JSON.parse(fs.readFileSync(path.join(extension, '_locales', locale, 'messages.json'), 'utf8'))
    ]));
    const keys = Object.keys(dictionaries.en).sort();
    for (const [locale, dictionary] of Object.entries(dictionaries)) {
        assert.deepStrictEqual(Object.keys(dictionary).sort(), keys, `${locale}: dictionary key parity`);
        for (const key of keys) assert(dictionary[key].message.trim(), `${locale}.${key}: nonempty message`);
    }

    async function checkBrowser(browserLanguage, check) {
        const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-popup-language-'));
        const languageArgs = process.platform === 'darwin'
            ? ['--no-startup-window', '-AppleLanguages', `(${browserLanguage})`]
            : [`--lang=${browserLanguage}`, 'about:blank'];
        const child = spawn(process.env.WG_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
            '--headless=new', '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
            `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-sync',
            '--disable-background-networking', ...languageArgs
        ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'], windowsHide: true });
        const pending = new Map();
        const closed = new Promise(resolve => child.once('close', resolve));
        let buffer = '';
        let serial = 0;
        child.stdio[4].on('data', chunk => {
            buffer += chunk.toString();
            let separator;
            while ((separator = buffer.indexOf('\0')) >= 0) {
                const message = JSON.parse(buffer.slice(0, separator));
                buffer = buffer.slice(separator + 1);
                const job = pending.get(message.id);
                if (job) {
                    clearTimeout(job.timer);
                    pending.delete(message.id);
                    message.error ? job.reject(new Error(JSON.stringify(message.error))) : job.resolve(message.result);
                }
            }
        });
        function send(method, params = {}, sessionId) {
            return new Promise((resolve, reject) => {
                const id = ++serial;
                const timer = setTimeout(() => {
                    pending.delete(id);
                    reject(new Error(`Timeout: ${method}`));
                }, 10000);
                pending.set(id, { resolve, reject, timer });
                child.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
            });
        }
        try {
            const { id } = await send('Extensions.loadUnpacked', { path: extension });
            assert(id, 'Chrome accepts the extension source');
            const { targetId } = await send('Target.createTarget', {
                url: `chrome-extension://${id}/${manifest.action.default_popup}`
            });
            const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
            await send('Emulation.setDeviceMetricsOverride', {
                width: 400, height: 620, deviceScaleFactor: 1, mobile: false
            }, sessionId);
            async function evaluate(expression, userGesture = false) {
                const result = await send('Runtime.evaluate', {
                    expression, returnByValue: true, awaitPromise: true, userGesture
                }, sessionId);
                if (result.exceptionDetails) {
                    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
                }
                return result.result.value;
            }
            async function expectLanguage(selection, locale) {
                const dictionary = dictionaries[locale];
                let state;
                for (let attempt = 0; attempt < 50; attempt++) {
                    try {
                        state = await evaluate(`(async () => {
                            if (document.readyState !== 'complete' || !globalThis.chrome?.runtime?.id) return null;
                            const select = document.getElementById('uiLanguageSelect');
                            if (!select || document.getElementById('siteListView').hidden) return null;
                            const stored = await chrome.storage.sync.get('uiLanguage');
                            return { browser: chrome.i18n.getUILanguage(), lang: document.documentElement.lang,
                                selected: select.value, stored: stored.uiLanguage,
                                label: document.querySelector('[data-i18n="uiLanguageLabel"]').textContent,
                                auto: document.querySelector('[data-i18n="uiLanguageAuto"]').textContent,
                                groups: [...document.querySelectorAll('.group-title')].filter(el => !el.parentElement.hidden).map(el => el.textContent),
                                states: [...document.querySelectorAll('.site-state')].map(el => el.textContent),
                                rows: [...document.querySelectorAll('.site-row')].map(row => ({ site: row.dataset.site,
                                    fits: row.scrollWidth <= row.clientWidth + 0.5 })) };
                        })()`);
                    } catch (error) {
                        if (!/Execution context was destroyed|Cannot find context|Inspected target navigated/.test(error.message)) {
                            throw error;
                        }
                    }
                    if (state?.selected === selection && state.stored === selection &&
                        state.lang === dictionary.localeCode.message &&
                        state.label === dictionary.uiLanguageLabel.message && state.rows.length >= 2) break;
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                assert(state, `Popup loads for ${selection}`);
                assert.strictEqual(state.browser.split('-')[0], browserLanguage.split('-')[0],
                    'Actual Chrome UI language matches the test profile language');
                assert.strictEqual(state.selected, selection);
                assert.strictEqual(state.stored, selection, 'Language preference persists after popup reload');
                assert.strictEqual(state.lang, dictionary.localeCode.message);
                assert.strictEqual(state.label, dictionary.uiLanguageLabel.message);
                assert.strictEqual(state.auto, dictionary.uiLanguageAuto.message);
                assert.deepStrictEqual(state.groups, [dictionary.yourSites.message, dictionary.addableSites.message],
                    'Site list groups use the selected dictionary');
                assert(state.states.includes(dictionary.stateEnabled.message) && state.states.includes(dictionary.siteAccessNeeded.message),
                    'Site states use the selected dictionary');
                assert(state.rows.every(row => row.fits), `Site rows do not overflow: ${JSON.stringify(state.rows)}`);
                return state;
            }
            async function switchLanguage(selection, locale) {
                await evaluate(`(() => {
                    const select = document.getElementById('uiLanguageSelect');
                    select.value = ${JSON.stringify(selection)};
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                })()`);
                return expectLanguage(selection, locale);
            }
            async function capture(name) {
                const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
                fs.writeFileSync(path.join(screenshots, `${name}.png`), Buffer.from(data, 'base64'));
            }
            async function key(keyName, code) {
                for (const type of ['keyDown', 'keyUp']) {
                    await send('Input.dispatchKeyEvent', {
                        type, key: keyName, code: keyName, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code
                    }, sessionId);
                }
            }
            await check({ expectLanguage, switchLanguage, evaluate, capture, key });
        } finally {
            await send('Browser.close').catch(() => child.kill());
            await closed;
            fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        }
    }

    (async () => {
        await checkBrowser('zh-TW', async ({ expectLanguage, switchLanguage, evaluate, capture, key }) => {
            await expectLanguage('auto', 'zh_TW');
            await switchLanguage('en', 'en');
            await switchLanguage('zh_CN', 'zh_CN');
            await switchLanguage('ko', 'ko');
            await switchLanguage('ja', 'ja');
            await switchLanguage('es', 'es');
            await switchLanguage('zh_TW', 'zh_TW');
            await evaluate('window.scrollTo(0, 0)');
            await capture('traditional-popup-top');
            await evaluate("document.querySelector('.language-row').scrollIntoView({ block: 'center' })");
            await capture('traditional-language-closed');
            await evaluate(`(() => {
                const select = document.getElementById('uiLanguageSelect');
                select.focus();
                select.showPicker();
            })()`, true);
            assert(await evaluate("document.getElementById('uiLanguageSelect').matches(':open')"), 'Native picker opens');
            await capture('traditional-language-expanded');
            await key('ArrowUp', 38);
            await key('Enter', 13);
            await expectLanguage('zh_CN', 'zh_CN');
            await switchLanguage('auto', 'zh_TW');
            console.log('PASS: zh-TW browser auto; all manual choices persist; translated site list; keyboard picker; return to auto');
        });
        for (const [browserLanguage, locale, name] of [
            ['ko', 'ko', 'korean'], ['ja', 'ja', 'japanese'], ['es-ES', 'es', 'spanish']
        ]) {
            await checkBrowser(browserLanguage, async ({ expectLanguage, evaluate, capture }) => {
                await expectLanguage('auto', locale);
                assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `${name} popup fits`);
                await capture(`${name}-popup-top`);
                console.log(`PASS: ${name} browser auto; popup fits its viewport`);
            });
        }
        await checkBrowser('fr', async ({ expectLanguage }) => {
            await expectLanguage('auto', 'en');
            console.log('PASS: unsupported French browser locale falls back to English, including document language');
        });
        console.log(`PASS: ${keys.length} matching translation keys; screenshots: ${screenshots}`);
    })().catch(error => {
        console.error(error.stack);
        process.exitCode = 1;
    });
})();
