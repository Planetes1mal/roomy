module.exports.pageScenario = `
    window.addEventListener('load', async () => {
        const q = selector => document.querySelector(selector);
        const rect = selector => q(selector).getBoundingClientRect();
        const wait = () => new Promise(resolve => setTimeout(resolve, 120));
        const keys = widerGeminiSettings.getSiteKeys('notebooklm');
        async function save(key, value) {
            window.store[key] = value;
            window.deliverStorage({ [key]: { newValue: value } }, 'sync');
            await wait();
        }
        const width = (value, unit = 'px') => save(keys.width, { widthEnabled: true, chatWidthSetting: { value, unit } });
        const status = () => {
            let result;
            window.deliver({action:'getLayoutStatus'}, {}, value => { result = value; });
            return result;
        };
        const measure = () => ({
            viewport: document.documentElement.clientWidth, window: innerWidth, pane: rect('chat-panel').width,
            source: rect('.source-panel').width, studio: rect('.studio-panel').width,
            pair: rect('.chat-message-pair').width, body: rect('.to-user-message-inner-content .message-text-content').width,
            header: rect('chat-panel-header').width, summary: rect('.chat-panel-empty-state').width,
            date: rect('.date-separator').width,
            input: rect('query-box').width, inputLeft: rect('query-box').left, messageLeft: rect('chat-message').left,
            table: q('table-element-view').clientWidth, tableScroll: q('table-element-view').scrollWidth,
            ticks: document.querySelectorAll('.wg-nav:not([hidden]) .wg-nav-tick').length,
            overflow: document.documentElement.scrollWidth - innerWidth
        });
        const railCount = () => document.querySelectorAll('.wg-nav:not([hidden])').length;
        try {
            await wait();
            const out = { native: measure() };
            await width(1000);
            out.enabled = measure();
            out.reading = status().capabilities.reading;
            const scroll = q('.chat-panel-content');
            scroll.prepend(makePair('What is the original configuration?'));
            scroll.append(makePair('What can be ruled out?'));
            await wait();
            q('.wg-nav-list button:nth-child(3)').click();
            await wait();
            const thirdQuestion = scroll.querySelectorAll('.from-user-container .message-text-content')[2];
            out.jump = thirdQuestion.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
            out.updated = measure();
            await save(keys.navigation, false);
            out.navOff = railCount();
            await save(keys.navigation, true);
            await width(70, 'percent');
            out.capped = measure();
            const notebook = q('notebook');
            notebook.style.setProperty('--left', '56px');
            notebook.style.setProperty('--right', '56px');
            await wait();
            status();
            out.wide = measure();
            notebook.style.setProperty('--right', '38%');
            await wait();
            status();
            out.viewer = measure();
            await save(keys.enabled, false);
            out.paused = measure();
            await save(keys.enabled, true);
            delete window[widerRoomySites.CORE_LOADED_FLAG];
            delete window.widerRoomyCore;
            new Function(window.coreSources)();
            await wait();
            out.takeover = [contexts.length, contexts[0].retired, railCount()];
            const footer = q('.omnibar-container');
            footer.classList.remove('omnibar-container');
            await wait();
            const unknown = status();
            await wait();
            out.unknown = [unknown.surface.kind, unknown.width.active, railCount()];
            footer.classList.add('omnibar-container');
            await wait();
            out.recovered = status().width.active;
            // Crossing the desktop breakpoint replaces the chat pane. Check the
            // mutation delivery itself, before a frame, timer or status read can help.
            const oldPane = q('chat-panel');
            const tabs = document.createElement('div');
            const replacement = oldPane.cloneNode(true);
            replacement.removeAttribute('data-wgx-width');
            replacement.removeAttribute('style');
            const transcript = replacement.querySelector('.chat-panel-content');
            transcript.querySelectorAll('.chat-message-pair').forEach(pair => pair.remove());
            tabs.style.width = '944px';
            tabs.append(replacement);
            oldPane.parentElement.replaceWith(tabs);
            await Promise.resolve();
            out.overviewFirst = [replacement.getAttribute('data-wgx-width'), rect('chat-panel-header').width,
                rect('.chat-panel-empty-state').width, rect('query-box').width];
            transcript.append(makePair('Which constraint is still untested?'));
            await Promise.resolve();
            out.remounted = [rect('.chat-message-pair').width, rect('chat-panel-header').width];
            notebook.remove();
            await wait();
            out.home = [status().surface.kind, status().width.active, railCount()];
            report(out);
        } catch (error) { report({ error: String(error.stack || error) }); }
    });
`;

module.exports.check = (r, expected, { assert, near }) => {
    near(r.native.pair, Math.min(756, r.native.pane - 16), 'native message cap', 1);
    near(r.native.input, 628, 'native input');
    near(r.enabled.source, r.native.source, 'source panel stays native');
    near(r.enabled.studio, r.native.studio, 'Studio stays native');
    for (const [state, requested] of [[r.enabled, 1000], [r.capped, r.capped.window * .7],
        [r.wide, r.wide.window * .7], [r.viewer, r.viewer.window * .7]]) {
        near(state.pair, Math.min(requested, state.pane - 48), 'requested width capped to the chat pane', 1);
        near(state.input, state.pair - 48, 'input aligns with inner message column');
        near(state.inputLeft, state.messageLeft, 'input and messages share a left edge');
        near(state.body, state.pair - 58, 'answer expands beyond its native inner cap');
        near(state.header, state.pair, 'overview title follows the message column');
        near(state.summary, state.pair, 'overview summary follows the message column');
        assert.strictEqual(state.overflow, 0);
        assert.strictEqual(state.tableScroll, Math.max(state.table, 850), 'table scrolls within the answer');
    }
    assert.strictEqual(r.reading, 'notApplicable');
    assert.strictEqual(r.enabled.ticks, 3);
    assert.strictEqual(r.updated.ticks, 5, 'both prepended history and the new turn have ticks');
    near(r.jump, 16, 'navigation jumps inside the transcript', 2);
    assert.strictEqual(r.navOff, 0);
    near(r.paused.input, r.native.input, 'pause restores native input width');
    near(r.paused.header, r.native.header, 'pause restores the native header limit');
    near(r.paused.summary, r.native.summary, 'pause restores the native summary limit');
    near(r.enabled.date, r.native.date, 'the native date row still spans the transcript');
    assert.strictEqual(r.paused.ticks, 0);
    assert.deepStrictEqual(r.takeover, [2, true, 1]);
    assert.deepStrictEqual(r.unknown, ['unknown', false, 0]);
    assert.strictEqual(r.recovered, true);
    assert.deepStrictEqual(r.overviewFirst, ['variable', 896, 896, 848], 'overview and composer fit the new pane before messages mount');
    assert.deepStrictEqual(r.remounted, [896, 896], 'the first question inherits the current width at insertion');
    assert.deepStrictEqual(r.home, ['notApplicable', false, 0]);
};
