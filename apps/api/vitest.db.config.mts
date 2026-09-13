import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * Database-backed tests. Requires a migrated, isolated test database reachable
 * via TEST_DATABASE_URL. Run through `pnpm test:db` (which enforces the
 * boundary), not directly.
 */
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: 'node',
    include: ['test/database/**/*.db-spec.ts'],
    setupFiles: ['test/setup-env.ts'],
    fileParallelism: false,
  },
});
