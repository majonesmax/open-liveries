// Lints the renderer's and the viewer's TypeScript sources with type information (tsconfig.json).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/', 'build/', 'renderer/dist/', 'examples/svg-viewer/js/'] },
  {
    files: ['renderer/src/**/*.ts', 'examples/svg-viewer/src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Template literals here interpolate numbers routinely (coordinates, counts).
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
);
