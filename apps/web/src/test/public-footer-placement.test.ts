import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('public footer placement', () => {
  it('is rendered by the public layout so it covers catalogue and auth pages', () => {
    const layout = read('src/app/(public)/layout.tsx');
    expect(layout).toContain("from '@/widgets/site-footer'");
    expect(layout).toContain('<SiteFooter />');
  });

  it('is not rendered by the administration layout', () => {
    const admin = read('src/app/administravimas/layout.tsx');
    expect(admin).not.toContain('SiteFooter');
  });
});
