# zonfig Landing Page

A Next.js landing page for the zonfig package, demonstrating how to use zonfig for configuration management in a Next.js application.

## Features

- Built with Next.js 15 and React 19
- Uses zonfig for all site configuration
- Demonstrates multi-source configuration (JSON files + env vars)
- Type-safe configuration access
- Dark mode support via configuration
- Fully responsive design

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

## Configuration

The site configuration is defined in `src/config/index.ts` using a Zod schema:

```typescript
export const schema = z.object({
  site: z.object({
    name: z.string().default('zonfig'),
    tagline: z.string().default('Universal Typed Configuration for Node.js'),
    // ...
  }),
  features: z.object({
    showInstallCommand: z.boolean().default(true),
    // ...
  }),
  theme: z.object({
    primaryColor: z.string().default('#6366f1'),
    darkMode: z.boolean().default(true),
  }),
});
```

Configuration is loaded from:

1. `config/site.json` - Default values
2. Environment variables with `SITE_` prefix - Overrides

### Customizing

Edit `config/site.json` to change site settings:

```json
{
  "site": {
    "name": "My Project",
    "tagline": "My awesome tagline"
  }
}
```

Or use environment variables:

```bash
SITE_SITE__NAME="My Project"
SITE_SITE__TAGLINE="My awesome tagline"
```

## Project Structure

```
├── config/
│   └── site.json        # Default configuration
├── src/
│   ├── app/
│   │   ├── globals.css  # Global styles
│   │   ├── layout.tsx   # Root layout
│   │   └── page.tsx     # Home page
│   ├── components/      # React components
│   └── config/
│       └── index.ts     # zonfig schema & loader
├── .env.example         # Example environment variables
├── next.config.ts       # Next.js configuration
└── package.json
```

## License

MIT
