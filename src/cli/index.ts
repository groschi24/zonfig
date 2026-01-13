import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { generateDocs } from '../documentation/index.js';
import { analyzeProject } from './analyze.js';
import { z } from 'zod';

const VERSION = '0.1.3';

const HELP = `
zonfig - Universal typed configuration CLI

Usage:
  zonfig <command> [options]

Commands:
  analyze   Analyze existing project and generate schema from .env files
  docs      Generate documentation from a Zod schema file
  init      Initialize a new zonfig configuration setup
  validate  Validate a configuration file against a schema
  help      Show this help message

Run 'zonfig <command> --help' for command-specific help.
`;

const ANALYZE_HELP = `
zonfig analyze - Analyze existing project and auto-generate schema

Usage:
  zonfig analyze [options]

Options:
  -d, --dir <directory>    Directory to analyze (default: current directory)
  -o, --output <file>      Output file path (default: src/config.ts)
  --dry-run                Preview generated schema without writing
  -v, --verbose            Show detailed analysis information
  -h, --help               Show this help message

Monorepo Options:
  --all                    Analyze all packages in a monorepo
  --package <name>         Analyze a specific package by name or path

What it analyzes:
  - .env, .env.local, .env.development, .env.production, etc.
  - config/*.json, config/*.yaml files
  - process.env.* and import.meta.env.* usage in source code
  - Existing config libraries (dotenv, convict, config, etc.)
  - Framework detection (Next.js, Vite, Express, etc.)
  - Monorepo detection (Turborepo, Nx, Lerna, pnpm, yarn, npm workspaces)

Examples:
  zonfig analyze
  zonfig analyze -d ./my-project
  zonfig analyze --dry-run
  zonfig analyze -o ./lib/config.ts -v

Monorepo Examples:
  zonfig analyze --all                  # Analyze all packages
  zonfig analyze --package my-app       # Analyze specific package
  zonfig analyze --package apps/web     # Analyze by path
`;

const DOCS_HELP = `
zonfig docs - Generate documentation from a Zod schema

Usage:
  zonfig docs [options]

Options:
  -s, --schema <file>    Path to schema file (TypeScript/JavaScript)
                         Must export 'schema' or 'configSchema'
  -o, --output <dir>     Output directory (default: current directory)
  -f, --format <type>    Output format: markdown, env, json-schema, all (default: all)
  -p, --prefix <prefix>  Environment variable prefix for env format (default: none)
  -t, --title <title>    Title for markdown documentation
  -h, --help             Show this help message

Examples:
  zonfig docs -s ./src/config.ts
  zonfig docs -s ./schema.ts -f markdown -o ./docs
  zonfig docs -s ./config.ts -f env -p MYAPP_
`;

const INIT_HELP = `
zonfig init - Initialize a new zonfig configuration setup

Usage:
  zonfig init [options]

Options:
  -d, --dir <directory>  Directory to initialize (default: current directory)
  -h, --help             Show this help message

Creates:
  - src/config.ts        Configuration schema and loader
  - config/default.json  Default configuration values
  - .env.example         Environment variable template
`;

const VALIDATE_HELP = `
zonfig validate - Validate a configuration file against a schema

Usage:
  zonfig validate [options]

Options:
  -s, --schema <file>   Path to schema file (TypeScript/JavaScript)
  -c, --config <file>   Path to configuration file (JSON/YAML)
  -h, --help            Show this help message

Examples:
  zonfig validate -s ./src/config.ts -c ./config/production.json
`;

interface ParsedArgs {
  values: {
    schema?: string;
    output?: string;
    format?: string;
    prefix?: string;
    title?: string;
    dir?: string;
    config?: string;
    help?: boolean;
    version?: boolean;
    'dry-run'?: boolean;
    verbose?: boolean;
    all?: boolean;
    package?: string;
  };
  positionals: string[];
}

function parseCliArgs(): ParsedArgs {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        schema: { type: 'string', short: 's' },
        output: { type: 'string', short: 'o' },
        format: { type: 'string', short: 'f' },
        prefix: { type: 'string', short: 'p' },
        title: { type: 'string', short: 't' },
        dir: { type: 'string', short: 'd' },
        config: { type: 'string', short: 'c' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        'dry-run': { type: 'boolean' },
        verbose: { type: 'boolean', short: 'V' },
        all: { type: 'boolean' },
        package: { type: 'string' },
      },
    });
  } catch {
    return { values: {}, positionals: [] };
  }
}

