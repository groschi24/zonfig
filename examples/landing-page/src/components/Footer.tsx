import type { SiteConfig } from '@/config';

interface FooterProps {
  config: SiteConfig;
}

export function Footer({ config }: FooterProps) {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <p className="footer-text">
            Built with zonfig. MIT Licensed.
          </p>
          <div className="footer-links">
            <a href={config.site.github} className="footer-link" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href={config.site.npm} className="footer-link" target="_blank" rel="noopener noreferrer">
              npm
            </a>
            <a href="/docs" className="footer-link">
              Docs
            </a>
            <a href={`${config.site.github}/issues`} className="footer-link" target="_blank" rel="noopener noreferrer">
              Issues
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
