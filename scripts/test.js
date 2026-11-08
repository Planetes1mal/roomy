(function () {
    'use strict';

    const fs = require('fs');
    const path = require('path');
    const { spawnSync } = require('child_process');
    const root = path.resolve(__dirname, '..');
    const skipPackaging = process.argv.includes('--skip-packaging');
    const tests = fs.readdirSync(path.join(root, 'tests'))
        .filter(name => name.endsWith('.test.js') && (!skipPackaging || name !== 'release-package.test.js'))
        .sort();

    for (const test of tests) {
        console.log(`Running ${test}`);
        const result = spawnSync(process.execPath, [path.join(root, 'tests', test)], {
            cwd: root,
            stdio: 'inherit'
        });
        if (result.error) throw result.error;
        if (result.status !== 0) process.exit(result.status || 1);
    }
})();
