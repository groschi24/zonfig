import type { Metadata } from 'next';
import Script from 'next/script';
import { getSiteConfig } from '@/config';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();

  return {
    title: `${config.site.name} - ${config.site.tagline}`,
    description: config.site.description,
    openGraph: {
      title: config.site.name,
      description: config.site.description,
      url: config.site.url,
      siteName: config.site.name,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: config.site.name,
      description: config.site.description,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await getSiteConfig();

  return (
    <html lang="en" className={config.theme.darkMode ? 'dark' : ''}>
      <body>
        {children}
        {process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID && (
          <Script
            src={process.env.NEXT_PUBLIC_ANALYTICS_URL || 'https://app.rybbit.io/api/script.js'}
            data-site-id={process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
