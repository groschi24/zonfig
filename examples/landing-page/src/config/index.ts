import { defineConfig, z, ConfigValidationError } from '@zonfig/zonfig';

// Define the configuration schema for the landing page
export const schema = z.object({
  site: z.object({
    name: z.string().default('zonfig'),
    tagline: z.string().default('Universal Typed Configuration for Node.js'),
    description: z.string().default('Define your config schema once with Zod and load from multiple sources with full TypeScript inference.'),
    url: z.string().url().default('https://github.com/groschi24/zonfig'),
    github: z.string().url().default('https://github.com/groschi24/zonfig'),
    npm: z.string().url().default('https://www.npmjs.com/package/zonfig'),
  }),

  features: z.object({
    showInstallCommand: z.boolean().default(true),
    showGitHubStars: z.boolean().default(true),
    enableAnalytics: z.boolean().default(false),
  }),

  theme: z.object({
    primaryColor: z.string().default('#6366f1'),
    accentColor: z.string().default('#8b5cf6'),
    darkMode: z.boolean().default(true),
  }),

  contact: z.object({
    email: z.string().email().optional(),
    twitter: z.string().optional(),
  }).default({}),
});

export type SiteConfig = z.infer<typeof schema>;

let configInstance: Awaited<ReturnType<typeof defineConfig<typeof schema>>> | null = null;

export async function getConfig() {
  if (configInstance) {
    return configInstance;
  }

  try {
    configInstance = await defineConfig({
      schema,
      sources: [
        { type: 'file', path: './config/site.json', optional: true },
        { type: 'env', prefix: 'SITE_' },
      ],
    });
    return configInstance;
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      console.error('Configuration Error:', error.formatErrors());
      throw error;
    }
    throw error;
  }
}

// Export a function to get config values for client components
export async function getSiteConfig(): Promise<SiteConfig> {
  const config = await getConfig();
  return config.getAll();
}
