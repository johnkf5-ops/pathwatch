import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL('https://hantavirustracer.com'),
  title: {
    default: 'Hantavirus Tracker — Live 2026 MV Hondius Outbreak',
    template: '%s | Hantavirus Tracker',
  },
  description:
    'Live tracking of the 2026 MV Hondius hantavirus outbreak (Andes virus, ANDV). Cases, deaths, travel timelines, country-level data, and pandemic threat assessment.',
  keywords: [
    'hantavirus',
    'hantavirus tracker',
    'MV Hondius',
    'MV Hondius outbreak',
    'Andes virus',
    'ANDV',
    'hantavirus 2026',
    'hantavirus cruise ship',
    'cruise ship outbreak',
    'pandemic tracker',
    'outbreak tracker',
    'disease outbreak news',
    'hantavirus pulmonary syndrome',
  ],
  authors: [{ name: 'Hantavirus Tracker' }],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Hantavirus Tracker — Live 2026 MV Hondius Outbreak',
    description:
      'Live tracking of the 2026 MV Hondius hantavirus outbreak (Andes virus). Cases, deaths, travel timelines, country-level data, and pandemic threat assessment.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Hantavirus Tracker',
    url: 'https://hantavirustracer.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hantavirus Tracker: Live 2026 MV Hondius Outbreak',
    description: 'Live cases, deaths, travel timelines, and pandemic threat assessment.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-bg font-sans text-text antialiased">
        {children}
      </body>
    </html>
  );
}
