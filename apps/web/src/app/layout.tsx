import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'TalentLens',
  description: 'Semantic job search and resume matching over real job postings.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const NAV = [
  { href: '/', label: 'Search' },
  { href: '/match', label: 'Resume match' },
  { href: '/score', label: 'Job ad score' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              TalentLens
            </Link>
            <nav className="flex gap-4 text-sm text-stone-600">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-stone-900">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-stone-500">
          Job data from the Remotive and Adzuna public APIs. Every result links to the original posting.
        </footer>
      </body>
    </html>
  );
}
