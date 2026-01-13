import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { detectMonorepo, formatMonorepoInfo, type MonorepoInfo, type MonorepoPackage } from './monorepo.js';

interface ConfigValue {
  key: string;
  value: string | undefined;
  source: string;
  inferredType: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'json' | 'unknown';
  isSecret: boolean;
  occurrences: number;
  package?: string; // For monorepo: which package this belongs to
}

interface AnalysisResult {
  envFiles: string[];
  configFiles: string[];
  existingLibraries: string[];
  frameworkDetected: string | null;
  configValues: Map<string, ConfigValue>;
  envUsageInCode: Map<string, string[]>; // env var -> files where used
  monorepo?: MonorepoInfo;
}

interface AnalyzeOptions {
  dir: string;
  output: string;
  dryRun: boolean;
  verbose: boolean;
  package?: string; // Specific package to analyze in monorepo
  all?: boolean; // Analyze all packages in monorepo
}

// Patterns that suggest a value is a secret
const SECRET_PATTERNS = [
  /secret/i, /password/i, /passwd/i, /key/i, /token/i,
  /auth/i, /credential/i, /private/i, /api_key/i, /apikey/i,
];

// Known config libraries
const CONFIG_LIBRARIES = [
  'dotenv', 'dotenv-expand', 'dotenv-flow',
  'config', 'convict', 'nconf', 'rc',
  'env-var', 'envalid', 'dotenv-safe',
  '@nestjs/config', 'conf', 'cosmiconfig',
];

// Framework detection
const FRAMEWORK_INDICATORS: Record<string, string[]> = {
  'next.js': ['next.config.js', 'next.config.mjs', 'next.config.ts', '.next'],
  'nuxt': ['nuxt.config.js', 'nuxt.config.ts', '.nuxt'],
  'vite': ['vite.config.js', 'vite.config.ts'],
  'remix': ['remix.config.js'],
  'express': ['express'],
  'nestjs': ['@nestjs/core'],
  'fastify': ['fastify'],
  'react': ['react', 'react-dom'],
  'vue': ['vue'],
  'svelte': ['svelte'],
  'angular': ['@angular/core'],
};

/**
 * Analyze an existing project for configuration
 */
