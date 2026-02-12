import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BNBrew — AI Onchain App Builder',
  description:
    'Build and deploy onchain apps on BNB Chain with AI. Describe your app, we generate smart contracts, build the frontend, and deploy everything.',
  metadataBase: new URL('https://bnbrew.xyz'),
  openGraph: {
    title: 'BNBrew — Build Onchain. Ship with AI.',
    description:
      'Describe your app in plain English. BNBrew generates smart contracts, builds the frontend, and deploys to BNB Chain. No blockchain experience needed.',
    siteName: 'BNBrew',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BNBrew — Build Onchain. Ship with AI.',
    description:
      'AI-powered onchain app builder for BNB Chain. Smart contracts + frontend + deploy in minutes.',
  },
  keywords: [
    'BNB Chain',
    'onchain app builder',
    'AI',
    'smart contracts',
    'opBNB',
    'Greenfield',
    'dApp',
    'no-code',
    'web3',
  ],
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
