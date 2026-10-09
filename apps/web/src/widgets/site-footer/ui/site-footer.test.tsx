import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { usePublicContacts } from '@/features/contacts/api/contacts-api';
import { COMPANY, mailtoHref, telHref } from '@/shared/config/contact';
import { SiteFooter } from './site-footer';

vi.mock('@/features/contacts/api/contacts-api', () => ({
  usePublicContacts: vi.fn(),
}));

const mockedContacts = vi.mocked(usePublicContacts);

const ADMINISTRATION = {
  key: 'administracija',
  title: 'Administracija',
  phone: '+370 612 85646',
  email: 'info@sokoladomeistrai.lt',
  hours: '8:00–18:00',
  address: 'Jeruzalės g. 16, LT-08414 Vilnius',
};

beforeEach(() => {
  mockedContacts.mockReset();
  mockedContacts.mockReturnValue({
    status: 'ready',
    data: { groups: [ADMINISTRATION], cities: [] },
    retry: vi.fn(),
  });
});

describe('SiteFooter', () => {
  it('renders the brand logo, a description and the shared navigation', () => {
    render(<SiteFooter />);

    const logo = screen.getByRole('img', { name: 'Šokolado meistrai' });
    expect(logo).toBeInTheDocument();
    // The dark footer uses the cream logo variant.
    expect(logo.getAttribute('src') ?? '').toContain('sokolado-meistrai-logo-creme');

    const nav = screen.getByRole('navigation', { name: 'Poraštės navigacija' });
    expect(within(nav).getByRole('link', { name: 'Tortai' })).toHaveAttribute('href', '/tortai');
    expect(within(nav).getByRole('link', { name: 'Kontaktai' })).toHaveAttribute(
      'href',
      '/kontaktai',
    );
    expect(within(nav).getByRole('link', { name: 'Parduotuvės' })).toHaveAttribute(
      'href',
      '/kontaktai#pardotuves',
    );
  });

  it('uses the persisted administration contact for clickable phone and email', () => {
    render(<SiteFooter />);

    expect(screen.getByRole('link', { name: ADMINISTRATION.phone })).toHaveAttribute(
      'href',
      telHref(ADMINISTRATION.phone),
    );
    expect(screen.getByRole('link', { name: ADMINISTRATION.email })).toHaveAttribute(
      'href',
      mailtoHref(ADMINISTRATION.email),
    );
  });

  it('never fabricates contact values while loading or on failure', () => {
    mockedContacts.mockReturnValue({ status: 'loading', data: null, retry: vi.fn() });
    render(<SiteFooter />);

    expect(screen.queryByRole('link', { name: ADMINISTRATION.phone })).toBeNull();
    expect(screen.queryByRole('link', { name: ADMINISTRATION.email })).toBeNull();
  });

  it('renders the legal name, company code and current copyright year', () => {
    render(<SiteFooter />);

    expect(screen.getByText(COMPANY.legalName)).toBeInTheDocument();
    expect(screen.getByText(`Įmonės kodas ${COMPANY.code}`)).toBeInTheDocument();
    expect(screen.getByText(`© ${new Date().getFullYear()} Šokolado meistrai`)).toBeInTheDocument();
  });
});
