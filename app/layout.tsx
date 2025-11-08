import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'AI Tools News to Video',
  description: 'Aggregates AI tool news and generates short videos about them.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="header">
            <div className="brand">AI Tools News ? Video</div>
            <nav className="nav">
              <a href="/" className="link">Home</a>
              <a href="https://agentic-a35ee5ef.vercel.app" className="link" target="_blank" rel="noreferrer">Deployed</a>
            </nav>
          </header>
          <main>{children}</main>
          <footer className="footer">Built for automated AI news video generation</footer>
        </div>
      </body>
    </html>
  );
}
