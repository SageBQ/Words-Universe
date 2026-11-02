import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Lexicon — Vocabulary Universe',
  description: 'Explore 5,241 postgraduate English syllabus words across twelve semantic galaxies.',
  openGraph: { title: 'Lexicon — Vocabulary Universe', description: '5,241 words. 12 galaxies. One universe of meaning.', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'Lexicon — Vocabulary Universe', description: '5,241 words. 12 galaxies. One universe of meaning.', images: ['/og.png'] },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1 };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
