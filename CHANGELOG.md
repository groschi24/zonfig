# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-01-14

### Added

#### Watch Mode
- `config.watch()` method for hot reloading configuration
- File system watchers for JSON, YAML, and .env files
- Configurable debounce for rapid file changes
- Event system with `config.on()` for change notifications
- `config.reload()` for manual reloading
- `config.unwatch()` to stop watching

#### Variable Interpolation
- Support for `${VAR}` syntax in config values
- Environment variable interpolation (e.g., `postgres://${DB_HOST}:${DB_PORT}/mydb`)
- Config reference interpolation (e.g., `${server.host}:${server.port}`)
- Recursive resolution with automatic cycle detection
- `CircularReferenceError` for circular reference detection

#### Secrets Masking
- `config.getMasked()` method for safe logging
- `maskObject()` utility function
- `isSensitiveKey()` for detecting sensitive keys
- Auto-detection of sensitive keys (password, secret, token, apiKey, etc.)
- Customizable mask patterns and additional keys

#### Encrypted Configs
- AES-256-GCM encryption with scrypt key derivation
- `encryptValue()` / `decryptValue()` functions
- `encryptObject()` / `decryptObject()` for bulk operations
- `isEncrypted()` / `hasEncryptedValues()` / `countEncryptedValues()` utilities
- Auto-decrypt support in `defineConfig()` with `decrypt` option
- Environment variable key support (`ZONFIG_ENCRYPTION_KEY`)

#### Schema Migrations
- `diffSchemas()` for comparing schema versions
- `generateMigrationReport()` for markdown reports
- `validateConfigAgainstChanges()` for config validation
- `applyAutoMigrations()` for automatic migrations
- Breaking change detection (removed fields, type changes)

#### Interactive CLI
- `zonfig init -i` with interactive prompts
- `zonfig check` for configuration health checks
- `zonfig show` for tree view of configuration
- `zonfig show --list-paths` for listing all config paths
- `zonfig show --masked` for hiding sensitive values
- `zonfig encrypt` / `zonfig decrypt` commands
- `zonfig migrate` for schema migration reports

#### Documentation Website
- Full documentation site at zonfig.dev
- Interactive examples and guides
- API reference documentation
- Docker support for self-hosting

### Changed

- Improved CLI help messages and error handling
- Better TypeScript type inference for config values

### Fixed

- Fixed duplicate `paths` CLI option conflict
- Fixed vitest compatibility in test suite

## [0.1.2] - 2025-01-13

### Fixed

- Fixed env-example generator mangling uppercase variable names (e.g., `NODE_ENV` was becoming `N_O_D_E__E_N_V`)
- Changed default prefix from `APP_` to none for env-example generation

## [0.1.1] - 2025-01-13

### Changed

- Package renamed from `zonfig` to `@zonfig/zonfig` (scoped package)
- Updated all documentation and examples with new package name

## [0.1.0] - 2025-01-12

### Added

- Initial release
- `defineConfig()` for creating typed configuration instances
- CLI with three commands:
  - `zonfig docs` - Generate documentation from Zod schemas
  - `zonfig init` - Scaffold new configuration setup
  - `zonfig validate` - Validate config files against schemas
- Multi-source configuration loading:
  - Environment variables with prefix support
  - JSON file loading
  - YAML file loading
  - .env file parsing
  - Plain object sources
  - Plugin system for custom sources
- Environment profiles for dev/staging/production configurations
- Auto-documentation generation:
  - Markdown format
  - JSON Schema format
  - .env.example format
- Type-safe `config.get()` with full TypeScript inference
- Immutable configuration (frozen at startup)
- Clear validation error messages with source tracking
- Plugin system with `definePlugin()` and `registerPlugin()`

### Technical

- Dual ESM/CJS build output
- Zod bundled (no separate install needed)
- Node.js 18+ required
- Full TypeScript support with strict mode
