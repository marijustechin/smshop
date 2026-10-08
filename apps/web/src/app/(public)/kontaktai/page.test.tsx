import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import KontaktaiPage, { metadata } from './page';
import { COMPANY, CONTACT, mailtoHref, telHref } from '@/shared/config/contact';

describe('Kontaktai metadata', () => {
  it('has a title, description and canonical path', () => {
    expect(metadata.title).toBe('Kontaktai — Šokolado meistrai');
    expect(metadata.description).toBeTruthy();
    expect(metadata.alternates).toEqual({ canonical: '/kontaktai' });
  });
});

describe('KontaktaiPage', () => {
  it('renders the contact groups with clickable phone and email', () => {
    render(<KontaktaiPage />);

    for (const channel of CONTACT.channels) {
      expect(screen.getByRole('heading', { name: channel.title })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: channel.phones[0] })).toHaveAttribute(
        'href',
        telHref(channel.phones[0]),
      );
      expect(screen.getByRole('link', { name: channel.email })).toHaveAttribute(
        'href',
        mailtoHref(channel.email),
      );
    }
  });

  it('exposes the stores section anchor and labels non-operating stores', () => {
    const { container } = render(<KontaktaiPage />);

    expect(container.querySelector('#pardotuves')).not.toBeNull();
    // An open, a temporarily closed and a closed store are all represented.
    expect(screen.getByText('Jeruzalės g. 16, Vilnius')).toBeInTheDocument();
    expect(screen.getAllByText('Laikinai uždaryta').length).toBeGreaterThan(0);
    expect(screen.getByText('Vydūno g. 4, PC „RIMI“')).toBeInTheDocument();
    expect(screen.getByText('Uždaryta')).toBeInTheDocument();
  });

  it('renders company details in a quieter section', () => {
    render(<KontaktaiPage />);

    expect(screen.getByText(COMPANY.legalName)).toBeInTheDocument();
    expect(screen.getByText(`Įmonės kodas ${COMPANY.code}`)).toBeInTheDocument();
  });
});
