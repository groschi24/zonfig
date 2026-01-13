'use client';

import { useState } from 'react';
import type { SiteConfig } from '@/config';

interface HeroProps {
  config: SiteConfig;
}

export function Hero({ config }: HeroProps) {
  const [copied, setCopied] = useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText('npm install @zonfig/zonfig');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="hero">
      <div className="container">
        <div className="hero-content">
          <div className="hero-eyebrow animate-in">
            <span className="hero-eyebrow-dot" />
            <span>Now with CLI &amp; Monorepo Support</span>
          </div>

          <h1 className="hero-title animate-in delay-1">
            Stop scattering <span className="hero-title-gradient">process.env</span> across your codebase
          </h1>

          <p className="hero-subtitle animate-in delay-2">
            One schema. Multiple sources. Full type safety.
            Define your configuration with Zod, load from anywhere,
            and get autocomplete, validation, and documentation for free.
          </p>

          <div className="hero-actions animate-in delay-3">
            <a href="#problem" className="btn btn-primary">
              See the Problem
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </a>
            <a href={config.site.github} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </a>
          </div>

          {config.features.showInstallCommand && (
            <div className="install-wrapper animate-in delay-4">
              <div className="install-box">
                <span className="prompt">$</span>
                <code>npm install @zonfig/zonfig</code>
                <button className="copy-btn" onClick={copyCommand} title="Copy to clipboard">
                  {copied ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
