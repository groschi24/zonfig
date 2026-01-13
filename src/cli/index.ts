import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { generateDocs } from '../documentation/index.js';
import { analyzeProject } from './analyze.js';
import { encryptObject, decryptObject, countEncryptedValues, hasEncryptedValues } from '../utils/encrypt.js';
import { diffSchemas, generateMigrationReport, validateConfigAgainstChanges, applyAutoMigrations } from '../utils/schema-diff.js';
import { z } from 'zod';
import { input, select, confirm, checkbox } from '@inquirer/prompts';

const VERSION = '0.1.3';

const HELP = `
zonfig - Universal typed configuration CLI

Usage:
  zonfig <command> [options]

Commands:
  analyze   Analyze existing project and generate schema from .env files
  docs      Generate documentation from a Zod schema file
  encrypt   Encrypt sensitive values in a configuration file
  decrypt   Decrypt encrypted values in a configuration file
  migrate   Compare schemas and generate migration report
  init      Initialize a new zonfig configuration setup (use -i for interactive)
  validate  Validate a configuration file against a schema
  check     Run health checks on your configuration setup
  show      Display configuration in a formatted tree view
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
  -i, --interactive      Run in interactive mode with prompts
  -h, --help             Show this help message

Creates:
  - src/config.ts        Configuration schema and loader
  - config/default.json  Default configuration values
  - .env.example         Environment variable template

Examples:
  zonfig init              # Quick setup with defaults
  zonfig init -i           # Interactive setup with prompts
  zonfig init -d ./myapp   # Initialize in specific directory
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

const ENCRYPT_HELP = `
zonfig encrypt - Encrypt sensitive values in a configuration file

Usage:
  zonfig encrypt [options]

Options:
  -c, --config <file>   Path to configuration file (JSON/YAML)
  -o, --output <file>   Output file path (default: overwrites input)
  -k, --key <key>       Encryption key (or set ZONFIG_ENCRYPTION_KEY env var)
  --paths <paths>       Comma-separated paths to encrypt (default: auto-detect sensitive keys)
  -h, --help            Show this help message

Sensitive keys are auto-detected:
  password, secret, token, apiKey, privateKey, accessKey,
  credential, encryptionKey, signingKey, clientSecret, connectionString

Examples:
  # Encrypt with env variable key
  export ZONFIG_ENCRYPTION_KEY="my-secret-key"
  zonfig encrypt -c ./config/production.json

  # Encrypt with inline key
  zonfig encrypt -c ./config.json -k "my-secret-key"

  # Encrypt specific paths only
  zonfig encrypt -c ./config.json --paths "database.password,api.token"

  # Output to different file
  zonfig encrypt -c ./config.json -o ./config.encrypted.json
`;

const DECRYPT_HELP = `
zonfig decrypt - Decrypt encrypted values in a configuration file

Usage:
  zonfig decrypt [options]

Options:
  -c, --config <file>   Path to encrypted configuration file (JSON/YAML)
  -o, --output <file>   Output file path (default: overwrites input)
  -k, --key <key>       Decryption key (or set ZONFIG_ENCRYPTION_KEY env var)
  -h, --help            Show this help message

Examples:
  # Decrypt with env variable key
  export ZONFIG_ENCRYPTION_KEY="my-secret-key"
  zonfig decrypt -c ./config.encrypted.json

  # Decrypt with inline key
  zonfig decrypt -c ./config.encrypted.json -k "my-secret-key"

  # Output to different file
  zonfig decrypt -c ./config.encrypted.json -o ./config.decrypted.json
`;

const MIGRATE_HELP = `
zonfig migrate - Compare schemas and generate migration report

Usage:
  zonfig migrate [options]

Options:
  --old <file>          Path to old schema file (TypeScript/JavaScript)
  --new <file>          Path to new schema file (TypeScript/JavaScript)
  -c, --config <file>   Config file to validate/migrate (optional)
  -o, --output <file>   Output migrated config to file (optional)
  --auto                Automatically apply safe migrations (add defaults)
  --report <file>       Write migration report to file (default: stdout)
  -h, --help            Show this help message

What it detects:
  - Breaking changes (removed fields, type changes, made required)
  - Warnings (made optional without default)
  - Info (new fields, default changes, description changes)

Examples:
  # Compare two schema versions
  zonfig migrate --old ./schema-v1.ts --new ./schema-v2.ts

  # Validate existing config against schema changes
  zonfig migrate --old ./v1.ts --new ./v2.ts -c ./config.json

  # Auto-migrate config with new defaults
  zonfig migrate --old ./v1.ts --new ./v2.ts -c ./config.json --auto -o ./config-migrated.json

  # Save report to file
  zonfig migrate --old ./v1.ts --new ./v2.ts --report migration-report.md