export async function analyzeProject(options: AnalyzeOptions): Promise<void> {
  const { dir, output, dryRun, verbose } = options;
  const targetDir = resolve(process.cwd(), dir);

  console.log(`\nAnalyzing project: ${targetDir}\n`);

  // Check for monorepo
  const monorepoInfo = await detectMonorepo(targetDir);

  if (monorepoInfo.isMonorepo) {
    console.log('='.repeat(50));
    console.log(formatMonorepoInfo(monorepoInfo));
    console.log('='.repeat(50));
    console.log('');

    // Handle monorepo analysis
    if (options.all) {
      // Analyze all packages
      await analyzeMonorepoAll(targetDir, monorepoInfo, options);
      return;
    } else if (options.package) {
      // Analyze specific package
      const pkg = monorepoInfo.packages.find(
        p => p.name === options.package || p.relativePath === options.package
      );
      if (!pkg) {
        console.error(`Package not found: ${options.package}`);
        console.error('Available packages:');
        for (const p of monorepoInfo.packages) {
          console.error(`  - ${p.name} (${p.relativePath})`);
        }
        process.exit(1);
      }
      // Analyze single package with shared config
      await analyzeSinglePackage(targetDir, pkg, monorepoInfo, options);
      return;
    } else {
      // Prompt user for what to do
      console.log('This is a monorepo. You can:');
      console.log('  --all              Analyze all packages and generate config for each');
      console.log('  --package <name>   Analyze a specific package');
      console.log('');
      console.log('Example:');
      console.log(`  zonfig analyze --all`);
      console.log(`  zonfig analyze --package ${monorepoInfo.packages[0]?.name || 'my-app'}`);
      console.log('');
      console.log('Continuing with root-level analysis only...');
      console.log('');
    }
  }

  const result: AnalysisResult = {
    envFiles: [],
    configFiles: [],
    existingLibraries: [],
    frameworkDetected: null,
    configValues: new Map(),
    envUsageInCode: new Map(),
  };

  // Step 1: Find .env files
  console.log('Scanning for .env files...');
  result.envFiles = await findEnvFiles(targetDir);
  if (verbose) {
    result.envFiles.forEach(f => console.log(`  Found: ${f}`));
  }
  console.log(`  Found ${result.envFiles.length} .env file(s)`);

  // Step 2: Find config files
  console.log('\nScanning for config files...');
  result.configFiles = await findConfigFiles(targetDir);
  if (verbose) {
    result.configFiles.forEach(f => console.log(`  Found: ${f}`));
  }
  console.log(`  Found ${result.configFiles.length} config file(s)`);

  // Step 3: Check package.json for existing libraries
  console.log('\nChecking for existing config libraries...');
  const pkgJsonPath = join(targetDir, 'package.json');
  if (existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf-8'));
    const allDeps = {
      ...pkgJson.dependencies,
      ...pkgJson.devDependencies,
    };

    result.existingLibraries = CONFIG_LIBRARIES.filter(lib => lib in allDeps);
    result.frameworkDetected = detectFramework(allDeps, targetDir);

    if (result.existingLibraries.length > 0) {
      console.log(`  Found: ${result.existingLibraries.join(', ')}`);
    } else {
      console.log('  No existing config libraries found');
    }

    if (result.frameworkDetected) {
      console.log(`  Framework detected: ${result.frameworkDetected}`);
    }
  }

  // Step 4: Parse env files
  console.log('\nParsing configuration values...');
  for (const envFile of result.envFiles) {
    await parseEnvFile(envFile, result.configValues);
  }

  // Step 5: Parse config files
  for (const configFile of result.configFiles) {
    await parseConfigFile(configFile, result.configValues);
  }

  // Step 6: Scan source code for process.env usage
  console.log('\nScanning source code for env var usage...');
  await scanSourceCode(targetDir, result.envUsageInCode);

  // Add any env vars found in code but not in .env files
  for (const [envVar, files] of result.envUsageInCode) {
    if (!result.configValues.has(envVar)) {
      result.configValues.set(envVar, {
        key: envVar,
        value: undefined,
        source: `code (${files.length} file(s))`,
        inferredType: 'string',
        isSecret: SECRET_PATTERNS.some(p => p.test(envVar)),
        occurrences: files.length,
      });
    } else {
      const existing = result.configValues.get(envVar)!;
      existing.occurrences = files.length;
    }
  }

  console.log(`  Found ${result.configValues.size} unique config value(s)`);

  // Step 7: Generate schema
  console.log('\nGenerating Zod schema...');
  const schema = generateSchema(result, options);

  if (dryRun) {
    console.log('\n--- Generated Schema (dry run) ---\n');
    console.log(schema);
    console.log('\n--- End Schema ---\n');
  } else {
    const outputPath = resolve(targetDir, output);
    await writeFile(outputPath, schema);
    console.log(`  Written to: ${outputPath}`);
  }

  // Step 8: Generate summary report
  printSummary(result);

  // Step 9: Migration hints
  if (result.existingLibraries.length > 0) {
    printMigrationHints(result);
  }
}

/**
 * Find all .env files in the project
 */
async function findEnvFiles(dir: string): Promise<string[]> {
  const envFiles: string[] = [];
  const patterns = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.development.local',
    '.env.test',
    '.env.test.local',
    '.env.staging',
    '.env.staging.local',
    '.env.production',
    '.env.production.local',
    '.env.example',
    '.env.sample',
    '.env.template',
  ];

  for (const pattern of patterns) {
    const filePath = join(dir, pattern);
    if (existsSync(filePath)) {
      envFiles.push(filePath);
    }
  }

  return envFiles;
}

