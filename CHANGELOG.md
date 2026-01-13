# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