`;

const SHOW_HELP = `
zonfig show - Display configuration in a formatted tree view

Usage:
  zonfig show [options]

Options:
  -s, --schema <file>   Path to schema file (required)
  -c, --config <file>   Path to config file (optional, validates defaults)
  --masked              Mask sensitive values (default: true)
  --no-masked           Show actual values (use with caution)
  --json                Output as JSON
  --paths               Show only config paths (no values)
  -h, --help            Show this help message

Examples:
  zonfig show -s ./src/config.ts                    # Show schema with defaults
  zonfig show -s ./src/config.ts -c ./config.json   # Show merged config
  zonfig show -s ./src/config.ts --no-masked        # Show actual values
  zonfig show -s ./src/config.ts --list-paths       # List all config paths
`;

const CHECK_HELP = `
zonfig check - Run health checks on your configuration setup

Usage:
  zonfig check [options]

Options:
  -s, --schema <file>   Path to schema file (optional, auto-detected)
  -c, --config <file>   Path to config file (optional, auto-detected)
  -d, --dir <directory> Directory to check (default: current directory)
  --fix                 Attempt to fix issues automatically
  -h, --help            Show this help message

Checks performed:
  - Schema file exists and is valid
  - Config files are valid JSON/YAML
  - Config validates against schema
  - Environment variables are set
  - No sensitive values in plain text
  - No encrypted values with missing keys

Examples:
  zonfig check                    # Check current directory
  zonfig check -d ./myapp         # Check specific directory
  zonfig check -s ./schema.ts     # Check with specific schema
  zonfig check --fix              # Fix issues automatically
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
    key?: string;
    paths?: string;
    help?: boolean;
    version?: boolean;
    'dry-run'?: boolean;
    verbose?: boolean;
    all?: boolean;
    package?: string;
    // Migrate command options
    old?: string;
    new?: string;
    auto?: boolean;
    report?: string;
    // Interactive CLI options
    interactive?: boolean;
    fix?: boolean;
    masked?: boolean;
    json?: boolean;
    'list-paths'?: boolean;
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
        key: { type: 'string', short: 'k' },
        paths: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        'dry-run': { type: 'boolean' },
        verbose: { type: 'boolean', short: 'V' },
        all: { type: 'boolean' },
        package: { type: 'string' },
        // Migrate command options
        old: { type: 'string' },
        new: { type: 'string' },
        auto: { type: 'boolean' },
        report: { type: 'string' },
        // Interactive CLI options
        interactive: { type: 'boolean', short: 'i' },
        fix: { type: 'boolean' },
        masked: { type: 'boolean' },
        json: { type: 'boolean' },
        'list-paths': { type: 'boolean' },
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

interface InitOptions {
  projectName: string;
  envPrefix: string;
  configPath: string;
  sections: string[];
  generateDocs: boolean;
  configFormat: 'json' | 'yaml';
}

async function runInteractiveInit(): Promise<InitOptions> {
  console.log('\n  Welcome to zonfig! Let\'s set up your configuration.\n');

  const projectName = await input({
    message: 'Project name:',
    default: 'my-app',
  });

  const envPrefix = await input({
    message: 'Environment variable prefix:',
    default: projectName.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_',
  });

  const configPath = await input({
    message: 'Config file location:',
    default: 'src/config.ts',
  });

  const configFormat = await select({
    message: 'Default config file format:',
    choices: [
      { name: 'JSON', value: 'json' as const },
      { name: 'YAML', value: 'yaml' as const },
    ],
    default: 'json',
  });

  const sections = await checkbox({
    message: 'Which config sections do you need?',
    choices: [
      { name: 'Server (host, port)', value: 'server', checked: true },
      { name: 'Database (url, poolSize)', value: 'database', checked: true },
      { name: 'Logging (level)', value: 'logging', checked: true },
      { name: 'Auth (secret, expiresIn)', value: 'auth', checked: false },
      { name: 'Redis (url)', value: 'redis', checked: false },
      { name: 'Email (smtp settings)', value: 'email', checked: false },
    ],
  });

  const generateDocs = await confirm({
    message: 'Generate documentation after setup?',
    default: true,
  });

  return {
    projectName,
    envPrefix,
    configPath,
    sections,
    generateDocs,
    configFormat,
  };
}

