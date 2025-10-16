export default [
  {
    files: ['**/*.js'],
    ignores: ['website/public/lib/*.min.js'],
    languageOptions: {
      'ecmaVersion': 2022,
      'sourceType': 'commonjs',
      'globals': {
        'console': 'readonly',
        'process': 'readonly',
        'Buffer': 'readonly',
        '__dirname': 'readonly',
        '__filename': 'readonly',
        'require': 'readonly',
        'module': 'readonly',
        'exports': 'readonly',
        'BigInt': 'readonly',
        'algos': 'readonly'
      },
    },
    'rules': {
      'brace-style': ['error', '1tbs'],
      'curly': ['error', 'all'],
      'indent': ['error', 4],
      'no-var': 'error',
      'prefer-const': 'error',
      'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
      'prefer-template': 'error',
      'prefer-arrow-callback': 'error',
      'semi': ['error', 'always'],
      'no-throw-literal': 'off',
      'no-prototype-builtins': 'off'
    },
  },
];