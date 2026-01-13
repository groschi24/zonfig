import Link from 'next/link';

const featureCards = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: 'Quick Start',
    description: 'Get up and running with zonfig in minutes. Learn the basics and build your first typed configuration.',
    href: '/docs/quick-start',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    title: 'Schema Definition',
    description: 'Define your configuration shape with Zod schemas. Get full TypeScript inference and runtime validation.',
    href: '/docs/schema',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
    title: 'Configuration Sources',
    description: 'Load config from multiple sources: JSON, YAML, environment variables, .env files, and custom plugins.',
    href: '/docs/sources',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    title: 'CLI Tools',
    description: 'Generate documentation, validate configs, and analyze your codebase with the built-in CLI.',
    href: '/docs/cli',
  },
];

const guideCards = [
  {
    title: 'Installation',
    description: 'Install zonfig and set up your project.',
    href: '/docs/installation',
  },
  {
    title: 'TypeScript Setup',
    description: 'Configure TypeScript for the best experience.',
    href: '/docs/guides/typescript',
  },
  {
    title: 'Monorepo Support',
    description: 'Use zonfig across multiple packages.',
    href: '/docs/guides/monorepo',
  },
];

export default function DocsPage() {
  return (
    <div className="docs-home">
      <div className="docs-home-header">
        <span className="docs-home-label">Get started</span>
        <h1 className="docs-home-title">zonfig Documentation</h1>
        <p className="docs-home-subtitle">
          Everything you need to build type-safe, validated configuration for your Node.js applications.
        </p>
      </div>

      <div className="docs-home-cards">
        {featureCards.map((card) => (
          <Link key={card.href} href={card.href} className="docs-home-card">
            <div className="docs-home-card-icon">{card.icon}</div>
            <h3 className="docs-home-card-title">{card.title}</h3>
            <p className="docs-home-card-desc">{card.description}</p>
          </Link>
        ))}
      </div>

      <div className="docs-home-section">
        <h2 className="docs-home-section-title">Guides</h2>
        <p className="docs-home-section-desc">Step-by-step tutorials to help you get the most out of zonfig.</p>
        <div className="docs-home-guides">
          {guideCards.map((card) => (
            <Link key={card.href} href={card.href} className="docs-home-guide">
              <div className="docs-home-guide-content">
                <h4 className="docs-home-guide-title">{card.title}</h4>
                <p className="docs-home-guide-desc">{card.description}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      <div className="docs-home-section">
        <h2 className="docs-home-section-title">Why zonfig?</h2>
        <div className="docs-home-features">
          <div className="docs-home-feature">
            <div className="docs-home-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h4>Type Safety</h4>
              <p>Full TypeScript inference from your Zod schema. Catch errors at compile time.</p>
            </div>
          </div>
          <div className="docs-home-feature">
            <div className="docs-home-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div>
              <h4>Validation</h4>
              <p>Runtime validation with clear error messages. Know exactly what&apos;s wrong and where.</p>
            </div>
          </div>
          <div className="docs-home-feature">
            <div className="docs-home-feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div>
              <h4>Auto Documentation</h4>
              <p>Generate markdown docs, JSON Schema, and .env.example from your schema.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
