(function () {
    'use strict';

    const selectors = {
        grid: '[role="main"][data-artifact-opened]',
        turn: '[data-scope-id][data-mlbl]',
        answer: '.pWvJNd .mZJni',
        composer: '.t0ITR:has(textarea)',
        dock: '.y4VEUd',
        sources: '.oRipZb'
    };

    window.widerRoomyCore.defineSite({
        id: 'googleaimode',
        selectors,
        discover(ctx) {
            // A fixed composer can be visible even when the empty grid has no height.
            const composer = ctx.findVisible(selectors.grid + ' > ' + selectors.dock + ' ' + selectors.composer);
            if (!composer) return { kind: 'notApplicable' };
            const dock = composer.closest(selectors.dock);
            const grid = dock.parentElement;
            const turn = grid.querySelector(selectors.turn);
            if (turn && !grid.querySelector(selectors.turn + ' ' + selectors.answer)) return { kind: 'unknown' };
            const surface = { kind: turn ? 'chat' : 'home', root: grid, column: grid, pane: grid, footer: dock };
            const style = getComputedStyle(grid);
            // Leave Google's alternate panel and compact layouts under its own control.
            if (grid.getAttribute('data-artifact-opened') !== 'false' ||
                style.columnGap !== '20px' || !style.getPropertyValue('--rhs-width').trim() ||
                !style.getPropertyValue('--rhs-margin').trim() || style.gridTemplateColumns.split(' ').length !== 22 || getComputedStyle(composer).gridColumnEnd !== 'span 12') {
                return { ...surface, nativeWidth: true };
            }
            return { ...surface, widthOwners: [{ element: grid, strategy: 'googleGrid' }] };
        },
        watch: {
            markers: [selectors.grid, selectors.turn, '.mZJni', '.t0ITR', selectors.dock].join(', '),
            attributes: ['data-artifact-opened', 'data-mlbl']
        }
    });
})();
