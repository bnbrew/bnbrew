import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BNBrew',
  description: 'AI-powered onchain app builder for BNB ecosystem',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
