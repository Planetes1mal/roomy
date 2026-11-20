// Measure the production adapter in a fixture using Chrome's real animation clock.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

async function exercise() {
    const q = selector => document.querySelector(selector);
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const keys = widerGeminiSettings.getSiteKeys('googleaimode');
    const timings = [];
    document.addEventListener('transitionrun', event => {
        if (event.propertyName !== '--wg-aim-answer') return;
        const style = getComputedStyle(event.target);
        timings.push([style.transitionDuration, style.transitionTimingFunction]);
    });
    function save(key, value) {
        window.store[key] = value;
        window.deliverStorage({ [key]: { newValue:value } }, 'sync');
    }
    const setWidth = value => save(keys.width, { chatWidthSetting:{ value, unit:'px' } });
    const mount = () => document.body.append(q('template').content.cloneNode(true));
    function geometry() {
        const box = selector => q(selector).getBoundingClientRect();
        const answer = box('.mZJni');
        return {
            width:answer.width, left:answer.left, owned:!!q('[data-wg-aim-motion]'), tabs:box('.P3mIxe').left - answer.left,
            bubble:box('.tbIZh').right - answer.right, editor:box('.t0ITR textarea').left - answer.left,
            gap:box('.oRipZb').left - answer.right, sources:box('.oRipZb').width
        };
    }
    async function sample(change, reverseAtMidpoint = false) {
        const frames = [{ ...geometry(), time:0 }];
        const start = performance.now();
        const reverseWidth = frames[0].width - (frames[0].width - 652) / 4;
        let reversed = false;
        change();
        do {
            await frame();
            const sample = { ...geometry(), time:performance.now() - start };
            frames.push(sample);
            if (reverseAtMidpoint && !reversed && sample.width < reverseWidth) {
                save(keys.enabled, true);
                reversed = true;
            }
        } while (performance.now() - start < 800);
        return frames;
    }
    try {
        // A deferred script holds DOMContentLoaded open until the first visible frame is sampled.
        const fragment = q('template').content.cloneNode(true);
        const turn = fragment.querySelector('[data-scope-id]');
        const dock = fragment.querySelector('.y4VEUd');
        turn.remove();
        dock.remove();
        document.body.append(fragment);
        const native = { left:q('.ilZyRc').getBoundingClientRect().left };
        function partialFrame(selector) {
            const r = q(selector).getBoundingClientRect();
            return { width:r.width, tabs:q('.P3mIxe').getBoundingClientRect().left - r.left,
                bubble:q('.tbIZh').getBoundingClientRect().right - r.right, hasDock:!!q('.y4VEUd') };
        }
        await frame();
        const questionFirst = partialFrame('.ilZyRc');
        q('[data-artifact-opened]').append(turn);
        await frame();
        const answerFirst = partialFrame('.mZJni');
        q('[data-artifact-opened]').append(dock);
        await frame();
        const firstFrame = geometry();
        const early = !window.domContentLoaded;
        await fetch('/release-dcl');
        if (!window.domContentLoaded) await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once:true }));
        q('.e9EfHf').remove();
        const toggleSidebar = innerWidth === 1440;
        if (toggleSidebar) document.body.style.setProperty('--lhs', '0px');
        await frame();
        let duringUpdate;
        const transition = document.startViewTransition({
            types:['aimc'],
            async update() {
                mount();
                await Promise.resolve(); // Mutation delivery, while rendering is suspended.
                duringUpdate = geometry();
            }
        });
        await transition.ready;
        const newSnapshot = geometry();
        await transition.finished;
        await frame();
        const firstChatFrame = geometry();
        await frame();
        if (toggleSidebar) {
            document.body.style.removeProperty('--lhs');
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        const narrow = await sample(() => setWidth(700));
        const wide = await sample(() => setWidth(1000));
        const reversed = await sample(() => save(keys.enabled, false), true);
        const pause = await sample(() => save(keys.enabled, false));
        const cleaned = !q('[data-wg-aim-motion]');
        const resume = await sample(() => save(keys.enabled, true));
        await frame();
        save(keys.enabled, false);
        q('[data-artifact-opened]').remove();
        await frame();
        const left = !q('[data-wg-aim-motion]') && !document.documentElement.classList.contains('wider-width-active');
        await fetch('/report', { method:'POST', body:JSON.stringify({
            viewport:[innerWidth,innerHeight], native, questionFirst, answerFirst, firstFrame, early, duringUpdate, newSnapshot, firstChatFrame,
            narrow, wide, reversed, pause, cleaned, resume, left, timings
        }) });
    } catch (error) {
        await fetch('/report', { method:'POST', body:JSON.stringify({ error:String(error.stack || error) }) });
    }
}

