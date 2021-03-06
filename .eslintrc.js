module.exports = {
    parser: require.resolve('@typescript-eslint/parser'),
    plugins: ['@typescript-eslint', 'react', 'react-hooks', 'no-only-tests'],
    extends: ['plugin:@typescript-eslint/recommended', 'prettier', 'prettier/@typescript-eslint'],
    rules: {
        'no-only-tests/no-only-tests': [
            'error',
            { block: ['test', 'it', 'assert', 'describe'], focus: ['only', 'focus', 'skip'] },
        ],
        '@typescript-eslint/no-explicit-any': 0,
        // disable the rule for all files
        '@typescript-eslint/explicit-function-return-type': 'off',
        'react/jsx-uses-react': 'error',
        'react/jsx-uses-vars': 'error',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        'prefer-const': 0,
    },
    overrides: [
        {
            // enable the rule specifically for TypeScript files
            files: ['*.ts', '*.tsx'],
            rules: {
                '@typescript-eslint/explicit-function-return-type': ['error'],
            },
        },
    ],
};
