import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

export interface MonorepoPackage {
  name: string;
  path: string;
  relativePath: string;
  hasEnvFiles: boolean;
  hasConfigDir: boolean;
  envFiles: string[];
  configFiles: string[];
  framework?: string;
}

export interface MonorepoInfo {
  isMonorepo: boolean;
  tool: 'turborepo' | 'nx' | 'lerna' | 'pnpm' | 'yarn' | 'npm' | 'rush' | null;
  rootPath: string;
  packages: MonorepoPackage[];
  sharedEnvFiles: string[];
  sharedConfigFiles: string[];
}

/**
 * Detect if the project is a monorepo and gather information about it
 */
export async function detectMonorepo(rootDir: string): Promise<MonorepoInfo> {
  const info: MonorepoInfo = {
    isMonorepo: false,
    tool: null,
    rootPath: rootDir,
    packages: [],
    sharedEnvFiles: [],
    sharedConfigFiles: [],
  };

  // Check for monorepo indicators
  const pkgJsonPath = join(rootDir, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    return info;
  }

  const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf-8'));

  // Detect monorepo tool
  info.tool = await detectMonorepoTool(rootDir, pkgJson);

  if (!info.tool) {
    return info;
  }

  info.isMonorepo = true;

  // Find package directories based on tool
  const packageDirs = await findPackageDirectories(rootDir, pkgJson, info.tool);

  // Scan each package
  for (const pkgDir of packageDirs) {
    const pkg = await scanPackage(rootDir, pkgDir);
    if (pkg) {
      info.packages.push(pkg);
    }
  }

  // Find shared/root .env files
  info.sharedEnvFiles = await findRootEnvFiles(rootDir);

  // Find shared config files
  info.sharedConfigFiles = await findRootConfigFiles(rootDir);

  return info;
}

/**
 * Detect which monorepo tool is being used
 */
async function detectMonorepoTool(
  rootDir: string,
  pkgJson: Record<string, unknown>
): Promise<MonorepoInfo['tool']> {
  // Turborepo
  if (existsSync(join(rootDir, 'turbo.json'))) {
    return 'turborepo';
  }

  // Nx
  if (existsSync(join(rootDir, 'nx.json'))) {
    return 'nx';
  }

  // Lerna
  if (existsSync(join(rootDir, 'lerna.json'))) {
    return 'lerna';
  }

  // Rush
  if (existsSync(join(rootDir, 'rush.json'))) {
    return 'rush';
  }

  // pnpm workspaces
  if (existsSync(join(rootDir, 'pnpm-workspace.yaml'))) {
    return 'pnpm';
  }

  // Yarn/npm workspaces (check package.json)
  if (pkgJson.workspaces) {
    // Detect yarn vs npm
    if (existsSync(join(rootDir, 'yarn.lock'))) {
      return 'yarn';
    }
    return 'npm';
  }

  return null;
}

/**
 * Find all package directories in the monorepo
 */
