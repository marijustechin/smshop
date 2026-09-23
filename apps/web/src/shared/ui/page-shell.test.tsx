import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageShell } from './page-shell';

describe('PageShell', () => {
  it('renders the card content and does not duplicate the brand logo', () => {
    render(
      <PageShell title="Prisijungti" description="Aprašymas" footer={<span>FOOTER</span>}>
        <button type="button">Veiksmas</button>
      </PageShell>,
    );

    expect(screen.getByRole('heading', { name: 'Prisijungti' })).toBeInTheDocument();
    expect(screen.getByText('Aprašymas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Veiksmas' })).toBeInTheDocument();
    expect(screen.getByText('FOOTER')).toBeInTheDocument();
    // The logo lives in the public header, not in the page shell.
    expect(screen.queryByRole('img', { name: 'Šokolado meistrai' })).toBeNull();
  });
});
