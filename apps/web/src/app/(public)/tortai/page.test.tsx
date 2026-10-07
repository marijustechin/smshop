import { describe, expect, it } from 'vitest';
import TortaiPage, { metadata } from './page';

describe('Tortai category page metadata', () => {
  it('has a meaningful title, description and canonical path', () => {
    expect(metadata.title).toBe('Tortai — Šokolado meistrai');
    expect(String(metadata.description)).toContain('tortai');
    expect(metadata.alternates).toEqual({ canonical: '/tortai' });
  });

  it('renders the catalogue category component', () => {
    const element = TortaiPage();
    expect(element).toBeTruthy();
  });
});
