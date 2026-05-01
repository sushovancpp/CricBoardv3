import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cricket Live',
  description: 'Real-time cricket scoring for 1000+ viewers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-950 text-white min-h-screen">{children}</body>
    </html>
  );
}
