import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SFW Siding Calculator',
  description: 'Sketch a wall, pick materials, get a quote.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
