module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:md/recommended',
    ],
    rules: {
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": "warn",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/indent": ["error"],
        'md/remark': [
            'error',
            {
                // This object corresponds to object you would export in .remarkrc file
                plugins: ['preset-lint-markdown-style-guide', 'lint', ['lint-list-item-spacing', false]],
            },
        ],
    },
    overrides: [
        {
            files: "**/*.test.ts",
            rules: {
                "@typescript-eslint/no-non-null-assertion": "off",
                "@typescript-eslint/no-non-null-asserted-optional-chain": "off"
            }
        },
        {
            files: ['*.md'],
            parser: 'markdown-eslint-parser',
        },
        {
            files: ['CHANGELOG.md'],
            rules: {
                'md/remark': [
                    'error',
                    {
                        // This object corresponds to object you would export in .remarkrc file
                        plugins: [
                            'preset-lint-markdown-style-guide',
                            'lint',
                            ['lint-list-item-spacing', false],
                            ['lint-no-shortcut-reference-link', false],
                            ['lint-no-duplicate-headings', false],
                        ],
                    },
                ],
            }
        }
    ]
};
