import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Meta CAPI Sync Dashboard',
  description: 'Real-time synchronization dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Using Tailwind CDN to match the original index.html setup */}
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
