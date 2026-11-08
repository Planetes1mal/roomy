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
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-message-width-'));
    const read = name => fs.readFileSync(path.join(repo, name), 'utf8');
    const script = source => `<script>${source.replace(/<\/script/gi, '<\\/script')}</script>`;
    const probe = process.argv.includes('--probe');
    const cases = ['baseline', 'response-content', 'anonymous', 'message-content', 'markdown',
        'tag-only', 'limited-parent', 'padded-body'];
    const fixture = name => {
        const limit = node => name === node ? 'style="max-width:760px"' : '';
        const tag = name === 'tag-only' ? 'conversation-container' : 'div';
        return `<section data-case="${name}" style="width:${name === 'limited-parent' ? 900 : 1800}px">
            <${tag} ${tag === 'div' ? 'class="conversation-container"' : ''}
                ${name === 'baseline' ? 'style="max-width:755px !important;color:rgb(1, 2, 3)"' : ''}>
                <user-query><div class="user-query-container"><user-query-content>
                    <div class="user-query-bubble-with-background">A short question</div>
                </user-query-content></div></user-query>
                <model-response><div><response-container><div class="response-container">
                <div class="presented-response-container"><div class="response-container-content">
                <div class="response-content" ${limit('response-content')}>
                <structured-content-container class="model-response-text"><div class="container">
                <div ${limit('anonymous')}><message-content class="message-content" ${limit('message-content')}>
                <div class="markdown markdown-main-panel" ${name === 'padded-body' ? 'style="padding:0 16px"' : limit('markdown')}>
                    <p data-text>Ordinary response text</p>
                    <img data-image width="2400" height="1" alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2400' height='1'/%3E">
                    <pre><code>${'long_code_without_spaces_'.repeat(150)}</code></pre>
                    <table-block><div class="table-block"><div class="table-content">
                        <table><tbody><tr><td>${'wide_table_cell_'.repeat(250)}</td></tr></tbody></table>
                    </div></div></table-block>
                    <div class="cdk-overlay-pane protected"><div role="dialog" class="protected">
                        <message-content class="overlay-body"><div class="markdown overlay-body">Nested dialog</div></message-content>
                    </div></div><div class="mat-menu-panel protected">
                        <div><div class="message-content overlay-body">Nested menu</div></div>
                    </div>
                </div></message-content></div></div></structured-content-container>
                </div></div></div></div></response-container></div></model-response>
            </${tag}>
            <input-container><button data-sources>Sources</button><input-area-v2>Composer
                <div class="upload-card" style="max-width:321px !important;width:500px">Attachment</div></input-area-v2>
            </input-container></section>`;
    };
    const generatedFixture = `<div class="conversation-container" data-generated>
        <model-response><response-container><message-content><div class="markdown">
            <div class="attachment-container generated-images"><response-element>
                <generated-image><single-image class="generated-image large luminous-layout">
                    <div class="image-container"><div class="overlay-container"><button class="image-button">
                        <img width="1024" height="572" alt=""
                            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='572'/%3E">
                    </button><div class="generated-image-controls"><button></button><button></button><button></button></div></div></div>
                </single-image></generated-image>
            </response-element></div>
            <div class="attachment-container"><response-element><pre><code>${'x'.repeat(300)}</code></pre></response-element></div>
            <table-block><div class="table-content"><table><tr><td></td></tr></table></div></table-block>
        </div></message-content></response-container></model-response>
    </div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        body { margin:0; }
        section { margin:auto; }
        conversation-container, user-query, user-query-content, model-response, response-container,
        structured-content-container, message-content, input-container, input-area-v2, table-block { display:block; }
        .conversation-container, conversation-container { max-width:760px; margin:auto; }
        .user-query-bubble-with-background { width:280px; max-width:280px; }
        .protected { width:600px; max-width:300px; }
        .overlay-body { width:600px; max-width:120px; }
        [data-sources] { width:280px; max-width:140px; }
        img { display:block; max-width:100%; }
        pre { margin:0; }
        table { min-width:3000px; }
        [data-generated] .attachment-container, [data-generated] generated-image { max-width:708px; }
        [data-generated] .generated-images { margin-inline:auto; }
        [data-generated] response-element { max-width:740px; }
        [data-generated] generated-image { display:block; }
        [data-generated] .image-button { display:block; width:100%; padding:0; border:0; }
        [data-generated] img { width:100%; height:auto; }
        [data-generated] .overlay-container { position:relative; }
        [data-generated] .generated-image-controls { position:absolute; top:12px; right:12px; display:flex; gap:8px; }
        [data-generated] .generated-image-controls button { width:36px; height:36px; padding:0; border:0; }
    </style><style>${read('src/content/gemini-content.css')}</style></head><body>
        ${cases.map(fixture).join('')}
        <div class="conversation-container" data-captions style="width:100%;margin:auto">
            <model-response><single-image style="display:block"><div class="image-button">
                <img width="240" height="1" alt="" style="display:block;margin:auto"
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='1'/%3E">
            </div><div class="hero-caption-row" style="width:100%;box-sizing:border-box;padding-left:13px !important">
                <span class="caption">Image caption</span>
            </div></single-image></model-response>
        </div>
        <div class="cdk-overlay-pane protected"><div role="dialog" class="protected">
            <message-content class="overlay-body"><div class="markdown overlay-body">Drive picker</div></message-content>
        </div></div>
        <div class="mat-menu-panel protected">Page menu</div>
        ${script(`
            window.settings = { chatWidthSetting:{value:700,unit:'px'}, userFullWidth:false, codeWrap:false };
            window.chrome = {
                runtime:{id:'width-regression',onMessage:{addListener(fn){window.deliver=fn;}}},
                storage:{sync:{get(keys,cb){cb(window.settings);}},onChanged:{addListener(fn){window.deliverStorage=fn;}}}
            };
        `)}${script(read('src/shared/sites.js'))}${script(read('src/shared/settings-utils.js'))}${script(read('src/content/gemini-content.js'))}
        ${script(`
            window.addEventListener('load', async () => {
                const width = node => node.getBoundingClientRect().width;
                const send = message => window.deliver(message, {}, () => {});
                const rows = [];
                const take = (setting, fullWidth, wrap, mode='extension') => {
                    for (const section of document.querySelectorAll('[data-case]')) {
                        const get = selector => section.querySelector(selector);
                        const table = get('.table-content');
                        const code = get('pre');
                        rows.push({name:section.dataset.case, setting, fullWidth, wrap, mode,
                            viewport:innerWidth, parent:width(section), response:width(get('[data-text]')),
                            body:width(get('.markdown')),
                            user:width(get('user-query')), bubble:width(get('.user-query-bubble-with-background')),
                            input:width(get('input-area-v2')), outerInput:width(get('input-container')),
                            sources:width(get('[data-sources]')), image:width(get('img')),
                            table:width(table), tableScroll:table.scrollWidth, tableOverflow:getComputedStyle(table).overflowX,
                            code:width(code), codeScroll:code.scrollWidth, codeWhiteSpace:getComputedStyle(code).whiteSpace,
                            protected:[...section.querySelectorAll('.protected')].map(width),
                            overlayContent:[...section.querySelectorAll('.overlay-body')].map(width)
                        });
                    }
                };
                for (const setting of [{value:700,unit:'px'}, {value:1600,unit:'px'},
                    {value:50,unit:'percent'}, {value:100,unit:'percent'}]) {
                    window.settings.chatWidthSetting = setting;
                    send({action:'updateWidthSetting',setting});
                    for (const enabled of [false,true]) {
                        window.settings.userFullWidth = enabled;
                        window.settings.codeWrap = enabled;
                        send({action:'updateUserFullWidth',enabled});
                        send({action:'updateCodeWrap',enabled});
                        take(setting, enabled, enabled);
                    }
                }
                const late = document.createElement('div');
                late.innerHTML = ${JSON.stringify(fixture('tag-only'))};
                const lateSection = late.firstElementChild;
                lateSection.dataset.case = 'late-tag-wrapper';
                lateSection.querySelector('.response-content').style.maxWidth = '760px';
                document.body.appendChild(lateSection);
                await new Promise(resolve => setTimeout(resolve, 0));
                take(window.settings.chatWidthSetting, true, true, 'late-insertion');
                if (${probe}) {
                    const setting = {value:1600,unit:'px'};
                    window.settings.chatWidthSetting = setting;
                    send({action:'updateWidthSetting',setting});
                    for (const [mode, css] of [
                        ['max-only','*{max-width:none!important;}'],
                        ['width-only','.chat-container,.message-content,textarea{width:100%!important;}'],
                        ['full','*{max-width:none!important;}.chat-container,.message-content,textarea{width:100%!important;}']
                    ]) {
                        const style=document.createElement('style');
                        style.textContent=css;
                        document.head.appendChild(style);
                        take(setting,true,true,mode);
                        style.remove();
                    }
                }
                const pageProtected = [...document.querySelectorAll('body > .protected, body > .protected .protected')].map(width);
                const pageOverlayContent = [...document.querySelectorAll('body > .protected .overlay-body')].map(width);
                const captions = [];
                for (const value of [1000, 1400]) {
                    const setting = {value,unit:'px'};
                    send({action:'updateWidthSetting',setting});
                    const host = document.querySelector('[data-captions]');
                    const measure = via => captions.push({value,via,
                        image:host.querySelector('img').getBoundingClientRect().left,
                        caption:host.querySelector('.caption').getBoundingClientRect().left});
                    measure('message');
                    window.deliverStorage({chatWidthSetting:{newValue:setting}},'sync');
                    measure('duplicate-storage');
                }
                window.deliverStorage({chatWidthSetting:{newValue:{value:1200,unit:'px'}}},'sync');
                const host = document.querySelector('[data-captions]');
                captions.push({value:1200,via:'storage-only',image:host.querySelector('img').getBoundingClientRect().left,
                    caption:host.querySelector('.caption').getBoundingClientRect().left});
                const baseline = document.querySelector('[data-case="baseline"]');
                const conversation = baseline.querySelector('.conversation-container');
                const drop = baseline.querySelector('.upload-card');
                const captionRow = host.querySelector('.hero-caption-row');
                send({action:'updateDensity',settings:{messageCompactness:30,messageFontSize:125}});
                send({action:'updateWidthEnabled',enabled:false});
                const paused = {
                    conversation:width(conversation), max:conversation.style.getPropertyValue('max-width'),
                    priority:conversation.style.getPropertyPriority('max-width'), color:conversation.style.color,
                    drop:drop.style.getPropertyValue('max-width'), dropPriority:drop.style.getPropertyPriority('max-width'),
                    captionPadding:captionRow.style.getPropertyValue('padding-left'),
                    captionPriority:captionRow.style.getPropertyPriority('padding-left'),
                    overflowX:getComputedStyle(document.documentElement).overflowX,
                    bubble:width(baseline.querySelector('.user-query-bubble-with-background')),
                    codeWrap:document.body.classList.contains('code-wrap-enabled'),
                    density:document.body.classList.contains('wider-gemini-density-enabled'),
                    font:document.body.classList.contains('wider-gemini-font-enabled')
                };
                send({action:'updateWidthSetting',enabled:true,setting:{value:900,unit:'px'}});
                const resumed = {conversation:width(conversation),
                    bubble:width(baseline.querySelector('.user-query-bubble-with-background'))};
                conversation.style.setProperty('max-width','810px','important');
                send({action:'updateWidthEnabled',enabled:false});
                const siteOwned = conversation.style.getPropertyValue('max-width');
                send({action:'updateCodeWrap',enabled:false});
                const imageHost = document.createElement('section');
                imageHost.innerHTML = ${JSON.stringify(generatedFixture)};
                document.body.appendChild(imageHost);
                const generated = [];
                const measureImage = setting => {
                    const image = imageHost.querySelector('img');
                    const code = imageHost.querySelector('pre');
                    const table = imageHost.querySelector('.table-content');
                    generated.push({setting, viewport:innerWidth, available:width(imageHost),
                        image:width(image), height:image.getBoundingClientRect().height,
                        imageLeft:image.getBoundingClientRect().left,
                        bodyLeft:imageHost.querySelector('.markdown').getBoundingClientRect().left,
                        controls:[...imageHost.querySelectorAll('.generated-image-controls button')].map(button => {
                            const r=button.getBoundingClientRect();
                            const imageRect=image.getBoundingClientRect();
                            return [r.left-imageRect.left,r.top-imageRect.top,r.width,r.height];
                        }),
                        attachment:width(imageHost.querySelector('.generated-images')),
                        component:width(imageHost.querySelector('generated-image')),
                        body:width(imageHost.querySelector('.markdown')), code:width(code),
                        codeScroll:code.scrollWidth, table:width(table), tableScroll:table.scrollWidth});
                };
                await imageHost.querySelector('img').decode();
                measureImage('native');
                for (const setting of [{value:1000,unit:'px'}, {value:2000,unit:'px'}, {value:90,unit:'percent'}]) {
                    send({action:'updateWidthSetting',enabled:true,setting});
                    measureImage(setting);
                }
                send({action:'updateWidthEnabled',enabled:false});
                measureImage('paused');
                const output=document.createElement('pre');
                output.id='results';
                output.textContent=JSON.stringify({rows,pageProtected,pageOverlayContent,captions,paused,resumed,siteOwned,generated});
                document.body.appendChild(output);
            });
        `)}</body></html>`;
    const file = path.join(temp, 'fixture.html');
    fs.writeFileSync(file, html);
    const runChrome = (profile, size = '2000,1200') => spawnSync(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check',
        '--disable-extensions', `--window-size=${size}`, `--user-data-dir=${path.join(temp, profile)}`,
        '--dump-dom', '--virtual-time-budget=1000', pathToFileURL(file).href],
    { encoding:'utf8', windowsHide:true, timeout:90000, maxBuffer:4 * 1024 * 1024 });
    let result = runChrome('profile');
    if (result.error && result.error.code === 'ETIMEDOUT') {
        console.error('Chrome timed out; retrying once with a fresh profile.');
        result = runChrome('profile-retry');
    }
    const match = result.stdout?.match(/<pre id="results">([^<]+)<\/pre>/);
    if (result.error || !match) {
        console.error(`Chrome report failure: status=${result.status}, signal=${result.signal}`);
        console.error(`stdout (first 1000 chars): ${result.stdout?.slice(0, 1000) || '(empty)'}`);
        console.error(`stderr (first 2000 chars): ${result.stderr?.slice(0, 2000) || '(empty)'}`);
    }
    if (result.error) throw result.error;
    assert(match, `No browser report (${result.status})`);
    const report = JSON.parse(match[1]);
    fs.writeFileSync(path.join(temp, 'results.json'), JSON.stringify(report, null, 4));
    console.log(`Synthetic fixture and measurements: ${temp}`);
    if (probe) {
        console.table(report.rows.filter(row => ['max-only','width-only','full'].includes(row.mode)).map(row => ({
            case:row.name, mode:row.mode, response:row.response, input:row.input, image:row.image,
            nestedDialog:row.protected[1], sources:row.sources
        })));
        return;
    }
    const failures = [];
    const check = (row, key, expected) => {
        if (Math.abs(row[key] - expected) > 1) {
            failures.push(`${row.name} ${row.setting.value}${row.setting.unit} full=${row.fullWidth}: ` +
                `${key}=${row[key]}, expected ${expected}`);
        }
    };
    for (const row of report.rows) {
        const requested = row.setting.unit === 'px' ? row.setting.value : row.viewport * row.setting.value / 100;
        const expected = Math.min(requested, row.parent);
        for (const key of ['body', 'user', 'input']) check(row, key, expected);
        const content = expected - (row.name === 'padded-body' ? 32 : 0);
        for (const key of ['response', 'image', 'table', 'code']) check(row, key, content);
        check(row, 'bubble', row.fullWidth ? expected : 280);
        check(row, 'outerInput', row.parent);
        check(row, 'sources', 140);
        assert.deepStrictEqual(row.protected, [300,300,300], `${row.name}: nested overlay/menu changed`);
        assert.deepStrictEqual(row.overlayContent, [120,120,120], `${row.name}: overlay content changed`);
        assert(row.tableScroll > row.table && row.tableOverflow === 'auto', `${row.name}: table lost scrolling`);
        assert.strictEqual(row.codeWhiteSpace, row.wrap ? 'pre-wrap' : 'pre');
        assert(row.wrap ? row.codeScroll <= row.code + 1 : row.codeScroll > row.code,
            `${row.name}: code wrapping/scrolling behavior changed`);
    }
    assert.deepStrictEqual(report.pageProtected, [300,300,300], 'Page overlay/menu changed');
    assert.deepStrictEqual(report.pageOverlayContent, [120,120], 'Page overlay content changed');
    for (const caption of report.captions) {
        assert(Math.abs(caption.image - caption.caption) <= 1,
            `Image caption misaligned after ${caption.via} at ${caption.value}px`);
    }
    assert.deepStrictEqual(report.paused, {
        conversation:755, max:'755px', priority:'important', color:'rgb(1, 2, 3)',
        drop:'321px', dropPriority:'important', captionPadding:'13px', captionPriority:'important',
        overflowX:'visible', bubble:280, codeWrap:true, density:true, font:true
    }, 'pause must restore native styles and priorities while retaining reading settings');
    assert.deepStrictEqual(report.resumed, {conversation:900,bubble:900}, 'resume restores width and bubble preference');
    assert.strictEqual(report.siteOwned, '810px', 'pause must not overwrite a newer native inline value');
    assert.strictEqual(failures.length, 0, `Width regressions:\n${failures.join('\n')}`);
    const imageReports = [report];
    for (const size of ['1470,956', '2560,1440']) {
        const result = runChrome(`images-${size}`, size);
        if (result.error) throw result.error;
        const match = result.stdout?.match(/<pre id="results">([^<]+)<\/pre>/);
        assert(match, `No generated-image browser report at ${size} (${result.status})`);
        const measured = JSON.parse(match[1]);
        fs.writeFileSync(path.join(temp, `images-${size}.json`), JSON.stringify(measured.generated, null, 4));
        assert(Math.abs(measured.generated[0].viewport - Number(size.split(',')[0])) <= 40,
            `actual image test viewport ${measured.generated[0].viewport} for window ${size}`);
        imageReports.push(measured);
    }
    for (const {generated} of imageReports) {
        const nativeImage = generated[0];
        assert.strictEqual(nativeImage.image, 708, 'captured native generated image width');
        assert(Math.abs(nativeImage.imageLeft-nativeImage.bodyLeft-(nativeImage.body-nativeImage.image)/2) <= 1,
            'native generated image is centered');
        for (const row of generated.slice(1)) {
            for (const key of ['image', 'height', 'attachment', 'component']) {
                assert(Math.abs(row[key] - nativeImage[key]) <= 1,
                    `Generated image ${JSON.stringify(row.setting)} at ${row.viewport}px: ${key}=${row[key]}, native=${nativeImage[key]}`);
            }
            assert.deepStrictEqual(row.controls, nativeImage.controls, 'image controls must keep their size and position relative to the image');
            if (row.setting === 'paused') {
                assert(Math.abs(row.imageLeft-nativeImage.imageLeft) <= 1, 'pause restores native image centering');
                continue;
            }
            assert(Math.abs(row.imageLeft-row.bodyLeft) <= 1,
                `Generated image must align with prose: imageLeft=${row.imageLeft}, bodyLeft=${row.bodyLeft}`);
            const requested = row.setting.unit === 'px' ? row.setting.value : row.viewport * row.setting.value / 100;
            const expected = Math.min(requested, row.available);
            for (const key of ['body', 'code', 'table']) {
                assert(Math.abs(row[key] - expected) <= 1, `Generated image sibling ${key} did not widen`);
            }
            assert(row.codeScroll > row.code && row.tableScroll > row.table, 'wide siblings must retain scrolling');
        }
    }
    console.log(`Passed ${report.rows.length} message-width scenarios, plus pause/resume and inline restoration.`);
    console.log('Passed generated-image native size, wide code/table siblings, and pause restoration.');
})();
