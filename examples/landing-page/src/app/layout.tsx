import type { Metadata } from 'next';
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
      </body>
    </html>
  );
}
