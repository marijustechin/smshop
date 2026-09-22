import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Šokolado meistrai',
  description: 'Premium šokoladas ir konditerija',
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
