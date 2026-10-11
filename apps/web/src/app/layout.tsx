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
        <a href="#main-content" className="sr-only focus:not-sr-only focus:block focus:p-3">
          Skip to content
        </a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="wordmark">
              <span className="lens-mark" aria-hidden="true" />
              TalentLens
            </Link>
            <nav aria-label="Main navigation" className="main-nav">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-stone-900">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-shell">
          {children}
        </main>
        <footer className="site-footer">
          <span>Jobs from Remotive and Adzuna. Check the original posting for availability.</span>
          <span>Search · Match · Improve</span>
        </footer>
      </body>
    </html>
  );
}
