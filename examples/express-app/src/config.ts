import { defineConfig, z, ConfigValidationError } from '@zonfig/zonfig';

// Define your application's configuration schema
export const configSchema = z.object({
  server: z.object({
    host: z.string().default('localhost'),
    port: z.number().min(1).max(65535).default(3000),
  }),

  database: z.object({
    url: z.string().url(),
    poolSize: z.number().min(1).max(100).default(10),
    ssl: z.boolean().default(false),
  }),

  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(6379),
    password: z.string().optional(),
  }),

  auth: z.object({
    jwtSecret: z.string().min(32),
    jwtExpiresIn: z.string().default('7d'),
    bcryptRounds: z.number().min(10).max(15).default(12),
  }),

  features: z.object({
    enableCache: z.boolean().default(true),
    enableRateLimit: z.boolean().default(true),
    maxRequestsPerMinute: z.number().default(100),
  }),

  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'pretty']).default('json'),
  }),
});

// Export the schema type for use elsewhere
export type AppConfig = z.infer<typeof configSchema>;

// Load configuration based on environment
export async function loadConfig() {
  const env = process.env.NODE_ENV ?? 'development';

  try {
    const config = await defineConfig({
      schema: configSchema,
      profiles: {
        development: {
          sources: [
            { type: 'file', path: './config/default.json' },
            { type: 'file', path: './config/development.json', optional: true },
            { type: 'file', path: './.env', format: 'dotenv', optional: true },
            { type: 'env', prefix: 'APP_' },
          ],
          defaults: {
            'logging.level': 'debug',
            'logging.format': 'pretty',
          },
        },
        production: {
          sources: [
            { type: 'file', path: './config/default.json' },
            { type: 'file', path: './config/production.json', optional: true },
            { type: 'env', prefix: 'APP_' },
          ],
          defaults: {
            'database.ssl': true,
            'logging.format': 'json',
          },
        },
        test: {
          sources: [
            { type: 'file', path: './config/default.json' },
            { type: 'file', path: './config/test.json', optional: true },
            { type: 'env', prefix: 'APP_' },
          ],
          defaults: {
            'features.enableRateLimit': false,
          },
        },
      },
      profile: env,
      cwd: import.meta.dirname,
    });

    return config;
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      console.error('\n' + error.formatErrors());
      process.exit(1);
    }
    throw error;
  }
}
