import { describe, expect, it } from 'vitest';
import { formatWeeklyHours, mapSearchUrl } from './hours';
import type { PublicStoreHour } from './types';

function day(weekday: number, opens: string, closes: string): PublicStoreHour {
  return { weekday, closed: false, opens, closes };
}

function closed(weekday: number): PublicStoreHour {
  return { weekday, closed: true, opens: null, closes: null };
}

describe('formatWeeklyHours', () => {
  it('collapses identical days across the whole week', () => {
    const hours = Array.from({ length: 7 }, (_, index) => day(index + 1, '10:00', '20:00'));
    expect(formatWeeklyHours(hours)).toBe('Visomis dienomis 10:00–20:00');
  });

  it('groups identical consecutive days into ranges', () => {
    const hours = [
      ...Array.from({ length: 5 }, (_, index) => day(index + 1, '09:00', '19:00')),
      day(6, '10:00', '18:00'),
      day(7, '10:00', '18:00'),
    ];
    expect(formatWeeklyHours(hours)).toBe('I–V 9:00–19:00; VI–VII 10:00–18:00');
  });

  it('marks a single closed day without leaking times', () => {
    const hours = [
      closed(1),
      ...Array.from({ length: 6 }, (_, index) => day(index + 2, '10:00', '20:00')),
    ];
    expect(formatWeeklyHours(hours)).toBe('I nedirba; II–VII 10:00–20:00');
  });

  it('returns a closed label when every day is closed', () => {
    const hours = Array.from({ length: 7 }, (_, index) => closed(index + 1));
    expect(formatWeeklyHours(hours)).toBe('Nedirba');
  });

  it('returns an empty string when no hours are configured', () => {
    expect(formatWeeklyHours([])).toBe('');
  });
});

describe('mapSearchUrl', () => {
  it('builds an encoded map search link from the address', () => {
    expect(mapSearchUrl('Jeruzalės g. 16, LT-08414 Vilnius')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Jeruzal%C4%97s%20g.%2016%2C%20LT-08414%20Vilnius',
    );
  });
});
