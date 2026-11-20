(function () {
    'use strict';

    const selectors = {
        grid: '[role="main"][data-artifact-opened]',
        turn: '[data-scope-id][data-mlbl]',
        answer: '.pWvJNd .mZJni',
        composer: '.t0ITR:has(textarea)',
        dock: '.y4VEUd',
        sources: '.oRipZb',
        question: '.ilZyRc[data-rfsp]'
    };

    window.widerRoomyCore.defineSite({
        id: 'googleaimode',
        selectors,
        discover(ctx) {
            // A streaming page can paint the question before it mounts the fixed composer.
            // Conversely, an empty conversation grid can have zero height and a visible dock.
            const composer = ctx.findVisible(selectors.grid + ' > ' + selectors.dock + ' ' + selectors.composer);
            const dock = composer?.closest(selectors.dock);
            const content = selectors.question + ' .xEFZqe, ' + selectors.turn + ' ' + selectors.answer;
            const grid = dock?.parentElement || ctx.findVisible(selectors.grid, document, node => node.querySelector(content));
            if (!grid) return { kind: 'notApplicable' };
            const turn = grid.querySelector(selectors.turn);
            if (turn && !grid.querySelector(content)) return { kind: 'unknown' };
            const surface = { kind: turn ? 'chat' : 'home', root: grid, column: grid, pane: grid, footer: dock };
            const style = getComputedStyle(grid);
            // Leave Google's alternate panel and compact layouts under its own control.
            if (grid.getAttribute('data-artifact-opened') !== 'false' ||
                style.columnGap !== '20px' || !style.getPropertyValue('--rhs-width').trim() ||
                !style.getPropertyValue('--rhs-margin').trim() || style.gridTemplateColumns.split(' ').length !== 22 ||
                (composer && getComputedStyle(composer).gridColumnEnd !== 'span 12')) {
                return { ...surface, nativeWidth: true };
            }
            return { ...surface, widthOwners: [{ element: grid, strategy: 'googleGrid' }] };
        },
        watch: {
            beforePaint: true,
            markers: [selectors.grid, selectors.turn, '.mZJni', '.t0ITR', selectors.dock,
                'textarea', selectors.question, '.xEFZqe'].join(', '),
            attributes: ['data-artifact-opened', 'data-mlbl']
        }
    });
})();