function generateSchemaCode(options: InitOptions): string {
  const sections: string[] = [];
  const imports = ['defineConfig', 'z', 'ConfigValidationError'];

  if (options.sections.includes('server')) {
    sections.push(`  server: z.object({
    host: z.string().default('localhost'),
    port: z.number().min(1).max(65535).default(3000),
  })`);
  }

  if (options.sections.includes('database')) {
    sections.push(`  database: z.object({
    url: z.string().url(),
    poolSize: z.number().min(1).max(100).default(10),
  })`);
  }

  if (options.sections.includes('logging')) {
    sections.push(`  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  })`);
  }

  if (options.sections.includes('auth')) {
    sections.push(`  auth: z.object({
    secret: z.string().min(32),
    expiresIn: z.string().default('7d'),
  })`);
  }

  if (options.sections.includes('redis')) {
    sections.push(`  redis: z.object({
    url: z.string().url().optional(),
    enabled: z.boolean().default(false),
  })`);
  }

  if (options.sections.includes('email')) {
    sections.push(`  email: z.object({
    host: z.string().optional(),
    port: z.number().default(587),
    user: z.string().optional(),
    password: z.string().optional(),
    from: z.string().email().optional(),
  })`);
  }

  const configExt = options.configFormat === 'yaml' ? 'yaml' : 'json';

  return `import { ${imports.join(', ')} } from '@zonfig/zonfig';

// Define your application's configuration schema
export const schema = z.object({
${sections.join(',\n\n')},
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
        { type: 'file', path: './config/default.${configExt}' },
        { type: 'file', path: \`./config/\${env}.${configExt}\`, optional: true },
        { type: 'env', prefix: '${options.envPrefix}' },
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
}

function generateDefaultConfig(options: InitOptions): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  if (options.sections.includes('server')) {
    config.server = { host: 'localhost', port: 3000 };
  }

  if (options.sections.includes('database')) {
    config.database = { url: 'postgres://localhost:5432/myapp', poolSize: 10 };
  }

  if (options.sections.includes('logging')) {
    config.logging = { level: 'info' };
  }

  if (options.sections.includes('auth')) {
    config.auth = { secret: 'change-this-to-a-secure-secret-key-32chars', expiresIn: '7d' };
  }

  if (options.sections.includes('redis')) {
    config.redis = { enabled: false };
  }

  if (options.sections.includes('email')) {
    config.email = { port: 587 };
  }

  return config;
}

function generateEnvExample(options: InitOptions): string {
  const lines: string[] = ['# Configuration Environment Variables', ''];
  const prefix = options.envPrefix;

  if (options.sections.includes('server')) {
    lines.push('# Server');
    lines.push(`${prefix}SERVER__HOST=localhost`);
    lines.push(`${prefix}SERVER__PORT=3000`);
    lines.push('');
  }

  if (options.sections.includes('database')) {
    lines.push('# Database');
    lines.push(`${prefix}DATABASE__URL=postgres://localhost:5432/myapp`);
    lines.push(`${prefix}DATABASE__POOL_SIZE=10`);
    lines.push('');
  }

  if (options.sections.includes('logging')) {
    lines.push('# Logging');
    lines.push(`${prefix}LOGGING__LEVEL=info`);
    lines.push('');
  }

  if (options.sections.includes('auth')) {
    lines.push('# Auth');
    lines.push(`${prefix}AUTH__SECRET=change-this-to-a-secure-secret-key-32chars`);
    lines.push(`${prefix}AUTH__EXPIRES_IN=7d`);
    lines.push('');
  }

  if (options.sections.includes('redis')) {
    lines.push('# Redis');
    lines.push(`${prefix}REDIS__URL=redis://localhost:6379`);
    lines.push(`${prefix}REDIS__ENABLED=false`);
    lines.push('');
  }

  if (options.sections.includes('email')) {
    lines.push('# Email');
    lines.push(`${prefix}EMAIL__HOST=smtp.example.com`);
    lines.push(`${prefix}EMAIL__PORT=587`);
    lines.push(`${prefix}EMAIL__USER=`);
    lines.push(`${prefix}EMAIL__PASSWORD=`);
    lines.push(`${prefix}EMAIL__FROM=noreply@example.com`);
    lines.push('');
  }

  return lines.join('\n');
}

