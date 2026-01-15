# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-15

### Added

- Full Zod 4 support with backward compatibility for Zod 3 patterns

### Changed

- Updated all dependencies to latest versions
- Migrated internal schema introspection to support Zod 4's new `_def` structure:
  - Type detection now uses `_def.type` (Zod 4) with fallback to `_def.typeName` (Zod 3)
  - Array element extraction uses `_def.element` (Zod 4) with fallback to `_def.type` (Zod 3)
  - Constraint extraction reads direct properties (`minLength`, `maxLength`, `minValue`, `maxValue`) alongside `_def.checks` array
- Updated documentation generators (markdown, JSON Schema, env-example) for Zod 4 compatibility
- Updated schema diff utilities for Zod 4 compatibility

### Fixed

- TypeScript errors in CLI (unused variables, type assertions)
- Array type extraction in `extractSchemaInfo` now correctly returns `itemType` for array schemas

## [1.0.0] - 2025-01-14

### Added

- Initial release
- Core configuration management with `defineConfig`
- Multi-source configuration loading (env, JSON, YAML, TOML, objects)
- Zod schema validation with full type inference
- Documentation generation (Markdown, JSON Schema, .env.example)
- Value encryption/decryption with `encryptValue`/`decryptValue`
- Secrets masking with `maskObject`
- Variable interpolation with `interpolate`
- Schema diffing with `diffSchemas` and `extractSchemaInfo`
- Interactive CLI with commands:
  - `zonfig init` - Initialize configuration
  - `zonfig validate` - Validate configuration
  - `zonfig docs` - Generate documentation
  - `zonfig encrypt` - Encrypt sensitive values
  - `zonfig diff` - Compare schema versions
  - `zonfig analyze` - Analyze monorepo configurations
- Watch mode for configuration changes
- TypeScript support with full type safety
