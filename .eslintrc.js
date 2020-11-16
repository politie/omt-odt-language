module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    "rules": {
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": "warn",
        "@typescript-eslint/explicit-module-boundary-types": "off",
    },
    overrides: [
        {
            files: "**/*.test.ts",
            rules: {
                "@typescript-eslint/no-non-null-assertion": "off",
                "@typescript-eslint/no-non-null-asserted-optional-chain": "off"
            }
        }
    ]
};
