import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import Navbar from '@/components/layout/Navbar';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'PE Analytics',
  description: 'Private equity and secondaries analytics suite',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-navy-950">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-navy-950 text-slate-100`}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
