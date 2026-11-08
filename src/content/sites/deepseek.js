(function () {
    'use strict';

    const selectors = {
        scroll: '.ds-virtual-list',
        list: '.ds-virtual-list-items',
        column: '.ds-virtual-list-visible-items',
        item: '[data-virtual-list-item-key]',
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
                const editor = ctx.findVisible(selectors.editor, scroll);
                let footer = null;
                for (let el = editor; el && el !== scroll; el = el.parentElement) {
                    if (el.parentElement === scroll) footer = el;
                }
                return {
                    kind: 'chat', root: column, column, scroll, footer, pane: scroll,
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
        turnKey: element => {
            const item = element.closest(selectors.item);
            return item ? item.getAttribute('data-virtual-list-item-key') : null;
        },
        navigation: { topInset: 8, bottomInset: 8, scrollInset: 16 },
        watch: {
            markers: selectors.markers,
            attributes: ['data-virtual-list-item-key']
        }
    });
})();
