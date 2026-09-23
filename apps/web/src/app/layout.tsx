import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Šokolado meistrai',
  description: 'Premium šokoladas ir konditerija',
  // File-convention `icon.*` does not support webp, so the supplied favicon is
  // referenced directly through the metadata icons API (no conversion).
  icons: {
    icon: [{ url: '/branding/sokolado-meistrai-favicon.webp', type: 'image/webp' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lt">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
