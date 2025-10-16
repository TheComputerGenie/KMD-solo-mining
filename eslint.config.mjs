export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      'brace-style': ['error', '1tbs'],
      'curly': ['error', 'all'],
      'indent': ['error', 4],
      'no-var': ['error'],
      'prefer-const': ['error'],
    },
  },
];