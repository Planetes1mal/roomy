// Generic checks for every core-runtime site: each site's stripped fixture page (tests/e2e/fixtures/<id>/) is
// loaded with the real shared scripts, core modules and that site's adapter, plus mocked Chrome APIs. The same
// scenario runs for each site: px/% widening, available-width capping, composer alignment, font/density/manual
// spacing, protected code/table/controls, user full width gated by width, streamed content, pause and resume,
// old-instance takeover, navigation rail placement and jumps, gutters, home and unrecognized surfaces.
// A synthetic "reference" site exercises the core itself. Site-specific checks live in fixtures/<id>/extra.js.
// Not a live-site check. Run: node tests/e2e/sites.js [site-id ...]   (WG_CHROME may point to another Chrome)
(function () {
    'use strict';

    const assert = require('assert');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const vm = require('vm');
    const { pathToFileURL } = require('url');
    const { spawnSync } = require('child_process');
    const repo = path.resolve(__dirname, '../..');
    const chrome = process.env.WG_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-sites-'));
    const read = name => fs.readFileSync(path.join(repo, name), 'utf8');
    const script = source => `<script>${source.replace(/<\/script/gi, '<\\/script')}</script>`;
    const near = (actual, expected, label, tolerance = 0.6) => assert(Math.abs(actual - expected) <= tolerance,
        `${label}: ${actual}, expected ${expected}`);

    const registrySandbox = { globalThis: {} };
    registrySandbox.globalThis = registrySandbox;
    vm.runInNewContext(read('src/shared/sites.js'), registrySandbox);
    const registry = registrySandbox.widerRoomySites;
    const fixturesRoot = 'tests/e2e/fixtures';
    const targets = [
        { id: 'reference', adapter: { js: `${fixturesRoot}/reference/adapter.js` } },
        ...registry.sites.filter(site => site.runtime === 'core').map(site => ({ id: site.id, adapter: site.adapter }))
    ];
    const requested = process.argv.slice(2);
    const selected = requested.length ? targets.filter(target => requested.includes(target.id)) : targets;
    assert(selected.length, `no fixture for ${requested.join(', ')}`);

    const sharedScripts = ['src/shared/sites.js', 'src/shared/settings-utils.js'];
    const runtimeScripts = ['src/content/message-navigation.js', ...registry.CORE_JS];
    const sharedStyles = ['src/content/message-navigation.css', ...registry.CORE_CSS];

    // 页面内通用：模拟扩展存储与消息，记录每个 defineSite 返回的上下文，脚本异常时也输出报告。
    const harness = id => `
        window.store = {};
        window.contexts = [];
        window.chrome = {
            runtime:{ id:'sites-${id}', onMessage:{ addListener(fn){ window.deliver = fn; } } },
            i18n:{ getMessage: () => '' },
            storage:{ sync:{ get(keys, cb){ cb(JSON.parse(JSON.stringify(window.store))); } },
                onChanged:{ addListener(fn){ window.deliverStorage = fn; } } }
        };
        window.addEventListener('unhandledrejection', event => report({ error:String(event.reason && event.reason.stack || event.reason) }));
        window.addEventListener('error', event => { window.pageErrors = (window.pageErrors || []).concat(event.message + ' @' + event.filename + ':' + event.lineno); });
        function report(value) {
            const pre = document.createElement('pre');
            pre.id = 'results';
            pre.textContent = JSON.stringify(value);
            document.body.appendChild(pre);
        }
    `;
    // 内核加载后包一层 defineSite，记录上下文以便检查接管。
    const hookCore = `
        (() => { const core = window.widerRoomyCore; const define = core.defineSite;
            core.defineSite = definition => { const ctx = define(definition); if (ctx) window.contexts.push(ctx); return ctx; }; })();
    `;

    const scenario = (id, expected) => `
        const ID = ${JSON.stringify(id)};
        const EXPECTED = ${JSON.stringify(expected)};
        const K = widerGeminiSettings.getSiteKeys(ID);
        const wait = (ms = 60) => new Promise(resolve => setTimeout(resolve, ms));
        const q = selector => document.querySelector(selector);
        const qa = selector => [...document.querySelectorAll(selector)];
        const probe = name => q('[data-probe="' + name + '"]');
        const px = (name, property) => probe(name) ? parseFloat(getComputedStyle(probe(name))[property]) : null;
        const rect = name => probe(name).getBoundingClientRect();
        const contentWidth = name => { const el = probe(name); const s = getComputedStyle(el);
            return el.getBoundingClientRect().width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight); };
        const contentLeft = name => rect(name).left + parseFloat(getComputedStyle(probe(name)).paddingLeft);
        const root = document.documentElement;
        const status = () => { let r; window.deliver({ action:'getLayoutStatus' }, {}, v => { r = v; }); return r; };
        async function save(key, value) {
            window.store[key] = value;
            window.deliverStorage({ [key]:{ newValue:value } }, 'sync');
            await wait();
        }
        const width = patch => save(K.width, { ...window.store[K.width], ...patch });
        const reading = value => save(K.reading, value);
        const markers = () => qa('[data-wgx-font],[data-wgx-line],[data-wgx-space],[data-wgx-full-path]').length;
        const rails = () => qa('.wg-nav').filter(el => !el.hidden).length;
        const scrollEl = () => probe('scroll');
        const paneRight = () => { const el = scrollEl(); return el.getBoundingClientRect().left + el.clientLeft + el.clientWidth; };
        const snapshot = () => ({
            p:px('p1','fontSize'), pLine:px('p1','lineHeight'), pBottom:px('p1','marginBottom'), p2Top:px('p2','marginTop'),
            h:px('h','fontSize'), hLine:px('h','lineHeight'), inline:px('inline','fontSize'), katex:px('katex','fontSize'),
            code:px('code','fontSize'), preLine:px('pre','lineHeight'), td:px('td','fontSize'), tdLine:px('td','lineHeight'),
            user:px('user','fontSize'), li:px('li','fontSize'), copy:px('copy','fontSize'), composerInput:px('composer-input','fontSize'),
            bubble:rect('bubble').width, column:contentWidth('column'), composer:contentWidth('composer'),
            columnOuter:rect('column').width, composerOuter:rect('composer').width,
            columnLeft:rect('column').left, composerLeft:rect('composer').left,
            pageOverflow:root.scrollWidth - innerWidth, paneRight:paneRight()
        });
        window.addEventListener('load', async () => {
            await wait(150);
            const out = { errors:window.pageErrors || [] };
            try {
                // 1. 宽度关闭：原生布局与状态。
                out.native = snapshot();
                out.nativeStatus = status();
                out.nativeMarkers = { owners:qa('[data-wgx-width]').length, attrs:root.hasAttribute('data-wgx-reading'), markers:markers(),
                    site:root.getAttribute('data-wgx-site'), active:root.classList.contains('wider-core-active') };
                // 2. px 与 % 宽度；输入区与消息列对齐；超出可用宽度时封顶。
                await width({ widthEnabled:true });
                out.px1000 = snapshot();
                out.px1000Status = status();
                out.owners = qa('[data-wgx-width]').map(el => el.getAttribute('data-probe') || el.tagName.toLowerCase());
                await width({ chatWidthSetting:{ value:90, unit:'percent' } });
                out.pct90 = snapshot();
                await width({ chatWidthSetting:{ value:2000, unit:'px' } });
                out.capped = snapshot();
                out.cappedGutter = root.style.getPropertyValue('--wgx-gutter');
                await width({ chatWidthSetting:{ value:1000, unit:'px' } });
                // 3. 阅读排版。
                out.defaultMarkers = markers();
                await reading({ messageFontSize:125 });
                out.font = snapshot();
                window.deliver({ action:'updateReadingSettings' }, {}, r => { out.ack = r; });
                window.deliverStorage({ [K.reading]:{ newValue:window.store[K.reading] } }, 'sync');
                await wait();
                out.duplicate = snapshot();
                await reading({ messageCompactness:100 });
                out.dense = snapshot();
                await reading({ messageSpacingCustom:true, messageLineHeight:1.3, messageParagraphSpacing:0, messageCompactness:100 });
                out.custom = snapshot();
                await reading({ userFullWidth:true, messageFontSize:125 });
                out.full = snapshot();
                out.fullStatus = status().capabilities.fullWidth;
                await width({ widthEnabled:false });
                out.fullWidthOff = snapshot();
                await width({ widthEnabled:true });
                const tableScroll = probe('table-scroll');
                const pre = probe('pre');
                out.geometry = { tableScroll:tableScroll.scrollWidth > tableScroll.clientWidth, codeScroll:pre.scrollWidth > pre.clientWidth,
                    pageOverflow:root.scrollWidth - innerWidth };
                // 4. 流式新增段落获得同样的设置。
                const late = document.createElement('p');
                late.dataset.probe = 'late';
                late.textContent = 'Streamed paragraph';
                probe('markdown').insertBefore(late, probe('ul'));
                await wait();
                out.late = px('late','fontSize');
                // 5. 消息导航：刻度数、跳转、键盘、留白。
                out.nav = { ticks:qa('.wg-nav-tick').length, rails:rails(), status:status().capabilities.navigation };
                const scroller = scrollEl();
                const turns = window.contexts[0].navigation.turns();
                qa('.wg-nav-tick')[1].click();
                await wait(400);
                out.jump = { targetTop:turns[1].element.getBoundingClientRect().top - scroller.getBoundingClientRect().top,
                    current:qa('.wg-nav-tick').findIndex(b => b.getAttribute('aria-current') === 'location') };
                qa('.wg-nav-tick')[0].focus();
                q('.wg-nav-list').dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowDown', bubbles:true }));
                out.keyboard = { focused:qa('.wg-nav-tick').indexOf(document.activeElement), tabbable:qa('.wg-nav-tick').filter(b => b.tabIndex === 0).length,
                    preview:!q('.wg-nav-preview').hidden };
                document.activeElement.blur();
                await width({ chatWidthSetting:{ value:100, unit:'percent' } });
                status();
                await wait();
                const navRect = q('.wg-nav').getBoundingClientRect();
                out.gutter = { value:root.style.getPropertyValue('--wgx-gutter'), railLeft:navRect.left, railRight:navRect.right,
                    paneRight:paneRight(), contentRight:window.contexts[0].navigation.contentRight(), visible:rails(),
                    column:rect('column').width, composer:rect('composer').width };
                await save(K.navigation, false);
                out.navOff = { gutter:root.style.getPropertyValue('--wgx-gutter'), rails:qa('.wg-nav').length, width:status().capabilities.width };
                await save(K.navigation, true);
                await width({ chatWidthSetting:{ value:1000, unit:'px' } });
                // 6. 宽度关闭的窄窗格：原生列占满时只为导航留白，列与输入区仍对齐。
                const narrow = q(EXPECTED.narrowPane.selector);
                const narrowBefore = narrow.style.cssText;
                narrow.style.cssText = EXPECTED.narrowPane.style;
                await width({ widthEnabled:false });
                await save(K.navigation, false);
                out.widthOffNative = { free:paneRight() - window.contexts[0].navigation.contentRight(), columnLeft:rect('column').left, composerLeft:rect('composer').left,
                    column:contentWidth('column'), composer:rect('composer').width };
                await save(K.navigation, true);
                status();
                await wait(100);
                const offNav = q('.wg-nav') && !q('.wg-nav').hidden ? q('.wg-nav').getBoundingClientRect() : null;
                out.widthOff = { gutterClass:root.classList.contains('wider-nav-gutter'), activeClass:root.classList.contains('wider-width-active'),
                    rail:!!offNav, railLeft:offNav && offNav.left, paneRight:paneRight(), contentRight:window.contexts[0].navigation.contentRight(),
                    column:contentWidth('column'), composer:rect('composer').width, columnLeft:rect('column').left, composerLeft:rect('composer').left,
                    width:status().capabilities.width };
                // 稳定状态下再同步一次布局不改写 html 的 class：布局观察器监听它，改写会让每一帧都再排一次同步。
                const classRecords = new MutationObserver(() => {});
                classRecords.observe(root, { attributes:true, attributeFilter:['class'] });
                status();
                out.widthOff.classMutations = classRecords.takeRecords().length;
                classRecords.disconnect();
                await save(K.navigation, false);
                out.widthOffNavOff = { gutterClass:root.classList.contains('wider-nav-gutter'), owners:qa('[data-wgx-width]').length };
                await save(K.navigation, true);
                narrow.style.cssText = narrowBefore;
                await width({ widthEnabled:true });
                // 7. 未识别的可见对话：保持原生；标记恢复后重新识别。
                const unknownEl = q(EXPECTED.unknown.selector);
                const unknownValue = unknownEl.getAttribute(EXPECTED.unknown.attribute);
                unknownEl.removeAttribute(EXPECTED.unknown.attribute);
                let s = status();
                await wait();
                out.unknown = { surface:s.surface.kind, status:s.status, owners:qa('[data-wgx-width]').length, markers:markers(), rails:rails(),
                    column:contentWidth('column') };
                unknownEl.setAttribute(EXPECTED.unknown.attribute, unknownValue || '');
                s = status();
                await wait();
                out.recovered = { surface:s.surface.kind, owners:qa('[data-wgx-width]').length, font:px('p1','fontSize'), column:contentWidth('column') };
                // 8. 首页（只有输入区）与不适用的页面：按 expected.json 的描述切换页面状态。
                const applyState = state => {
                    const undo = [];
                    for (const el of state.hide ? qa(state.hide) : []) { undo.push(() => { el.hidden = false; }); el.hidden = true; }
                    for (const el of state.show ? qa(state.show) : []) { undo.push(() => { el.hidden = true; }); el.hidden = false; }
                    for (const change of state.attributes || []) {
                        const el = q(change.selector);
                        const previous = el.getAttribute(change.attribute);
                        undo.push(() => previous === null ? el.removeAttribute(change.attribute) : el.setAttribute(change.attribute, previous));
                        el.setAttribute(change.attribute, change.value);
                    }
                    return () => undo.reverse().forEach(fn => fn());
                };
                let restoreState = applyState(EXPECTED.home);
                s = status();
                await wait();
                out.home = { surface:s.surface.kind, status:s.status, owners:qa('[data-wgx-width]').map(el => el.getAttribute('data-probe')),
                    composer:contentWidth(EXPECTED.home.composerProbe || 'composer'), rails:rails(), reading:s.capabilities.reading };
                restoreState();
                restoreState = applyState(EXPECTED.notApplicable);
                s = status();
                await wait();
                out.notApplicable = { surface:s.surface.kind, status:s.status, width:s.capabilities.width, owners:qa('[data-wgx-width]').length };
                restoreState();
                s = status();
                await wait();
                out.back = { surface:s.surface.kind, column:contentWidth('column') };
                // 9. 暂停：导航条移除，全部标记撤回；暂停期间新增内容保持原生；恢复时重新采样。
                await save(K.enabled, false);
                out.paused = snapshot();
                out.pausedState = { markers:markers(), owners:qa('[data-wgx-width]').length, rails:qa('.wg-nav, .wg-nav-preview').length,
                    attrs:[root.getAttribute('data-wgx-reading'), root.style.getPropertyValue('--wgx-font-scale'), root.classList.contains('wider-width-active'),
                        root.classList.contains('wider-core-active'), root.style.getPropertyValue('--wgx-gutter')],
                    status:status() };
                const pausedNew = document.createElement('p');
                pausedNew.dataset.probe = 'paused-new';
                pausedNew.textContent = 'Added while paused';
                probe('markdown').appendChild(pausedNew);
                await wait();
                out.pausedNew = [px('paused-new','fontSize'), pausedNew.hasAttribute('data-wgx-font')];
                const nativeChange = document.createElement('style');
                nativeChange.textContent = '[data-probe="markdown"] p { font-size:18px; }';
                document.head.appendChild(nativeChange);
                await save(K.enabled, true);
                out.resumed = snapshot();
                out.resumedStatus = status();
                nativeChange.remove();
                await wait();
                // 10. 旧实例接管：同一页面再注入一次，只剩一条导航条，旧实例退出。
                const railsBefore = rails();
                delete window.widerCoreContentLoaded;
                delete window.widerRoomyCore;
                new Function(window.coreSources)();
                await wait(200);
                status();
                await wait(200);
                out.takeover = { railsBefore, rails:rails(), contexts:window.contexts.length, oldRetired:window.contexts[0].retired,
                    newRetired:window.contexts[1] && window.contexts[1].retired, font:px('p1','fontSize'), column:contentWidth('column'),
                    owners:qa('[data-wgx-width]').length };
                // 11. 默认字号与间距下的用户消息铺满：网站换掉对话元素（切换对话）而窗格与滚动区不变时，新对话同样铺满。
                await reading({ userFullWidth:true });
                const conversation = window.contexts[window.contexts.length - 1].surface.root;
                const fresh = conversation.cloneNode(true);
                for (const el of [fresh, ...fresh.querySelectorAll('*')]) {
                    [...el.attributes].filter(attr => attr.name.startsWith('data-wgx')).forEach(attr => el.removeAttribute(attr.name));
                    Array.from(el.style).filter(name => name.startsWith('--wgx')).forEach(name => el.style.removeProperty(name));
                }
                conversation.replaceWith(fresh);
                // 同步识别新对话（与排队的布局帧相同），在任何后续布局同步之前读取结果。
                s = status();
                out.switched = { root:window.contexts[window.contexts.length - 1].surface.root === fresh, bubble:rect('bubble').width,
                    column:contentWidth('column'), fullWidth:s.capabilities.fullWidth };
                ${expected.extraScenario || ''}
                report(out);
            } catch (error) {
                report({ error:String(error && error.stack || error), partial:out });
            }
        });
    `;

    function run(target) {
        const fixtureDir = `${fixturesRoot}/${target.id}`;
        const expected = JSON.parse(read(`${fixtureDir}/expected.json`));
        const extraPath = path.join(repo, fixtureDir, 'extra.js');
        const extra = fs.existsSync(extraPath) ? require(extraPath) : null;
        if (extra && extra.scenario) expected.extraScenario = extra.scenario;
        const page = read(`${fixtureDir}/page.html`);
        assert(page.includes('</head>') && page.includes('</body>'), `${target.id}: fixture page has head and body`);
        const coreSources = [...runtimeScripts.map(read), hookCore, read(target.adapter.js)].join('\n;\n');
        const styles = [...sharedStyles, ...(target.adapter.css ? [target.adapter.css] : [])]
            .map(file => `<style data-extension="${file}">${read(file)}</style>`).join('');
        const scripts = [
            script(harness(target.id)),
            ...sharedScripts.map(file => script(read(file))),
            script(`window.store = { [widerGeminiSettings.getSiteKeys(${JSON.stringify(target.id)}).width]:
                { widthEnabled:false, chatWidthSetting:{ value:1000, unit:'px' } } };
                window.coreSources = ${JSON.stringify(coreSources)};`),
            script(coreSources),
            script(scenario(target.id, expected))
        ].join('');
        const html = page.replace('</head>', `${styles}</head>`).replace('</body>', `${scripts}</body>`);
        const file = path.join(temp, `${target.id}.html`);
        fs.writeFileSync(file, html);
        const [w, h] = expected.viewport || [1600, 1000];
        const result = spawnSync(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check',
            '--disable-extensions', '--force-prefers-reduced-motion', `--window-size=${w},${h}`,
            `--user-data-dir=${path.join(temp, `profile-${target.id}`)}`, '--dump-dom', '--virtual-time-budget=10000',
            pathToFileURL(file).href], { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
        if (result.error) throw result.error;
        const match = result.stdout?.match(/<pre id="results">([^<]+)<\/pre>/);
        assert(match, `${target.id}: no browser report (${result.status}): ${result.stderr?.slice(0, 800)}`);
        const report = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
        fs.writeFileSync(path.join(temp, `${target.id}.json`), JSON.stringify(report, null, 4));
        assert(!report.error, `${target.id}: ${report.error}`);
        return { report, expected, extra };
    }

    function check(id, r, expected) {
        const label = text => `${id}: ${text}`;
        const n = r.native;
        assert.deepStrictEqual(r.errors, [], label('no page errors'));
        assert.strictEqual(r.nativeStatus.site, id);
        assert.strictEqual(r.nativeStatus.status, 'paused', label('width off is reported as paused'));
        assert.strictEqual(r.nativeStatus.capabilities.width, 'off');
        assert.deepStrictEqual([r.nativeMarkers.owners, r.nativeMarkers.attrs, r.nativeMarkers.markers], [0, false, 0], label('width off leaves no markers'));
        assert.strictEqual(r.nativeMarkers.site, id, label('html carries the site id'));
        assert.strictEqual(r.nativeMarkers.active, true, label('site-active class is set'));
        assert(n.column < 900, label(`fixture: native column is narrow (${n.column})`));

        // 宽度：px、%、封顶、对齐、无横向溢出。
        near(r.px1000.column, 1000, label('1000px widens the column'), 1);
        near(r.px1000.composerOuter, r.px1000.columnOuter, label('composer matches the column width'), 1);
        // 与原生的相对位置比较：Windows 的常规滚动条会让原生对话列和输入区本来就错开半个滚动条宽。
        near(r.px1000.composerLeft - r.px1000.columnLeft, n.composerLeft - n.columnLeft, label('composer keeps its native alignment at 1000px'), 1);
        assert.strictEqual(r.px1000Status.status, 'active');
        assert.strictEqual(r.px1000Status.capabilities.width, 'active');
        assert.deepStrictEqual([...r.owners].sort(), [...(expected.widthOwners || ['column', 'composer'])].sort(), label('width owners'));
        assert(r.pct90.column > r.px1000.column + 100 && r.pct90.column <= r.pct90.paneRight, label(`90% is wider and inside the pane: ${JSON.stringify(r.pct90)}`));
        near(r.pct90.composerOuter, r.pct90.columnOuter, label('composer follows the % width'), 1);
        assert(r.capped.column > r.pct90.column - 1 && r.capped.column <= r.capped.paneRight - r.capped.columnLeft + 1,
            label(`a width beyond the pane is capped to the available width: ${JSON.stringify(r.capped)}`));
        assert(r.capped.pageOverflow <= 0 && r.px1000.pageOverflow <= 0, label('no page horizontal overflow'));

        // 阅读排版。
        assert.strictEqual(r.defaultMarkers, 0, label('default reading settings do not sample text metrics'));
        for (const key of ['p', 'h', 'code', 'td', 'user', 'li']) near(r.font[key], n[key] * 1.25, label(`font ${key}`));
        near(r.font.inline, r.font.p * 0.875, label('inline code keeps its em ratio'));
        if (n.katex !== null) near(r.font.katex, r.font.p * 1.21, label('math scales only through its text context'));
        near(r.font.preLine, n.preLine * 1.25, label('code line height scales with font only'));
        near(r.font.pLine, n.pLine * 1.25, label('prose line height keeps its native ratio'));
        for (const key of ['copy', 'composerInput']) near(r.font[key], n[key], label(`${key} stays native`));
        assert.deepStrictEqual(r.duplicate, r.font, label('duplicate storage/message delivery does not compound'));
        assert.strictEqual(r.ack.protocolVersion, 2);
        near(r.dense.pLine, Math.min(n.pLine, Math.max(n.p * 1.15, n.pLine * 0.82)), label('dense prose line'));
        near(r.dense.pBottom, n.pBottom * 0.125, label('dense paragraph spacing'));
        near(r.dense.preLine, n.preLine, label('density leaves code lines'));
        near(r.dense.tdLine, n.tdLine, label('density leaves table rows'));
        near(r.custom.pLine, 1.3 * n.p, label('manual line height'));
        near(r.custom.p2Top, 0, label('manual zero paragraph spacing'));
        near(r.custom.pBottom, 0, label('manual spacing replaces native bottom margins of prose'));
        near(r.custom.preLine, n.preLine, label('manual line height does not leak into code'));
        near(r.custom.tdLine, n.tdLine, label('manual line height does not leak into tables'));
        near(r.full.bubble, r.full.column, label('user bubble fills the conversation column'), 1);
        assert.strictEqual(r.fullStatus, 'active');
        assert(r.fullWidthOff.bubble < r.full.column - 100, label('full width is gated by effective width'));
        near(r.fullWidthOff.p, n.p * 1.25, label('reading stays active with width off'));
        assert(r.geometry.tableScroll, label('table keeps native inner scroll'));
        assert(r.geometry.codeScroll, label('code keeps native horizontal scroll'));
        assert(r.geometry.pageOverflow <= 0, label('no page horizontal overflow with reading'));
        near(r.late, n.p * 1.25, label('streamed paragraph receives settings'));

        // 导航。
        assert.strictEqual(r.nav.ticks, expected.turns, label('one tick per user message'));
        assert.strictEqual(r.nav.rails, 1);
        assert.strictEqual(r.nav.status, 'active');
        near(r.jump.targetTop, expected.scrollInset, label('jump places the target below the top inset'), 2);
        assert.strictEqual(r.jump.current, 1);
        assert.strictEqual(r.keyboard.focused, 1, label('ArrowDown moves focus within the rail'));
        assert.strictEqual(r.keyboard.tabbable, 1, label('one Tab stop'));
        assert.strictEqual(r.keyboard.preview, true);
        assert(parseFloat(r.gutter.value) > 0, label(`100% width reserves a gutter: ${JSON.stringify(r.gutter)}`));
        assert.strictEqual(r.gutter.visible, 1, label('rail stays visible at 100% width'));
        assert(r.gutter.railRight <= r.gutter.paneRight + 0.5 && r.gutter.railLeft >= r.gutter.contentRight - 0.5,
            label(`rail fits between column and pane edge: ${JSON.stringify(r.gutter)}`));
        near(r.gutter.composer, r.gutter.column, label('composer stays aligned with the gutter'), 1);
        assert.strictEqual(r.navOff.gutter, '', label('navigation off releases the gutter'));
        assert.strictEqual(r.navOff.rails, 0);
        if (r.widthOffNative.free < 23) {
            // 原生列占满窄窗格：只为导航留白，列与输入区对称收窄、仍然对齐。
            assert.deepStrictEqual([r.widthOff.gutterClass, r.widthOff.activeClass, r.widthOff.rail, r.widthOff.width], [true, false, true, 'off'],
                label(`width off keeps a navigation-only gutter: ${JSON.stringify(r.widthOff)}`));
            near(r.widthOff.composerLeft - r.widthOff.columnLeft, r.widthOffNative.composerLeft - r.widthOffNative.columnLeft,
                label('composer keeps its native alignment with the column'), 1);
        } else {
            // 原生布局本来就留有导航条的位置：不收窄，列与输入区保持原生宽度。
            assert.deepStrictEqual([r.widthOff.gutterClass, r.widthOff.activeClass, r.widthOff.rail, r.widthOff.width], [false, false, true, 'off'],
                label(`width off needs no gutter when the native layout leaves room: ${JSON.stringify(r.widthOff)}`));
            near(r.widthOff.column, r.widthOffNative.column, label('native column width is kept'), 1);
            near(r.widthOff.composer, r.widthOffNative.composer, label('native composer width is kept'), 1);
        }
        assert(r.widthOff.railLeft >= r.widthOff.contentRight - 0.5 && r.widthOff.railLeft + 24 <= r.widthOff.paneRight + 0.5,
            label(`rail fits beside the native column: ${JSON.stringify(r.widthOff)}`));
        assert.strictEqual(r.widthOff.classMutations, 0, label('a settled layout sync with width off leaves html classes untouched'));
        assert.deepStrictEqual([r.widthOffNavOff.gutterClass, r.widthOffNavOff.owners], [false, 0], label('navigation off releases it'));

        // 界面识别。
        assert.deepStrictEqual([r.unknown.surface, r.unknown.status, r.unknown.owners, r.unknown.markers, r.unknown.rails],
            ['unknown', 'unsupported', 0, 0, 0], label('unknown visible chat stays native'));
        near(r.unknown.column, n.column, label('unknown structure keeps the native column'), 1);
        assert.strictEqual(r.recovered.surface, 'chat');
        near(r.recovered.font, n.p * 1.25, label('recognition recovers when markers return'));
        near(r.recovered.column, 1000, label('width recovers when markers return'), 1);
        assert.deepStrictEqual([r.home.surface, r.home.status, r.home.owners, r.home.rails, r.home.reading],
            ['home', 'active', [expected.home.composerProbe || 'composer'], 0, 'notApplicable'], label(`home widens only the composer: ${JSON.stringify(r.home)}`));
        near(r.home.composer, 1000, label('home composer width'), 1);
        assert.deepStrictEqual([r.notApplicable.surface, r.notApplicable.status, r.notApplicable.width, r.notApplicable.owners],
            ['notApplicable', 'notApplicable', 'notApplicable', 0], label('native-only pages stay native'));
        assert.strictEqual(r.back.surface, 'chat');
        near(r.back.column, 1000, label('chat resumes after a native-only page'), 1);

        // 暂停、恢复、接管。
        for (const key of ['p', 'pLine', 'pBottom', 'h', 'code', 'preLine', 'td', 'user']) near(r.paused[key], n[key], label(`pause restores ${key}`));
        near(r.paused.column, n.column, label('pause restores the native column'), 1);
        assert.deepStrictEqual([r.pausedState.markers, r.pausedState.owners, r.pausedState.rails], [0, 0, 0], label('pause removes markers, owners and the rail'));
        assert.deepStrictEqual(r.pausedState.attrs, [null, '', false, false, ''], label('pause removes root attributes, variables, classes and gutter'));
        assert.strictEqual(r.pausedState.status.status, 'sitePaused');
        assert.strictEqual(r.pausedState.status.pauseReason, 'site');
        assert.strictEqual(r.pausedState.status.capabilities.navigation, 'paused');
        assert.deepStrictEqual(r.pausedNew, [n.p, false], label('content added while paused stays native'));
        near(r.resumed.p, 18 * 1.25, label('resume samples the new native size'));
        near(r.resumed.h, n.h * 1.25, label('resume does not compound scaling'));
        assert.strictEqual(r.resumedStatus.status, 'active');
        assert.strictEqual(r.resumedStatus.reading.status, 'active');
        assert.deepStrictEqual([r.takeover.railsBefore, r.takeover.rails, r.takeover.contexts, r.takeover.oldRetired, r.takeover.newRetired],
            [1, 1, 2, true, false], label(`a new instance retires the old one and keeps one rail: ${JSON.stringify(r.takeover)}`));
        near(r.takeover.font, n.p * 1.25, label('the new instance reapplies reading'));
        near(r.takeover.column, 1000, label('the new instance reapplies width'), 1);

        // 默认字号与间距下切换对话：用户消息铺满不依赖阅读采样。
        assert.strictEqual(r.switched.root, true, label('the replaced conversation is recognized'));
        near(r.switched.bubble, r.switched.column, label(`user bubble fills a replaced conversation at default text settings: ${JSON.stringify(r.switched)}`), 1);
        assert.strictEqual(r.switched.fullWidth, 'active');
    }

    for (const target of selected) {
        const { report, expected, extra } = run(target);
        check(target.id, report, expected);
        if (extra && extra.check) extra.check(report, expected, { assert, near });
        console.log(`Passed generic site checks for ${target.id}`);
    }
    console.log(`Passed site regression for ${selected.map(target => target.id).join(', ')} (${temp}).`);
})();
