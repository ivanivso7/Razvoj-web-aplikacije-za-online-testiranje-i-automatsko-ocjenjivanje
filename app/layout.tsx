import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin', 'latin-ext'] });

export const metadata: Metadata = {
  title: 'ZnanjePlus — Online provjera znanja',
  description: 'Web aplikacija za izradu, rješavanje i automatsko ocjenjivanje online testova.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="hr"><body className={`${inter.variable} antialiased`}>{children}</body></html>;
}
