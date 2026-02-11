import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BNBrew — AI Onchain App Builder',
  description: 'Build and deploy onchain apps on BNB Chain with AI. No blockchain experience needed.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-bnb-dark text-bnb-light">
        {children}
      </body>
    </html>
  );
}
