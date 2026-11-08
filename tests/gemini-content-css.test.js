const assert = require('assert');
const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'src/content/gemini-content.css');
const css = fs.readFileSync(cssPath, 'utf8');

[
    'body.wider-gemini-font-enabled [data-wg-typography]',
    'body:is(.wider-gemini-font-enabled, .wider-gemini-density-enabled) [data-wg-line]',
    'body.wider-gemini-density-enabled [data-wg-spacing]',
    'body.wider-gemini-spacing-custom [data-wg-spacing="after"]'
].forEach(selector => {
    assert.ok(css.includes(selector), `missing reading selector: ${selector}`);
});
assert.ok(css.includes('var(--wg-native-font-size) * var(--gemini-font-scale)'),
    'font scaling must use captured native font sizes');
assert.ok(css.includes('var(--wg-line-reduction) * var(--gemini-density-progress)'),
    'automatic line height must interpolate from the native value');
assert.ok(css.includes('var(--wg-native-margin-top) * var(--gemini-density-spacing-scale)'),
    'automatic paragraph spacing must scale native margins');
assert.ok(css.includes('margin-top: var(--gemini-message-paragraph-spacing) !important;'),
    'manual paragraph spacing must use the exact requested value, including zero');

[
    'body.wider-gemini-user-full-width .conversation-container .user-query-bubble-with-background',
    'body.wider-gemini-user-full-width .conversation-container .user-query-bubble-container'
].forEach(selector => {
    assert.ok(css.includes(selector), `missing user full-width selector: ${selector}`);
});

assert.ok(
    css.includes(':is(p, li, ul, ol, blockquote, h1, h2, h3, h4, h5, h6):not('),
    'text-level max-width unlock selector must exist for luminous readable width'
);

assert.ok(
    css.includes('user-query :is(p, .query-text, .query-text-line):not('),
    'user query text max-width unlock selector must exist'
);

assert.ok(
    css.includes('model-response message-actions'),
    'message-actions max-width/margin unlock selector must exist'
);

assert.ok(
    css.includes('model-response response-element'),
    'response-element max-width unlock selector must exist'
);

assert.ok(
    css.includes('img, video, svg, canvas, iframe, button, input, select, textarea,'),
    'generic markdown max-width unlock rule must exclude media and form controls'
);

assert.ok(
    css.includes('.horizontal-scroll-wrapper:has(table-block)'),
    'horizontal-scroll-wrapper bleed must be disabled around table-block'
);

assert.ok(
    css.includes('table-block .table-content::-webkit-scrollbar-track'),
    'table scroll container must render a full-width scrollbar track'
);

assert.ok(
    css.includes('model-response .response-container-header'),
    'response-container-header margin unlock selector must exist'
);

assert.ok(
    css.includes('model-response thinking-overlay'),
    'thinking-overlay margin unlock selector must exist'
);

assert.ok(
    css.includes('pending-request > thinking-dots-animation'),
    'thinking-dots-animation standalone stretch selector must exist'
);

assert.ok(
    css.includes('thinking-overlay > thinking-dots-animation'),
    'thinking-dots-animation in-overlay content-width selector must exist'
);

assert.ok(
    css.includes('.hero-caption-row .caption'),
    'image caption margin reset selector must exist'
);

console.log('gemini-content CSS tests passed');
