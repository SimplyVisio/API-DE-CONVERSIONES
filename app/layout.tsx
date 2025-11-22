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
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}