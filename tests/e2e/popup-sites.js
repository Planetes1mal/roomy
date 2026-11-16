(function () {
    'use strict';

    const assert = require('assert');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const { spawn } = require('child_process');
    assert(process.argv[2] && process.argv[3], 'Provide the extension and screenshot directories');
    const source = path.resolve(process.argv[2]);
    const screenshots = path.resolve(process.argv[3]);
    fs.mkdirSync(screenshots, { recursive: true });
    const LOCALES = ['en', 'zh_CN', 'zh_TW', 'ko', 'ja', 'es'];
    const dictionaries = Object.fromEntries(LOCALES.map(locale => [locale,
        JSON.parse(fs.readFileSync(path.join(source, '_locales', locale, 'messages.json'), 'utf8'))]));

    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-popup-sites-'));
    const extension = path.join(temp, 'extension');
    fs.cpSync(source, extension, {
        recursive: true,
        filter: file => !/(^|[\\/])(\.git|\.claude|local|tests|node_modules)([\\/]|$)/.test(path.relative(source, file))
    });
    const extensionManifestPath = path.join(extension, 'manifest.json');
    const extensionManifest = JSON.parse(fs.readFileSync(extensionManifestPath, 'utf8'));
    delete extensionManifest.background;
    fs.writeFileSync(extensionManifestPath, JSON.stringify(extensionManifest, null, 4));
    const registryPath = path.join(extension, 'src/shared/sites.js');
    const registry = fs.readFileSync(registryPath, 'utf8');
    const start = registry.indexOf('const SITES = [');
    const end = registry.indexOf('\n    ];', start);
    assert(start > 0 && end > start, 'sites.js declares the SITES array');
    const fakeSites = `const SITES = [
        {
            id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/', matches: ['https://gemini.google.com/*'],
            access: 'required', since: '1.0.0', runtime: 'legacy', storage: 'gemini-legacy',
            capabilities: ['width', 'navigation', 'reading', 'userFullWidth', 'codeWrap'], tasks: ['reading', 'table', 'code', 'large'],
            legacy: { js: [...SHARED_JS, 'src/content/gemini-content.js'], css: [...SHARED_CSS, 'src/content/gemini-content.css'],
                loadedFlag: 'widerGeminiContentLoaded', takeoverEvent: 'wider-gemini-takeover' }
        },
        {
            id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', matches: ['https://chatgpt.com/*'],
            access: 'optional', since: '3.0.0', runtime: 'legacy', storage: 'default',
            capabilities: ['width', 'navigation', 'reading', 'userFullWidth'], tasks: ['reading', 'wide', 'large'],
            legacy: { js: [...SHARED_JS, 'src/content/chatgpt-content.js'], css: [...SHARED_CSS, 'src/content/chatgpt-content.css'],
                loadedFlag: 'widerChatgptContentLoaded', takeoverEvent: 'wider-chatgpt-takeover' }
        },
        {
            id: 'alpha', name: 'Alpha Chat', url: 'https://alpha.example/', matches: ['https://alpha.example/*', 'https://www.alpha.example/*'],
            access: 'optional', since: '3.1.0', runtime: 'core', storage: 'default',
            capabilities: ['width', 'navigation', 'reading', 'userFullWidth'], tasks: ['reading', 'wide', 'large'],
            adapter: { js: 'src/content/sites/alpha.js' }
        },
        {
            id: 'beta', name: 'Beta', url: 'https://beta.example/', matches: ['https://beta.example/*'],
            access: 'optional', since: '3.2.0', runtime: 'core', storage: 'default',
            capabilities: ['width'], tasks: ['reading', 'wide'],
            adapter: { js: 'src/content/sites/beta.js' }
        }`;
    fs.writeFileSync(registryPath, registry.slice(0, start) + fakeSites + registry.slice(end));
    const manifestPath = path.join(extension, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.optional_host_permissions = ['https://chatgpt.com/*', 'https://alpha.example/*', 'https://www.alpha.example/*', 'https://beta.example/*'];
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));

    async function withBrowser(check) {
        const profile = path.join(temp, 'profile');
        const child = spawn(process.env.WG_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
            '--headless=new', '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
            `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-sync',
            '--disable-background-networking', '--force-prefers-reduced-motion', 'about:blank'
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
        function send(method, params = {}, sessionId, timeout = 10000) {
            return new Promise((resolve, reject) => {
                const id = ++serial;
                const timer = setTimeout(() => {
                    pending.delete(id);
                    reject(new Error(`Timeout: ${method}`));
                }, timeout);
                pending.set(id, { resolve, reject, timer });
                child.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
            });
        }
        try {
            const { id } = await send('Extensions.loadUnpacked', { path: extension }, undefined, 90000);
            assert(id, 'Chrome accepts the extension source');
            const base = `chrome-extension://${id}/${manifest.action.default_popup}`;
            async function openPopup(query = '') {
                const { targetId } = await send('Target.createTarget', { url: `${base}${query}` });
                const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
                await send('Emulation.setDeviceMetricsOverride', { width: 400, height: 600, deviceScaleFactor: 1, mobile: false }, sessionId);
                async function evaluate(expression, userGesture = false) {
                    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture }, sessionId);
                    if (result.exceptionDetails) {
                        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
                    }
                    return result.result.value;
                }
                async function ready(extra = 'true') {
                    let state = null;
                    for (let attempt = 0; attempt < 100; attempt++) {
                        try {
                            state = await evaluate(`(() => {
                                if (document.readyState !== 'complete' || !globalThis.chrome?.runtime?.id) return null;
                                const controls = document.getElementById('settingsControls');
                                if (!controls || controls.disabled) return null;
                                if (!(${extra})) return null;
                                return true;
                            })()`);
                        } catch (error) {
                            if (!/Execution context was destroyed|Cannot find context|Inspected target navigated/.test(error.message)) throw error;
                        }
                        if (state) return;
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    assert.fail(`popup did not become ready (${extra})`);
                }
                async function capture(name) {
                    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
                    fs.writeFileSync(path.join(screenshots, `${name}.png`), Buffer.from(data, 'base64'));
                }
                async function close() {
                    await send('Target.closeTarget', { targetId }).catch(() => {});
                }
                async function click(selector) {
                    const { x, y } = await evaluate(`(() => {
                        const target = document.querySelector(${JSON.stringify(selector)});
                        target.scrollIntoView({block:'nearest'});
                        const r = target.getBoundingClientRect();
                        if (!r.width || !r.height) throw Error('Control is hidden: ' + target.outerHTML);
                        return {x:r.x + r.width / 2, y:r.y + r.height / 2};
                    })()`);
                    for (const type of ['mousePressed', 'mouseReleased']) {
                        await send('Input.dispatchMouseEvent', { type, x, y, button:'left', clickCount:1 }, sessionId);
                    }
                }
                async function theme(value) {
                    await send('Emulation.setEmulatedMedia', { features: [{name:'prefers-color-scheme', value},
                        {name:'prefers-reduced-motion', value:'reduce'}] }, sessionId);
                }
                return { evaluate, ready, capture, close, click, theme };
            }
            await check({ openPopup, send });
        } finally {
            await send('Browser.close').catch(() => child.kill());
            await closed;
        }
    }

    const LIST_STATE = `(() => ({
        view: document.getElementById('siteListView').hidden ? 'site' : 'list',
        yours: [...document.querySelectorAll('#yourSites .site-row')].map(row => row.dataset.site),
        addable: [...document.querySelectorAll('#addableSites .site-row')].map(row => row.dataset.site),
        addableShown: !document.getElementById('addableSitesGroup').hidden,
        fresh: [...document.querySelectorAll('.site-row')].filter(row => !row.querySelector('.site-new').hidden).map(row => row.dataset.site),
        current: [...document.querySelectorAll('.site-row')].filter(row => !row.querySelector('.site-current').hidden).map(row => row.dataset.site),
        states: Object.fromEntries([...document.querySelectorAll('.site-row')].map(row => [row.dataset.site, row.querySelector('.site-state').textContent])),
        controls: Object.fromEntries([...document.querySelectorAll('.site-row')].map(row => [row.dataset.site,
            !row.querySelector('.site-allow').hidden ? 'allow' : !row.querySelector('.switch').hidden ? 'switch' : 'none'])),
        fits: document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.site-row')].every(row => row.scrollWidth <= row.clientWidth + 0.5),
        version: document.getElementById('extensionVersion').textContent
    }))()`;
    const SITE_STATE = `(() => ({
        view: document.getElementById('siteView').hidden ? 'list' : 'site',
        title: document.getElementById('siteTitle').textContent,
        permission: !document.getElementById('sitePermission').hidden,
        grantText: document.getElementById('grantSitePermission').textContent,
        intro: !document.getElementById('introLine').hidden,
        introText: document.getElementById('introLineText').textContent,
        navigation: !document.getElementById('navigationCard').hidden,
        codeWrap: !document.getElementById('codeWrapCard').hidden,
        userFullWidth: !document.getElementById('userFullWidthCard').hidden,
        tasks: [...document.querySelectorAll('[data-task]')].map(row => row.dataset.task),
        enabled: document.getElementById('siteEnabledToggle').checked,
        paused: !document.getElementById('sitePowerState').hidden,
        fits: document.documentElement.scrollWidth <= innerWidth &&
            document.querySelector('.site-header').scrollWidth <= document.querySelector('.site-header').clientWidth + 0.5,
        summary: document.getElementById('readingSummary').textContent
    }))()`;

    (async () => {
        await withBrowser(async ({ openPopup }) => {
            let popup = await openPopup();
            await popup.ready("!document.getElementById('siteListView').hidden");
            let list = await popup.evaluate(LIST_STATE);
            assert.strictEqual(list.view, 'list', 'opens the list away from a supported site');
            assert.deepStrictEqual(list.yours, ['gemini'], 'required sites are in "your websites"');
            assert.deepStrictEqual(list.addable, ['chatgpt', 'alpha', 'beta'], 'ungranted sites follow the registry order');
            assert.strictEqual(list.addableShown, true);
            assert.deepStrictEqual(list.fresh, [], 'no New marker without intro flags');
            assert.deepStrictEqual(list.current, [], 'no current-page marker on a non-site page');
            assert.strictEqual(list.controls.gemini, 'switch');
            assert.strictEqual(list.controls.alpha, 'allow');
            assert.strictEqual(list.states.gemini, '');
            assert.strictEqual(list.states.alpha, '');
            assert.strictEqual(list.version, manifest.version);
            assert(list.fits, 'list fits the popup width');
            await popup.evaluate(`chrome.storage.local.set({ alphaIntroPending: 'update', betaIntroPending: 'install' })`);
            await popup.close();
            popup = await openPopup();
            await popup.ready("!document.getElementById('siteListView').hidden");
            list = await popup.evaluate(LIST_STATE);
            assert.deepStrictEqual(list.fresh, ['alpha'], 'only update-introduced sites get the New marker');
            const flagsAfter = await popup.evaluate(`chrome.storage.local.get(['alphaIntroPending', 'betaIntroPending'])`);
            assert.deepStrictEqual(flagsAfter, {}, 'opening the popup clears the intro flags');
            const request = await popup.evaluate(`(() => {
                window.requests = [];
                let inClick = false;
                document.addEventListener('click', () => { inClick = true; queueMicrotask(() => { inClick = false; }); }, true);
                chrome.permissions.request = request => { window.requests.push({ origins: request.origins, sync: inClick }); return Promise.resolve(false); };
                document.querySelector('.site-row[data-site="alpha"] .site-allow').click();
                return window.requests;
            })()`, true);
            assert.deepStrictEqual(request, [{ origins: ['https://alpha.example/*', 'https://www.alpha.example/*'], sync: true }],
                'Allow requests only that site, synchronously within the click');
            await popup.evaluate(`(() => { const input = document.querySelector('.site-row[data-site="gemini"] input'); input.checked = false;
                input.dispatchEvent(new Event('change', { bubbles: true })); })()`, true);
            await popup.ready(`document.querySelector('.site-row[data-site="gemini"] .site-state').textContent === ${JSON.stringify(dictionaries.en.sitePaused.message)}`);
            const stored = await popup.evaluate(`chrome.storage.sync.get('geminiEnabled')`);
            assert.strictEqual(stored.geminiEnabled, false, 'list switch pauses the site');
            await popup.evaluate(`(() => { const input = document.querySelector('.site-row[data-site="gemini"] input'); input.checked = true;
                input.dispatchEvent(new Event('change', { bubbles: true })); })()`, true);
            await popup.ready(`document.querySelector('.site-row[data-site="gemini"] .site-state').textContent === ${JSON.stringify('')}`);
            await popup.evaluate(`document.querySelector('.site-row[data-site="alpha"] .site-open').click()`, true);
            await popup.ready("!document.getElementById('siteView').hidden");
            let site = await popup.evaluate(SITE_STATE);
            assert.strictEqual(site.title, 'Alpha Chat');
            assert.strictEqual(site.navigation, true);
            assert.strictEqual(site.permission, true, 'ungranted site shows the permission card');
            assert.strictEqual(site.grantText, 'Allow Alpha Chat access');
            assert.strictEqual(site.codeWrap, false, 'code wrap is hidden without the capability');
            assert.strictEqual(site.userFullWidth, true);
            assert.deepStrictEqual(site.tasks, ['reading', 'wide', 'large']);
            assert.strictEqual(site.intro, false, 'the new site itself gets no intro line');
            assert(site.fits, 'site page fits the popup width');
            await popup.evaluate(`document.getElementById('backToSites').click()`, true);
            await popup.ready("!document.getElementById('siteListView').hidden");
            await popup.close();
            popup = await openPopup('?site=beta');
            await popup.ready("!document.getElementById('siteView').hidden");
            site = await popup.evaluate(SITE_STATE);
            assert.strictEqual(site.navigation, false, 'navigation is absent without the capability');
            assert.deepStrictEqual([site.title, site.codeWrap, site.userFullWidth, site.tasks], ['Beta', false, false, ['reading', 'wide']]);
            await popup.close();
            popup = await openPopup('?site=gemini');
            await popup.ready("!document.getElementById('siteView').hidden");
            await popup.evaluate(`chrome.storage.local.set({ alphaIntroPending: 'update' })`);
            await popup.close();
            popup = await openPopup('?site=gemini');
            await popup.ready("!document.getElementById('siteView').hidden");
            site = await popup.evaluate(SITE_STATE);
            assert.deepStrictEqual([site.title, site.codeWrap, site.userFullWidth, site.tasks, site.permission],
                ['Gemini', true, true, ['reading', 'table', 'code', 'large'], false]);
            assert.strictEqual(site.intro, true, 'intro line appears on another site');
            assert.strictEqual(site.introText, 'New: Alpha Chat supported');
            assert.strictEqual(site.summary, '');
            await popup.evaluate(`document.getElementById('introLine').click()`, true);
            await popup.ready("!document.getElementById('siteListView').hidden");
            list = await popup.evaluate(LIST_STATE);
            assert.deepStrictEqual(list.fresh, ['alpha'], 'the list keeps the New marker for this opening');
            await popup.close();
            console.log('PASS: list grouping, intro markers, Allow request, list pause, capability-gated site page, intro line');

            popup = await openPopup('?view=list');
            await popup.ready();
            await popup.evaluate(`(() => {
                let allowed = false;
                chrome.permissions.request = async () => { allowed = true; return true; };
                chrome.permissions.contains = async ({ origins }) => allowed && origins.includes('https://chatgpt.com/*');
                chrome.tabs.query = async () => [{ url: 'https://chatgpt.com/' }];
                return initializeSettings();
            })()`);
            await popup.click('[data-site="chatgpt"] .site-allow');
            await popup.ready("document.querySelector('#yourSites li').dataset.site === 'chatgpt'");
            assert.deepStrictEqual((await popup.evaluate(LIST_STATE)).yours, ['chatgpt', 'gemini'], 'granted current site comes first');
            await popup.click('[data-site="chatgpt"] .site-open');
            const centered = await popup.evaluate(`(() => {
                const r = document.getElementById('siteTitle').getBoundingClientRect();
                return [document.getElementById('siteTitle').textContent, r.left + r.width / 2, !document.getElementById('siteSwitch').hidden];
            })()`);
            assert.strictEqual(centered[0], 'ChatGPT');
            assert(Math.abs(centered[1] - 200) <= 0.5 && centered[2], 'ChatGPT stays centered with both header controls visible');
            await popup.close();
            console.log(`PASS: optional grant, current site first, ChatGPT title center at ${centered[1]} px`);

            popup = await openPopup('?site=gemini');
            await popup.ready();
            await popup.theme('light');
            await popup.click('#widthEnabledToggle');
            assert(await popup.evaluate("document.querySelector('#nativeWidth').checkVisibility() && document.querySelector('#widthSlider').matches(':disabled') && document.querySelector('#unitPercentBtn').disabled"));
            await popup.click('[data-open="tasks"]');
            assert.strictEqual(await popup.evaluate("document.querySelector('[data-task][aria-pressed=true]')"), null);
            await popup.click('[data-task="large"]');
            await popup.ready("!document.getElementById('restoreTaskPreset').hidden");
            await popup.click('[data-task="large"]');
            const applied = await popup.evaluate("chrome.storage.sync.get(['widthEnabled','messageFontSize'])");
            assert.deepStrictEqual(applied, { widthEnabled:true, messageFontSize:140 });
            await popup.click('#restoreTaskPreset');
            await popup.ready("document.getElementById('restoreTaskPreset').hidden");
            assert.deepStrictEqual(await popup.evaluate("chrome.storage.sync.get(['widthEnabled','messageFontSize'])"),
                { widthEnabled:false, messageFontSize:100 }, 'repeat application preserves the original undo');
            assert.strictEqual(await popup.evaluate('document.activeElement.id'), 'siteTitle');
            await popup.click('#backToSites');
            await popup.click('#widthEnabledToggle');
            await popup.click('#siteEnabledToggle');
            await popup.ready("!document.getElementById('sitePowerState').hidden");
            await popup.click('#fontUp');
            await popup.ready("document.getElementById('fontSizeValue').textContent === '105%'");
            await popup.click('#resetFontSizeBtn');
            await popup.click('#siteEnabledToggle');
            await popup.click('[data-open="reading"]');
            await popup.click('#manualSpacing');
            assert(await popup.evaluate("document.getElementById('compactnessSlider').disabled && !document.getElementById('advancedDensityBody').hidden"));
            await popup.click('#resetDensityBtn');
            assert.strictEqual(await popup.evaluate('document.activeElement.id'), 'compactnessSlider');
            await popup.click('#backToSites');
            await popup.click('[data-open="range"]');
            async function typeAndLeave(selector, value) {
                await popup.evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); input.focus(); input.value = ${JSON.stringify(value)}; })()`);
                await popup.click('.subhead');
            }
            await typeAndLeave('#widthMaxInput', '725');
            assert.strictEqual(await popup.evaluate("document.getElementById('widthMaxInput').getAttribute('aria-invalid')"), 'true');
            assert.strictEqual(await popup.evaluate("chrome.storage.sync.get('widthMax').then(s => s.widthMax)"), 2000);
            await typeAndLeave('#widthMaxInput', '900');
            await typeAndLeave('#presetEditor input[type=text]', 'Desk');
            await popup.click('#resetRange');
            await popup.ready("!document.getElementById('undoRange').hidden");
            await popup.click('#undoRange');
            assert.deepStrictEqual(await popup.evaluate(`flushPendingChanges().then(() => chrome.storage.sync.get(['widthMax','presetsByUnit','chatWidthSetting'])).then(s => [s.widthMax,s.presetsByUnit.px[0].name,s.chatWidthSetting.value])`),
                [900, 'Desk', 900], 'limits, clamped width, and shortcut names survive reset and undo');
            assert.strictEqual(await popup.evaluate('document.activeElement.id'), 'resetRange');
            await popup.click('#rangeUnits button[data-unit=percent]');
            assert.strictEqual(await popup.evaluate("document.getElementById('widthMaxInput').value"), '100');
            await popup.click('#backToSites');
            assert.strictEqual(await popup.evaluate("document.getElementById('widthUnitLabel').textContent"), 'px');
            await popup.click('[data-open="range"]');
            await popup.click('#resetRange');
            await popup.click('#backToSites');
            await popup.click('#presetButtonsContainer button:nth-child(2)');
            await popup.evaluate('flushPendingChanges()');
            await popup.close();
            console.log('PASS: real clicks, paused edits, width lock, task and range undo, validation, manual spacing, focus');

            for (const locale of LOCALES) {
                popup = await openPopup('?view=list');
                await popup.ready("!document.getElementById('siteListView').hidden");
                await popup.evaluate(`(() => { const select = document.getElementById('uiLanguageSelect'); select.value = ${JSON.stringify(locale)};
                    select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
                await popup.ready(`!document.getElementById('siteListView').hidden && document.documentElement.lang === ${JSON.stringify(dictionaries[locale].localeCode.message)}`);
                list = await popup.evaluate(LIST_STATE);
                assert(list.fits, `${locale}: list fits`);
                assert.strictEqual(list.states.alpha, '');
                await popup.capture(`${locale}-list`);
                await popup.close();
                for (const id of ['gemini', 'alpha']) {
                    popup = await openPopup(`?site=${id}`);
                    await popup.ready(`!document.getElementById('siteView').hidden && document.documentElement.lang === ${JSON.stringify(dictionaries[locale].localeCode.message)}`);
                    site = await popup.evaluate(SITE_STATE);
                    assert(site.fits, `${locale}: ${id} site page fits`);
                    await popup.theme('light');
                    await popup.capture(`${locale}-site-${id}-light`);
                    await popup.theme('dark');
                    await popup.capture(`${locale}-site-${id}`);
                    if (id === 'gemini') {
                        for (const panel of ['range', 'reading', 'tasks']) {
                            await popup.click('[data-open="' + panel + '"]');
                            const geometry = await popup.evaluate(`(() => {
                                const panel = document.querySelector('[data-panel]:not([hidden])');
                                const scroll = document.getElementById('siteScroll');
                                const header = document.querySelector('.site-header').getBoundingClientRect();
                                const title = document.getElementById('siteTitle').getBoundingClientRect();
                                const back = document.getElementById('backToSites').getBoundingClientRect();
                                const centered = Math.abs(title.left + title.width / 2 - header.left - header.width / 2) <= 1;
                                return [panel.dataset.panel, scroll.scrollWidth <= scroll.clientWidth, centered,
                                    back.right <= title.left, document.activeElement.id, getComputedStyle(panel).animationName];
                            })()`);
                            assert.deepStrictEqual(geometry, [panel, true, true, true, 'siteTitle', 'none']);
                            for (const scheme of ['dark', 'light']) {
                                await popup.theme(scheme);
                                await popup.capture(`${locale}-${panel}-${scheme}`);
                            }
                            await popup.click('#backToSites');
                            assert.strictEqual(await popup.evaluate('document.activeElement.dataset.open'), panel);
                        }
                    }
                    await popup.close();
                }
                console.log(`PASS: ${locale} list and site pages fit 400px`);
            }
            popup = await openPopup('?view=list');
            await popup.ready("!document.getElementById('siteListView').hidden");
            await popup.evaluate(`(() => { const select = document.getElementById('uiLanguageSelect'); select.value = 'auto';
                select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
            await popup.ready("!document.getElementById('siteListView').hidden && document.getElementById('uiLanguageSelect').value === 'auto'");
            await popup.close();
        });
        fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        console.log(`PASS: popup site list and site pages; screenshots: ${screenshots}`);
    })().catch(error => {
        console.error(error.stack);
        process.exitCode = 1;
    });
})();
