// @ts-check
// adapted from vscode-extension-samples/lsp-user-input-sample/server/webpack.config.js

'use strict';

const withDefaults = require('../shared.webpack.config');
const path = require('path');

module.exports = withDefaults({
    context: path.join(__dirname),
    entry: {
        extension: './src/server.ts',
    },
    output: {
        filename: 'server.js',
        path: path.join(__dirname, 'out'),
    },
});
