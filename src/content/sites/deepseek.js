(function () {
    'use strict';

    const selectors = {
        scroll: '.ds-virtual-list',
        list: '.ds-virtual-list-items',
        column: '.ds-virtual-list-visible-items',
        message: '.ds-message',
        assistantBody: '.ds-message .ds-markdown',
        userBubble: '.ds-message > div:has(> .ds-collapsible-text)',
        codeBanner: '.md-code-block-banner-wrap',
        controls: '.ds-button, [role="button"]',
        editor: 'textarea',
        markers: '.ds-virtual-list, .ds-virtual-list-items, .ds-virtual-list-visible-items, .ds-message, textarea'
    };

    window.widerRoomyCore.defineSite({
        id: 'deepseek',
        selectors,
        discover(ctx) {
            const column = ctx.findVisible(selectors.column);
            const list = column && column.closest(selectors.list);
            const scroll = list && list.closest(selectors.scroll);
            if (column && list && scroll) {
                return {
                    kind: 'chat', root: column, column, scroll, pane: scroll,
                    widthOwners: [{ element: scroll, strategy: 'variable' }]
                };
            }
            if (ctx.findVisible(selectors.scroll)) return { kind: 'unknown', root: null, widthOwners: [] };
            const editor = ctx.findVisible(selectors.editor);
            const owner = editor && ctx.findWidthOwner(editor);
            if (owner && owner.parentElement) {
                return { kind: 'home', root: null, pane: owner.parentElement, widthOwners: [{ element: owner, strategy: 'maxWidth' }] };
            }
            return { kind: 'notApplicable', root: null, widthOwners: [] };
        },
        reading: {
            assistantRoot: selectors.assistantBody,
            userBubble: selectors.userBubble,
            exclude: `${selectors.codeBanner}, ${selectors.controls}`
        },
        watch: {
            markers: selectors.markers
        }
    });
})();
