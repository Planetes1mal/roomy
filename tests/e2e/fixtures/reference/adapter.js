window.widerRoomyCore.defineSite({
    id: 'reference',
    selectors: {
        column: 'main .column[data-conversation]',
        scroll: 'main .scroll',
        composer: 'main .composer',
        footer: 'main .composer-wrap',
        userBubble: '[data-role="user"] .bubble',
        assistantRoot: '[data-role="assistant"] .markdown',
        markers: 'main, .column, .composer, .scroll, [data-role]'
    },
    discover(ctx) {
        const S = this.selectors;
        const column = ctx.findVisible(S.column);
        const composer = ctx.findVisible(S.composer);
        if (!column) {
            if (composer && composer.getAttribute('data-placement') === 'home') return { kind: 'home', widthOwners: [composer] };
            return { kind: document.body.dataset.page === 'settings' ? 'notApplicable' : 'unknown' };
        }
        return {
            kind: 'chat', root: column, column,
            scroll: column.closest(S.scroll) || column.parentElement,
            footer: composer ? composer.closest(S.footer) : null,
            widthOwners: composer ? [column, composer] : [column]
        };
    },
    reading: { assistantRoot: '[data-role="assistant"] .markdown', userBubble: '[data-role="user"] .bubble' },
    turnKey: element => element.getAttribute('data-turn-key'),
    navigation: { topInset: 56, bottomInset: 8, scrollInset: 72 },
    watch: { markers: 'main, .column, .composer, .scroll, [data-role]', attributes: ['data-conversation', 'data-role', 'data-placement'] }
});
