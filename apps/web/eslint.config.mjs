import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// FSD-lite import boundaries (ARCH-001).
//
// Dependency direction: app -> widgets -> features -> entities -> shared.
// `app/` may import anything below it; each lower layer may not import a higher
// one (nor another slice of its own layer via the `@/...` alias — same-slice
// imports use relative paths). Enforced with ESLint's built-in
// `no-restricted-imports`; no FSD-specific tooling is added.
const app = ['@/app', '@/app/*', '@/app/**'];
const widgets = ['@/widgets', '@/widgets/*', '@/widgets/**'];
const features = ['@/features', '@/features/*', '@/features/**'];
const entities = ['@/entities', '@/entities/*', '@/entities/**'];

/** Forbid `forbidden` alias groups inside `src/<layer>/**`. */
const layerBoundary = (layer, forbidden) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: forbidden,
            message: `FSD-lite boundary: "${layer}" must not import from a higher layer or another slice of its own layer via "@/"; use relative imports within the slice.`,
          },
        ],
      },
    ],
  },
});

const eslintConfig = [
  {
    ignores: ['node_modules/**', '.next/**', 'next-env.d.ts'],
  },
  ...coreWebVitals,
  ...nextTypescript,
  layerBoundary('shared', [...app, ...widgets, ...features, ...entities]),
  layerBoundary('entities', [...app, ...widgets, ...features, ...entities]),
  layerBoundary('features', [...app, ...widgets, ...features]),
  layerBoundary('widgets', [...app, ...widgets]),
];

export default eslintConfig;
