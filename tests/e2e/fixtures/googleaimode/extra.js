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
        const geometry = () => ({
            answer:rect('.mZJni').width, shell:rect('.t0ITR').width,
            aligned:Math.abs(rect('.mZJni').left - rect('.t0ITR textarea').left) < 1,
            sources:rect('.oRipZb').width, gap:rect('.oRipZb').left - rect('.mZJni').right,
            left:rect('.sidebar').width, overflow:document.documentElement.scrollWidth - innerWidth
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
    for (const [sample, width] of [[out.at700, 700], [out.at1000, 1000], [out.capped, 1858]]) {
        near(sample.answer, width, 'answer width');
        near(sample.shell, width + 40, 'composer keeps its original outer inset');
        assert(sample.aligned, 'input text aligns with answers');
        near(sample.sources, expected.sourceWidth, 'sources keep their native width');
        near(sample.gap, expected.sourceGap, 'sources stay clear of answers');
        near(sample.left, 206, 'left sidebar keeps its width');
        assert.strictEqual(sample.overflow, 0);
    }
    assert.deepStrictEqual(out.panel, [0, expected.nativeWidth]);
    assert.deepStrictEqual(out.paused, [0, expected.nativeWidth]);
    assert.deepStrictEqual(out.empty, ['home', 740]);
    assert.deepStrictEqual(out.returned, ['chat', 700]);
    assert.deepStrictEqual(out.exit, ['notApplicable', 0, true]);
};
