import antfu from '@antfu/eslint-config';

export default antfu(
  {
    typescript: {
      tsconfigPath: 'tsconfig.json',
    },
    formatters: {
      markdown: true,
    },
    stylistic: {
      semi: true,
      quotes: 'single',
      indent: 2,
    },
  },
  {
    ignores: [
      'node_modules',
      'dist',
      'src/**/__generated__',
      '**/*.md',
    ],
  },
  {
    rules: {
      'jsdoc/no-defaults': 'off',

      'style/arrow-parens': ['error', 'always'],
      'style/no-trailing-spaces': 'warn',

      'perfectionist/sort-imports': [
        'warn',
        {
          groups: [
            ['side-effect'],
            ['side-effect-style'],
            'type-import',
            ['value-builtin', 'value-external'],
            ['value-internal', 'type-internal'],
            ['type-parent', 'type-sibling', 'type-index'],
            ['value-parent', 'value-sibling', 'value-index'],
            'ts-equals-import',
            'unknown',
          ],
          newlinesBetween: 1,
          order: 'asc',
          type: 'natural',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'ts/strict-boolean-expressions': 'off',
      'ts/no-unsafe-call': 'off',
      'ts/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports', prefer: 'type-imports' }],
      'ts/consistent-type-exports': 'error',
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
        },
      ],
    },
  },
  {
    files: ['src/**/*.{spec,test,bench}.{ts,tsx}'],
    rules: {
      'test/prefer-lowercase-title': ['error', {
        ignore: ['describe'],
        ignoreTopLevelDescribe: true,
      }],
    },
  },
);
