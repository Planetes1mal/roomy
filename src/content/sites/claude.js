(function () {
    'use strict';

    const selectors = {
        scroll: '[data-autoscroll-container]',
        chatColumn: '[data-testid="chat-column"]',
        transcript: '[data-testid="transcript-list"]',
        footer: '[data-chat-input-container]',
        chatBody: '[data-testid="chat-column-body"]',
        turn: '[data-turn-key]',
        userMessage: '[data-testid="user-message"]',
        assistantMessage: '[data-testid="assistant-message"]',
        assistantBody: '[data-testid="assistant-message"] :is(.standard-markdown, .prose)',
        messageActions: '[data-testid="message-actions"], [data-testid="user-message-actions"]',
        editor: '[data-testid="chat-input"]',
        homeSlot: '[data-chorus-card-slot]',
        markers: '[data-testid="chat-column"], [data-testid="transcript-list"], [data-autoscroll-container], ' +
            '[data-chat-input-container], [data-testid="chat-column-body"], [data-chorus-card-slot], ' +
            '[data-testid="transcript-row"], [data-testid="chat-input"], main'
    };

    window.widerRoomyCore.defineSite({
        id: 'claude',
        selectors,
        discover(ctx) {
            const transcript = ctx.findVisible(selectors.transcript);
            if (transcript) {
                const column = transcript.closest(selectors.chatColumn);
                const scroll = transcript.closest(selectors.scroll) || ctx.scrollOwner(transcript, document.body) ||
                    transcript.parentElement;
                const footer = column ? ctx.findVisible(selectors.footer, column) : null;
                return {
                    kind: 'chat', root: transcript, column: transcript, scroll, footer,
                    pane: column ? column.parentElement : scroll,
                    widthOwners: column ? [{ element: column, strategy: 'variable' }] : []
                };
            }
            const editor = ctx.findVisible(selectors.editor);
            if (editor) {
                const slot = editor.closest(selectors.homeSlot);
                let owner = null;
                for (let el = editor; slot && el && el !== slot; el = el.parentElement) {
                    if (el.parentElement === slot) owner = el;
                }
                if (owner && slot.parentElement) {
                    return { kind: 'home', root: null, pane: slot.parentElement, widthOwners: [{ element: owner, strategy: 'maxWidth' }] };
                }
            }
            const chatShell = ctx.findVisible(selectors.chatBody) || ctx.findVisible(selectors.scroll);
            return { kind: chatShell ? 'unknown' : 'notApplicable', root: null, widthOwners: [] };
        },
        reading: {
            assistantRoot: selectors.assistantBody,
            userBubble: selectors.userMessage,
            exclude: `${selectors.messageActions}, .sr-only`
        },
        turnKey: element => {
            const owner = element.closest(selectors.turn);
            return owner ? owner.getAttribute('data-turn-key') : null;
        },
        navigation: { topInset: 56, bottomInset: 8, scrollInset: 72 },
        watch: {
            markers: selectors.markers,
            attributes: ['data-testid', 'data-is-streaming', 'data-chat-hidden', 'data-turn-key', 'data-autoscroll-container',
                'data-chat-input-container', 'data-chorus-card-slot']
        }
    });
})();