/**
 * Find config files (JSON, YAML) in common locations
 */
async function findConfigFiles(dir: string): Promise<string[]> {
  const configFiles: string[] = [];
  const configDirs = ['config', 'configs', 'conf', 'settings'];
  const extensions = ['.json', '.yaml', '.yml'];

  // Check root level config files
  const rootConfigs = ['config.json', 'config.yaml', 'config.yml', 'settings.json'];
  for (const file of rootConfigs) {
    const filePath = join(dir, file);
    if (existsSync(filePath)) {
      configFiles.push(filePath);
    }
  }

  // Check config directories
  for (const configDir of configDirs) {
    const configPath = join(dir, configDir);
    if (existsSync(configPath)) {
      try {
        const files = await readdir(configPath);
        for (const file of files) {
          if (extensions.some(ext => file.endsWith(ext))) {
            configFiles.push(join(configPath, file));
          }
        }
      } catch {
        // Ignore errors reading directory
      }
    }
  }

  return configFiles;
}

/**
 * Detect framework from dependencies and file structure
 */
function detectFramework(deps: Record<string, string>, dir: string): string | null {
  for (const [framework, indicators] of Object.entries(FRAMEWORK_INDICATORS)) {
    for (const indicator of indicators) {
      // Check if it's a dependency
      if (indicator in deps) {
        return framework;
      }
      // Check if it's a file/folder
      if (existsSync(join(dir, indicator))) {
        return framework;
      }
    }
  }
  return null;
}

/**
 * Parse a .env file and extract values
 */
async function parseEnvFile(
  filePath: string,
  values: Map<string, ConfigValue>
): Promise<void> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const fileName = relative(process.cwd(), filePath);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    const existing = values.get(key);
    if (existing) {
      // Update with more specific info if this is not an example file
      if (!filePath.includes('example') && !filePath.includes('sample')) {
        existing.value = value;
        existing.source = fileName;
        existing.inferredType = inferType(value);
      }
    } else {
      values.set(key, {
        key,
        value: filePath.includes('example') || filePath.includes('sample') ? undefined : value,
        source: fileName,
        inferredType: inferType(value),
        isSecret: SECRET_PATTERNS.some(p => p.test(key)),
        occurrences: 0,
      });
    }
  }
}

/**
 * Parse a JSON/YAML config file
 */
async function parseConfigFile(
  filePath: string,
  values: Map<string, ConfigValue>
): Promise<void> {
  const content = await readFile(filePath, 'utf-8');
  const fileName = relative(process.cwd(), filePath);

  let data: Record<string, unknown>;
  try {
    if (filePath.endsWith('.json')) {
      data = JSON.parse(content);
    } else {
      data = parseYaml(content) as Record<string, unknown>;
    }
  } catch {
    return; // Skip invalid files
  }

  // Flatten nested config to dot notation
  function flatten(obj: Record<string, unknown>, prefix = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        flatten(value as Record<string, unknown>, fullKey);
      } else {
        const strValue = String(value);
        values.set(fullKey, {
          key: fullKey,
          value: strValue,
          source: fileName,
          inferredType: inferTypeFromValue(value),
          isSecret: SECRET_PATTERNS.some(p => p.test(fullKey)),
          occurrences: 0,
        });
      }
    }
  }

  flatten(data);
}

/**
 * Scan source code for process.env usage
 */
