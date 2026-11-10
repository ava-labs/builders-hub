import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { APP_LANG, APP_STYLES, APP_TITLE } from '../lib/app-content';
import { Providers } from './providers';

export const metadata: Metadata = { title: APP_TITLE };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={APP_LANG} suppressHydrationWarning>
      <head>
        {APP_STYLES.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
