# zonfig

[![npm version](https://img.shields.io/npm/v/@zonfig/zonfig.svg)](https://www.npmjs.com/package/@zonfig/zonfig)
[![npm downloads](https://img.shields.io/npm/dm/@zonfig/zonfig.svg)](https://www.npmjs.com/package/@zonfig/zonfig)
[![license](https://img.shields.io/npm/l/@zonfig/zonfig.svg)](https://github.com/groschi24/zonfig/blob/main/LICENSE)

A universal, type-safe configuration library for Node.js applications. Define your config schema once with Zod and load from multiple sources with full TypeScript inference.

## Features

- **Type-safe** - Full TypeScript inference from your Zod schema
- **Multi-source** - Load from env vars, JSON, YAML, .env files, and custom plugins
- **Validated** - Runtime validation with clear error messages showing exactly what's wrong
- **Documented** - Auto-generate markdown docs, JSON Schema, or .env.example from your schema
- **Immutable** - Config is frozen at startup, preventing accidental mutations
- **Watch mode** - Hot-reload config when files change with event-based notifications
- **Variable interpolation** - Use `${VAR}` syntax to reference env vars and other config values
- **Extensible** - Plugin system for secret stores (AWS Secrets Manager, Vault, etc.)
- **CLI included** - Generate docs, validate configs, and scaffold projects from the command line

## Installation

```bash
npm install @zonfig/zonfig
```

## Quick Start

```typescript
import { defineConfig, z } from '@zonfig/zonfig';

// Define your schema
const config = await defineConfig({
  schema: z.object({
    server: z.object({
      host: z.string().default('localhost'),
      port: z.number().min(1).max(65535).default(3000),
    }),
    database: z.object({
      url: z.string().url(),
      poolSize: z.number().default(10),
    }),
    debug: z.boolean().default(false),
  }),
  sources: [
    { type: 'file', path: './config.json' },
    { type: 'env', prefix: 'APP_' },
  ],
});

// Fully typed access
const port = config.get('server.port');     // number
const dbUrl = config.get('database.url');   // string
const all = config.getAll();                // Full typed object
```

## Configuration Sources

Sources are loaded in order, with later sources overriding earlier ones.

### Environment Variables

```typescript
{ type: 'env', prefix: 'APP_' }
```

Environment variable naming convention:
- `APP_SERVER__HOST` → `server.host`
- `APP_DATABASE__POOL_SIZE` → `database.poolSize`

Double underscore (`__`) indicates nesting. Single underscores are converted to camelCase.

### JSON/YAML Files

```typescript
{ type: 'file', path: './config.json' }
{ type: 'file', path: './config.yaml' }
{ type: 'file', path: './config.yml' }
```

Supports profile interpolation:

```typescript
{ type: 'file', path: './config/${PROFILE}.json', optional: true }
```

### .env Files

```typescript
{ type: 'file', path: './.env', format: 'dotenv' }
```

### Plain Objects

```typescript
{ type: 'object', data: { server: { port: 8080 } } }
```

### Plugins

```typescript
{ type: 'plugin', name: 'aws-secrets', options: { secretId: 'my-app/prod' } }
```

## Environment Profiles

Define different configurations per environment:

```typescript
const config = await defineConfig({
  schema,
  profiles: {
    development: {
      sources: [
        { type: 'file', path: './config/dev.json' },
        { type: 'env', prefix: 'APP_' },
      ],
      defaults: {
        debug: true,
      },
    },
    production: {
      sources: [
        { type: 'plugin', name: 'aws-secrets', options: { secretId: 'prod/app' } },
        { type: 'env', prefix: 'APP_' },
      ],
    },
  },
  profile: process.env.NODE_ENV ?? 'development',
});
```

## Variable Interpolation

Use `${VAR}` syntax to reference environment variables and other config values:

```typescript
// config.json
{
  "server": {
    "host": "localhost",
    "port": 5432
  },
  "database": {
    "url": "postgres://${DB_USER}:${DB_PASSWORD}@${server.host}:${server.port}/mydb"
  },
  "apiUrl": "https://${API_HOST}/v1"
}
```

```typescript
// With environment variables:
// DB_USER=admin
// DB_PASSWORD=secret
// API_HOST=api.example.com

const config = await defineConfig({ schema, sources });

config.get('database.url');
// → "postgres://admin:secret@localhost:5432/mydb"

config.get('apiUrl');
// → "https://api.example.com/v1"
```

### Variable Resolution

Variables are resolved in the following order:

1. **Environment variables** - `${DB_PASSWORD}` looks for `process.env.DB_PASSWORD`
2. **Config references** - `${server.host}` references another config value

```yaml
# config.yaml
app:
  name: myapp
  version: "1.0.0"

logging:
  prefix: "${app.name}-${app.version}"  # → "myapp-1.0.0"

database:
  host: "${DB_HOST}"          # From environment
  url: "postgres://${database.host}/db"  # Mixed reference
```

### Recursive Resolution

Variables can reference other variables that also contain interpolation:

```json
{
  "base": "${API_HOST}",
  "versioned": "${base}/v2",
  "endpoint": "${versioned}/users"
}
```

With `API_HOST=api.example.com`, this resolves to:
- `base` → `"api.example.com"`
- `versioned` → `"api.example.com/v2"`
- `endpoint` → `"api.example.com/v2/users"`

### Cycle Detection

Circular references are automatically detected and throw an error:

```json
{
  "a": "${b}",
  "b": "${a}"
}
```

This throws `CircularReferenceError: Circular reference detected: a -> b -> a`

## Plugins

Create custom plugins to load configuration from any source:

```typescript
import { definePlugin, registerPlugin } from '@zonfig/zonfig';

const awsSecretsPlugin = definePlugin({
  name: 'aws-secrets',
  async load(options: { secretId: string; region?: string }, context) {
    const client = new SecretsManagerClient({
      region: options.region ?? 'us-east-1'
    });
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: options.secretId })
    );
    return JSON.parse(response.SecretString ?? '{}');
  },
});

registerPlugin(awsSecretsPlugin);
```

## Auto-Documentation

Generate documentation from your schema:

```typescript
import { generateDocs } from '@zonfig/zonfig';

// Markdown documentation
const markdown = generateDocs(schema, { format: 'markdown' });

// JSON Schema
const jsonSchema = generateDocs(schema, { format: 'json-schema' });

// .env.example file
const envExample = generateDocs(schema, {
  format: 'env-example',
  prefix: 'APP_'
});
```

### Example Markdown Output

```markdown
# Configuration Reference

## server

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `server.host` | string | No | `"localhost"` | - |
| `server.port` | number | No | `3000` | - |
```

### Example .env.example Output

```bash
# Configuration Environment Variables
# Generated by zonfig

# Type: string (optional)
SERVER__HOST=localhost

# Type: number (optional)
SERVER__PORT=3000

# Type: string (required)
DATABASE__URL=
```

## CLI

zonfig includes a command-line interface for common tasks.

### Commands

```bash
# Show help
npx zonfig --help

# Generate documentation from a schema file
npx zonfig docs -s ./src/config.ts

# Initialize a new zonfig setup
npx zonfig init

# Validate a config file against a schema
npx zonfig validate -s ./src/config.ts -c ./config/production.json
```

### `zonfig docs`

Generate documentation from a Zod schema file.

```bash
npx zonfig docs [options]

Options:
  -s, --schema <file>    Path to schema file (required)
  -o, --output <dir>     Output directory (default: .)
  -f, --format <type>    markdown | env | json-schema | all (default: all)
  -p, --prefix <prefix>  Env var prefix for env format (default: APP_)
  -t, --title <title>    Title for markdown docs
```

**Examples:**

```bash
# Generate all formats (CONFIG.md, .env.example, config.schema.json)
npx zonfig docs -s ./src/config.ts

# Generate only markdown to a specific directory
npx zonfig docs -s ./src/config.ts -f markdown -o ./docs

# Generate .env.example with custom prefix
npx zonfig docs -s ./src/config.ts -f env -p MYAPP_
```

The schema file must export `schema`, `configSchema`, or a default export:

```typescript
// src/config.ts
import { z } from 'zod';

export const schema = z.object({
  server: z.object({
    port: z.number().default(3000),
  }),
});
```

### `zonfig init`

Scaffold a new zonfig configuration setup.

```bash
npx zonfig init [options]

Options:
  -d, --dir <directory>  Target directory (default: .)
```

Creates:
- `src/config.ts` - Schema definition and loader
- `config/default.json` - Default configuration values
- `.env.example` - Environment variable template

### `zonfig analyze`

Analyze an existing project and auto-generate a Zod schema from discovered configuration.

```bash
npx zonfig analyze [options]

Options:
  -d, --dir <directory>  Directory to analyze (default: .)
  -o, --output <file>    Output file path (default: src/config.ts)
  --dry-run              Preview schema without writing
  -v, --verbose          Show detailed analysis

Monorepo Options:
  --all                  Analyze all packages in monorepo
  --package <name>       Analyze specific package by name or path
```

**What it detects:**
- `.env`, `.env.local`, `.env.development`, `.env.production` files
- `config/*.json` and `config/*.yaml` files
- `process.env.*` and `import.meta.env.*` usage in source code
- Existing config libraries (dotenv, convict, config, etc.)
- Framework detection (Next.js, Vite, Express, NestJS, etc.)
- Monorepo tools (Turborepo, Nx, Lerna, pnpm, yarn, npm workspaces)

**Example:**

```bash
npx zonfig analyze --dry-run
```

Output:
```typescript
export const schema = z.object({
  server: z.object({
    host: z.string().optional(),
    port: z.number().optional(),
  }),
  database: z.object({
    url: z.string().url(),
    poolSize: z.number().optional(),
  }),
  auth: z.object({
    jwtSecret: z.string(), // sensitive
  }),
});
```

The analyzer:
- Groups related config values (server, database, auth, etc.)
- Infers types from values (boolean, number, URL, email)
- Detects sensitive values (passwords, secrets, tokens)
- Provides migration hints for existing config libraries

#### Monorepo Support

The analyze command automatically detects monorepos and provides special handling:

```bash
# Analyze all packages in a monorepo
npx zonfig analyze --all

# Analyze a specific package
npx zonfig analyze --package my-app
npx zonfig analyze --package apps/web
```

**Supported monorepo tools:**
- Turborepo (`turbo.json`)
- Nx (`nx.json`)
- Lerna (`lerna.json`)
- Rush (`rush.json`)
- pnpm workspaces (`pnpm-workspace.yaml`)
- Yarn workspaces (`package.json` workspaces)
- npm workspaces (`package.json` workspaces)

When analyzing a monorepo:
- Detects shared `.env` files at the root
- Scans each package for package-specific config
- Merges shared and package-specific configuration
- Generates a config file for each package
- Creates a shared config module for common values

### `zonfig validate`

Validate a configuration file against a schema.

```bash
npx zonfig validate [options]

Options:
  -s, --schema <file>   Path to schema file (required)
  -c, --config <file>   Path to config file (required)
```

**Example:**

```bash
npx zonfig validate -s ./src/config.ts -c ./config/production.json
```

Output on success:
```
Validating configuration...
  Schema: ./src/config.ts
  Config: ./config/production.json

Validation successful!
```

Output on failure:
```
Validation failed!

  ✗ database.url
    Invalid url
    Expected: valid URL
    Received: "not-a-url"
```

## Error Handling

Validation errors are clear and actionable:

```
Configuration validation failed:

✗ database.url
  Expected valid URL string
  Received: "not-a-url"
  Source: environment variable APP_DATABASE__URL

✗ server.port
  Number must be less than or equal to 65535
  Received: 70000
  Source: file: ./config.json
```

### Error Types

```typescript
import {
  ConfigValidationError,
  ConfigFileNotFoundError,
  ConfigParseError,
  PluginNotFoundError,
} from '@zonfig/zonfig';

try {
  const config = await defineConfig({ schema, sources });
} catch (error) {
  if (error instanceof ConfigValidationError) {
    console.error(error.formatErrors());
    console.error(error.errors); // Structured error details
    process.exit(1);
  }
  throw error;
}
```

## API Reference

### `defineConfig(options)`

Creates a typed configuration instance.

**Options:**
- `schema` - Zod schema defining config structure
- `sources` - Array of configuration sources (loaded in order)
- `profile` - Active profile name (optional)
- `profiles` - Profile-specific configurations (optional)
- `cwd` - Working directory for file resolution (optional, defaults to `process.cwd()`)

**Returns:** `Promise<Config<TSchema>>`

### `Config` Methods

- `get(path)` - Get value at dot-notation path (type-safe)
- `getAll()` - Get entire config object (frozen)
- `has(path)` - Check if path exists
- `getSource(path)` - Get source of a specific value

### `generateDocs(schema, options)`

Generate documentation from a Zod schema.

**Options:**
- `format` - `'markdown'` | `'json-schema'` | `'env-example'`
- `prefix` - Environment variable prefix (for env-example)
- `title` - Document title (for markdown)
- `includeDefaults` - Include default values (default: true)

### Plugin Functions

- `definePlugin(options)` - Create a plugin definition
- `registerPlugin(plugin)` - Register a plugin globally
- `getPlugin(name)` - Get a registered plugin
- `hasPlugin(name)` - Check if plugin is registered
- `unregisterPlugin(name)` - Remove a plugin
- `clearPlugins()` - Remove all plugins

## Watch Mode

zonfig supports hot-reloading configuration when files change. This is useful during development or for applications that need to respond to config changes without restarting.

### Basic Usage

```typescript
import { defineConfig, z } from '@zonfig/zonfig';

const config = await defineConfig({
  schema: z.object({
    server: z.object({
      port: z.number().default(3000),
      host: z.string().default('localhost'),
    }),
  }),
  sources: [
    { type: 'file', path: './config.json' },
  ],
});

// Start watching for file changes
config.watch();

// Listen for changes
config.on((event) => {
  if (event.type === 'change') {
    console.log('Config changed:', event.changedPaths);
    console.log('New values:', event.newData);
  }
});

// Stop watching when done
config.unwatch();
```

### Watch Options

```typescript
config.watch({
  debounce: 100,    // Debounce delay in ms (default: 100)
  immediate: true,  // Reload immediately on start (default: false)
});
```

### Event Types

```typescript
import type { ConfigEvent } from '@zonfig/zonfig';

config.on((event: ConfigEvent) => {
  switch (event.type) {
    case 'change':
      // Config values changed
      console.log('Changed paths:', event.changedPaths);
      console.log('Old data:', event.oldData);
      console.log('New data:', event.newData);
      break;

    case 'reload':
      // Config was reloaded (even if nothing changed)
      console.log('Reloaded:', event.data);
      break;

    case 'error':
      // Error during reload (validation failed, file read error, etc.)
      console.error('Config error:', event.error);
      if (event.source) {
        console.error('Source:', event.source);
      }
      break;
  }
});
```

### Manual Reload

You can also manually trigger a reload without watching:

```typescript
// Reload and update config
await config.reload();

// Check current values
console.log(config.get('server.port'));
```

### Watch Methods

- `config.watch(options?)` - Start watching config files
- `config.unwatch()` - Stop watching
- `config.on(listener)` - Add event listener (returns unsubscribe function)
- `config.off(listener)` - Remove event listener
- `config.reload()` - Manually reload configuration
- `config.watching` - Check if currently watching (boolean)

### Removing Listeners

```typescript
// Method 1: Use the returned unsubscribe function
const unsubscribe = config.on((event) => {
  console.log(event);
});
unsubscribe();

// Method 2: Use off() with the same listener reference
const listener = (event) => console.log(event);
config.on(listener);
config.off(listener);
```

## Performance

zonfig is designed for speed and efficiency. Here are benchmark results from stress testing:

> **Test System:** MacBook Pro 13-inch (M1, 2020) · Apple M1 · 16 GB RAM · macOS Sequoia 15.5

| Scenario | Time |
|----------|------|
| Load 1,000 keys | 5ms |
| 50 levels deep nesting | <1ms |
| Merge 20 sources | 1ms |
| 100 rapid reloads | 12ms |
| Parse ~500KB JSON file | 26ms |
| Load 10 async plugins | 111ms |
| Parse 1,000 item YAML | 42ms |
| 500 environment variables | 6ms |
| Generate docs (200 fields) | 2ms |
| 50 concurrent config instances | <1ms |

### Key Performance Characteristics

- **Fast startup** - Most configurations load in under 10ms
- **Efficient merging** - Deep merge algorithm handles complex nested structures
- **Low memory** - Configurations are frozen, preventing memory leaks from mutations
- **Parallel loading** - Multiple config instances can be created concurrently
- **Optimized validation** - Zod schemas are validated once at load time

## TypeScript Support

zonfig provides full type inference from your Zod schema:

```typescript
const schema = z.object({
  port: z.number(),
  host: z.string(),
});

const config = await defineConfig({ schema, sources: [] });

config.get('port');   // number
config.get('host');   // string
config.get('other');  // TypeScript error!
```

## Requirements

- Node.js >= 18.0.0

Zod is bundled with zonfig - no need to install it separately.

## License

MIT - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
