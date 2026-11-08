(function () {
    'use strict';

    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const { spawn } = require('child_process');
    const { pathToFileURL } = require('url');
    const root = path.resolve(__dirname, '../..');
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-performance-'));
    const samples = Number(process.argv[3] || 5);
    const output = path.resolve(process.argv[2] || path.join(temporary, 'results.json'));
    const chrome = process.env.WG_CHROME || (process.platform === 'win32'
        ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
    const profile = path.join(temporary, 'profile');
    const script = source => `<script>${source.replace(/<\/script/gi, '<\\/script')}</script>`;
    const read = name => fs.readFileSync(path.join(root, name), 'utf8');

    const turn = index => `<article><user-query><user-query-content>Question ${index}</user-query-content></user-query>
        <model-response><response-container><div class="response-container-content"><message-content>
        <div class="markdown"><p>Example ${index}. ${'A synthetic sentence for comparable reading layout. '.repeat(8)}</p>
        <pre><code>${'const example = syntheticValue; '.repeat(12)}</code></pre>
        <table><tbody><tr><td>Input ${index}</td><td>Output ${index}</td><td>Explanation</td></tr></tbody></table>
        </div></message-content></div></response-container></model-response></article>`;

    function fixture(count, enabled) {
        return `<!doctype html><html><head><meta charset="utf-8"><style>
            body{margin:0;font:17px/1.5 Arial,sans-serif}.chat-container{width:1400px;margin:auto}
            .conversation-container{max-width:1000px;margin:auto}article{margin-bottom:24px}
            user-query,user-query-content,model-response,response-container,message-content,input-container,input-area-v2{display:block}
            input-area-v2{height:60px}p{margin:8px 0}pre{overflow:auto}table{border-collapse:collapse}td{padding:4px 16px}
            single-image{display:block}.image-button img{display:block;width:240px;height:100px;margin:auto}
            .hero-caption-row{box-sizing:border-box;width:100%}.caption{display:inline-block}
        </style>${enabled ? `<style>${read('src/content/gemini-content.css')}</style>` : ''}</head><body>
        <div class="chat-container"><div class="conversation-container" id="conversation">
        ${Array.from({ length: count }, (_, index) => turn(index)).join('')}
        <model-response><single-image><div class="image-button"><img alt="Synthetic image" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='100'/%3E"></div>
        <div class="hero-caption-row"><span class="caption">Synthetic caption</span></div></single-image></model-response>
        </div><input-container><input-area-v2>Input</input-area-v2></input-container></div>
        ${script(`
            window.__counts={storageReads:0,observerCallbacks:0};
            const NativeObserver=window.MutationObserver;
            window.MutationObserver=class extends NativeObserver {
                constructor(callback){super((...args)=>{window.__counts.observerCallbacks++;callback(...args);});}
            };
            window.__settings={chatWidthSetting:{value:1000,unit:'px'},codeWrap:false,userFullWidth:false};
            window.chrome={runtime:{id:'synthetic-baseline',onMessage:{addListener(fn){window.__deliver=fn;}}},
                storage:{sync:{get(keys,callback){window.__counts.storageReads++;queueMicrotask(()=>callback(window.__settings));}},
                onChanged:{addListener(){}}}};
            window.__frames=async count=>{for(let i=0;i<count;i++)await new Promise(requestAnimationFrame);};
        `)}${enabled ? script(read('src/shared/sites.js')) + script(read('src/shared/settings-utils.js')) + script(read('src/content/gemini-content.js')) : ''}
        ${script(`
            addEventListener('load',async()=>{await window.__frames(2);window.__firstSettledMs=performance.now();window.__ready=true;});
            window.__append=async()=>{
                document.getElementById('conversation').insertAdjacentHTML('beforeend',${JSON.stringify(Array.from({ length: 20 }, (_, index) => turn(1000 + index)).join(''))});
                await window.__frames(2);
            };
            window.__drag=async()=>{
                const chat=document.querySelector('.chat-container');chat.classList.add('xap-drag-in-progress');
                document.dispatchEvent(new Event('dragenter',{bubbles:true}));
                await window.__frames(30);
                chat.classList.remove('xap-drag-in-progress');document.dispatchEvent(new Event('drop',{bubbles:true}));
                await new Promise(resolve=>setTimeout(resolve,250));await window.__frames(2);
            };
            window.__caption=()=>{const image=document.querySelector('single-image img');const caption=document.querySelector('.caption');
                return {imageLeft:image.getBoundingClientRect().left,captionLeft:caption.getBoundingClientRect().left,
                    padding:document.querySelector('.hero-caption-row').style.paddingLeft};};
        `)}</body></html>`;
    }

    const child = spawn(chrome, ['--headless=new', '--remote-debugging-pipe', '--disable-extensions',
        '--disable-background-networking', '--no-first-run', '--no-default-browser-check',
        '--window-size=1600,1000', `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'], windowsHide: true });
    const closed = new Promise(resolve => child.once('close', resolve));
    const pending = new Map();
    let buffer = '';
    let serial = 0;
    child.stdio[4].on('data', chunk => {
        buffer += chunk.toString();
        let separator;
        while ((separator = buffer.indexOf('\0')) >= 0) {
            const message = JSON.parse(buffer.slice(0, separator));
            buffer = buffer.slice(separator + 1);
            const request = pending.get(message.id);
            if (!request) continue;
            clearTimeout(request.timer);
            pending.delete(message.id);
            message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
        }
    });
    function send(method, params = {}, sessionId) {
        return new Promise((resolve, reject) => {
            const id = ++serial;
            const timer = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 15000);
            pending.set(id, { resolve, reject, timer });
            child.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
        });
    }
    async function evaluate(sessionId, expression) {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
    }
    async function metrics(sessionId) {
        const result = await send('Performance.getMetrics', {}, sessionId);
        return Object.fromEntries(result.metrics.map(metric => [metric.name, metric.value]));
    }
    function delta(before, after) {
        return Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration']
            .map(key => [key + 'Ms', Number(((after[key] - (before[key] || 0)) * 1000).toFixed(3))]));
    }

    (async () => {
        const results = { browser: await send('Browser.getVersion'), node: process.version,
            platform: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0].model, samples,
            conditions: '1600x1000; 100/500 turns; +20 turns in one batch; drag class active for 30 animation frames; no network or extension installation',
            rows: [], captionProbe: null };
        try {
            for (const count of [100, 500]) {
                for (let sample = -1; sample < samples; sample++) {
                    const order = sample % 2 ? [true, false] : [false, true];
                    for (const enabled of order) {
                        const file = path.join(temporary, `${count}-${enabled}.html`);
                        fs.writeFileSync(file, fixture(count, enabled));
                        const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
                        const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
                        await send('Performance.enable', {}, sessionId);
                        await send('Page.navigate', { url: pathToFileURL(file).href }, sessionId);
                        for (let attempt = 0; attempt < 100; attempt++) {
                            if (await evaluate(sessionId, 'window.__ready === true')) break;
                            await new Promise(resolve => setTimeout(resolve, 20));
                            if (attempt === 99) throw new Error('Fixture did not become ready');
                        }
                        const ready = await metrics(sessionId);
                        const initial = await evaluate(sessionId, '({settledMs:window.__firstSettledMs,counts:{...window.__counts},nodes:document.querySelectorAll("*").length})');
                        await evaluate(sessionId, 'window.__append()');
                        const appended = await metrics(sessionId);
                        const appendCounts = await evaluate(sessionId, '({...window.__counts})');
                        await evaluate(sessionId, 'window.__drag()');
                        const dragged = await metrics(sessionId);
                        const dragCounts = await evaluate(sessionId, '({...window.__counts})');
                        if (sample >= 0) results.rows.push({ count, enabled, sample: sample + 1,
                            initial: { ...delta({}, ready), ...initial, heapMiB: Number((ready.JSHeapUsedSize / 1048576).toFixed(2)) },
                            append: { ...delta(ready, appended), storageReads: appendCounts.storageReads - initial.counts.storageReads,
                                observerCallbacks: appendCounts.observerCallbacks - initial.counts.observerCallbacks },
                            drag: { ...delta(appended, dragged), storageReads: dragCounts.storageReads - appendCounts.storageReads,
                                observerCallbacks: dragCounts.observerCallbacks - appendCounts.observerCallbacks } });
                        if (enabled && count === 100 && sample === -1) {
                            const before = await evaluate(sessionId, 'window.__caption()');
                            await evaluate(sessionId, `window.__settings.chatWidthSetting={value:1400,unit:'px'};window.__deliver({action:'updateWidthSetting',setting:window.__settings.chatWidthSetting},{},()=>{});window.__frames(2)`);
                            results.captionProbe = { before, after: await evaluate(sessionId, 'window.__caption()') };
                        }
                        await send('Target.closeTarget', { targetId });
                    }
                }
            }
            fs.mkdirSync(path.dirname(output), { recursive: true });
            fs.writeFileSync(output, JSON.stringify(results, null, 2));
            console.log(`Saved ${results.rows.length} measured pages to ${output}`);
            console.log(`Caption probe: ${JSON.stringify(results.captionProbe)}`);
            console.log(`Synthetic fixtures: ${temporary}`);
        } finally {
            await send('Browser.close').catch(() => child.kill());
            await closed;
            if (path.dirname(path.resolve(profile)) !== path.resolve(temporary)) throw new Error('Unexpected profile path');
            fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        }
    })().catch(error => { console.error(error.stack); process.exitCode = 1; });
})();