async function commandInit(args: ParsedArgs): Promise<void> {
  if (args.values.help) {
    console.log(INIT_HELP);
    return;
  }

  const targetDir = resolve(process.cwd(), args.values.dir || '.');
  const isInteractive = args.values.interactive || false;

  // Get configuration options
  let options: InitOptions;

  if (isInteractive) {
    try {
      options = await runInteractiveInit();
    } catch {
      // User cancelled (Ctrl+C)
      console.log('\n  Setup cancelled.\n');
      return;
    }
  } else {
    // Default options for non-interactive mode
    options = {
      projectName: 'my-app',
      envPrefix: 'APP_',
      configPath: 'src/config.ts',
      sections: ['server', 'database', 'logging'],
      generateDocs: false,
      configFormat: 'json',
    };
  }

  console.log(`\nInitializing zonfig in: ${targetDir}\n`);

  // Create directories
  const configDir = resolve(targetDir, options.configPath.replace(/\/[^/]+$/, ''));
  try {
    await mkdir(configDir, { recursive: true });
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

  // Generate files
  const configTs = generateSchemaCode(options);
  const defaultConfig = generateDefaultConfig(options);
  const envExample = generateEnvExample(options);

  // Determine file paths and formats
  const configTsPath = resolve(targetDir, options.configPath);
  const configExt = options.configFormat === 'yaml' ? 'yaml' : 'json';
  const defaultConfigPath = resolve(targetDir, `config/default.${configExt}`);
  const envExamplePath = resolve(targetDir, '.env.example');

  // Write files
  if (existsSync(configTsPath)) {
    console.log(`  Skipped: ${configTsPath} (already exists)`);
  } else {
    await writeFile(configTsPath, configTs);
    console.log(`  Created: ${configTsPath}`);
  }

  if (existsSync(defaultConfigPath)) {
    console.log(`  Skipped: ${defaultConfigPath} (already exists)`);
  } else {
    if (options.configFormat === 'yaml') {
      const { stringify } = await import('yaml');
      await writeFile(defaultConfigPath, stringify(defaultConfig));
    } else {
      await writeFile(defaultConfigPath, JSON.stringify(defaultConfig, null, 2));
    }
    console.log(`  Created: ${defaultConfigPath}`);
  }

  if (existsSync(envExamplePath)) {
    console.log(`  Skipped: ${envExamplePath} (already exists)`);
  } else {
    await writeFile(envExamplePath, envExample);
    console.log(`  Created: ${envExamplePath}`);
  }

  // Generate docs if requested
  if (options.generateDocs) {
    console.log('\nGenerating documentation...');
    try {
      const schema = await loadSchemaFromFile(configTsPath);
      const markdown = generateDocs(schema, { format: 'markdown', title: `${options.projectName} Configuration` });
      const docsPath = resolve(targetDir, 'CONFIG.md');
      await writeFile(docsPath, markdown);
      console.log(`  Created: ${docsPath}`);
    } catch (error) {
      console.log(`  Skipped: Could not generate docs (${error instanceof Error ? error.message : 'unknown error'})`);
    }
  }

  console.log(`
Setup complete! Next steps:

  1. Install zonfig:
     npm install @zonfig/zonfig

  2. Import and use the config:
     import { loadConfig } from './${options.configPath.replace('.ts', '.js')}';
     const config = await loadConfig();
     console.log(config.get('server.port'));

  3. Generate documentation:
     npx zonfig docs -s ./${options.configPath}
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

async function loadConfigFile(configPath: string): Promise<{ data: Record<string, unknown>; format: 'json' | 'yaml' }> {
  const absolutePath = resolve(process.cwd(), configPath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  const content = await readFile(absolutePath, 'utf-8');

  if (configPath.endsWith('.json')) {
    return { data: JSON.parse(content), format: 'json' };
  } else if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
    const { parse } = await import('yaml');
    return { data: parse(content), format: 'yaml' };
  } else {
    throw new Error('Config file must be .json, .yaml, or .yml');
  }
}

async function writeConfigFile(outputPath: string, data: Record<string, unknown>, format: 'json' | 'yaml'): Promise<void> {
  let content: string;

  if (format === 'json') {
    content = JSON.stringify(data, null, 2);
  } else {
    const { stringify } = await import('yaml');
    content = stringify(data);
  }

  await writeFile(outputPath, content);
}

async function commandEncrypt(args: ParsedArgs): Promise<void> {
  if (args.values.help) {
    console.log(ENCRYPT_HELP);
    return;
  }

  const configPath = args.values.config;
  if (!configPath) {
    console.error('Error: --config (-c) is required\n');
    console.log(ENCRYPT_HELP);
    process.exit(1);
  }

  const outputPath = args.values.output || configPath;
  const key = args.values.key || process.env.ZONFIG_ENCRYPTION_KEY;
  const pathsArg = args.values.paths;

  if (!key) {
    console.error('Error: Encryption key is required.\n');
    console.error('Set ZONFIG_ENCRYPTION_KEY environment variable or use --key (-k) option.\n');
    console.log(ENCRYPT_HELP);
    process.exit(1);
  }

  console.log(`Encrypting: ${configPath}`);

  try {
    const { data, format } = await loadConfigFile(configPath);

    // Check if already has encrypted values
    const existingCount = countEncryptedValues(data);
    if (existingCount > 0) {
      console.log(`  Note: File already contains ${existingCount} encrypted value(s)`);
    }

    // Parse paths if provided
    const paths = pathsArg ? pathsArg.split(',').map((p) => p.trim()) : undefined;

    const encrypted = encryptObject(data, {
      key,
      paths,
      useSensitivePatterns: !paths, // Use patterns only if no specific paths
    });

    const newCount = countEncryptedValues(encrypted);
    const encryptedCount = newCount - existingCount;

    if (encryptedCount === 0) {
      console.log('\nNo values were encrypted.');
      if (paths) {
        console.log('Specified paths may not exist or are already encrypted.');
      } else {
        console.log('No sensitive keys found. Use --paths to specify values to encrypt.');
      }
      return;
    }

    await writeConfigFile(resolve(process.cwd(), outputPath), encrypted, format);

    console.log(`\n  Encrypted ${encryptedCount} value(s)`);
    console.log(`  Output: ${outputPath}`);
    console.log('\nEncryption complete!');
  } catch (error) {
    console.error(`\nError: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function commandDecrypt(args: ParsedArgs): Promise<void> {
  if (args.values.help) {
    console.log(DECRYPT_HELP);
    return;
  }

  const configPath = args.values.config;
  if (!configPath) {
    console.error('Error: --config (-c) is required\n');
    console.log(DECRYPT_HELP);
    process.exit(1);
  }

  const outputPath = args.values.output || configPath;
  const key = args.values.key || process.env.ZONFIG_ENCRYPTION_KEY;

  if (!key) {
    console.error('Error: Decryption key is required.\n');
    console.error('Set ZONFIG_ENCRYPTION_KEY environment variable or use --key (-k) option.\n');
    console.log(DECRYPT_HELP);
    process.exit(1);
  }

  console.log(`Decrypting: ${configPath}`);

  try {
    const { data, format } = await loadConfigFile(configPath);

    const encryptedCount = countEncryptedValues(data);
    if (encryptedCount === 0) {
      console.log('\nNo encrypted values found in file.');
      return;
    }

    console.log(`  Found ${encryptedCount} encrypted value(s)`);

    const decrypted = decryptObject(data, { key });

    await writeConfigFile(resolve(process.cwd(), outputPath), decrypted, format);

    console.log(`  Output: ${outputPath}`);
    console.log('\nDecryption complete!');
  } catch (error) {
    console.error(`\nError: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function commandMigrate(args: ParsedArgs): Promise<void> {
  if (args.values.help) {
    console.log(MIGRATE_HELP);
    return;
  }

  const oldSchemaPath = args.values.old;
  const newSchemaPath = args.values.new;

  if (!oldSchemaPath || !newSchemaPath) {
    console.error('Error: Both --old and --new schema paths are required\n');
    console.log(MIGRATE_HELP);
    process.exit(1);
  }

  const configPath = args.values.config;
  const outputPath = args.values.output;
  const autoMigrate = args.values.auto || false;
  const reportPath = args.values.report;

  console.log('Schema Migration Analysis');
  console.log('=========================\n');
  console.log(`  Old schema: ${oldSchemaPath}`);
  console.log(`  New schema: ${newSchemaPath}`);
  if (configPath) {
    console.log(`  Config: ${configPath}`);
  }
  console.log('');

  try {
    // Load both schemas
    console.log('Loading schemas...');
    const oldSchema = await loadSchemaFromFile(oldSchemaPath);
    const newSchema = await loadSchemaFromFile(newSchemaPath);
    console.log('  Schemas loaded successfully\n');

    // Compare schemas
    console.log('Comparing schemas...');
    const diff = diffSchemas(oldSchema, newSchema);

    // Generate report
    const report = generateMigrationReport(diff);

    // Output report
    if (reportPath) {
      await writeFile(resolve(process.cwd(), reportPath), report);
      console.log(`  Report written to: ${reportPath}\n`);
    } else {
      console.log('\n' + report);
    }

    // Summary
    console.log('Summary:');
    console.log(`  Breaking changes: ${diff.breaking.length}`);
    console.log(`  Warnings: ${diff.warnings.length}`);
    console.log(`  Info: ${diff.info.length}`);

    if (diff.hasBreakingChanges) {
      console.log('\n  ⚠️  Breaking changes detected! Manual migration may be required.');
    }

    // If config provided, validate and optionally migrate
    if (configPath) {
      console.log('\nValidating config against changes...');
      const { data, format } = await loadConfigFile(configPath);

      const validation = validateConfigAgainstChanges(data, diff);

      if (validation.valid) {
        console.log('  ✓ Config is compatible with schema changes');
      } else {
        console.log('  ✗ Config has compatibility issues:');
        for (const error of validation.errors) {
          console.log(`    - ${error}`);
        }
      }

      // Auto-migrate if requested
      if (autoMigrate) {
        console.log('\nApplying automatic migrations...');
        const migration = applyAutoMigrations(data, diff, newSchema);

        if (migration.applied.length > 0) {
          console.log('  Applied migrations:');
          for (const applied of migration.applied) {
            console.log(`    ✓ ${applied}`);
          }
        }

        if (migration.manual.length > 0) {
          console.log('  Manual migrations required:');
          for (const manual of migration.manual) {
            console.log(`    ⚠ ${manual}`);
          }
        }

        if (outputPath) {
          await writeConfigFile(resolve(process.cwd(), outputPath), migration.config, format);
          console.log(`\n  Migrated config written to: ${outputPath}`);
        } else if (migration.applied.length > 0) {
          console.log('\n  Use -o/--output to save migrated config');
        }
      }
    }

    // Exit with error code if breaking changes
    if (diff.hasBreakingChanges && !autoMigrate) {
      process.exit(1);
    }

  } catch (error) {
    console.error(`\nError: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

interface SchemaFieldInfo {
  type: string;
  isOptional?: boolean;
  hasDefault?: boolean;
  defaultValue?: unknown;
  children?: Record<string, SchemaFieldInfo>;
}

function extractDefaults(info: SchemaFieldInfo): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (info.children) {
    for (const [key, child] of Object.entries(info.children)) {
      if (child.children) {
        // Nested object
        result[key] = extractDefaults(child);
      } else if (child.hasDefault) {
        result[key] = child.defaultValue;
      } else if (child.isOptional) {
        // Skip optional without default
      } else {
        result[key] = `<${child.type.replace('Zod', '').toLowerCase()} required>`;
      }
    }
  }

  return result;
}

async function commandShow(args: ParsedArgs): Promise<void> {
  if (args.values.help) {
    console.log(SHOW_HELP);
    return;
  }

  const schemaPath = args.values.schema;
  const configPath = args.values.config;
  const masked = args.values.masked !== false; // Default true
  const outputJson = args.values.json || false;
  const showPathsOnly = args.values['list-paths'] || false;

  if (!schemaPath) {
    console.error('Error: --schema (-s) is required\n');
    console.log(SHOW_HELP);
    process.exit(1);
  }

  try {
    // Load schema
    const schema = await loadSchemaFromFile(schemaPath);

    // Get default values from schema or load config
    let finalConfig: Record<string, unknown>;

    if (configPath) {
      // Config file provided - load and validate
      const { data } = await loadConfigFile(configPath);
      const result = schema.safeParse(data);
      if (!result.success) {
        console.error('Config validation errors:');
        for (const issue of result.error.issues.slice(0, 5)) {
          console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
        }
        if (result.error.issues.length > 5) {
          console.error(`  ... and ${result.error.issues.length - 5} more`);
        }
        process.exit(1);
      }
      finalConfig = result.data as Record<string, unknown>;
    } else {
      // No config file - extract defaults from schema
      const { extractSchemaInfo } = await import('../utils/schema-diff.js');
      const schemaInfo = extractSchemaInfo(schema);
      finalConfig = extractDefaults(schemaInfo);
    }

    // Mask sensitive values if requested
    let displayConfig = finalConfig;
    if (masked) {
      const { maskObject } = await import('../utils/mask.js');
      displayConfig = maskObject(finalConfig);
    }

    // Output format
    if (outputJson) {
      console.log(JSON.stringify(displayConfig, null, 2));
      return;
    }

    if (showPathsOnly) {
      console.log('Configuration Paths:');
      console.log('====================\n');
      const paths: string[] = [];

      function collectPaths(obj: unknown, path: string[] = []): void {
        if (!obj || typeof obj !== 'object') {
          paths.push(path.join('.'));
          return;
        }
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            collectPaths(value, [...path, key]);
          } else {
            paths.push([...path, key].join('.'));
          }
        }
      }

      collectPaths(displayConfig);
      for (const p of paths.sort()) {
        console.log(`  ${p}`);
      }
      return;
    }

    // Tree view
    console.log('Configuration:');
    console.log('==============\n');

    function printTree(obj: unknown, prefix = '', isLast = true): void {
      if (!obj || typeof obj !== 'object') return;

      const entries = Object.entries(obj);
      entries.forEach(([key, value], index) => {
        const isLastEntry = index === entries.length - 1;
        const connector = isLastEntry ? '└── ' : '├── ';
        const childPrefix = isLastEntry ? '    ' : '│   ';

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          console.log(`${prefix}${connector}${key}:`);
          printTree(value, prefix + childPrefix, isLastEntry);
        } else {
          const displayValue = formatValue(value);
          console.log(`${prefix}${connector}${key}: ${displayValue}`);
        }
      });
    }

    function formatValue(value: unknown): string {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (typeof value === 'string') {
        if (value.length > 50) {
          return `"${value.slice(0, 47)}..."`;
        }
        return `"${value}"`;
      }
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      if (typeof value === 'number') return String(value);
      if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        if (value.length <= 3) {
          return `[${value.map(formatValue).join(', ')}]`;
        }
        return `[${value.slice(0, 3).map(formatValue).join(', ')}, ... (${value.length} items)]`;
      }
      return String(value);
    }

    printTree(displayConfig);

    // Summary
    const pathCount = countPaths(displayConfig);
    console.log(`\n${pathCount} configuration values`);
    if (configPath) {
      console.log(`Loaded from: ${configPath}`);
    } else {
      console.log('Using schema defaults');
    }
    if (masked) {
      console.log('Sensitive values are masked');
    }

  } catch (error) {
    console.error(`\nError: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

function countPaths(obj: unknown): number {
  if (!obj || typeof obj !== 'object') return 1;
  let count = 0;
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      count += countPaths(value);
    } else {
      count += 1;
    }
  }
  return count;
}

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  fixable?: boolean;
}

async function commandCheck(args: ParsedArgs): Promise<void> {
  if (args.values.help) {
    console.log(CHECK_HELP);
    return;
  }

  const targetDir = resolve(process.cwd(), args.values.dir || '.');
  const schemaPath = args.values.schema;
  const configPath = args.values.config;
  const shouldFix = args.values.fix || false;

  console.log('zonfig Health Check');
  console.log('===================\n');
  console.log(`  Directory: ${targetDir}\n`);

  const results: CheckResult[] = [];

  // Check 1: Look for schema file
  const possibleSchemas = [
    schemaPath,
    'src/config.ts',
    'config.ts',
    'src/schema.ts',
    'schema.ts',
    'lib/config.ts',
  ].filter(Boolean) as string[];

  let foundSchemaPath: string | null = null;
  for (const sp of possibleSchemas) {
    const fullPath = resolve(targetDir, sp);
    if (existsSync(fullPath)) {
      foundSchemaPath = fullPath;
      break;
    }
  }

  if (foundSchemaPath) {
    results.push({
      name: 'Schema file',
      status: 'pass',
      message: `Found at ${foundSchemaPath.replace(targetDir + '/', '')}`,
    });
  } else {
    results.push({
      name: 'Schema file',
      status: 'fail',
      message: 'No schema file found. Run `zonfig init` to create one.',
      fixable: true,
    });
  }

  // Check 2: Look for config files
  const possibleConfigs = [
    configPath,
    'config/default.json',
    'config/default.yaml',
    'config/default.yml',
    'config.json',
    'config.yaml',
  ].filter(Boolean) as string[];

  let foundConfigPath: string | null = null;
  for (const cp of possibleConfigs) {
    const fullPath = resolve(targetDir, cp);
    if (existsSync(fullPath)) {
      foundConfigPath = fullPath;
      break;
    }
  }

  if (foundConfigPath) {
    results.push({
      name: 'Config file',
      status: 'pass',
      message: `Found at ${foundConfigPath.replace(targetDir + '/', '')}`,
    });

    // Check 3: Validate config syntax
    try {
      await loadConfigFile(foundConfigPath.replace(targetDir + '/', ''));
      results.push({
        name: 'Config syntax',
        status: 'pass',
        message: 'Valid JSON/YAML syntax',
      });
    } catch (error) {
      results.push({
        name: 'Config syntax',
        status: 'fail',
        message: `Invalid syntax: ${error instanceof Error ? error.message : 'unknown error'}`,
      });
    }
  } else {
    results.push({
      name: 'Config file',
      status: 'warn',
      message: 'No config file found. Using environment variables only.',
    });
  }

  // Check 4: Look for .env.example
  const envExamplePath = resolve(targetDir, '.env.example');
  if (existsSync(envExamplePath)) {
    results.push({
      name: '.env.example',
      status: 'pass',
      message: 'Found',
    });
  } else {
    results.push({
      name: '.env.example',
      status: 'warn',
      message: 'Not found. Run `zonfig docs -f env` to generate.',
      fixable: true,
    });
  }

  // Check 5: Validate schema if found
  if (foundSchemaPath) {
    try {
      const schema = await loadSchemaFromFile(foundSchemaPath);
      results.push({
        name: 'Schema valid',
        status: 'pass',
        message: 'Schema loads and is valid Zod schema',
      });

      // Check 6: Validate config against schema if both found
      if (foundConfigPath) {
        try {
          const { data } = await loadConfigFile(foundConfigPath.replace(targetDir + '/', ''));
          const result = schema.safeParse(data);
          if (result.success) {
            results.push({
              name: 'Config validates',
              status: 'pass',
              message: 'Config matches schema',
            });
          } else {
            const issues = result.error.issues.slice(0, 3);
            results.push({
              name: 'Config validates',
              status: 'fail',
              message: `Validation errors: ${issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
            });
          }
        } catch {
          // Already reported syntax error
        }
      }

      // Check 7: Check for encrypted values without key
      if (foundConfigPath) {
        try {
          const { data } = await loadConfigFile(foundConfigPath.replace(targetDir + '/', ''));
          const encryptedCount = countEncryptedValues(data);
          if (encryptedCount > 0) {
            if (process.env.ZONFIG_ENCRYPTION_KEY) {
              results.push({
                name: 'Encryption key',
                status: 'pass',
                message: `Found ${encryptedCount} encrypted value(s), key is set`,
              });
            } else {
              results.push({
                name: 'Encryption key',
                status: 'warn',
                message: `Found ${encryptedCount} encrypted value(s) but ZONFIG_ENCRYPTION_KEY is not set`,
              });
            }
          }
        } catch {
          // Already reported
        }
      }

      // Check 8: Check for sensitive values in plain text
      if (foundConfigPath) {
        try {
          const { data } = await loadConfigFile(foundConfigPath.replace(targetDir + '/', ''));
          const sensitiveKeys = ['password', 'secret', 'token', 'apiKey', 'api_key', 'privateKey', 'private_key'];
          const foundSensitive: string[] = [];

          function checkForSensitive(obj: unknown, path: string[] = []): void {
            if (!obj || typeof obj !== 'object') return;
            for (const [key, value] of Object.entries(obj)) {
              const currentPath = [...path, key];
              const lowerKey = key.toLowerCase();
              if (sensitiveKeys.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
                if (typeof value === 'string' && !value.startsWith('ENC[')) {
                  foundSensitive.push(currentPath.join('.'));
                }
              }
              if (typeof value === 'object') {
                checkForSensitive(value, currentPath);
              }
            }
          }

          checkForSensitive(data);

          if (foundSensitive.length > 0) {
            results.push({
              name: 'Sensitive values',
              status: 'warn',
              message: `Found unencrypted sensitive values: ${foundSensitive.slice(0, 3).join(', ')}${foundSensitive.length > 3 ? '...' : ''}`,
              fixable: true,
            });
          } else {
            results.push({
              name: 'Sensitive values',
              status: 'pass',
              message: 'No unencrypted sensitive values detected',
            });
          }
        } catch {
          // Already reported
        }
      }
    } catch (error) {
      results.push({
        name: 'Schema valid',
        status: 'fail',
        message: `Schema error: ${error instanceof Error ? error.message : 'unknown error'}`,
      });
    }
  }

  // Print results
  console.log('Results:');
  let hasErrors = false;
  let hasWarnings = false;

  for (const result of results) {
    const icon = result.status === 'pass' ? '✓' : result.status === 'warn' ? '⚠' : '✗';
    const color = result.status === 'pass' ? '' : result.status === 'warn' ? '' : '';
    console.log(`  ${icon} ${result.name}: ${result.message}`);
    if (result.status === 'fail') hasErrors = true;
    if (result.status === 'warn') hasWarnings = true;
  }

  // Summary
  console.log('');
  const passCount = results.filter((r) => r.status === 'pass').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;
  const failCount = results.filter((r) => r.status === 'fail').length;

  console.log(`Summary: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`);

  // Offer fixes if available
  if (shouldFix) {
    const fixable = results.filter((r) => r.fixable && r.status !== 'pass');
    if (fixable.length > 0) {
      console.log('\nApplying fixes...');

      for (const result of fixable) {
        if (result.name === 'Schema file') {
          console.log('  Run `zonfig init` to create a schema file');
        } else if (result.name === '.env.example' && foundSchemaPath) {
          try {
            const schema = await loadSchemaFromFile(foundSchemaPath);
            const envContent = generateDocs(schema, { format: 'env-example', prefix: 'APP_' });
            await writeFile(resolve(targetDir, '.env.example'), envContent);
            console.log('  ✓ Created .env.example');
          } catch {
            console.log('  ✗ Could not generate .env.example');
          }
        } else if (result.name === 'Sensitive values' && foundConfigPath) {
          console.log('  Run `zonfig encrypt -c ' + foundConfigPath.replace(targetDir + '/', '') + '` to encrypt sensitive values');
        }
      }
    }
  }

  if (hasErrors) {
    process.exit(1);
  }
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
      await commandValidate(args);
      break;

    case 'check':
    case 'health':
      await commandCheck(args);
      break;

    case 'show':
    case 'view':
    case 'browse':
      await commandShow(args);
      break;

    case 'analyze':
    case 'scan':
      await commandAnalyze(args);
      break;

    case 'migrate':
    case 'diff':
      await commandMigrate(args);
      break;

    case 'encrypt':
      await commandEncrypt(args);
      break;

    case 'decrypt':
      await commandDecrypt(args);
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
