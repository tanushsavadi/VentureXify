import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VentureXify - Maximize Your Venture X Rewards',
  description: 'The AI-powered Chrome extension that helps Capital One Venture X cardholders make smarter decisions on every booking.',
  keywords: ['Venture X', 'Capital One', 'travel rewards', 'Chrome extension', 'AI', 'miles', 'points'],
  authors: [{ name: 'VentureXify Team' }],
  openGraph: {
    title: 'VentureXify - Maximize Your Venture X Rewards',
    description: 'The AI-powered Chrome extension that helps Capital One Venture X cardholders make smarter decisions on every booking.',
    url: 'https://venturexify.com',
    siteName: 'VentureXify',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VentureXify - Maximize Your Venture X Rewards',
    description: 'The AI-powered Chrome extension for Venture X cardholders.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-background text-white antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
