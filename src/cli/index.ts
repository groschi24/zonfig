import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { generateDocs } from '../documentation/index.js';
import { analyzeProject } from './analyze.js';
import { encryptObject, decryptObject, countEncryptedValues, hasEncryptedValues } from '../utils/encrypt.js';
import { diffSchemas, generateMigrationReport, validateConfigAgainstChanges, applyAutoMigrations } from '../utils/schema-diff.js';
import { z } from 'zod';

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
