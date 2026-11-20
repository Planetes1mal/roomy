module.exports.pageScenario = `
    window.addEventListener('load', async () => {
        const wait = () => new Promise(resolve => setTimeout(resolve, 100));
        const q = selector => document.querySelector(selector);
        const rect = selector => q(selector).getBoundingClientRect();
        const key = widerGeminiSettings.getSiteKeys('googleaimode');
        const set = (k, v) => {
            window.store[k] = v;
            window.deliverStorage({ [k]: { newValue:v } }, 'sync');
        };
        const width = (value, unit = 'px') => set(key.width, { chatWidthSetting:{ value, unit } });
        const marked = () => document.querySelectorAll('[data-wgx-width]').length;
        const hit = selector => {
            const node = q(selector);
            const box = node.getBoundingClientRect();
            return node.contains(document.elementFromPoint(box.left + 2, box.top + box.height / 2));
        };
        const geometry = () => ({
            answer:rect('.mZJni').width, shell:rect('.t0ITR').width,
            composerOffset:rect('.t0ITR textarea').left - rect('.mZJni').left,
            tabsOffset:rect('.P3mIxe').left - rect('.mZJni').left,
            questionOffset:rect('.tbIZh').right - rect('.mZJni').right,
            sources:rect('.oRipZb').width, gap:rect('.oRipZb').left - rect('.mZJni').right,
            sidebarRight:rect('[aria-hidden="false"]').right, answerLeft:rect('.mZJni').left,
            cardLeft:rect('.t0ITR').left, sourcesRight:rect('.oRipZb').right,
            reachable:['.mZJni', '.P3mIxe', '.t0ITR'].map(hit),
            viewport:document.documentElement.clientWidth, windowWidth:innerWidth,
            overflow:document.documentElement.scrollWidth - document.documentElement.clientWidth
        });
        try {
            await wait();
            const out = {};
            const start = location.href;
            width(700);
            q('button').click();
            out.entry = [marked(), location.href === start];
            document.body.append(q('template').content.cloneNode(true));
            await wait();
            const status = () => { let s; window.deliver({action:'getLayoutStatus'}, {}, v => {s=v;}); return s; };
            out.surface = status().surface.kind;
            out.at700 = geometry();
            width(1000);
            out.at1000 = geometry();
            width(90, 'percent');
            out.capped = geometry();
            out.sidebar = [];
            for (const [value, unit] of [[1000, 'px'], [70, 'percent'], [90, 'percent'], [2000, 'px']]) {
                width(value, unit);
                await wait();
                for (const action of ['close', 'open']) {
                    const button = q('button[data-sidebar="' + action + '"]');
                    const box = button.getBoundingClientRect();
                    const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
                    if (target !== button) throw Error('Sidebar toggle is covered: ' + action);
                    target.click();
                    await wait();
                    out.sidebar.push({ value, unit, open:action === 'open', ...geometry() });
                }
            }
            width(1000);
            document.documentElement.style.overflowY = 'hidden';
            width(90, 'percent');
            out.noScrollbar = geometry();
            document.documentElement.style.removeProperty('overflow-y');
            await wait();
            const main = q('[data-artifact-opened]');
            main.setAttribute('data-artifact-opened','true');
            await wait();
            status();
            out.panel = [marked(), rect('.mZJni').width];
            main.setAttribute('data-artifact-opened','false');
            width(700);
            set(key.enabled,false);
            out.paused = [marked(), rect('.mZJni').width];
            set(key.enabled,true);
            const turn = q('[data-scope-id]');
            turn.remove();
            out.empty = [status().surface.kind, rect('.t0ITR').width];
            main.prepend(turn);
            out.returned = [status().surface.kind, rect('.mZJni').width];
            // Some turns insert a display:contents container while the answer streams in.
            const wrap = document.createElement('div');
            wrap.setAttribute('data-container-id','');
            wrap.style.display = 'contents';
            const answer = q('.mZJni');
            answer.replaceWith(wrap);
            wrap.append(answer);
            out.wrappedSurface = status().surface.kind;
            out.wrapped = geometry();
            main.remove();
            await wait();
            out.exit = [status().surface.kind, marked(), location.href === start];
            report(out);
        } catch (error) { report({error:String(error.stack || error)}); }
    });
`;

