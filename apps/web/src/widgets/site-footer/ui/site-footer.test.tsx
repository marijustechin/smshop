import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SiteFooter } from './site-footer';
import { COMPANY, CONTACT, mailtoHref, telHref } from '@/shared/config/contact';

describe('SiteFooter', () => {
  it('renders the brand logo, a description and the shared navigation', () => {
    render(<SiteFooter />);

    expect(screen.getByRole('img', { name: 'Šokolado meistrai' })).toBeInTheDocument();

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

  it('uses the shared contact source for clickable phone and email', () => {
    render(<SiteFooter />);

    expect(screen.getByRole('link', { name: CONTACT.generalPhone })).toHaveAttribute(
      'href',
      telHref(CONTACT.generalPhone),
    );
    expect(screen.getByRole('link', { name: CONTACT.generalEmail })).toHaveAttribute(
      'href',
      mailtoHref(CONTACT.generalEmail),
    );
  });

  it('renders the legal name, company code and current copyright year', () => {
    render(<SiteFooter />);

    expect(screen.getByText(COMPANY.legalName)).toBeInTheDocument();
    expect(screen.getByText(`Įmonės kodas ${COMPANY.code}`)).toBeInTheDocument();
    expect(screen.getByText(`© ${new Date().getFullYear()} Šokolado meistrai`)).toBeInTheDocument();
  });
});
