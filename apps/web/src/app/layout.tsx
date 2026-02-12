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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen bg-bnb-dark text-bnb-light">
        {children}
      </body>
    </html>
  );
}