async function scanSourceCode(
  dir: string,
  envUsage: Map<string, string[]>
): Promise<void> {
  const srcDirs = ['src', 'app', 'lib', 'pages', 'components', 'server', 'api'];
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue', '.svelte'];

  // Patterns to match env var access
  const patterns = [
    /process\.env\.([A-Z_][A-Z0-9_]*)/g,
    /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
    /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g,
    /\$env\/static\/(?:private|public)\.([A-Z_][A-Z0-9_]*)/g,
  ];

  async function scanDirectory(scanDir: string): Promise<void> {
    if (!existsSync(scanDir)) return;

    try {
      const entries = await readdir(scanDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(scanDir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and hidden directories
          if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
            continue;
          }
          await scanDirectory(fullPath);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          await scanFile(fullPath);
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  async function scanFile(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const relPath = relative(process.cwd(), filePath);

      for (const pattern of patterns) {
        let match;
        // Reset regex state
        pattern.lastIndex = 0;
        while ((match = pattern.exec(content)) !== null) {
          const envVar = match[1];
          if (envVar) {
            const files = envUsage.get(envVar) || [];
            if (!files.includes(relPath)) {
              files.push(relPath);
            }
            envUsage.set(envVar, files);
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  // Scan root level files
  await scanDirectory(dir);

  // Scan common source directories
  for (const srcDir of srcDirs) {
    await scanDirectory(join(dir, srcDir));
  }
}

/**
 * Infer type from string value
 */
function inferType(value: string): ConfigValue['inferredType'] {
  if (!value) return 'string';

  // Boolean
  if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
    return 'boolean';
  }

  // Number
  if (/^-?\d+$/.test(value) || /^-?\d*\.\d+$/.test(value)) {
    return 'number';
  }

  // URL
  if (/^https?:\/\//i.test(value) || /^(postgres|mysql|mongodb|redis):\/\//i.test(value)) {
    return 'url';
  }

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'email';
  }

  // JSON
  if ((value.startsWith('{') && value.endsWith('}')) ||
      (value.startsWith('[') && value.endsWith(']'))) {
    try {
      JSON.parse(value);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }

  return 'string';
}

/**
 * Infer type from actual value (for JSON/YAML)
 */
function inferTypeFromValue(value: unknown): ConfigValue['inferredType'] {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return inferType(value);
  return 'unknown';
}

/**
 * Generate Zod schema from analysis result
 */
function generateSchema(result: AnalysisResult, options: AnalyzeOptions): string {
  const lines: string[] = [];

  lines.push(`import { defineConfig, z, ConfigValidationError } from 'zonfig';`);
  lines.push('');
  lines.push('// Auto-generated schema from project analysis');
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push(`// Source: ${result.envFiles.length} .env file(s), ${result.configFiles.length} config file(s)`);

  if (result.frameworkDetected) {
    lines.push(`// Framework: ${result.frameworkDetected}`);
  }

  if (result.existingLibraries.length > 0) {
    lines.push(`// Existing libraries: ${result.existingLibraries.join(', ')}`);
  }

  lines.push('');

  // Group values by prefix (e.g., DATABASE_, API_, etc.)
  const groups = new Map<string, ConfigValue[]>();

  for (const [, value] of result.configValues) {
    // Determine group from key
    // Keys are like: APP_SERVER__HOST, DATABASE_URL, SERVER_PORT
    let group = 'app';
    const key = value.key;

    // Remove common app prefix first
    let keyWithoutAppPrefix = key;
    const appPrefixes = ['APP_', 'NEXT_PUBLIC_', 'VITE_', 'REACT_APP_'];
    for (const prefix of appPrefixes) {
      if (key.startsWith(prefix)) {
        keyWithoutAppPrefix = key.slice(prefix.length);
        break;
      }
    }

    // Now determine group from remaining key
    const parts = keyWithoutAppPrefix.split(/__|_/);

    if (parts.length > 0) {
      const prefix = parts[0]!.toLowerCase();
      // Common prefixes to group
      if (['database', 'db'].includes(prefix)) {
        group = 'database';
      } else if (['redis'].includes(prefix)) {
        group = 'redis';
      } else if (['mongo', 'mongodb'].includes(prefix)) {
        group = 'mongo';
      } else if (['postgres', 'pg'].includes(prefix)) {
        group = 'postgres';
      } else if (['mysql'].includes(prefix)) {
        group = 'mysql';
      } else if (['auth', 'jwt', 'oauth', 'session'].includes(prefix)) {
        group = 'auth';
      } else if (['server', 'host', 'port'].includes(prefix)) {
        group = 'server';
      } else if (['log', 'logging', 'debug', 'trace'].includes(prefix)) {
        group = 'logging';
      } else if (['aws', 's3', 'gcp', 'azure', 'cloud'].includes(prefix)) {
        group = 'cloud';
      } else if (['smtp', 'mail', 'email', 'sendgrid', 'mailgun'].includes(prefix)) {
        group = 'email';
      } else if (['feature', 'features', 'flag', 'flags'].includes(prefix)) {
        group = 'features';
      } else if (['api'].includes(prefix)) {
        group = 'api';
      } else if (['cache'].includes(prefix)) {
        group = 'cache';
      } else if (['node', 'npm'].includes(prefix)) {
        group = 'node';
      } else if (parts.length > 1) {
        // Use the first part as group if it's meaningful
        group = prefix;
      }
    }

    const groupValues = groups.get(group) || [];
    groupValues.push(value);
    groups.set(group, groupValues);
  }

  // Generate schema
  lines.push('export const schema = z.object({');

  for (const [group, values] of groups) {
    lines.push(`  ${group}: z.object({`);

    for (const val of values) {
      const fieldName = envKeyToFieldName(val.key, group);
      const zodType = getZodType(val);
      const comment = val.isSecret ? ' // sensitive' : '';

      lines.push(`    ${fieldName}: ${zodType},${comment}`);
    }

    lines.push('  }),');
    lines.push('');
  }

  lines.push('});');
  lines.push('');
  lines.push('export type AppConfig = z.infer<typeof schema>;');
  lines.push('');

  // Generate loader function
  lines.push('export async function loadConfig() {');
  lines.push('  const env = process.env.NODE_ENV ?? \'development\';');
  lines.push('');
  lines.push('  try {');
  lines.push('    return await defineConfig({');
  lines.push('      schema,');
  lines.push('      sources: [');

  // Add discovered config files
  if (result.configFiles.length > 0) {
    const relPath = relative(options.dir, result.configFiles[0]!);
    lines.push(`        { type: 'file', path: './${relPath}', optional: true },`);
  }

  // Add env source
  lines.push(`        { type: 'env' },`);
  lines.push('      ],');
  lines.push('    });');
  lines.push('  } catch (error) {');
  lines.push('    if (error instanceof ConfigValidationError) {');
  lines.push('      console.error(error.formatErrors());');
  lines.push('      process.exit(1);');
  lines.push('    }');
  lines.push('    throw error;');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/**
 * Convert env key to camelCase field name
 */
function envKeyToFieldName(key: string, group: string): string {
  // Remove common app prefixes first
  let name = key;
  const appPrefixes = ['APP_', 'NEXT_PUBLIC_', 'VITE_', 'REACT_APP_'];
  for (const prefix of appPrefixes) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length);
      break;
    }
  }

  // Remove group prefix
  const groupUpper = group.toUpperCase();
  const groupPrefixes = [groupUpper + '__', groupUpper + '_'];
  for (const prefix of groupPrefixes) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length);
      break;
    }
  }

  // Convert to camelCase: DATABASE__POOL_SIZE -> poolSize
  return name
    .toLowerCase()
    .replace(/^_+/, '') // Remove leading underscores
    .replace(/__/g, '_') // Replace double underscore with single
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Get Zod type string for a config value
 */
function getZodType(value: ConfigValue): string {
  const hasDefault = value.value !== undefined && !value.isSecret;

  let zodType: string;

  switch (value.inferredType) {
    case 'boolean':
      zodType = 'z.boolean()';
      if (hasDefault) {
        zodType += `.default(${value.value})`;
      }
      break;

    case 'number':
      zodType = 'z.number()';
      if (hasDefault) {
        zodType += `.default(${value.value})`;
      }
      break;

    case 'url':
      zodType = 'z.string().url()';
      break;

    case 'email':
      zodType = 'z.string().email()';
      break;

    default:
      zodType = 'z.string()';
      if (hasDefault && !value.isSecret) {
        zodType += `.default('${value.value}')`;
      }
  }

  // Make optional if no value and not found in code
  if (value.value === undefined && value.occurrences === 0) {
    zodType += '.optional()';
  }

  return zodType;
}

/**
 * Print analysis summary
 */
function printSummary(result: AnalysisResult): void {
  console.log('\n' + '='.repeat(50));
  console.log('Analysis Summary');
  console.log('='.repeat(50));

  const secretCount = Array.from(result.configValues.values())
    .filter(v => v.isSecret).length;

  const byType = new Map<string, number>();
  for (const value of result.configValues.values()) {
    const count = byType.get(value.inferredType) || 0;
    byType.set(value.inferredType, count + 1);
  }

  console.log(`\nConfiguration Values: ${result.configValues.size}`);
  console.log(`  Secrets detected: ${secretCount}`);
  console.log(`  Types breakdown:`);
  for (const [type, count] of byType) {
    console.log(`    ${type}: ${count}`);
  }

  if (result.envUsageInCode.size > 0) {
    console.log(`\nEnv vars used in code: ${result.envUsageInCode.size}`);

    // Show most used
    const sorted = Array.from(result.envUsageInCode.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);

    if (sorted.length > 0) {
      console.log('  Most used:');
      for (const [envVar, files] of sorted) {
        console.log(`    ${envVar}: ${files.length} file(s)`);
      }
    }
  }

  // Warnings
  const unusedInCode = Array.from(result.configValues.values())
    .filter(v => v.occurrences === 0 && v.source.includes('.env'));

  if (unusedInCode.length > 0) {
    console.log(`\nWarnings:`);
    console.log(`  ${unusedInCode.length} env var(s) defined but not found in code`);
  }
}

/**
 * Print migration hints for existing config libraries
 */
function printMigrationHints(result: AnalysisResult): void {
  console.log('\n' + '='.repeat(50));
  console.log('Migration Hints');
  console.log('='.repeat(50));

  if (result.existingLibraries.includes('dotenv')) {
    console.log(`
dotenv Migration:
  1. zonfig handles .env loading automatically
  2. Remove: require('dotenv').config() or import 'dotenv/config'
  3. Replace: process.env.VAR with config.get('group.var')
`);
  }

  if (result.existingLibraries.includes('convict')) {
    console.log(`
convict Migration:
  1. Your convict schema can be converted to Zod
  2. convict format -> Zod validator:
     - 'port' -> z.number().min(0).max(65535)
     - 'url' -> z.string().url()
     - 'email' -> z.string().email()
  3. Replace: config.get('key') with config.get('group.key')
`);
  }

  if (result.existingLibraries.includes('config')) {
    console.log(`
node-config Migration:
  1. Move config/*.json values to your schema defaults
  2. Replace: config.get('key') with config.get('group.key')
  3. Environment overrides work the same way
`);
  }

  if (result.frameworkDetected === 'next.js') {
    console.log(`
Next.js Notes:
  - NEXT_PUBLIC_* vars are auto-detected
  - Use config in server components and API routes
  - For client-side, expose needed values via props or context
`);
  }

  if (result.frameworkDetected === 'vite') {
    console.log(`
Vite Notes:
  - VITE_* vars are auto-detected
  - import.meta.env usage is detected
  - Use config in server-side code
`);
  }

  console.log(`
Next Steps:
  1. Review the generated schema in src/config.ts
  2. Adjust types and defaults as needed
  3. Add validation rules (min, max, regex, etc.)
  4. Run: npx zonfig validate -s ./src/config.ts -c ./config.json
  5. Update your code to use the typed config
`);
}

/**
 * Analyze all packages in a monorepo
 */
async function analyzeMonorepoAll(
  rootDir: string,
  monorepo: MonorepoInfo,
  options: AnalyzeOptions
): Promise<void> {
  console.log(`\nAnalyzing ${monorepo.packages.length} packages...\n`);

  // First, analyze shared/root config
  const sharedResult = await analyzeDirectory(rootDir, {
    envFiles: monorepo.sharedEnvFiles,
    configFiles: monorepo.sharedConfigFiles,
    isShared: true,
  });

  // Then analyze each package
  for (const pkg of monorepo.packages) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Package: ${pkg.name}`);
    console.log(`${'─'.repeat(50)}`);

    const pkgResult = await analyzeDirectory(pkg.path, {
      envFiles: pkg.envFiles,
      configFiles: pkg.configFiles,
      isShared: false,
    });

    // Merge shared config values (shared values have lower priority)
    const mergedValues = new Map(sharedResult.configValues);
    for (const [key, value] of pkgResult.configValues) {
      mergedValues.set(key, value);
    }

    const mergedResult: AnalysisResult = {
      ...pkgResult,
      configValues: mergedValues,
    };

    // Generate schema for this package
    const schema = generateSchema(mergedResult, { ...options, dir: pkg.path });
    const outputPath = join(pkg.path, 'src', 'config.ts');

    if (options.dryRun) {
      console.log(`\nWould write to: ${relative(rootDir, outputPath)}`);
      console.log(`Config values: ${mergedResult.configValues.size} (${sharedResult.configValues.size} shared)`);
    } else {
      // Ensure directory exists
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, schema);
      console.log(`\nWritten: ${relative(rootDir, outputPath)}`);
      console.log(`Config values: ${mergedResult.configValues.size} (${sharedResult.configValues.size} shared)`);
    }
  }

  // Generate shared config module if there are shared values
  if (sharedResult.configValues.size > 0) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log('Shared Configuration');
    console.log(`${'─'.repeat(50)}`);

    const sharedSchema = generateSharedSchema(sharedResult);
    const sharedOutputPath = join(rootDir, 'packages', 'shared', 'src', 'config.ts');

    if (options.dryRun) {
      console.log(`\nShared config (${sharedResult.configValues.size} values):`);
      console.log(`Would write to: ${relative(rootDir, sharedOutputPath)}`);
    } else {
      await mkdir(dirname(sharedOutputPath), { recursive: true });
      await writeFile(sharedOutputPath, sharedSchema);
      console.log(`\nWritten: ${relative(rootDir, sharedOutputPath)}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Monorepo Analysis Complete');
  console.log('='.repeat(50));
  console.log(`\nPackages analyzed: ${monorepo.packages.length}`);
  console.log(`Shared config values: ${sharedResult.configValues.size}`);

  if (!options.dryRun) {
    console.log(`
Next Steps:
  1. Review generated configs in each package's src/config.ts
  2. Install zonfig in each package: npm install zonfig
  3. Import shared config if needed
  4. Update code to use typed config
`);
  }
}

/**
 * Analyze a single package in a monorepo
 */
async function analyzeSinglePackage(
  rootDir: string,
  pkg: MonorepoPackage,
  monorepo: MonorepoInfo,
  options: AnalyzeOptions
): Promise<void> {
  console.log(`\nAnalyzing package: ${pkg.name}\n`);

  // Analyze shared config first
  const sharedResult = await analyzeDirectory(rootDir, {
    envFiles: monorepo.sharedEnvFiles,
    configFiles: monorepo.sharedConfigFiles,
    isShared: true,
  });

  // Analyze package config
  const pkgResult = await analyzeDirectory(pkg.path, {
    envFiles: pkg.envFiles,
    configFiles: pkg.configFiles,
    isShared: false,
  });

  // Merge: package values override shared values
  const mergedValues = new Map(sharedResult.configValues);
  for (const [key, value] of pkgResult.configValues) {
    mergedValues.set(key, value);
  }

  const mergedResult: AnalysisResult = {
    envFiles: [...monorepo.sharedEnvFiles, ...pkg.envFiles],
    configFiles: [...monorepo.sharedConfigFiles, ...pkg.configFiles],
    existingLibraries: pkgResult.existingLibraries,
    frameworkDetected: pkg.framework || null,
    configValues: mergedValues,
    envUsageInCode: pkgResult.envUsageInCode,
    monorepo,
  };

  // Generate schema
  const schema = generateSchema(mergedResult, { ...options, dir: pkg.path });

  if (options.dryRun) {
    console.log('--- Generated Schema (dry run) ---\n');
    console.log(schema);
    console.log('\n--- End Schema ---');
  } else {
    const outputPath = resolve(pkg.path, options.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, schema);
    console.log(`Written to: ${outputPath}`);
  }

  printSummary(mergedResult);

  console.log(`\nShared config values included: ${sharedResult.configValues.size}`);
  console.log(`Package-specific config values: ${pkgResult.configValues.size}`);
}

/**
 * Analyze a directory for config (helper for monorepo analysis)
 */
async function analyzeDirectory(
  dir: string,
  opts: { envFiles: string[]; configFiles: string[]; isShared: boolean }
): Promise<AnalysisResult> {
  const result: AnalysisResult = {
    envFiles: opts.envFiles,
    configFiles: opts.configFiles,
    existingLibraries: [],
    frameworkDetected: null,
    configValues: new Map(),
    envUsageInCode: new Map(),
  };

  // Parse env files
  for (const envFile of opts.envFiles) {
    await parseEnvFile(envFile, result.configValues);
  }

  // Parse config files
  for (const configFile of opts.configFiles) {
    await parseConfigFile(configFile, result.configValues);
  }

  // Scan source code (only for non-shared)
  if (!opts.isShared) {
    await scanSourceCode(dir, result.envUsageInCode);

    // Add env vars from code
    for (const [envVar, files] of result.envUsageInCode) {
      if (!result.configValues.has(envVar)) {
        result.configValues.set(envVar, {
          key: envVar,
          value: undefined,
          source: `code (${files.length} file(s))`,
          inferredType: 'string',
          isSecret: SECRET_PATTERNS.some(p => p.test(envVar)),
          occurrences: files.length,
        });
      } else {
        const existing = result.configValues.get(envVar)!;
        existing.occurrences = files.length;
      }
    }
  }

  return result;
}

/**
 * Generate a shared config module for monorepo
 */
function generateSharedSchema(result: AnalysisResult): string {
  const lines: string[] = [];

  lines.push(`import { z } from 'zod';`);
  lines.push('');
  lines.push('// Shared configuration schema for monorepo');
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('export const sharedSchema = z.object({');

  // Group by prefix (simplified for shared)
  const groups = new Map<string, ConfigValue[]>();
  for (const [, value] of result.configValues) {
    const parts = value.key.split(/__|_/);
    const group = parts[0]?.toLowerCase() || 'shared';
    const groupValues = groups.get(group) || [];
    groupValues.push(value);
    groups.set(group, groupValues);
  }

  for (const [group, values] of groups) {
    lines.push(`  ${group}: z.object({`);
    for (const val of values) {
      const fieldName = envKeyToFieldName(val.key, group);
      const zodType = getZodType(val);
      lines.push(`    ${fieldName}: ${zodType},`);
    }
    lines.push('  }),');
  }

  lines.push('});');
  lines.push('');
  lines.push('export type SharedConfig = z.infer<typeof sharedSchema>;');
  lines.push('');

  return lines.join('\n');
}