async function loadSchemaFromFile(schemaPath: string): Promise<z.ZodType> {
  const absolutePath = resolve(process.cwd(), schemaPath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Schema file not found: ${absolutePath}`);
  }

  // Dynamic import the schema file
  const module = await import(absolutePath);

  // Look for common export names
  const schema = module.schema || module.configSchema || module.default;

  if (!schema) {
    throw new Error(
      `Schema file must export 'schema', 'configSchema', or a default export.\n` +
      `Found exports: ${Object.keys(module).join(', ')}`
    );
  }

  // Verify it's a Zod schema
  if (typeof schema.safeParse !== 'function') {
    throw new Error('Exported schema must be a Zod schema (must have safeParse method)');
  }

  return schema;
}

async function commandDocs(args: ParsedArgs): Promise<void> {
  if (args.values.help) {
    console.log(DOCS_HELP);
    return;
  }

  const schemaPath = args.values.schema;
  if (!schemaPath) {
    console.error('Error: --schema (-s) is required\n');
    console.log(DOCS_HELP);
    process.exit(1);
  }

  const outputDir = args.values.output || '.';
  const format = args.values.format || 'all';
  const prefix = args.values.prefix ?? '';
  const title = args.values.title || 'Configuration Reference';

  console.log(`Loading schema from: ${schemaPath}`);

  try {
    const schema = await loadSchemaFromFile(schemaPath);

    // Ensure output directory exists
    if (outputDir !== '.') {
      await mkdir(outputDir, { recursive: true });
    }

    const formats = format === 'all'
      ? ['markdown', 'env', 'json-schema']
      : [format];

    for (const fmt of formats) {
      let content: string;
      let filename: string;

      switch (fmt) {
        case 'markdown':
        case 'md':
          content = generateDocs(schema, { format: 'markdown', title });
          filename = 'CONFIG.md';
          break;

        case 'env':
        case 'env-example':
        case 'dotenv':
          content = generateDocs(schema, { format: 'env-example', prefix });
          filename = '.env.example';
          break;

        case 'json-schema':
        case 'json':
        case 'schema':
          content = generateDocs(schema, { format: 'json-schema' });
          filename = 'config.schema.json';
          break;

        default:
          console.error(`Unknown format: ${fmt}`);
          console.error('Valid formats: markdown, env, json-schema, all');
          process.exit(1);
      }

      const outputPath = resolve(outputDir, filename);
      await writeFile(outputPath, content);
      console.log(`  Created: ${outputPath}`);
    }

    console.log('\nDocumentation generated successfully!');
  } catch (error) {
    console.error(`\nError: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function commandInit(args: ParsedArgs): Promise<void> {
  if (args.values.help) {
    console.log(INIT_HELP);
    return;
  }

  const targetDir = resolve(process.cwd(), args.values.dir || '.');

  console.log(`Initializing zonfig in: ${targetDir}\n`);

  // Create directories
  try {
    await mkdir(resolve(targetDir, 'src'), { recursive: true });
    await mkdir(resolve(targetDir, 'config'), { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('EACCES') || message.includes('EPERM')) {
      console.error(`Error: Permission denied. Cannot create directories in ${targetDir}`);
      console.error('Please check that you have write permissions for this directory.');
    } else if (message.includes('ENOENT')) {
      console.error(`Error: Directory not found: ${targetDir}`);
    } else {
      console.error(`Error creating directories: ${message}`);
    }
    process.exit(1);
  }

  // Create config schema file
  const configTs = `import { defineConfig, z, ConfigValidationError } from '@zonfig/zonfig';

// Define your application's configuration schema
export const schema = z.object({
  server: z.object({
    host: z.string().default('localhost'),
    port: z.number().min(1).max(65535).default(3000),
  }),

  database: z.object({
    url: z.string().url(),
    poolSize: z.number().min(1).max(100).default(10),
  }),

  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),
});

// Export the schema type
export type AppConfig = z.infer<typeof schema>;

// Load configuration
export async function loadConfig() {
  const env = process.env.NODE_ENV ?? 'development';

  try {
    return await defineConfig({
      schema,
      sources: [
        { type: 'file', path: './config/default.json' },
        { type: 'file', path: \`./config/\${env}.json\`, optional: true },
        { type: 'env', prefix: 'APP_' },
      ],
    });
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      console.error(error.formatErrors());
      process.exit(1);
    }
    throw error;
  }
}
`;

  // Create default config
  const defaultJson = {
    server: {
      host: 'localhost',
      port: 3000,
    },
    database: {
      url: 'postgres://localhost:5432/myapp',
      poolSize: 10,
    },
    logging: {
      level: 'info',
    },
  };

  // Create .env.example
  const envExample = `# Configuration Environment Variables

# Server
APP_SERVER__HOST=localhost
APP_SERVER__PORT=3000

# Database
APP_DATABASE__URL=postgres://localhost:5432/myapp
APP_DATABASE__POOL_SIZE=10

# Logging
APP_LOGGING__LEVEL=info
`;

  // Write files
  const configTsPath = resolve(targetDir, 'src/config.ts');
  const defaultJsonPath = resolve(targetDir, 'config/default.json');
  const envExamplePath = resolve(targetDir, '.env.example');

  if (existsSync(configTsPath)) {
    console.log(`  Skipped: ${configTsPath} (already exists)`);
  } else {
    await writeFile(configTsPath, configTs);
    console.log(`  Created: ${configTsPath}`);
  }

  if (existsSync(defaultJsonPath)) {
    console.log(`  Skipped: ${defaultJsonPath} (already exists)`);
  } else {
    await writeFile(defaultJsonPath, JSON.stringify(defaultJson, null, 2));
    console.log(`  Created: ${defaultJsonPath}`);
  }

  if (existsSync(envExamplePath)) {
    console.log(`  Skipped: ${envExamplePath} (already exists)`);
  } else {
    await writeFile(envExamplePath, envExample);
    console.log(`  Created: ${envExamplePath}`);
  }

  console.log(`
Setup complete! Next steps:

  1. Install zonfig:
     npm install @zonfig/zonfig

  2. Import and use the config:
     import { loadConfig } from './src/config.js';
     const config = await loadConfig();
     console.log(config.get('server.port'));

  3. Generate documentation:
     npx zonfig docs -s ./src/config.ts
`);
}

async function commandValidate(args: ParsedArgs): Promise<void> {
  if (args.values.help) {
    console.log(VALIDATE_HELP);
    return;
  }

  const schemaPath = args.values.schema;
  const configPath = args.values.config;

  if (!schemaPath || !configPath) {
    console.error('Error: Both --schema (-s) and --config (-c) are required\n');
    console.log(VALIDATE_HELP);
    process.exit(1);
  }

  console.log(`Validating configuration...`);
  console.log(`  Schema: ${schemaPath}`);
  console.log(`  Config: ${configPath}\n`);

  try {
    // Load schema
    const schema = await loadSchemaFromFile(schemaPath);

    // Load config file
    const absoluteConfigPath = resolve(process.cwd(), configPath);
    if (!existsSync(absoluteConfigPath)) {
      throw new Error(`Config file not found: ${absoluteConfigPath}`);
    }

    const configContent = await readFile(absoluteConfigPath, 'utf-8');
    let configData: unknown;

    if (configPath.endsWith('.json')) {
      configData = JSON.parse(configContent);
    } else if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
      // Dynamic import yaml parser
      const { parse } = await import('yaml');
      configData = parse(configContent);
    } else {
      throw new Error('Config file must be .json, .yaml, or .yml');
    }

    // Validate
    const result = schema.safeParse(configData);

    if (result.success) {
      console.log('Validation successful!\n');
      console.log('Parsed configuration:');
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.error('Validation failed!\n');

      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || '(root)';
        console.error(`  ✗ ${path}`);
        console.error(`    ${issue.message}`);
        if ('expected' in issue) {
          console.error(`    Expected: ${issue.expected}`);
        }
        if ('received' in issue) {
          console.error(`    Received: ${issue.received}`);
        }
        console.error('');
      }

      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function commandAnalyze(args: ParsedArgs): Promise<void> {
  if (args.values.help) {
    console.log(ANALYZE_HELP);
    return;
  }

  const options: Parameters<typeof analyzeProject>[0] = {
    dir: args.values.dir || '.',
    output: args.values.output || 'src/config.ts',
    dryRun: args.values['dry-run'] || false,
    verbose: args.values.verbose || false,
    all: args.values.all || false,
  };
  if (args.values.package) options.package = args.values.package;
  await analyzeProject(options);
}

async function main(): Promise<void> {
  const args = parseCliArgs();
  const command = args.positionals[0];

  if (args.values.version) {
    console.log(`zonfig v${VERSION}`);
    return;
  }

  if (args.values.help && !command) {
    console.log(HELP);
    return;
  }

  switch (command) {
    case 'docs':
    case 'doc':
    case 'generate':
      await commandDocs(args);
      break;

    case 'init':
    case 'setup':
      await commandInit(args);
      break;

    case 'validate':
    case 'check':
      await commandValidate(args);
      break;

    case 'analyze':
    case 'scan':
    case 'migrate':
      await commandAnalyze(args);
      break;

    case 'help':
    case undefined:
      console.log(HELP);
      break;

    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