module.exports.check = function (out, expected, { assert, near }) {
    assert.deepStrictEqual(out.entry, [0, true], 'search and its entry toggle stay native');
    assert.strictEqual(out.surface, 'chat');
    const cap = sample => sample.viewport - sample.sidebarRight - expected.sourceWidth - expected.sourceGap - 48;
    assert.strictEqual(out.noScrollbar.viewport - out.capped.viewport, 16, 'the fixture reserves a real scrollbar gutter');
    for (const sample of [out.capped, out.noScrollbar]) {
        assert(cap(sample) > 700 && cap(sample) < sample.viewport * .9, 'the percent case reaches the available-space cap');
    }
    for (const [sample, width] of [[out.at700, 700], [out.at1000, Math.min(1000, cap(out.at1000))],
        [out.capped, cap(out.capped)], [out.noScrollbar, cap(out.noScrollbar)]]) {
        near(sample.answer, width, 'answer width');
        near(sample.shell, width + 40, 'composer keeps its original outer inset');
        near(sample.composerOffset, 0, 'input text aligns with answers');
        near(sample.tabsOffset, 0, 'tabs align with the left edge of answers');
        near(sample.questionOffset, 0, 'questions align with the right edge of answers');
        near(sample.sources, expected.sourceWidth, 'sources keep their native width');
        near(sample.gap, expected.sourceGap, 'sources stay clear of answers');
        near(sample.sidebarRight, 261, 'expanded sidebar reaches its actual edge');
        assert.strictEqual(sample.overflow, 0);
    }
    for (const sample of out.sidebar) {
        const sidebar = sample.open ? 261 : 64;
        const label = [sample.viewport, sample.value + sample.unit, sample.open ? 'open' : 'closed'].join(' ');
        const requested = sample.unit === 'percent' ? sample.windowWidth * sample.value / 100 : sample.value;
        near(sample.sidebarRight, sidebar, label + ': actual visible navigation');
        near(sample.answer, Math.min(requested, cap(sample)), label + ': width within the usable area');
        near(sample.answerLeft - sidebar, sample.viewport - sample.sourcesRight, label + ': centered between the rail and viewport edge');
        near(sample.composerOffset, 0, label + ': editor');
        near(sample.tabsOffset, 0, label + ': tabs');
        near(sample.questionOffset, 0, label + ': question');
        near(sample.gap, expected.sourceGap, label + ': sources gap');
        near(sample.sources, expected.sourceWidth, label + ': sources width');
        assert(sample.cardLeft > sidebar && sample.sourcesRight < sample.viewport, label + ': card and sources are inside the available bounds');
        assert(sample.reachable.every(Boolean), label + ': sidebar does not intercept the answer, tabs or composer');
        assert.strictEqual(sample.overflow, 0, label + ': no page overflow');
    }
    assert.deepStrictEqual(out.panel, [0, expected.nativeWidth]);
    assert.deepStrictEqual(out.paused, [0, expected.nativeWidth]);
    assert.deepStrictEqual(out.empty, ['home', 740]);
    assert.deepStrictEqual(out.returned, ['chat', 700]);
    assert.strictEqual(out.wrappedSurface, 'chat', 'wrapped answer remains a recognized conversation');
    near(out.wrapped.answer, 700, 'wrapped answer follows the width');
    near(out.wrapped.shell, 740, 'wrapped answer and follow-up box stay aligned');
    near(out.wrapped.gap, expected.sourceGap, 'wrapped answer leaves room for sources');
    near(out.wrapped.composerOffset, 0, 'wrapped answer and editor align');
    assert.deepStrictEqual(out.exit, ['notApplicable', 0, true]);
};

module.exports.runMotion = require('./motion.cjs');
