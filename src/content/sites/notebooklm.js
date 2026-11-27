(function () {
    'use strict';

    const selectors = {
        pane: 'notebook chat-panel',
        transcript: '.chat-panel-content',
        pair: '.chat-message-pair',
        overview: ':scope > chat-panel-header, :scope > .chat-panel-empty-state, :scope > chat-panel-zero-state',
        footer: 'omnibar .omnibar-container',
        userText: 'chat-message .from-user-container .message-text-content',
        markers: 'notebook, chat-panel, .chat-panel-content, .chat-message-pair, chat-panel-header, ' +
            '.chat-panel-empty-state, chat-panel-zero-state, .omnibar-container, query-box, .from-user-container'
    };

    window.widerRoomyCore.defineSite({
        id: 'notebooklm',
        selectors,
        discover(ctx) {
            const pane = ctx.findVisible(selectors.pane);
            if (!pane) return { kind: 'notApplicable' };
            const scroll = ctx.findVisible(selectors.transcript, pane);
            const footer = ctx.findVisible(selectors.footer, pane);
            if (!scroll || !footer) return { kind: 'unknown' };
            const pair = ctx.findVisible(selectors.pair, scroll);
            const column = pair || ctx.findVisible(selectors.overview, scroll);
            if (!column) return { kind: 'unknown' };
            // Each pair has identical horizontal bounds. Use one for rail placement,
            // and the whole transcript for turn discovery as older history is prepended.
            return { kind: pair ? 'chat' : 'home', root: scroll, column, scroll, footer, pane,
                widthOwners: [{ element: pane, strategy: 'variable' }] };
        },
        turns(surface) {
            return Array.from(surface.root.querySelectorAll(selectors.userText), element => ({
                element, text: element.textContent.replace(/\s+/g, ' ').trim()
            }));
        },
        navigation: { topInset: 8, bottomInset: 8, scrollInset: 16 },
        // NotebookLM replaces the pane when switching between columns and tabs.
        watch: { markers: selectors.markers, beforePaint: true }
    });
})();
