import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePublicContacts } from '@/features/contacts/api/contacts-api';
import { COMPANY, mailtoHref, telHref } from '@/shared/config/contact';
import KontaktaiPage, { metadata } from './page';

vi.mock('@/features/contacts/api/contacts-api', () => ({
  usePublicContacts: vi.fn(),
}));

const mockedContacts = vi.mocked(usePublicContacts);

function openHours() {
  return Array.from({ length: 7 }, (_, index) => ({
    weekday: index + 1,
    closed: false,
    opens: '10:00',
    closes: '20:00',
  }));
}

function payload() {
  return {
    groups: [
      {
        key: 'administracija',
        title: 'Administracija',
        phone: '+370 612 85646',
        email: 'info@sokoladomeistrai.lt',
        hours: '8:00–18:00',
        address: 'Jeruzalės g. 16, LT-08414 Vilnius',
      },
      {
        key: 'uzsakymai',
        title: 'Užsakymų skyrius',
        phone: '+370 691 81928',
        email: 'uzsakymai@sokoladomeistrai.lt',
        hours: '8:00–18:00',
        address: null,
      },
    ],
    cities: [
      {
        name: 'Vilnius',
        stores: [
          {
            name: 'Jeruzalės g. 16, Vilnius',
            address: 'Jeruzalės g. 16, LT-08414 Vilnius',
            phone: null,
            email: null,
            status: 'OPERATING' as const,
            notice: null,
            hours: openHours(),
          },
          {
            name: 'Viršuliškių g. 40, PC „MADA“',
            address: 'Viršuliškių g. 40, PC „MADA“, Vilnius',
            phone: null,
            email: null,
            status: 'TEMPORARILY_CLOSED' as const,
            notice: 'Laikinai uždaryta – vyksta rekonstrukcija',
            hours: [],
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  mockedContacts.mockReset();
});

describe('Kontaktai metadata', () => {
  it('has a title, description and canonical path', () => {
    expect(metadata.title).toBe('Kontaktai — Šokolado meistrai');
    expect(metadata.description).toBeTruthy();
    expect(metadata.alternates).toEqual({ canonical: '/kontaktai' });
  });
});

describe('KontaktaiPage', () => {
  it('renders the persisted contact groups with clickable phone and email', () => {
    mockedContacts.mockReturnValue({ status: 'ready', data: payload(), retry: vi.fn() });
    render(<KontaktaiPage />);

    for (const group of payload().groups) {
      expect(screen.getByRole('heading', { name: group.title })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: group.phone })).toHaveAttribute(
        'href',
        telHref(group.phone),
      );
      expect(screen.getByRole('link', { name: group.email })).toHaveAttribute(
        'href',
        mailtoHref(group.email),
      );
    }
  });

  it('groups stores by city and labels a temporarily closed store with its notice', () => {
    mockedContacts.mockReturnValue({ status: 'ready', data: payload(), retry: vi.fn() });
    const { container } = render(<KontaktaiPage />);

    expect(container.querySelector('#pardotuves')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Parašykite mums' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siųsti žinutę' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vilnius' })).toBeInTheDocument();
    expect(screen.getByText('Jeruzalės g. 16, Vilnius')).toBeInTheDocument();
    // Operating store renders compact weekly hours.
    expect(screen.getByText('Visomis dienomis 10:00–20:00')).toBeInTheDocument();
    // Temporarily closed store shows an explicit notice instead of hours.
    expect(screen.getByText('Laikinai uždaryta')).toBeInTheDocument();
    expect(screen.getByText('Laikinai uždaryta – vyksta rekonstrukcija')).toBeInTheDocument();
  });

  it('renders company details in a quieter section', () => {
    mockedContacts.mockReturnValue({ status: 'ready', data: payload(), retry: vi.fn() });
    render(<KontaktaiPage />);

    expect(screen.getByText(COMPANY.legalName)).toBeInTheDocument();
    expect(screen.getByText(`Įmonės kodas ${COMPANY.code}`)).toBeInTheDocument();
  });

  it('shows a loading state first', () => {
    mockedContacts.mockReturnValue({ status: 'loading', data: null, retry: vi.fn() });
    render(<KontaktaiPage />);

    expect(screen.getByText('Kraunama…')).toBeInTheDocument();
  });

  it('shows a failure state without fabricated contacts', () => {
    mockedContacts.mockReturnValue({ status: 'error', data: null, retry: vi.fn() });
    render(<KontaktaiPage />);

    expect(screen.getByText('Nepavyko įkelti kontaktų. Bandykite dar kartą.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /\+370/ })).toBeNull();
  });

  it('shows a neutral empty state when nothing is configured', () => {
    mockedContacts.mockReturnValue({
      status: 'ready',
      data: { groups: [], cities: [] },
      retry: vi.fn(),
    });
    render(<KontaktaiPage />);

    expect(screen.getByText('Kontaktai netrukus bus paskelbti.')).toBeInTheDocument();
  });
});
