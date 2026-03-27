import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  // Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.astro/**',
      '**/.turbo/**',
      '**/.vercel/**',
      'tools/**',
    ],
  },

  // Base JS/TS rules
  eslint.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // Astro rules
  ...astro.configs.recommended,

  // Project overrides
  {
    rules: {
      // Relax rules that conflict with Astro patterns
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Allow any in component props for flexibility during migration
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Node globals for config files (URL, module, etc.)
  {
    files: ['**/astro.config.mjs', '**/tailwind.config.js', '**/eslint.config.mjs'],
    languageOptions: {
      globals: {
        URL: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
      },
    },
  },

  // Disable prefer-rest-params in Astro files (inline scripts use arguments)
  {
    files: ['**/*.astro', '**/*.astro/*.js', '**/*.astro/*.ts'],
    rules: {
      'prefer-rest-params': 'off',
    },
  },
];
