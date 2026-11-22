// Exercise the content scripts' mutation observers while a reader is partway through a long answer.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const repo = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(repo, name), 'utf8');
const registry = vm.runInNewContext(read('src/shared/sites.js') + '\nwiderRoomySites');
const script = source => '<script>' + source.replace(/<\/script/gi, '<\\/script') + '</script>';

function page(site, reverse = false) {
    let html;
    if (site === 'gemini') {
        html = '<!doctype html><html><head></head><body><chat-window><infinite-scroller class="chat-history" data-scroll>' +
            '<div class="conversation-container"><model-response><message-content><div class="markdown" data-answer></div>' +
            '</message-content></model-response></div></infinite-scroller></chat-window></body></html>';
    } else if (site === 'chatgpt') {
        html = '<!doctype html><html><head></head><body><main><div data-app-action-timeline-scroll data-scroll>' +
            '<div data-thread-user-message-navigation-content class="max-w-(--thread-body-max-width)">' +
            '<section data-turn="assistant"><div data-markdown-text-style="assistant-message" data-answer><p>Seed</p></div>' +
            '</section></div></div></main></body></html>';
    } else {
        html = read('tests/e2e/fixtures/' + site + '/page.html');
    }
    const store = site === 'gemini' ? { messageFontSize: 200, messageCompactness: 100 }
        : { [registry.getStorageKeys(site).reading]: { messageFontSize: 200, messageCompactness: 100 } };
    const harness = script('window.chrome = { runtime:{ id:"reading-scroll", onMessage:{ addListener(){} } },' +
        'i18n:{ getMessage(){return "";} }, storage:{sync:{get(keys,cb){cb(' + JSON.stringify(store) +
        ');}},onChanged:{addListener(){}}} };');
    const extension = registry.getContentScript(site);
    const styles = extension.css.map(file => '<style>' + read(file) + '</style>').join('');
    const layout = '<style>body{margin:0}.home[hidden]{display:none}chat-window,model-response,message-content{display:block}' +
        '[data-scroll]{display:flex;flex-direction:' + (reverse ? 'column-reverse' : 'column') +
        ';height:80vh;overflow:auto}[data-scroll]>div{flex:none;width:min(900px,100%)}' +
        '[data-answer] p,[data-probe="markdown"] p{font:16px/24px sans-serif;margin:8px 0}</style>';
    const sources = extension.js.map(file => script(read(file))).join('');
    const run = 'window.addEventListener("load",()=>(' + scenario.toString() + ')(' + reverse + '));';
    return html.replace('</head>', () => layout + styles + '</head>')
        .replace('</body>', () => harness + sources + script(run) + '</body>');
}

async function scenario(reverse) {
    const scroller = document.querySelector('[data-scroll],[data-probe="scroll"]');
    const answer = document.querySelector('[data-answer],[data-probe="markdown"]');
    const wait = () => new Promise(resolve => setTimeout(resolve, 40));
    const paragraph = () => {
        const p = document.createElement('p');
        p.textContent = 'A synthetic sentence for testing reading position. '.repeat(6);
        return p;
    };
    const report = document.createElement('pre');
    report.id = 'reading-scroll-report';
    try {
        answer.append(...Array.from({ length: 160 }, paragraph));
        // Reserve space for the incoming blocks. This isolates movement caused by measuring
        // typography from the site's legitimate scroll anchoring when an answer grows.
        const slot = document.createElement('div');
        slot.style.cssText = 'height:240px;overflow:hidden';
        answer.append(slot);
        await wait();
        const oldParagraphs = [...scroller.querySelectorAll('p')];
        const rows = [];
        for (const [anchor, behavior] of [['none', 'auto'], ['auto', 'auto'], ['none', 'smooth']]) {
            scroller.style.overflowAnchor = anchor;
            scroller.style.scrollBehavior = behavior;
            for (const fraction of [0.8, 1]) {
                const distance = (scroller.scrollHeight - scroller.clientHeight) * fraction;
                scroller.scrollTo({ top: reverse ? -distance : distance, behavior: 'instant' });
                await wait();
                const viewport = scroller.getBoundingClientRect();
                const readingAnchor = oldParagraphs.find(node => {
                    const rect = node.getBoundingClientRect();
                    const top = Math.max(rect.top, viewport.top);
                    const bottom = Math.min(rect.bottom, viewport.bottom);
                    return top < bottom && node.contains(document.elementFromPoint(
                        rect.left + rect.width / 2, (top + bottom) / 2));
                });
                if (!readingAnchor) throw new Error('No previously rendered paragraph is visible at offset ' + scroller.scrollTop);
                const anchorY = () => {
                    if (!scroller.contains(readingAnchor)) throw new Error('The visible paragraph was removed');
                    return readingAnchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
                };
                const before = scroller.scrollTop;
                const yBefore = anchorY();
                const p = paragraph();
                slot.replaceChildren(p);
                // Mutation observers run before the next task. Check both the immediate and settled offset.
                await new Promise(resolve => setTimeout(resolve, 0));
                const after = scroller.scrollTop;
                const yAfter = anchorY();
                await wait();
                rows.push({ anchor, behavior, fraction, before, delta: after - before, settled: scroller.scrollTop - before,
                    anchorDelta: yAfter - yBefore, anchorSettled: anchorY() - yBefore,
                    font: parseFloat(getComputedStyle(p).fontSize) });
            }
        }
        report.textContent = JSON.stringify({ viewport: [innerWidth, innerHeight], rows });
    } catch (error) {
        report.textContent = JSON.stringify({ error: String(error) });
    }
    document.body.append(report);
}

function main() {
    const chrome = process.env.WG_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-reading-scroll-'));
    try {
        for (const name of ['gemini', 'chatgpt', 'chatgpt-reverse', 'claude', 'deepseek']) {
            const reverse = name === 'chatgpt-reverse';
            const file = path.join(dir, name + '.html');
            fs.writeFileSync(file, page(reverse ? 'chatgpt' : name, reverse));
            const result = spawnSync(chrome, ['--headless=new', '--disable-extensions', '--no-first-run',
                '--no-default-browser-check', '--window-size=2560,1440', '--user-data-dir=' + path.join(dir, 'profile'),
                '--dump-dom', '--virtual-time-budget=5000', pathToFileURL(file).href],
            { encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
            if (result.error) throw result.error;
            assert.equal(result.status, 0, result.stderr);
            const match = result.stdout.match(/<pre id="reading-scroll-report">([^<]+)<\/pre>/);
            assert.ok(match, name + ': no scroll measurements');
            const data = JSON.parse(match[1]);
            assert.ok(!data.error, data.error);
            assert.equal(data.rows.length, 6, name + ': expected six scroll scenarios');
            for (const row of data.rows) {
                const context = name + ' ' + JSON.stringify(row);
                assert.ok((reverse ? -row.before : row.before) > 1500, context);
                assert.equal(row.font, 32, context);
                assert.ok(Math.abs(row.delta) <= 1 && Math.abs(row.settled) <= 1, context);
                assert.ok(Math.abs(row.anchorDelta) <= 1 && Math.abs(row.anchorSettled) <= 1, context);
            }
            console.log(name + ': ' + data.rows.length + ' scroll positions passed');
        }
    } finally {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
}

if (require.main === module) main();
module.exports = { page };
