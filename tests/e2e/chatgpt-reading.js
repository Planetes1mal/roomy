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
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-chatgpt-reading-'));
    const read = name => fs.readFileSync(path.join(repo, name), 'utf8');
    const script = source => `<script>${source.replace(/<\/script/gi, '<\\/script')}</script>`;

    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        *, ::before, ::after { box-sizing:border-box; }
        body { margin:0; font:16px/26px sans-serif; }
        .max-w-\\(--thread-body-max-width\\) {
            --thread-body-inline-padding:16px; --thread-content-responsive-max-width:768px;
            --thread-body-max-width:calc(var(--thread-content-responsive-max-width) + var(--thread-body-inline-padding) * 2);
            max-width:var(--thread-body-max-width); margin:auto; padding-inline:var(--thread-body-inline-padding);
            box-sizing:border-box;
        }
        .contents { display:contents; }
        .uflex { display:flex; width:100%; flex-direction:column; align-items:flex-end; }
        .max-w-\\(--user-chat-width\\,70\\%\\) { max-width:70%; }
        .user-message-bubble-color, [data-user-message-bubble] { padding:10px 16px; background:#eee; line-height:24px; }
        [data-markdown-text-style] p { margin:0 0 16px; }
        [data-markdown-text-style] pre { margin:0; font-size:12px; line-height:20px; }
        .markdown p { margin:0 0 16px; }
        .markdown h3 { font-size:20px; line-height:28px; margin:16px 0 8px; }
        .markdown li { margin:4px 0; }
        .markdown ul { margin:0 0 16px; padding-left:24px; }
        .markdown code { font-size:.875em; }
        .markdown pre { margin:0; font-size:12px; line-height:20px; white-space:pre; }
        .markdown pre.whitespace-pre-wrap { white-space:pre-wrap; overflow-wrap:anywhere; }
        .markdown pre code { font-size:inherit; }
        .markdown td { font-size:14px; }
        .markdown table { min-width:2400px; }
        button { font:inherit; }
        [data-copy], [data-table-btn], [data-toolbar] { font-size:13px; }
    </style><style>${read('src/content/chatgpt-content.css')}</style></head><body>
        <main><div data-app-action-timeline-scroll style="width:1600px">
            <div data-thread-user-message-navigation-content class="max-w-(--thread-body-max-width)">
                <article data-testid="conversation-turn-1"><div data-message-author-role="user" class="uflex">
                    <div class="uflex"><div class="contents max-w-(--user-chat-width,70%)" data-user-wrapper>
                        <div class="user-message-bubble-color max-w-(--user-chat-width,70%)" data-bubble>
                            <div class="whitespace-pre-wrap" data-user>Short user question</div>
                        </div>
                    </div></div>
                    <div data-toolbar><button>Edit</button></div>
                </div></article>
                <article data-testid="conversation-turn-2"><div data-message-author-role="assistant">
                    <div class="markdown prose" data-md>
                        <h3 data-h>Heading</h3>
                        <p data-p1>First paragraph <code data-inline>inline</code>
                            <span class="katex" data-katex style="font-size:1.21em;line-height:1.2">x</span></p>
                        <p data-p2>Second paragraph</p>
                        <ul data-ul><li data-li>Item</li></ul>
                        <div data-code-block><div><button data-copy>Copy</button></div>
                            <div class="chatgpt-code-scrollport" style="overflow-x:auto" data-scrollport>
                                <pre data-pre><code data-code>${'long_code_without_spaces_'.repeat(60)}</code></pre>
                            </div></div>
                        <div data-table-block><div style="overflow-x:auto" data-scroller><div><table><tbody>
                            <tr><td data-td>${'wide cell '.repeat(40)}</td></tr></tbody></table></div></div>
                            <button data-table-btn>Copy table</button></div>
                    </div>
                    <div data-toolbar><button>Copy</button></div>
                </div></article>
                <section data-turn="user"><div class="uflex"><div class="uflex">
                    <div data-user-message-bubble class="max-w-(--user-chat-width,70%)" data-new-bubble>
                        <span data-new-user>New structure question</span></div>
                </div></div></section>
                <section data-turn="assistant"><div data-markdown-text-style="assistant-message" data-new-md>
                    <p data-new-p>New structure answer</p>
                    <div><button data-new-copy>Copy</button></div>
                    <pre><code data-new-code>const x = 1;</code></pre>
                </div></section>
            </div>
            <div data-pip-obstacle="thread-footer" class="max-w-(--thread-body-max-width)">
                <form data-chatgpt-composer><textarea data-composer style="font-size:16px"></textarea></form>
            </div>
        </div></main>
        ${script(`
            window.store = { chatgptWidthSettings:{ widthEnabled:true, chatWidthSetting:{ value:1000, unit:'px' } } };
            window.chrome = {
                runtime:{ id:'chatgpt-reading', onMessage:{ addListener(fn){ window.deliver = fn; } } },
                storage:{ sync:{ get(keys, cb){ cb(JSON.parse(JSON.stringify(window.store))); } },
                    onChanged:{ addListener(fn){ window.deliverStorage = fn; } } }
            };
        `)}${script(read('src/shared/sites.js'))}${script(read('src/shared/settings-utils.js'))}${script(read('src/content/chatgpt-content.js'))}
        ${script(`
            const frames = () => new Promise(resolve => setTimeout(resolve, 50));
            const q = selector => document.querySelector(selector);
            const px = (selector, property) => parseFloat(getComputedStyle(q(selector))[property]);
            async function save(key, value) {
                window.store[key] = value;
                window.deliverStorage({ [key]:{ newValue:value } }, 'sync');
                await frames();
            }
            const reading = value => save('chatgptReadingSettings', value);
            const snapshot = () => ({
                p:px('[data-p1]','fontSize'), pLine:px('[data-p1]','lineHeight'), pBottom:px('[data-p1]','marginBottom'),
                p2Top:px('[data-p2]','marginTop'), h:px('[data-h]','fontSize'), hLine:px('[data-h]','lineHeight'),
                inline:px('[data-inline]','fontSize'), katex:px('[data-katex]','fontSize'),
                code:px('[data-code]','fontSize'), preLine:px('[data-pre]','lineHeight'),
                td:px('[data-td]','fontSize'), tdLine:px('[data-td]','lineHeight'),
                user:px('[data-user]','fontSize'), li:px('[data-li]','fontSize'),
                copy:px('[data-copy]','fontSize'), tableBtn:px('[data-table-btn]','fontSize'),
                toolbar:px('[data-toolbar] button','fontSize'), composer:px('[data-composer]','fontSize'),
                bubble:q('[data-bubble]').getBoundingClientRect().width,
                newP:px('[data-new-p]','fontSize'), newUser:px('[data-new-user]','fontSize'),
                newCode:px('[data-new-code]','fontSize'), newCopy:px('[data-new-copy]','fontSize'),
                newBubble:q('[data-new-bubble]').getBoundingClientRect().width,
                column:q('[data-md]').getBoundingClientRect().width
            });
            window.addEventListener('unhandledrejection', event => {
                const pre = document.createElement('pre');
                pre.id = 'results';
                pre.textContent = JSON.stringify({ error:String(event.reason && event.reason.stack || event.reason) });
                document.body.appendChild(pre);
            });
            window.addEventListener('load', async () => {
                await frames();
                const out = {};
                out.native = snapshot();
                out.defaultAttrs = document.querySelectorAll('html[data-wgc-reading]').length;
                out.defaultMarkers = document.querySelectorAll('[data-wgc-font],[data-wgc-line],[data-wgc-space]').length;
                await reading({ messageFontSize:125 });
                out.font = snapshot();
                window.deliver({ action:'updateReadingSettings' }, {}, r => { out.ack = r; });
                window.deliverStorage({ chatgptReadingSettings:{ newValue:window.store.chatgptReadingSettings } }, 'sync');
                await frames();
                out.duplicate = snapshot();
                await reading({ messageCompactness:100 });
                out.dense = snapshot();
                await reading({ messageSpacingCustom:true, messageLineHeight:1.3, messageParagraphSpacing:0, messageCompactness:100 });
                out.custom = snapshot();
                await reading({ userFullWidth:true, messageFontSize:125 });
                out.full = snapshot();
                await save('chatgptWidthSettings', { ...window.store.chatgptWidthSettings, widthEnabled:false });
                out.fullWidthOff = snapshot();
                out.widthOffFont = out.fullWidthOff.p;
                await save('chatgptWidthSettings', { ...window.store.chatgptWidthSettings, widthEnabled:true });

                const scroller = q('[data-scroller]');
                const scrollport = q('[data-scrollport]');
                out.geometry = { tableScroll:scroller.scrollWidth > scroller.clientWidth,
                    tableOverflow:getComputedStyle(scroller).overflowX, codeScroll:scrollport.scrollWidth > scrollport.clientWidth,
                    pageOverflow:document.documentElement.scrollWidth - innerWidth };
                q('[data-pre]').classList.add('whitespace-pre-wrap');
                out.nativeWrapOn = { whiteSpace:getComputedStyle(q('[data-pre]')).whiteSpace,
                    codeScroll:scrollport.scrollWidth > scrollport.clientWidth + 1 };
                q('[data-pre]').classList.remove('whitespace-pre-wrap');

                const late = document.createElement('p');
                late.dataset.late = '';
                late.textContent = 'Streamed paragraph';
                q('[data-md]').insertBefore(late, q('[data-ul]'));
                await frames();
                out.late = px('[data-late]','fontSize');

                await save('chatgptEnabled', false);
                out.paused = snapshot();
                out.pausedMarkers = document.querySelectorAll('[data-wgc-font],[data-wgc-line],[data-wgc-space]').length;
                out.pausedRoot = [document.documentElement.getAttribute('data-wgc-reading'),
                    document.documentElement.style.getPropertyValue('--wgc-font-scale'),
                    document.documentElement.classList.contains('wider-chatgpt-width-active')];
                const pausedNew = document.createElement('p');
                pausedNew.dataset.pausedNew = '';
                pausedNew.textContent = 'Added while paused';
                q('[data-md]').appendChild(pausedNew);
                await frames();
                out.pausedNew = [px('[data-paused-new]','fontSize'), pausedNew.hasAttribute('data-wgc-font')];
                window.deliver({ action:'getLayoutStatus' }, {}, r => { out.pausedStatus = r; });

                const nativeChange = document.createElement('style');
                nativeChange.textContent = '.markdown p { font-size:18px; }';
                document.head.appendChild(nativeChange);
                await save('chatgptEnabled', true);
                out.resumed = snapshot();
                window.deliver({ action:'getLayoutStatus' }, {}, r => { out.status = r; });
                q('[data-thread-user-message-navigation-content]').innerHTML = '<div><div>Unknown message layout</div></div>';
                window.deliver({ action:'getLayoutStatus' }, {}, r => { out.unknownStatus = r; });

                const pre = document.createElement('pre');
                pre.id = 'results';
                pre.textContent = JSON.stringify(out);
                document.body.appendChild(pre);
            });
        `)}</body></html>`;
    const file = path.join(temp, 'fixture.html');
    fs.writeFileSync(file, html);
    const result = spawnSync(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check',
        '--disable-extensions', '--window-size=1700,1000', `--user-data-dir=${path.join(temp, 'profile')}`,
        '--dump-dom', '--virtual-time-budget=5000', pathToFileURL(file).href],
    { encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    if (result.error) throw result.error;
    const match = result.stdout?.match(/<pre id="results">([^<]+)<\/pre>/);
    assert(match, `No browser report (${result.status}): ${result.stderr?.slice(0, 1000)}`);
    const r = JSON.parse(match[1]);
    assert(!r.error, r.error);
    fs.writeFileSync(path.join(temp, 'results.json'), JSON.stringify(r, null, 4));
    const near = (actual, expected, label) => assert(Math.abs(actual - expected) < 0.6,
        `${label}: ${actual}, expected ${expected}`);
    const n = r.native;

    assert.strictEqual(r.defaultAttrs, 0, 'defaults add no typography override');
    assert.strictEqual(r.defaultMarkers, 0, 'default reading settings do not sample text metrics');
    for (const key of ['p', 'pLine', 'pBottom', 'h', 'code', 'preLine', 'td', 'user']) {
        near(r.paused[key] ?? 0, key === 'p' ? n.p : n[key], `pause restores ${key}`);
    }

    for (const key of ['p', 'h', 'code', 'td', 'user', 'li', 'newP', 'newUser', 'newCode']) {
        near(r.font[key], n[key] * 1.25, `font ${key}`);
    }
    near(r.font.newCopy, n.newCopy, 'new-structure copy button stays native');
    near(r.font.inline, r.font.p * 0.875, 'inline code keeps its em ratio');
    near(r.font.katex, r.font.p * 1.21, 'math scales only through its text context');
    near(r.font.preLine, n.preLine * 1.25, 'code line height scales with font only');
    near(r.font.pLine, n.pLine * 1.25, 'prose line height keeps its native ratio');
    for (const key of ['copy', 'tableBtn', 'toolbar', 'composer']) near(r.font[key], n[key], `${key} stays native`);
    assert.deepStrictEqual(r.duplicate, r.font, 'duplicate storage/message delivery does not compound');
    assert.strictEqual(r.ack.protocolVersion, 2);

    near(r.dense.pLine, Math.min(n.pLine, Math.max(n.p * 1.15, n.pLine * 0.82)), 'dense prose line');
    near(r.dense.pBottom, n.pBottom * 0.125, 'dense paragraph spacing');
    near(r.dense.preLine, n.preLine, 'density leaves code lines');
    near(r.dense.tdLine, n.tdLine, 'density leaves table rows');

    near(r.custom.pLine, 1.3 * n.p, 'manual line height');
    near(r.custom.p2Top, 0, 'manual zero paragraph spacing');
    near(r.custom.pBottom, 0, 'manual spacing replaces native bottom margins of prose');
    near(r.custom.preLine, n.preLine, 'manual line height does not leak into code');
    near(r.custom.tdLine, n.tdLine, 'manual line height does not leak into tables');

    near(r.full.bubble, r.full.column, 'user bubble fills the conversation column');
    near(r.full.newBubble, r.full.column, 'new-structure user bubble fills the conversation column');
    assert(r.fullWidthOff.bubble < r.full.column - 100, 'full width is gated by effective width');
    assert(r.fullWidthOff.newBubble < r.full.column - 100, 'new-structure full width is gated by effective width');
    near(r.widthOffFont, n.p * 1.25, 'reading stays active with width off');

    assert(r.geometry.tableScroll && r.geometry.tableOverflow === 'auto', 'table keeps native inner scroll');
    assert(r.geometry.codeScroll, 'code keeps native horizontal scroll');
    assert(r.geometry.pageOverflow <= 0, 'no page horizontal overflow');
    assert.strictEqual(r.nativeWrapOn.whiteSpace, 'pre-wrap', 'native wrap state stays authoritative');
    assert.strictEqual(r.nativeWrapOn.codeScroll, false, 'native wrap removes code overflow');
    near(r.late, n.p * 1.25, 'streamed paragraph receives settings');

    assert.strictEqual(r.pausedMarkers, 0, 'pause removes node markers');
    assert.deepStrictEqual(r.pausedRoot, [null, '', false], 'pause removes root attributes, variables and width');
    assert.deepStrictEqual(r.pausedNew, [n.p, false], 'content added while paused stays native');
    assert.strictEqual(r.pausedStatus.status, 'sitePaused');
    assert.strictEqual(r.pausedStatus.pauseReason, 'site');
    near(r.resumed.p, 18 * 1.25, 'resume samples the new native size');
    near(r.resumed.h, n.h * 1.25, 'resume does not compound scaling');
    assert.strictEqual(r.status.status, 'active');
    assert.strictEqual(r.status.reading.status, 'active');
    assert.strictEqual(r.unknownStatus.reading.status, 'unsupported', 'unrecognized messages are reported');
    assert.strictEqual(r.unknownStatus.status, 'active', 'width recognition is reported separately');
    console.log(`Passed ChatGPT reading regression (${temp}).`);
})();
