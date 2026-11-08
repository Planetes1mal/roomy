(function () {
    'use strict';

    const assert = require('assert');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const { spawn } = require('child_process');
    const extension = path.resolve(process.argv[2]);
    const expected = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
    const registrySandbox = { globalThis: {} };
    registrySandbox.globalThis = registrySandbox;
    require('vm').runInNewContext(fs.readFileSync(path.join(extension, 'src/shared/sites.js'), 'utf8'), registrySandbox);
    const widerRoomySites = registrySandbox.widerRoomySites;
    const plain = value => JSON.parse(JSON.stringify(value));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-package-load-'));
    const child = spawn(process.env.WG_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
        '--headless=new', '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
        `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
        '--disable-sync', '--disable-background-networking', 'about:blank'
    ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'], windowsHide: true });
    const pending = new Map();
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

    async function waitForPage(sessionId, expression, message) {
        for (let attempt = 0; attempt < 300; attempt++) {
            const result = await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
            assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
            if (result.result.value) return result.result.value;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.fail(message);
    }

    (async () => {
        try {
            const { id } = await send('Extensions.loadUnpacked', { path: extension }, undefined, 90000);
            assert(id, 'Chrome should accept the release manifest and files');
            const { targetId } = await send('Target.createTarget', {
                url: `chrome-extension://${id}/${expected.action.default_popup}`
            });
            const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
            const state = await waitForPage(sessionId, `(() => {
                const controls = document.getElementById('settingsControls');
                const list = document.getElementById('siteListView');
                if (document.readyState !== 'complete' || !globalThis.chrome?.runtime?.id ||
                    !globalThis.widerGeminiSettings || !globalThis.widerRoomySites || !controls || controls.disabled ||
                    !list || list.hidden) return null;
                const manifest = chrome.runtime.getManifest();
                return { version:manifest.version, versionName:manifest.version_name,
                    slider:!!document.getElementById('widthSlider'), name:manifest.name,
                    sites:[...document.querySelectorAll('.site-row')].map(row => row.dataset.site),
                    width:getComputedStyle(document.body).width,
                    styles:[...document.styleSheets].some(sheet => sheet.href && sheet.cssRules.length > 0),
                    helpUrl:document.querySelector('[data-i18n="helpLink"]').href };
            })()`, 'Packaged popup scripts should initialize and enable its controls');
            assert.strictEqual(state.version, expected.version);
            assert.strictEqual(state.versionName, expected.version_name);
            assert.strictEqual(state.slider, true);
            assert.deepStrictEqual(state.sites, plain(widerRoomySites.sites.map(site => site.id)), 'The site list follows the registry');
            assert.strictEqual(state.width, '400px', 'Packaged popup CSS should apply');
            assert.strictEqual(state.styles, true, 'Packaged popup stylesheet should load');
            assert(!state.name.startsWith('__MSG_'), 'Manifest localization should resolve');
            assert(state.helpUrl.startsWith(`chrome-extension://${id}/`), 'Help must point into this extension');
            const helpTarget = await send('Target.createTarget', { url: state.helpUrl });
            const helpSession = await send('Target.attachToTarget', { targetId: helpTarget.targetId, flatten: true });
            const help = await waitForPage(helpSession.sessionId, `(() => {
                if (document.readyState !== 'complete' || !globalThis.widerGeminiSettings) return null;
                const version = document.getElementById('extensionVersion')?.textContent;
                if (!version) return null;
                return { version, shared:typeof widerGeminiSettings.normalizeStorage === 'function',
                    links:[...document.querySelectorAll('#siteLinks a')].map(a => a.href),
                    styles:[...document.styleSheets].some(sheet => sheet.href && sheet.cssRules.length > 0) };
            })()`, 'The popup help link should load its shared helper and help script');
            assert.strictEqual(help.version, `v${expected.version_name || expected.version}`);
            assert.strictEqual(help.shared, true);
            assert.deepStrictEqual(help.links, plain(widerRoomySites.sites.map(site => site.url)), 'Help links every registered site');
            assert.strictEqual(help.styles, true, 'Packaged help stylesheet should load');
            console.log('Packaged extension loaded in Chrome:', JSON.stringify(state));
            console.log('Packaged help loaded through the popup link:', JSON.stringify(help));
        } catch (error) {
            console.error(error.stack);
            process.exitCode = 1;
        } finally {
            await send('Browser.close').catch(() => child.kill());
        }
    })();
})();