async function runMotion(chrome, temp, page, viewportWidth) {
    let unblock;
    const dclGate = new Promise(resolve => { unblock = resolve; });
    let finish;
    const result = new Promise(resolve => { finish = resolve; });
    const server = http.createServer(async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        if (req.url === '/') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end('<a href="/search">AI Mode</a><script>document.querySelector("a").click()</script>');
        } else if (req.url === '/search') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            const gate = '<script>document.addEventListener("DOMContentLoaded",()=>{window.domContentLoaded=true})</script><script defer src="/hold.js"></script>';
            res.end(page.replace('</head>', gate + '</head>').replace('</body>', '<script>(' + exercise.toString() + ')()</script></body>'));
        } else if (req.url === '/hold.js') {
            await dclGate;
            res.setHeader('Content-Type', 'application/javascript');
            res.end('');
        } else if (req.url === '/release-dcl') {
            unblock();
            res.end();
        } else if (req.url === '/report' && req.method === 'POST') {
            let body = '';
            for await (const chunk of req) body += chunk;
            res.end();
            finish(JSON.parse(body));
        } else {
            res.writeHead(404).end();
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const child = spawn(chrome, ['--headless=new', '--disable-extensions', '--disable-sync', '--disable-background-networking',
        '--no-first-run', '--no-default-browser-check', '--force-prefers-no-reduced-motion', '--window-size=' + viewportWidth + ',1440',
        '--user-data-dir=' + path.join(temp, 'motion-' + viewportWidth), 'http://127.0.0.1:' + server.address().port], { stdio:'ignore' });
    const closed = new Promise(resolve => child.once('close', resolve));
    let timer;
    let data;
    try {
        const stalled = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Google motion fixture timed out')), 30000); });
        data = await Promise.race([result, stalled, closed.then(() => { throw Error('Chrome closed before the Google motion report'); })]);
    } finally {
        clearTimeout(timer);
        unblock();
        child.kill();
        await closed;
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
    assert(!data.error, data.error);
    fs.writeFileSync(path.join(temp, 'googleaimode-motion-' + viewportWidth + '.json'), JSON.stringify(data));
    assert.strictEqual(data.viewport[0], viewportWidth);
    const wideTarget = Math.min(1000, viewportWidth - 206 - 448 - 48);
    assert(data.early, 'sample the full-document entry before DOMContentLoaded');
    for (const sample of [data.questionFirst, data.answerFirst]) {
        assert(!sample.hasDock, 'this streamed frame precedes the follow-up box');
        assert(Math.abs(sample.width - wideTarget) < 1 && Math.abs(sample.tabs) < 1 && Math.abs(sample.bubble) < 1,
            'the streamed question and answer use the saved width and alignment before the composer arrives');
    }
    assert(Math.abs(data.firstFrame.width - wideTarget) < 1, 'full-document first frame at the saved width');
    const entryWidth = viewportWidth === 1440 ? 944 : wideTarget;
    for (const [name, sample] of Object.entries({ duringUpdate:data.duringUpdate, newSnapshot:data.newSnapshot, firstChatFrame:data.firstChatFrame })) {
        assert(Math.abs(sample.width - entryWidth) < 1, name + ': enter at the saved width');
    }
    assert(data.timings.some(([duration, easing]) => duration === '0.35s' && easing.startsWith('linear(')),
        'Chrome plays the registered length transition with the 350 ms spring');
    assert(data.cleaned && data.left, 'pause and mid-transition route exit remove animation ownership');
    for (const [name, target] of [['narrow',700], ['wide',wideTarget], ['reversed',wideTarget], ['pause',652], ['resume',wideTarget]]) {
        const frames = data[name];
        const distinct = new Set(frames.map(f => Math.round(f.width)));
        assert(Math.abs(frames.at(-1).width - target) < 1, name + ': settles at the requested width');
        assert(distinct.size > 3, name + ': partial widths appear in separate real frames');
        if (name === 'reversed') assert(frames.some(f => f.width < wideTarget - (wideTarget - 652) / 4), 'reverse a return that has already started');
        for (const f of frames) {
            assert(Math.max(Math.abs(f.tabs), Math.abs(f.bubble), Math.abs(f.editor)) < 1, name + ': edges track each frame');
            assert(Math.abs(f.gap - 76) < 1 && Math.abs(f.sources - 372) < 1, name + ': source links keep their space');
        }
        if (viewportWidth === 1440 && (name === 'pause' || name === 'resume')) {
            // With the sidebar open, both the answer width and Google's 37px grid bias change.
            // When they share one curve, every frame lies on the line between the two endpoint boxes.
            const from = frames[0], to = frames.at(-1);
            for (const f of frames) {
                const progress = (f.width - from.width) / (to.width - from.width);
                const expectedLeft = from.left + progress * (to.left - from.left);
                assert(Math.abs(f.left - expectedLeft) < 1,
                    name + ': the left edge and answer width must move with the same progress');
            }
        }
        if (name === 'pause') {
            const released = frames.findIndex((f, i) => i > 0 && !f.owned && frames[i-1].owned);
            assert(released > 0, 'ownership clears at the end of the return');
            assert(Math.abs(frames[released].left - frames[released-1].left) < 2, 'cleanup must not jump to the native grid');
            assert(Math.abs(frames.at(-1).left - data.native.left) < 1, 'restore original native left edge');
            if (viewportWidth === 1440) assert.strictEqual(data.native.left, 310, 'exercise asymmetric 84px / 10px native side tracks');
        }
        const moving = frames.filter((f, i) => i && Math.abs(f.width - frames[i-1].width) >= 0.05);
        console.log(`Google AI Mode ${viewportWidth}px ${name}: ${moving.length} moving frames, last change at ${Math.round(moving.at(-1)?.time || 0)} ms`);
    }
}

module.exports = async function (chrome, temp, page) {
    await runMotion(chrome, temp, page, 2560);
    await runMotion(chrome, temp, page, 1440);
};
