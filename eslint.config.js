import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import react from 'eslint-plugin-react'

// レイヤー: data < lib < hooks < components < App/main
// 下位レイヤーが上位レイヤーを import することを CI で禁止する(プロンプトの指示ではなく機械的に強制)。
const forbid = (...layers) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: layers.map((l) => ({
        group: [`**/${l}`, `**/${l}/**`],
        message: `このレイヤーから ${l} は import できない(data < lib < hooks < components < App)`,
      })),
    },
  ],
})

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/sw.js'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    plugins: { 'react-hooks': reactHooks, react },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      // JSX で使うコンポーネントは no-unused-vars に拾わせない代わりに、未定義参照は error
      'no-undef': 'error',
      // 近道が最善になるよう、後始末忘れ・デバッグ残しを弾く
      'no-console': ['error', { allow: ['warn', 'error', 'log'] }],
      'no-debugger': 'error',
    },
  },
  { files: ['src/data/**'], rules: forbid('lib', 'hooks', 'components', 'App', 'App.jsx') },
  { files: ['src/lib/**'], rules: forbid('hooks', 'components', 'App', 'App.jsx') },
  { files: ['src/hooks/**'], rules: forbid('components', 'App', 'App.jsx') },
  { files: ['src/components/**'], rules: forbid('App', 'App.jsx') },
  {
    files: ['scripts/**', 'test/**', 'vite.config.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
  },
]
