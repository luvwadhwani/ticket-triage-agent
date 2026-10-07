import type { Metadata } from 'next';
import { IBM_Plex_Mono, Instrument_Sans } from 'next/font/google';
import { headers } from 'next/headers';
import { TopBar } from '@/components/TopBar';
import './globals.css';

const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Ticket Triage Agent',
  description: 'A working AI agent that triages support tickets with tools, and stops for a person when a safety rule applies. A demo by Luv Wadhwani.',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const raw = (await headers()).get('x-lw-viewer');
  let viewer = 'Guest';
  if (raw) {
    try {
      viewer = decodeURIComponent(raw);
    } catch {
      viewer = raw;
    }
  }
  return (
    <html lang="en" className={`${instrument.variable} ${plexMono.variable}`}>
      <body>
        <TopBar viewerName={viewer} hubUrl={process.env.NEXT_PUBLIC_HUB_URL ?? ''} />
        {children}
      </body>
    </html>
  );
}
