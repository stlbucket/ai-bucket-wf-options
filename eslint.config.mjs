import nuxtEslint from '@nuxt/eslint'

export default [
  ...nuxtEslint.configs.recommended,
  {
    rules: {
      'no-console': 'warn',
    },
  },
]
