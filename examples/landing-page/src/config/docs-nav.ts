export interface NavItem {
  title: string;
  href?: string;
  icon?: string;
  items?: NavItem[];
  expanded?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const docsNav: NavSection[] = [
  {
    title: 'Get Started',
    items: [
      { title: 'Introduction', href: '/docs', icon: 'home' },
      { title: 'Installation', href: '/docs/installation', icon: 'download' },
      { title: 'Quick Start', href: '/docs/quick-start', icon: 'zap' },
    ],
  },
  {
    title: 'Core Concepts',
    items: [
      { title: 'Schema Definition', href: '/docs/schema', icon: 'code' },
      { title: 'Configuration Sources', href: '/docs/sources', icon: 'layers' },
      { title: 'Environment Profiles', href: '/docs/profiles', icon: 'git-branch' },
      { title: 'Validation', href: '/docs/validation', icon: 'check-circle' },
      { title: 'Variable Interpolation', href: '/docs/interpolation', icon: 'dollar-sign' },
      { title: 'Watch Mode', href: '/docs/watch-mode', icon: 'refresh-cw' },
      { title: 'Secrets Masking', href: '/docs/secrets-masking', icon: 'eye-off' },
      { title: 'Encryption', href: '/docs/encryption', icon: 'lock' },
    ],
  },
  {
    title: 'Sources',
    items: [
      { title: 'File Sources', href: '/docs/sources/file', icon: 'file-text' },
      { title: 'Environment Variables', href: '/docs/sources/env', icon: 'terminal' },
      { title: 'Dotenv Files', href: '/docs/sources/dotenv', icon: 'file' },
      { title: 'Plugins', href: '/docs/sources/plugins', icon: 'puzzle' },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { title: 'defineConfig', href: '/docs/api/define-config', icon: 'settings' },
      { title: 'Config Object', href: '/docs/api/config', icon: 'box' },
      { title: 'Types', href: '/docs/api/types', icon: 'type' },
    ],
  },
  {
    title: 'CLI',
    items: [
      { title: 'Overview', href: '/docs/cli', icon: 'terminal' },
      { title: 'init', href: '/docs/cli/init', icon: 'plus-circle' },
      { title: 'validate', href: '/docs/cli/validate', icon: 'shield' },
      { title: 'docs', href: '/docs/cli/docs', icon: 'book' },
      { title: 'analyze', href: '/docs/cli/analyze', icon: 'search' },
      { title: 'encrypt', href: '/docs/cli/encrypt', icon: 'lock' },
      { title: 'decrypt', href: '/docs/cli/decrypt', icon: 'unlock' },
    ],
  },
  {
    title: 'Guides',
    items: [
      { title: 'TypeScript Setup', href: '/docs/guides/typescript', icon: 'code' },
      { title: 'Monorepo Support', href: '/docs/guides/monorepo', icon: 'folder' },
      { title: 'Secret Management', href: '/docs/guides/secrets', icon: 'lock' },
    ],
  },
];
