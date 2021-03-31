// @ts-check
// adapted from vscode-extension-samples/lsp-user-input-sample/shared.webpack.config.js
/** @typedef {import('webpack').Configuration} WebpackConfig */

'use strict';

const path = require('path');
const merge = require('merge-options');

module.exports = function withDefaults(/** @type WebpackConfig */extConfig) {
    /** @type WebpackConfig */
    let defaultConfig = {
        mode: 'none',
        target: 'node',
        node: {
            __dirname: false,
        },
        resolve: {
            mainFields: ['module', 'main'],
            extensions: ['.ts', '.js'],
        },
        module: {
            rules: [{
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [{
                    loader: 'ts-loader',
                    options: {
                        compilerOptions: {
                            sourceMap: true,
                        },
                    },
                }],
            }],
        },
        externals: {
            vscode: 'commonjs vscode',
        },
        output: {
            filename: '[name].js',
            path: path.join(extConfig.context, 'out'),
            libraryTarget: 'commonjs',
        },
        devtool: 'source-map',
    };

    return merge(defaultConfig, extConfig);
};