async function findPackageDirectories(
  rootDir: string,
  pkgJson: Record<string, unknown>,
  tool: MonorepoInfo['tool']
): Promise<string[]> {
  const packageDirs: string[] = [];

  // Common package directory patterns
  const patterns: string[] = [];

  // Get patterns from workspaces config
  if (pkgJson.workspaces) {
    const workspaces = pkgJson.workspaces;
    if (Array.isArray(workspaces)) {
      patterns.push(...workspaces);
    } else if (typeof workspaces === 'object' && workspaces !== null) {
      const ws = workspaces as { packages?: string[] };
      if (ws.packages) {
        patterns.push(...ws.packages);
      }
    }
  }

  // Tool-specific patterns
  if (tool === 'turborepo' || tool === 'lerna') {
    // Check turbo.json or lerna.json for patterns
    const configFile = tool === 'turborepo' ? 'turbo.json' : 'lerna.json';
    const configPath = join(rootDir, configFile);
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(await readFile(configPath, 'utf-8'));
        if (config.packages) {
          patterns.push(...config.packages);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  if (tool === 'pnpm') {
    // Read pnpm-workspace.yaml
    const workspacePath = join(rootDir, 'pnpm-workspace.yaml');
    if (existsSync(workspacePath)) {
      const content = await readFile(workspacePath, 'utf-8');
      // Simple YAML parsing for packages array
      const match = content.match(/packages:\s*\n((?:\s+-\s+.+\n?)+)/);
      if (match) {
        const pkgPatterns = match[1]!
          .split('\n')
          .map(line => line.replace(/^\s*-\s*['"]?/, '').replace(/['"]?\s*$/, ''))
          .filter(Boolean);
        patterns.push(...pkgPatterns);
      }
    }
  }

  if (tool === 'nx' && patterns.length === 0) {
    // Nx typically uses apps/ and libs/ when no workspaces defined
    patterns.push('apps/*', 'libs/*', 'packages/*');
  }

  // Default patterns if none found
  if (patterns.length === 0) {
    patterns.push('packages/*', 'apps/*', 'libs/*', 'services/*');
  }

  // Deduplicate patterns
  const uniquePatterns = [...new Set(patterns)];

  // Resolve patterns to actual directories
  for (const pattern of uniquePatterns) {
    // Simple glob handling for common patterns
    if (pattern.endsWith('/*')) {
      const baseDir = pattern.slice(0, -2);
      const fullPath = join(rootDir, baseDir);
      if (existsSync(fullPath)) {
        try {
          const entries = await readdir(fullPath, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
              const pkgPath = join(fullPath, entry.name);
              // Verify it's a package (has package.json)
              if (existsSync(join(pkgPath, 'package.json'))) {
                packageDirs.push(pkgPath);
              }
            }
          }
        } catch {
          // Ignore read errors
        }
      }
    } else if (!pattern.includes('*')) {
      // Exact path
      const fullPath = join(rootDir, pattern);
      if (existsSync(fullPath) && existsSync(join(fullPath, 'package.json'))) {
        packageDirs.push(fullPath);
      }
    }
  }

  return packageDirs;
}

/**
 * Scan a package directory for config-related files
 */
async function scanPackage(
  rootDir: string,
  pkgDir: string
): Promise<MonorepoPackage | null> {
  const pkgJsonPath = join(pkgDir, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    return null;
  }

  let name = basename(pkgDir);
  try {
    const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf-8'));
    name = pkgJson.name || name;
  } catch {
    // Use directory name
  }

  const envFiles: string[] = [];
  const configFiles: string[] = [];

  // Find .env files
  const envPatterns = [
    '.env', '.env.local', '.env.development', '.env.production',
    '.env.staging', '.env.test', '.env.example',
  ];
  for (const pattern of envPatterns) {
    const envPath = join(pkgDir, pattern);
    if (existsSync(envPath)) {
      envFiles.push(envPath);
    }
  }

  // Find config directory
  const hasConfigDir = existsSync(join(pkgDir, 'config'));
  if (hasConfigDir) {
    try {
      const configDir = join(pkgDir, 'config');
      const entries = await readdir(configDir);
      for (const entry of entries) {
        if (entry.endsWith('.json') || entry.endsWith('.yaml') || entry.endsWith('.yml')) {
          configFiles.push(join(configDir, entry));
        }
      }
    } catch {
      // Ignore
    }
  }

  // Check for root-level config files
  const rootConfigs = ['config.json', 'config.yaml', 'settings.json'];
  for (const config of rootConfigs) {
    const configPath = join(pkgDir, config);
    if (existsSync(configPath)) {
      configFiles.push(configPath);
    }
  }

  // Detect framework
  let framework: string | undefined;
  try {
    const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf-8'));
    const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

    if ('next' in deps) framework = 'next.js';
    else if ('nuxt' in deps) framework = 'nuxt';
    else if ('@nestjs/core' in deps) framework = 'nestjs';
    else if ('express' in deps) framework = 'express';
    else if ('fastify' in deps) framework = 'fastify';
    else if ('react' in deps) framework = 'react';
    else if ('vue' in deps) framework = 'vue';
    else if ('svelte' in deps) framework = 'svelte';
  } catch {
    // Ignore
  }

  const pkg: MonorepoPackage = {
    name,
    path: pkgDir,
    relativePath: relative(rootDir, pkgDir),
    hasEnvFiles: envFiles.length > 0,
    hasConfigDir,
    envFiles,
    configFiles,
  };
  if (framework) pkg.framework = framework;
  return pkg;
}

/**
 * Find .env files at the monorepo root
 */
async function findRootEnvFiles(rootDir: string): Promise<string[]> {
  const envFiles: string[] = [];
  const patterns = [
    '.env', '.env.local', '.env.development', '.env.production',
    '.env.staging', '.env.test', '.env.example', '.env.shared',
  ];

  for (const pattern of patterns) {
    const envPath = join(rootDir, pattern);
    if (existsSync(envPath)) {
      envFiles.push(envPath);
    }
  }

  return envFiles;
}

/**
 * Find config files at the monorepo root
 */
async function findRootConfigFiles(rootDir: string): Promise<string[]> {
  const configFiles: string[] = [];

  // Check for shared config directories
  const sharedDirs = ['config', 'configs', 'shared/config'];
  for (const dir of sharedDirs) {
    const dirPath = join(rootDir, dir);
    if (existsSync(dirPath)) {
      try {
        const entries = await readdir(dirPath);
        for (const entry of entries) {
          if (entry.endsWith('.json') || entry.endsWith('.yaml') || entry.endsWith('.yml')) {
            configFiles.push(join(dirPath, entry));
          }
        }
      } catch {
        // Ignore
      }
    }
  }

  return configFiles;
}

/**
 * Format monorepo info for display
 */
export function formatMonorepoInfo(info: MonorepoInfo): string {
  const lines: string[] = [];

  lines.push(`Monorepo detected: ${info.tool}`);
  lines.push(`Packages found: ${info.packages.length}`);
  lines.push('');

  if (info.sharedEnvFiles.length > 0) {
    lines.push('Shared .env files (root):');
    for (const file of info.sharedEnvFiles) {
      lines.push(`  - ${relative(info.rootPath, file)}`);
    }
    lines.push('');
  }

  lines.push('Packages:');
  for (const pkg of info.packages) {
    const framework = pkg.framework ? ` (${pkg.framework})` : '';
    lines.push(`  ${pkg.name}${framework}`);
    lines.push(`    Path: ${pkg.relativePath}`);
    if (pkg.envFiles.length > 0) {
      lines.push(`    Env files: ${pkg.envFiles.length}`);
    }
    if (pkg.configFiles.length > 0) {
      lines.push(`    Config files: ${pkg.configFiles.length}`);
    }
  }

  return lines.join('\n');
}
