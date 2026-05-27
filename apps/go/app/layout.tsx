import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SFW Links',
  description: 'SFW Construction short links',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
