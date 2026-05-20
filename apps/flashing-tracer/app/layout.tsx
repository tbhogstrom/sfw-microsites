import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SFW Flashing Tracer',
  description: 'Trace a flashing detail from a drawing image.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
