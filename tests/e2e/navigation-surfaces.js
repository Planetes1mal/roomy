(function () {
    'use strict';

    const assert = require('assert');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const { pathToFileURL } = require('url');
    const { spawnSync } = require('child_process');
    const repo = path.resolve(__dirname, '../..');
    const chrome = process.env.WG_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-navigation-surfaces-'));
    const read = name => fs.readFileSync(path.join(repo, name), 'utf8');
    const script = source => `<script>${source.replace(/<\/script/gi, '<\\/script')}</script>`;
    const near = (actual, expected, label, tolerance = 1) => assert(Math.abs(actual - expected) <= tolerance,
        `${label}: ${actual}, expected ${expected}`);

    const harness = `
        window.store = window.initialStore;
        window.chrome = {
            runtime:{ id:'nav-surfaces', onMessage:{ addListener(fn){ window.deliver = fn; } } },
            i18n:{ getMessage: () => '' },
            storage:{ sync:{ get(keys, cb){ cb(JSON.parse(JSON.stringify(window.store))); } },
                onChanged:{ addListener(fn){ window.deliverStorage = fn; } } }
        };
        const wait = (ms = 60) => new Promise(resolve => setTimeout(resolve, ms));
        const q = selector => document.querySelector(selector);
        const qa = selector => [...document.querySelectorAll(selector)];
        const rect = selector => q(selector).getBoundingClientRect();
        const px = (selector, property) => parseFloat(getComputedStyle(q(selector))[property]);
        const status = () => { let r; window.deliver({ action:'getLayoutStatus' }, {}, v => { r = v; }); return r; };
        async function save(key, value) {
            window.store[key] = value;
            window.deliverStorage({ [key]:{ newValue:value } }, 'sync');
            await wait();
        }
        function report(value) {
            const pre = document.createElement('pre');
            pre.id = 'results';
            pre.textContent = JSON.stringify(value);
            document.body.appendChild(pre);
        }
        window.addEventListener('unhandledrejection', event => report({ error:String(event.reason && event.reason.stack || event.reason) }));
        window.addEventListener('error', event => { window.pageErrors = (window.pageErrors || []).concat(event.message + ' @' + event.lineno); });
    `;

    function run(name, html) {
        const file = path.join(temp, `${name}.html`);
        fs.writeFileSync(file, html);
        const result = spawnSync(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check',
            '--disable-extensions', '--force-prefers-reduced-motion', '--window-size=1400,900', `--user-data-dir=${path.join(temp, `profile-${name}`)}`,
            '--dump-dom', '--virtual-time-budget=8000', pathToFileURL(file).href],
        { encoding: 'utf8', windowsHide: true, timeout: 90000, maxBuffer: 8 * 1024 * 1024 });
        if (result.error) throw result.error;
        const match = result.stdout?.match(/<pre id="results">([^<]+)<\/pre>/);
        assert(match, `${name}: no browser report (${result.status}): ${result.stderr?.slice(0, 800)}`);
        const report = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
        assert(!report.error, `${name}: ${report.error}`);
        fs.writeFileSync(path.join(temp, `${name}.json`), JSON.stringify(report, null, 4));
        return report;
    }

    const native = 'max-w-(--thread-body-max-width)';
    const dotsRow = (id, self, body) => `<article class="message-row ${self ? 'self' : ''}" data-message-id="${id}">
        <div class="message-bubble-wrap"><div class="message-content-line"><div class="message-content-stack">
        <div class="message-content"><div class="message-body" data-message-id="${id}">${body}
        <div class="message-inline-actions" aria-label="Message actions"><button type="button" aria-label="Reply">R</button></div>
        </div></div></div></div></div></article>`;
    const dotsText = text => `<div class="message-surface"><div class="message-bubble"><div class="message-text">
        <div data-markdown-text-style="assistant-message"><p class="Paragraph-kKnbIo">${text}</p></div></div></div></div>`;
    const ordinaryTurn = (user, answer) => `<div data-user-message-bubble="true"><div class="flex flex-col items-end">
        <div class="relative w-full min-w-0"><div data-search-result-target><div>
        <div class="whitespace-pre-wrap">${user}</div></div></div></div></div></div>
        <div data-markdown-text-style="assistant-message"><p>${answer}</p><p>${answer}</p><p>${answer}</p></div>`;

    const chatgpt = `<!doctype html><html><head><meta charset="utf-8"><style>
        *, ::before, ::after { box-sizing:border-box; }
        body { margin:0; font:16px/26px sans-serif; }
        .route[hidden-route] { display:none; }
        .max-w-\\(--thread-body-max-width\\) {
            --thread-body-inline-padding:16px;
            --thread-content-max-width:var(--thread-content-responsive-max-width, 640px);
            --thread-body-max-width:calc(var(--thread-content-max-width) + var(--thread-body-inline-padding) * 2);
            max-width:var(--thread-body-max-width); width:100%; margin:auto; padding-inline:16px;
        }
        [data-app-action-timeline-scroll] { display:flex; flex-direction:column-reverse; overflow-y:auto; height:600px; }
        [data-user-message-bubble] { display:flex; justify-content:flex-end; }
        [data-user-message-bubble] > div { max-width:70%; padding:10px 16px; background:#eee; line-height:24px; }
        [data-markdown-text-style] p { margin:0 0 16px; min-height:150px; }
        .thread-pane { --thread-content-responsive-max-width:640px; display:flex; flex-direction:column; height:640px; }
        .messages-scroll { overflow-y:auto; height:560px; scrollbar-gutter:stable both-edges; }
        html[data-theme="dark"] body, html[data-theme="dark"] .thread-pane { background:rgb(14, 14, 14); color:rgb(236, 236, 236); }
        [data-markdown-copy="code-block"] code { display:block; font-size:12px; line-height:20px; white-space:pre; font-family:monospace; }
        [data-markdown-copy="exclude"] { font-size:14px; }
        section[data-pip-obstacle="quick-chat"] { position:fixed; right:20px; bottom:20px; width:572px; height:420px; display:flex; flex-direction:column; background:#fff; }
        .thread-scroll-container { overflow-y:auto; flex:1; }
        #quick-portal { position:fixed; inset:0; z-index:50; transform:translateZ(0); pointer-events:none; }
        #quick-portal > section { pointer-events:auto; }
        #quick [data-thread-user-message-navigation-content] { padding-inline-end:16px; }
        .message-row { display:flex; margin:4px 0; }
        .message-row.self { justify-content:flex-end; }
        .message-bubble-wrap { position:relative; max-width:min(88%, 100% - 73px); }
        .message-row.self .message-inline-actions { position:absolute; inset:0 auto 0 -65px; width:56px; }
        .message-row:not(.self) .message-inline-actions { position:absolute; inset:0 -65px 0 auto; width:56px; }
        .message-row [data-markdown-text-style] p { margin:0; line-height:22px; }
        .message-row [data-markdown-text-style] { min-height:220px; }
        [data-page-document-selection] [role="textbox"] { font:14px/22.75px sans-serif; }
    </style><style>${read('src/content/message-navigation.css')}</style>
    <style>${read('src/content/chatgpt-content.css')}</style></head><body>
        <div class="route" id="ordinary" hidden-route><main data-app-shell-main-surface="shell"><div data-app-action-timeline-scroll>
            <div data-pip-obstacle="thread-footer" class="${native}"><form data-chatgpt-composer><div role="textbox" contenteditable="true"></div></form></div>
            <div data-thread-user-message-navigation-content class="${native}" id="transcript">
                ${ordinaryTurn('First ordinary question', 'Ordinary answer one')}
                ${ordinaryTurn('Second ordinary question', 'Ordinary answer two')}
                ${ordinaryTurn('Third ordinary question', 'Ordinary answer three')}
            </div>
        </div></main></div>
        <div class="route" id="dots"><div class="messaging-root messaging-embedded"><div class="workspace"><main class="thread-pane">
            <div class="conversation-viewport"><div class="messages-scroll" data-role="messages-scroll">
                <div class="message-list ${native}" id="dots-list">
                    ${dotsRow('d1', false, dotsText('Dot says hello'))}
                    ${dotsRow('d2', true, dotsText('First dots question'))}
                    ${dotsRow('d3', false, dotsText('Dot answers'))}
                    ${dotsRow('d4', true, '<div class="mt-2"><span>Call ended</span></div><div role="status">Read</div>')}
                    ${dotsRow('d5', true, dotsText('Second dots question'))}
                    ${dotsRow('d6', false, '<div class="message-surface"><div class="message-bubble"><div class="message-text"><div data-markdown-text-style="assistant-message"><p>Code follows</p>' +
                        '<div data-markdown-copy="code-block"><div data-markdown-copy="exclude"><div id="code-label">JavaScript</div><button aria-label="Enable word wrap">W</button></div>' +
                        '<div id="code-scroll" style="overflow:auto"><code id="dots-code"><span><span class="hljs-keyword">const</span> sample = "' + 'x'.repeat(300) + '";</span></code></div></div></div></div></div></div>')}
                    ${dotsRow('d7', true, dotsText('Third dots question'))}
                </div>
            </div></div>
            <div class="conversation-footer" id="dots-footer"><div data-role="composer" id="dots-composer-host"><div data-codex-composer-root>
                <div class="relative ${native}" id="dots-composer"><div role="textbox" contenteditable="true"></div></div>
            </div></div></div>
            <div class="reply-chain-panel" role="dialog" id="reply-panel" hidden-route></div>
        </main></div></div></div>
        <div class="route" id="page" hidden-route><div data-page-document-selection="true" role="presentation">
            <div role="textbox" aria-label="Page document" contenteditable="true">
                <div data-page-block-row data-page-block-type="paragraph"><div data-page-block-viewport><p id="page-p">Document text</p></div></div>
            </div></div>
            <div id="quick-portal"><section role="dialog" data-pip-obstacle="quick-chat" data-quick-chat-drag-handle="true" id="quick" hidden-route class="route">
                <div class="thread-scroll-container" id="quick-scroll"><div data-thread-user-message-navigation-content="true" class="relative flex flex-1 flex-col">
                    <div class="flex flex-col px-4"><div data-chatgpt-conversation-turn="true"><h4 class="sr-only">You said:</h4>
                        <div data-user-message-bubble="true"><div><div class="text-size-chat whitespace-pre-wrap" id="quick-user">Page chat question</div></div></div></div>
                    <div data-chatgpt-conversation-turn="true"><div data-markdown-text-style="assistant-message"><p id="quick-p">Page chat answer.</p></div></div>
                    <div data-chatgpt-conversation-turn="true"><div data-user-message-bubble="true"><div><div class="text-size-chat whitespace-pre-wrap">Second page question</div></div></div></div>
                    <div data-chatgpt-conversation-turn="true"><div data-markdown-text-style="assistant-message"><p>Second page answer.</p></div></div></div>
                </div></div>
                <div data-pip-obstacle="thread-footer"><form data-composer-placement="thread" data-thread-find-composer="true">
                    <div role="textbox" contenteditable="true" aria-label="Work with ChatGPT"></div></form></div>
            </section></div>
        </div>
        ${script(`window.initialStore = { chatgptWidthSettings:{ widthEnabled:true, chatWidthSetting:{ value:1000, unit:'px' } },
            chatgptReadingSettings:{ messageFontSize:125 } };` + harness)}
        ${script(read('src/shared/sites.js'))}${script(read('src/shared/settings-utils.js'))}${script(read('src/content/message-navigation.js'))}
        ${script(read('src/content/chatgpt-content.js'))}
        ${script(`
            const show = id => { qa('.route').forEach(el => el.setAttribute('hidden-route', '')); q('#' + id).removeAttribute('hidden-route'); };
            window.addEventListener('load', async () => {
                await wait(120);
                const out = {};
                let s = status();
                await wait();
                out.dots = { surface:s.surface.kind, status:s.status,
                    owners:qa('[data-wgc-width]').map(el => el.id || el.className.split(' ')[0]),
                    font:px('#dots-list .message-row.self p','fontSize'), line:px('#dots-list .message-row.self p','lineHeight'),
                    hiddenMarked:qa('#ordinary [data-wgc-font]').length, nav:qa('.wg-nav-tick').length,
                    code:px('#dots-code','fontSize'), codeLine:px('#dots-code','lineHeight'), codeLabel:px('#code-label','fontSize'),
                    codeScrolls:q('#code-scroll').scrollWidth > q('#code-scroll').clientWidth,
                    navVisible:!q('.wg-nav').hidden, reading:s.capabilities.reading, navigation:s.capabilities.navigation };
                await save('chatgptReadingSettings', { messageFontSize:125, userFullWidth:true });
                const row = q('#dots-list .message-row.self');
                const wrap = row.querySelector('.message-bubble-wrap');
                out.dotsFull = { row:row.getBoundingClientRect().width, wrap:wrap.getBoundingClientRect().width,
                    actionsLeft:row.querySelector('.message-inline-actions').getBoundingClientRect().left - row.getBoundingClientRect().left };
                const scroller = q('.messages-scroll');
                qa('.wg-nav-tick')[1].click();
                await wait(400);
                out.dotsJump = { targetTop:qa('#dots-list .message-row.self:has(.message-surface)')[1].getBoundingClientRect().top - scroller.getBoundingClientRect().top,
                    current:qa('.wg-nav-tick').findIndex(b => b.getAttribute('aria-current') === 'location') };
                qa('.wg-nav-tick')[0].focus();
                q('.wg-nav-list').dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowDown', bubbles:true }));
                out.keyboard = { focused:qa('.wg-nav-tick').indexOf(document.activeElement), tabbable:qa('.wg-nav-tick').filter(b => b.tabIndex === 0).length,
                    preview:!q('.wg-nav-preview').hidden };
                const clamp = q('.wg-nav-preview-text');
                clamp.textContent = 'long preview '.repeat(40);
                out.keyboard.clamp = { inner:clamp.clientHeight, clipped:clamp.scrollHeight > clamp.clientHeight + 1,
                    outer:q('.wg-nav-preview').getBoundingClientRect().height };
                q('.wg-nav-list').dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
                out.keyboard.previewAfterEscape = !q('.wg-nav-preview').hidden;
                document.activeElement.blur();
                await save('chatgptWidthSettings', { widthEnabled:true, chatWidthSetting:{ value:100, unit:'percent' } });
                status();
                await wait();
                const nav = rect('.wg-nav');
                const list = q('#dots-list');
                const listStyle = getComputedStyle(list);
                out.gutter = { value:document.documentElement.style.getPropertyValue('--wg-chatgpt-nav-gutter'),
                    railLeft:nav.left, railRight:nav.right, paneRight:scroller.getBoundingClientRect().right,
                    contentRight:list.getBoundingClientRect().right - parseFloat(listStyle.paddingRight),
                    composer:rect('#dots-composer').width, list:list.getBoundingClientRect().width,
                    visible:!q('.wg-nav').hidden, clientRight:scroller.getBoundingClientRect().left + scroller.clientLeft + scroller.clientWidth };
                document.documentElement.setAttribute('data-theme', 'dark');
                status();
                await wait();
                out.dark = { ink:q('.wg-nav').style.getPropertyValue('--wg-nav-ink'), surface:q('.wg-nav-preview').style.getPropertyValue('--wg-nav-surface') };
                document.documentElement.removeAttribute('data-theme');
                const widthBefore = list.getBoundingClientRect().width;
                const host = q('#dots-composer-host');
                q('#reply-panel').removeAttribute('hidden-route');
                q('#reply-panel').appendChild(host);
                s = status();
                await wait();
                out.reply = { surface:s.surface.kind, before:widthBefore, after:list.getBoundingClientRect().width,
                    owners:qa('[data-wgc-width]').map(el => el.id), width:s.capabilities.width };
                q('#dots-footer').appendChild(host);
                q('#reply-panel').setAttribute('hidden-route', '');
                status();
                await wait();
                await save('chatgptMessageNavigationEnabled', false);
                out.navOff = { gutter:document.documentElement.style.getPropertyValue('--wg-chatgpt-nav-gutter'),
                    rail:qa('.wg-nav').length, width:status().capabilities.width };
                await save('chatgptMessageNavigationEnabled', true);
                q('.thread-pane').style.cssText = 'width:700px; --thread-content-responsive-max-width:1000px';
                await save('chatgptWidthSettings', { widthEnabled:false, chatWidthSetting:{ value:1000, unit:'px' } });
                s = status();
                await wait();
                const offNav = q('.wg-nav') && !q('.wg-nav').hidden ? rect('.wg-nav') : null;
                out.widthOff = { gutterClass:document.documentElement.classList.contains('wider-chatgpt-nav-gutter'),
                    activeClass:document.documentElement.classList.contains('wider-chatgpt-width-active'), rail:!!offNav,
                    railLeft:offNav && offNav.left, clientRight:scroller.getBoundingClientRect().left + scroller.clientLeft + scroller.clientWidth,
                    contentRight:list.getBoundingClientRect().right - parseFloat(getComputedStyle(list).paddingRight),
                    list:list.getBoundingClientRect().width, composer:rect('#dots-composer').width, width:s.capabilities.width };
                await save('chatgptMessageNavigationEnabled', false);
                out.widthOffNavOff = { gutterClass:document.documentElement.classList.contains('wider-chatgpt-nav-gutter'),
                    owners:qa('[data-wgc-width]').length };
                await save('chatgptMessageNavigationEnabled', true);
                q('.thread-pane').style.cssText = '';
                await save('chatgptWidthSettings', { widthEnabled:true, chatWidthSetting:{ value:1000, unit:'px' } });

                show('ordinary');
                s = status();
                await wait();
                const root = q('[data-app-action-timeline-scroll]');
                out.ordinary = { surface:s.surface.kind, owners:qa('[data-wgc-width]').map(el => el.id || el.getAttribute('data-pip-obstacle')),
                    dotsMarked:qa('#dots [data-wgc-font]').length, font:px('#transcript [data-markdown-text-style] p','fontSize'),
                    userFont:px('#transcript .whitespace-pre-wrap','fontSize'), nav:qa('.wg-nav-tick').length };
                qa('.wg-nav-tick')[1].click();
                await wait(400);
                out.reverse = { scrollTop:root.scrollTop, targetTop:qa('#transcript [data-user-message-bubble]')[1].getBoundingClientRect().top - root.getBoundingClientRect().top };
                const answer = document.createElement('div');
                answer.setAttribute('data-markdown-text-style', 'assistant-message');
                const para = document.createElement('p');
                answer.appendChild(para);
                const bubble = document.createElement('div');
                bubble.setAttribute('data-user-message-bubble', 'true');
                bubble.innerHTML = '<div><div class="whitespace-pre-wrap" id="late-user"></div></div>';
                q('#transcript').append(bubble, answer);
                await wait();
                para.appendChild(document.createTextNode('Streamed words'));
                q('#late-user').appendChild(document.createTextNode('Late question'));
                await wait();
                out.streaming = { paragraph:parseFloat(getComputedStyle(para).fontSize), user:px('#late-user','fontSize'),
                    nav:qa('.wg-nav-tick').length };
                show('page');
                s = status();
                await wait();
                out.page = { surface:s.surface.kind, status:s.status, width:s.capabilities.width, reading:s.capabilities.reading,
                    owners:qa('[data-wgc-width]').length, markers:qa('[data-wgc-font]').length, pageFont:px('#page-p','fontSize'),
                    rail:qa('.wg-nav').length };
                q('#quick').removeAttribute('hidden-route');
                s = status();
                await wait();
                out.quick = { surface:s.surface.kind, status:s.status, owners:qa('[data-wgc-width]').length,
                    width:s.capabilities.width, reading:s.capabilities.reading, answer:px('#quick-p','fontSize'),
                    user:px('#quick-user','fontSize'), pageFont:px('#page-p','fontSize'), pageMarked:qa('#page-p[data-wgc-font]').length,
                    hostWidth:rect('#quick').width, rail:!!q('.wg-nav') && !q('.wg-nav').hidden,
                    railInside:!!q('.wg-nav') && rect('.wg-nav').right <= rect('#quick-scroll').right + 0.5 &&
                        rect('.wg-nav').left >= Math.max(...qa('#quick [data-markdown-text-style], #quick [data-user-message-bubble]').map(el => el.getBoundingClientRect().right)) - 0.5,
                    inset:q('#quick [data-thread-user-message-navigation-content]').style.getPropertyValue('padding-inline-end') };
                const hits = () => qa('.wg-nav-tick').map(b => { const r = b.getBoundingClientRect();
                    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!el && el.closest('.wg-nav') !== null; });
                const quickRail = () => { const host = rect('#quick'), nav = rect('.wg-nav'), sc = q('#quick-scroll');
                    const sr = sc.getBoundingClientRect();
                    return { inside:nav.left >= host.left - 0.5 && nav.right <= sr.left + sc.clientLeft + sc.clientWidth + 0.5 &&
                        nav.top >= host.top - 0.5 && nav.bottom <= host.bottom + 0.5, hits:hits() }; };
                out.quickStack = { parent:q('.wg-nav').parentElement.id, ...quickRail() };
                const quickList = q('.wg-nav-list');
                const firstTick = qa('.wg-nav-tick')[0].getBoundingClientRect();
                quickList.dispatchEvent(new PointerEvent('pointermove', { clientX:firstTick.left + 12, clientY:firstTick.top + 12, bubbles:true }));
                const pv = rect('.wg-nav-preview'), hostRect = rect('#quick');
                out.quickStack.preview = !q('.wg-nav-preview').hidden && pv.left >= hostRect.left && pv.right <= hostRect.right;
                quickList.dispatchEvent(new PointerEvent('pointerleave', { bubbles:false }));
                const railBefore = rect('.wg-nav'), hostBefore = rect('#quick');
                q('#quick').style.right = '180px';
                q('#quick').style.bottom = '100px';
                await wait();
                out.quickMove = { hostDx:rect('#quick').left - hostBefore.left, railDx:rect('.wg-nav').left - railBefore.left,
                    hostDy:rect('#quick').top - hostBefore.top, railDy:rect('.wg-nav').top - railBefore.top, ...quickRail() };
                q('#quick').style.width = '480px';
                q('#quick').style.height = '360px';
                status();
                await wait(200);
                out.quickResize = { hostWidth:rect('#quick').width, ...quickRail() };
                q('#quick').style.cssText = '';
                await wait(200);
                show('ordinary');
                q('#transcript').removeAttribute('data-thread-user-message-navigation-content');
                s = status();
                await wait();
                out.unknown = { surface:s.surface.kind, status:s.status, owners:qa('[data-wgc-width]').length,
                    markers:qa('[data-wgc-font]').length, rail:qa('.wg-nav').length };
                q('#transcript').setAttribute('data-thread-user-message-navigation-content', '');
                s = status();
                await wait();
                out.recovered = { surface:s.surface.kind, owners:qa('[data-wgc-width]').length, font:px('#transcript [data-markdown-text-style] p','fontSize') };
                await save('chatgptEnabled', false);
                s = status();
                out.paused = { rail:qa('.wg-nav, .wg-nav-preview').length, owners:qa('[data-wgc-width]').length,
                    markers:qa('[data-wgc-font], [data-wgc-full-path]').length, navigation:s.capabilities.navigation,
                    gutter:document.documentElement.style.getPropertyValue('--wg-chatgpt-nav-gutter') };
                report(out);
            });
        `)}</body></html>`;

    const c = run('chatgpt', chatgpt);
    assert.deepStrictEqual([c.widthOff.gutterClass, c.widthOff.activeClass, c.widthOff.rail, c.widthOff.width],
        [true, false, true, 'off'], `width off keeps a navigation-only gutter: ${JSON.stringify(c.widthOff)}`);
    assert(c.widthOff.railLeft >= c.widthOff.contentRight - 0.5 && c.widthOff.railLeft + 24 <= c.widthOff.clientRight + 0.5,
        `rail fits beside the native column: ${JSON.stringify(c.widthOff)}`);
    near(c.widthOff.composer, c.widthOff.list, 'composer stays aligned in navigation-only gutter');
    assert.deepStrictEqual([c.widthOffNavOff.gutterClass, c.widthOffNavOff.owners], [false, 0], 'navigation off releases it');
    assert.strictEqual(c.dots.surface, 'dots');
    assert.deepStrictEqual(c.dots.owners.sort(), ['dots-composer', 'dots-list'], 'only the visible Dots owners are marked');
    near(c.dots.font, 20, 'Dots prose scales from its own 16px baseline');
    near(c.dots.line, 27.5, 'Dots prose keeps its own 22px line ratio');
    assert.strictEqual(c.dots.hiddenMarked, 0, 'hidden ordinary route is not styled');
    assert.strictEqual(c.dots.nav, 3, 'Dots navigation counts user messages and skips the call row');
    assert(c.dots.navVisible);
    assert.strictEqual(c.dots.navigation, 'active');
    near(c.dots.code, 15, 'Dots block code scales from its explicit 12px');
    near(c.dots.codeLine, 25, 'Dots code line height scales with font only');
    near(c.dots.codeLabel, 14, 'Dots code toolbar stays native');
    assert(c.dots.codeScrolls, 'Dots code keeps its native horizontal scroll');
    near(c.dotsFull.wrap, c.dotsFull.row - 73, 'Dots full width keeps the 73px action allowance');
    assert(c.dotsFull.actionsLeft >= 0, 'Dots reply/reaction group stays inside the row');
    near(c.dotsJump.targetTop, 72, 'jump places the target below the top inset', 2);
    assert.strictEqual(c.dotsJump.current, 1);
    assert.strictEqual(c.keyboard.focused, 1, 'ArrowDown moves focus within the rail');
    assert.strictEqual(c.keyboard.tabbable, 1, 'one Tab stop');
    assert.strictEqual(c.keyboard.preview, true);
    assert.strictEqual(c.keyboard.previewAfterEscape, false, 'Escape dismisses the preview');
    assert(c.keyboard.clamp.clipped && c.keyboard.clamp.inner <= 36, `preview clamps to two lines: ${JSON.stringify(c.keyboard.clamp)}`);
    assert(c.keyboard.clamp.outer <= 36 + 12 + 2 + 0.5, 'no third line shows inside the preview padding');
    assert.strictEqual(c.gutter.value, '9px', 'gutter reserves only the missing space beyond native padding');
    assert(c.gutter.visible, 'rail stays visible at 100% width with both-edge scrollbar gutters');
    assert(c.gutter.railRight <= c.gutter.clientRight + 0.5 && c.gutter.railLeft >= c.gutter.contentRight - 0.5,
        `rail fits between column and pane edge: ${JSON.stringify(c.gutter)}`);
    near(c.gutter.composer, c.gutter.list, 'Dots composer stays aligned with the list');
    assert.strictEqual(c.dark.ink, 'rgb(236, 236, 236)', 'ticks follow the dark host text color');
    assert.strictEqual(c.dark.surface, 'rgb(14, 14, 14)', 'preview follows the dark host surface');
    assert.strictEqual(c.reply.surface, 'dots');
    near(c.reply.after, c.reply.before, 'Reply keeps the main Dots column width');
    assert.deepStrictEqual(c.reply.owners, ['dots-list'], 'the relocated reply composer stays native');
    assert.strictEqual(c.reply.width, 'active');
    assert.strictEqual(c.navOff.gutter, '', 'navigation off releases the gutter');
    assert.strictEqual(c.navOff.rail, 0);
    assert.strictEqual(c.ordinary.surface, 'chat');
    assert.deepStrictEqual(c.ordinary.owners.sort(), ['thread-footer', 'transcript'], 'width markers move to the visible chat');
    assert.strictEqual(c.ordinary.dotsMarked, 0, 'Dots markers are removed after the route switch');
    near(c.ordinary.font, 20, 'ordinary prose scales');
    near(c.ordinary.userFont, 20, 'ordinary user text scales');
    assert.strictEqual(c.ordinary.nav, 3);
    assert(c.reverse.scrollTop < 0, `column-reverse jump uses signed scrollTop: ${c.reverse.scrollTop}`);
    near(c.reverse.targetTop, 72, 'column-reverse jump reaches the target', 2);
    near(c.streaming.paragraph, 20, 'late-filled paragraph scales');
    near(c.streaming.user, 20, 'user text owner that gains text later scales');
    assert.strictEqual(c.streaming.nav, 4, 'new user message joins the rail');
    assert.deepStrictEqual([c.page.surface, c.page.status, c.page.width, c.page.reading],
        ['notApplicable', 'notApplicable', 'notApplicable', 'notApplicable']);
    assert.deepStrictEqual([c.page.owners, c.page.markers, c.page.pageFont, c.page.rail], [0, 0, 14, 0], 'Page stays native');
    assert.deepStrictEqual([c.quick.surface, c.quick.status, c.quick.owners, c.quick.width, c.quick.reading],
        ['quickChat', 'notApplicable', 0, 'notApplicable', 'active'], 'Page chat: host keeps its width, reading applies');
    near(c.quick.answer, 20, 'Page chat answer scales');
    assert(c.quick.rail && c.quick.railInside, `Page chat rail fits inside the chat after the transcript inset: ${JSON.stringify(c.quick)}`);
    assert(parseFloat(c.quick.inset) > 0, 'inset is added inside the transcript');
    near(c.quick.hostWidth, 572, 'floating window size unchanged');
    assert(parseFloat(c.quick.inset) > 16, `inset adds to the native 16px end padding: ${c.quick.inset}`);
    assert.deepStrictEqual(c.quickStack, { parent: 'quick', inside: true, hits: [true, true], preview: true },
        'Page chat rail is mounted in the floating chat above its portal and is pointer-reachable');
    assert(Math.abs(c.quickMove.hostDx) > 100 && Math.abs(c.quickMove.hostDy) > 50, `host moved: ${JSON.stringify(c.quickMove)}`);
    near(c.quickMove.railDx, c.quickMove.hostDx, 'rail follows the moved floating chat horizontally');
    near(c.quickMove.railDy, c.quickMove.hostDy, 'rail follows the moved floating chat vertically');
    assert(c.quickMove.inside && c.quickMove.hits.every(Boolean), `rail stays inside after the move: ${JSON.stringify(c.quickMove)}`);
    near(c.quickResize.hostWidth, 480, 'floating chat resized');
    assert(c.quickResize.inside && c.quickResize.hits.every(Boolean), `rail relayouts inside the resized chat: ${JSON.stringify(c.quickResize)}`);
    near(c.quick.user, 20, 'Page chat user text scales');
    assert.deepStrictEqual([c.quick.pageFont, c.quick.pageMarked], [14, 0], 'Page document stays native beside the chat');
    assert.deepStrictEqual([c.unknown.surface, c.unknown.status, c.unknown.owners, c.unknown.markers, c.unknown.rail],
        ['unknown', 'unsupported', 0, 0, 0], 'unknown visible chat stays native despite the hidden known route');
    assert.strictEqual(c.recovered.surface, 'chat');
    near(c.recovered.font, 20, 'recognition recovers when markers return');
    assert.deepStrictEqual([c.paused.rail, c.paused.owners, c.paused.markers, c.paused.navigation, c.paused.gutter],
        [0, 0, 0, 'paused', ''], 'pause removes rail, width markers and reading markers');

    const geminiTurn = (i, long) => `<div class="conversation-container" id="c${i}"><user-query><span class="user-query-container">
        <user-query-content><div class="user-query-container"><div class="query-content"><span class="user-query-bubble-with-background">
        <div class="query-text${long ? ' collapsed' : ''}"><h5 class="cdk-visually-hidden screen-reader-user-query-label"><span>You said</span> Gemini question ${i} sassy</h5>
        <p class="query-text-line">Gemini question ${i} sassy${long ? ' ' + 'long '.repeat(80) : ''}</p></div>
        </span></div></div></user-query-content></span></user-query>
        <model-response><div class="markdown"><p>${'Answer text. '.repeat(400)}</p>${i === 2 ? `
            <p id="g-inline-p">Inline <code id="g-inline">sample</code> text</p>
            <code-block><div class="formatted-code-block-internal-container"><pre id="g-pre"><code id="g-code">a\nb</code></pre></div></code-block>
            <table><tr><th id="g-th">Title</th><td id="g-td">Cell</td></tr></table>` : ''}</div></model-response></div>`;
    const gemini = `<!doctype html><html><head><meta charset="utf-8"><style>
        body { margin:0; font:16px/26px sans-serif; }
        chat-window, user-query, user-query-content, model-response, infinite-scroller, input-container, input-area-v2 { display:block; }
        chat-window { height:700px; display:flex; flex-direction:column; }
        .chat-container { display:flex; flex-direction:column; width:100%; flex:1; min-height:0; }
        infinite-scroller.chat-history { overflow-y:scroll; flex:1; }
        .conversation-container { max-width:760px; margin:auto; }
        .query-text.collapsed { max-height:96px; overflow:hidden; }
        code { font-size:14px; line-height:14px; }
        pre code { display:block; line-height:21px; }
    </style><style>${read('src/content/message-navigation.css')}</style>
    <style>${read('src/content/gemini-content.css')}</style></head><body>
        <chat-window><div class="chat-container"><infinite-scroller class="chat-history">
            ${geminiTurn(1, true)}${geminiTurn(2)}${geminiTurn(3)}
        </infinite-scroller><input-container><div class="input-area-container"><input-area-v2>Composer</input-area-v2></div></input-container></div></chat-window>
        ${script(`window.initialStore = { chatWidthSetting:{ value:1000, unit:'px' } };` + harness)}
        ${script(read('src/shared/sites.js'))}${script(read('src/shared/settings-utils.js'))}${script(read('src/content/message-navigation.js'))}
        ${script(read('src/content/gemini-content.js'))}
        ${script(`
            window.addEventListener('load', async () => {
                await wait(200);
                const out = { errors:window.pageErrors || [] };
                const scroller = q('infinite-scroller');
                if (!q('.wg-nav')) { report({ error:'no Gemini rail; errors=' + JSON.stringify(out.errors) }); return; }
                out.rail = { ticks:qa('.wg-nav-tick').length, visible:!q('.wg-nav').hidden };
                out.defaultMarkers = qa('[data-wg-typography]').length;
                await save('messageFontSize', 125);
                out.activatedFont = px('#c2 model-response p', 'fontSize');
                await save('messageFontSize', 100);
                out.resetMarkers = qa('[data-wg-typography]').length;
                out.fixedLines = [];
                for (const font of [100, 140]) {
                    await save('messageFontSize', font);
                    for (const manual of [false, true]) {
                        await save('messageCompactness', 60);
                        await save('messageLineHeight', 1.2);
                        await save('messageSpacingCustom', manual);
                        out.fixedLines.push({ font, manual, container:px('#c2 .formatted-code-block-internal-container','lineHeight'),
                            pre:px('#g-pre','lineHeight'), code:px('#g-code','lineHeight'),
                            td:px('#g-td','lineHeight'), th:px('#g-th','lineHeight'),
                            p:px('#g-inline-p','lineHeight'), inline:px('#g-inline','lineHeight') });
                    }
                }
                await save('messageFontSize', 100);
                await save('messageCompactness', 0);
                await save('messageSpacingCustom', false);
                out.label = qa('.wg-nav-tick')[1].getAttribute('aria-label');
                qa('.wg-nav-tick')[1].click();
                await wait(400);
                out.jump = { targetTop:q('#c2 user-query').getBoundingClientRect().top - scroller.getBoundingClientRect().top,
                    collapsed:q('#c1 .query-text').classList.contains('collapsed') };
                scroller.scrollTop = scroller.scrollHeight;
                await wait(300);
                qa('.wg-nav-tick')[0].click();
                await wait(60);
                const earlier = document.createElement('div');
                earlier.className = 'conversation-container';
                earlier.id = 'c0';
                earlier.innerHTML = '<user-query><p class="query-text-line">Earlier question</p></user-query>' +
                    '<model-response><div class="markdown"><p style="height:2400px">Earlier answer</p></div></model-response>';
                q('infinite-scroller').prepend(earlier);
                await wait(1600);
                out.prependJump = { targetTop:q('#c1 user-query').getBoundingClientRect().top - scroller.getBoundingClientRect().top };
                earlier.remove();
                await wait(300);
                const prompt = q('#c3 .query-text-line');
                const editor = document.createElement('textarea');
                editor.value = 'Unsaved draft';
                prompt.replaceWith(editor);
                await wait();
                out.edit = { label:qa('.wg-nav-tick')[2].getAttribute('aria-label') };
                prompt.textContent = 'Saved Gemini question';
                editor.replaceWith(prompt);
                await wait();
                out.edit.saved = qa('.wg-nav-tick')[2].getAttribute('aria-label');
                await save('chatWidthSetting', { value:100, unit:'percent' });
                await wait();
                const nav = rect('.wg-nav');
                out.gutter = { railLeft:nav.left, columnRight:rect('#c1').right,
                    width:getComputedStyle(document.documentElement).getPropertyValue('--gemini-chat-width').trim() };
                await save('geminiMessageNavigationEnabled', false);
                out.off = { rail:qa('.wg-nav').length, width:getComputedStyle(document.documentElement).getPropertyValue('--gemini-chat-width').trim() };
                await save('geminiMessageNavigationEnabled', true);
                q('chat-window').style.width = '640px';
                await save('widthEnabled', false);
                await save('geminiMessageNavigationEnabled', false);
                const edges = () => { const col = rect('#c1'), area = rect('.input-area-container');
                    return { left:area.left - col.left, right:area.right - col.right }; };
                out.widthOffNative = { edges:edges(), free:scroller.getBoundingClientRect().right - rect('#c1').right };
                await save('geminiMessageNavigationEnabled', true);
                await wait(100);
                const offRail = q('.wg-nav') && !q('.wg-nav').hidden ? rect('.wg-nav') : null;
                out.widthOff = { rail:!!offRail, railLeft:offRail && offRail.left, columnRight:rect('#c1').right, edges:edges(),
                    widthClass:document.documentElement.classList.contains('wider-gemini-width-enabled') };
                await save('widthEnabled', true);
                await wait(100);
                out.widthOnAgain = { padding:scroller.style.getPropertyValue('padding-inline-end'),
                    input:q('input-container').style.getPropertyValue('padding-inline-end') };
                await save('widthEnabled', false);
                await wait(100);
                await save('geminiEnabled', false);
                out.pausedGutter = { padding:scroller.style.getPropertyValue('padding-inline-end'),
                    input:q('input-container').style.getPropertyValue('padding-inline-start') };
                out.paused = { rail:qa('.wg-nav').length };
                report(out);
            });
        `)}</body></html>`;

    const overview = `<!doctype html><html><head><meta charset="utf-8"><style>
        body { margin:0; font:16px/26px sans-serif; }
        #pane { height:560px; overflow-y:auto; }
        .turn { max-width:700px; margin:auto; }
        .bubble { margin:16px 0; }
        .answer { height:320px; }
    </style><style>${read('src/content/message-navigation.css')}</style></head><body>
        <div id="pane">${Array.from({ length: 40 }, (_, i) => `<div class="turn"><div class="bubble" id="u${i + 1}">Question ${i + 1}</div><div class="answer"></div></div>`).join('')}</div>
        ${script(harness)}${script(read('src/content/message-navigation.js'))}
        ${script(`
            window.addEventListener('load', async () => {
                const pane = q('#pane');
                const turns = () => qa('.bubble').map(element => ({ element, text:element.textContent }));
                const r = pane.getBoundingClientRect();
                const bounds = { left:r.left, right:r.left + pane.clientWidth, top:r.top + 16, bottom:r.top + 330 };
                const nav = widerMessageNavigation.create({ labels:{ rail:'Nav', message:(n, t) => n + '/' + t, attachment:'Att', older:'Earlier' },
                    topInset:() => 16 });
                pane.scrollTop = pane.scrollHeight;
                nav.update({ turns:turns(), scrollRoot:pane, bounds });
                await wait(200);
                const out = {};
                const ticks = () => qa('.wg-nav-tick');
                const text = i => ticks()[i].getAttribute('aria-label').split(': ')[1];
                const railRect = rect('.wg-nav');
                out.all = { count:ticks().length, first:text(0), last:text(ticks().length - 1), inside:ticks().every(b => { const t = b.getBoundingClientRect();
                        return t.top + 12 >= railRect.top - 0.5 && t.top + 12 <= railRect.bottom + 0.5; }),
                    listScrolls:['auto', 'scroll'].includes(getComputedStyle(q('.wg-nav-list')).overflowY),
                    active:ticks().findIndex(b => b.hasAttribute('aria-current')), older:!q('.wg-nav-older').hidden };
                const list = q('.wg-nav-list');
                const target = ticks()[12];
                const y = target.getBoundingClientRect().top + 12;
                list.dispatchEvent(new PointerEvent('pointermove', { clientY:y, clientX:railRect.left + 12, bubbles:true }));
                await wait();
                const centers = ticks().map(b => b.getBoundingClientRect().top + 12);
                out.magnify = { gap:centers[13] - centers[12], farGap:centers[2] - centers[1],
                    minGap:Math.min(...centers.slice(1).map((c, i) => c - centers[i])),
                    hovered:ticks().findIndex(b => b.classList.contains('wg-nav-hover')), preview:!q('.wg-nav-preview').hidden };
                list.dispatchEvent(new MouseEvent('click', { clientY:centers[12], clientX:railRect.left + 12, detail:1, bubbles:true }));
                await wait(300);
                out.jump = { top:q('#u33').getBoundingClientRect().top - pane.getBoundingClientRect().top,
                    active:ticks().findIndex(b => b.hasAttribute('aria-current')) };
                list.dispatchEvent(new PointerEvent('pointerleave', { bubbles:false }));
                const before = rect('.wg-nav-list').top;
                q('#u37').scrollIntoView();
                pane.scrollTop -= 16;
                pane.dispatchEvent(new Event('scroll'));
                await wait(200);
                out.scrolled = { active:ticks().findIndex(b => b.hasAttribute('aria-current')), railMoved:rect('.wg-nav-list').top - before,
                    first:text(0) };
                q('#u12').scrollIntoView();
                pane.scrollTop -= 16;
                pane.dispatchEvent(new Event('scroll'));
                await wait(200);
                out.slid = { count:ticks().length, current:text(ticks().findIndex(b => b.hasAttribute('aria-current'))), first:text(0) };
                out.olderBefore = !q('.wg-nav-older').hidden;
                q('.wg-nav-older').click();
                await wait(200);
                out.olderScrolled = pane.scrollTop;
                pane.dispatchEvent(new Event('scroll'));
                await wait(1800);
                out.olderAfter = !q('.wg-nav-older').hidden;
                const early = document.createElement('div');
                early.className = 'turn';
                early.innerHTML = '<div class="bubble" id="u0">Earlier question</div><div class="answer"></div>';
                pane.prepend(early);
                pane.scrollTop = 400;
                nav.update({ turns:turns(), scrollRoot:pane, bounds });
                await wait(200);
                out.prepended = { count:ticks().length, older:!q('.wg-nav-older').hidden };
                nav.destroy();
                out.destroyed = qa('.wg-nav, .wg-nav-preview').length;
                report(out);
            });
        `)}</body></html>`;
    const o = run('overview', overview);
    assert.deepStrictEqual([o.all.count, o.all.first, o.all.last], [20, 'Question 21', 'Question 40'],
        `at most 20 ticks, around the current (last) message: ${JSON.stringify(o.all)}`);
    assert(o.all.inside && !o.all.listScrolls, `all shown ticks fit without an inner scroll: ${JSON.stringify(o.all)}`);
    assert.strictEqual(o.all.active, 19, 'bottom of the conversation marks the last message');
    assert(o.magnify.gap >= 20 && o.magnify.farGap < 16 && o.magnify.minGap > 0.5, `pointer magnifies nearby ticks: ${JSON.stringify(o.magnify)}`);
    assert.strictEqual(o.magnify.hovered, 12);
    assert(o.magnify.preview);
    near(o.jump.top, 16, 'pointer click on a compressed rail jumps to the nearest tick', 2);
    assert.strictEqual(o.jump.active, 12);
    assert.deepStrictEqual([o.scrolled.active, o.scrolled.first], [16, 'Question 21'], 'active follows message 37 inside the same window');
    assert.strictEqual(o.scrolled.railMoved, 0, 'the rail itself never pages');
    assert.strictEqual(o.slid.count, 20);
    assert.strictEqual(o.slid.current, 'Question 12', `window follows the current message: ${JSON.stringify(o.slid)}`);
    assert(o.olderBefore, 'earlier-messages marker shows away from the top');
    assert.strictEqual(o.olderScrolled, 0, 'marker scrolls to the beginning');
    assert.strictEqual(o.olderAfter, false, 'marker hides once the top is stable');
    assert.deepStrictEqual(o.prepended, { count: 20, older: true }, 'a prepended batch re-enables the marker');
    assert.strictEqual(o.destroyed, 0);

    const virtual = `<!doctype html><html><head><meta charset="utf-8"><style>
        body { margin:0; font:16px/26px sans-serif; }
        #pane { height:560px; overflow-y:auto; }
        #spacer { position:relative; height:${60 * 400}px; }
        #win { position:absolute; left:0; right:0; }
        .item { height:400px; max-width:700px; margin:auto; }
    </style><style>${read('src/content/message-navigation.css')}</style></head><body>
        <div id="pane"><div id="spacer"><div id="win"></div></div></div>
        ${script(harness)}${script(read('src/content/message-navigation.js'))}
        ${script(`
            window.addEventListener('load', async () => {
                const pane = q('#pane');
                const r = pane.getBoundingClientRect();
                const bounds = { left:r.left, right:r.left + pane.clientWidth, top:r.top + 16, bottom:r.bottom - 8 };
                let nav = null;
                function render() {
                    const first = Math.max(0, Math.floor(pane.scrollTop / 400) - 1);
                    const last = Math.min(59, Math.floor((pane.scrollTop + 560) / 400) + 1);
                    q('#win').style.top = first * 400 + 'px';
                    q('#win').innerHTML = Array.from({ length:last - first + 1 }, (_, i) => first + i)
                        .map(i => '<div class="item" data-turn-key="k' + i + '"><div class="bubble">Question ' + i + '</div></div>').join('');
                    nav.update({ turns:qa('.bubble').map(element => ({ element, text:element.textContent,
                        key:element.closest('[data-turn-key]').getAttribute('data-turn-key') })), scrollRoot:pane, bounds });
                }
                nav = widerMessageNavigation.create({ labels:{ rail:'Nav', message:(n, t) => n + '/' + t, attachment:'Att', older:'Earlier' },
                    topInset:() => 16, onStale:() => render() });
                const ticks = () => qa('.wg-nav-tick');
                const text = i => ticks()[i].getAttribute('aria-label').split(': ')[1];
                const out = {};
                pane.scrollTop = pane.scrollHeight;
                render();
                await wait(200);
                out.initial = { mounted:qa('.bubble').length, ticks:ticks().length };
                for (let i = 55; i >= 30; i -= 2) {
                    pane.scrollTop = i * 400 - 16;
                    render();
                    pane.dispatchEvent(new Event('scroll'));
                    await wait(150);
                }
                const labels = ticks().map((b, i) => text(i));
                out.scrolled = { mounted:qa('.bubble').length, ticks:labels.length, first:labels[0], last:labels[labels.length - 1],
                    ordered:labels.every((l, i) => i === 0 || +l.split(' ')[1] > +labels[i - 1].split(' ')[1]),
                    current:text(ticks().findIndex(b => b.hasAttribute('aria-current'))) };
                const targetIndex = labels.length - 1;
                const targetText = labels[targetIndex];
                out.targetMountedBefore = qa('.bubble').some(b => b.textContent === targetText);
                ticks()[targetIndex].click();
                await wait(1500);
                const target = qa('.bubble').find(b => b.textContent === targetText);
                out.relocated = { text:targetText, mounted:!!target,
                    top:target ? target.getBoundingClientRect().top - pane.getBoundingClientRect().top : null,
                    current:text(ticks().findIndex(b => b.hasAttribute('aria-current'))) };
                nav.destroy();
                report(out);
            });
        `)}</body></html>`;
    const v = run('virtual', virtual);
    assert(v.initial.mounted < 6 && v.initial.ticks === v.initial.mounted, `only mounted turns at first: ${JSON.stringify(v.initial)}`);
    assert(v.scrolled.mounted < 6 && v.scrolled.ticks === 20 && v.scrolled.ordered,
        `remembered unmounted turns keep ticks, capped at 20 and ordered: ${JSON.stringify(v.scrolled)}`);
    assert.strictEqual(v.scrolled.current, 'Question 31');
    assert.strictEqual(v.targetMountedBefore, false, 'the clicked tick belongs to an unmounted turn');
    assert(v.relocated.mounted && Math.abs(v.relocated.top - 16) <= 2 && v.relocated.current === v.relocated.text,
        `jumping to an unmounted turn relocates it by key: ${JSON.stringify(v.relocated)}`);

    const g = run('gemini', gemini);
    assert.deepStrictEqual(g.rail, { ticks: 3, visible: true }, 'one tick per outer user-query');
    assert.strictEqual(g.defaultMarkers, 0, 'default Gemini reading settings do not sample text metrics');
    near(g.activatedFont, 20, 'activating reading samples the existing Gemini text');
    assert.strictEqual(g.resetMarkers, 0, 'returning to default reading clears Gemini text metrics');
    for (const row of g.fixedLines) {
        const scale = row.font / 100;
        near(row.code, 21 * scale, 'Gemini block code ignores compactness and manual line height');
        for (const key of ['container', 'pre', 'td', 'th']) near(row[key], 26 * scale, `Gemini ${key} preserves its native line height`);
        near(row.inline, row.p, 'Gemini inline code follows its paragraph line height');
        near(row.p, row.manual ? 16 * scale * 1.2 : 26 * 0.892 * scale, 'Gemini prose spacing stays unchanged');
    }
    assert(g.label.endsWith(': Gemini question 2 sassy'), `preview keeps text once without hidden labels: ${g.label}`);
    near(g.jump.targetTop, 16, 'Gemini jump uses the chat-history scroller', 2);
    near(g.prependJump.targetTop, 16, 'a jump stays on target when earlier messages load during the scroll', 2);
    assert.strictEqual(g.jump.collapsed, true, 'collapsed long message is not expanded');
    assert(g.edit.label.endsWith(': Gemini question 3 sassy'), 'editing retains the saved prompt preview');
    assert(g.edit.saved.endsWith(': Saved Gemini question'), 'saving replaces the remembered prompt preview');
    assert(/^min\(100vw, \d+px\)$/.test(g.gutter.width), `Gemini caps width for the rail: ${g.gutter.width}`);
    assert(g.gutter.railLeft >= g.gutter.columnRight - 0.5, `rail clears the column: ${JSON.stringify(g.gutter)}`);
    assert.deepStrictEqual(g.off, { rail: 0, width: '100vw' }, 'navigation off removes the rail and releases the gutter');
    assert.strictEqual(g.paused.rail, 0);
    assert(g.widthOffNative.free < 23, `fixture: native Gemini column leaves no room for the rail: ${JSON.stringify(g.widthOffNative)}`);
    assert(g.widthOff.rail && !g.widthOff.widthClass && g.widthOff.railLeft >= g.widthOff.columnRight - 0.5,
        `width off keeps a navigation-only gutter in Gemini: ${JSON.stringify(g.widthOff)}`);
    near(g.widthOff.edges.left, g.widthOffNative.edges.left, 'composer keeps its native left alignment');
    near(g.widthOff.edges.right, g.widthOffNative.edges.right, 'composer keeps its native right alignment');
    assert.deepStrictEqual(g.widthOnAgain, { padding: '', input: '' }, 'width on releases the navigation-only gutter');
    assert.deepStrictEqual(g.pausedGutter, { padding: '', input: '' }, 'pause releases the navigation-only gutter');
    console.log(`Passed navigation and surface regression (${temp}).`);
})();
