import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    // design-preview（査読用の受け皿）はL1〜L4対象外（meta/adr/0022 §2・成果物→断面の
    // 対応表）。BookingDesign.tsx（承認済みモック）は無改変で置かれており、lintの対象に
    // しない（未使用importの掃除等、モック自体への手当てはしない）。
    'src/design-preview',
    // schema.d.ts は openapi-typescript による生成物（SSoT=reservation-api.yamlからの導出、
    // ADR-0008）。手編集禁止であり、lintの対象にしない（`npm run gen:api` で再生成する）。
    'src/api/schema.d.ts',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // shadcn/ui のcopy-inコンポーネント（src/components/ui/**）はCLIが生成・上書きする
    // ベンダーコード。variant定義（cva）をコンポーネントと同じファイルからexportする
    // shadcnの標準パターンがreact-refresh/only-export-componentsに抵触するため、この
    // ディレクトリのみ当該ルールを無効化する。
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // 本番コードから design-preview への import を禁止する（import境界。meta/adr/0022 §2
    // 「design-previewは本実装から architecturally 隔離する」の軽い機械担保）。
    // design-preview自身（main.tsx等、上でglobalIgnores済み）には適用されない。
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/design-preview', '@/design-preview/*', '**/design-preview/*'],
              message:
                'design-preview は査読用の受け皿であり、本番コードから import しない（meta/adr/0022 §2）。',
            },
          ],
        },
      ],
    },
  },
])
