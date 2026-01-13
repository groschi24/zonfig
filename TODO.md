# zonfig Roadmap

## High Priority

- [x] **Watch mode** - Hot reload config when files change
  - `config.watch()` method that emits events on change
  - File system watchers for JSON/YAML/.env files
  - Debounce rapid changes

- [x] **Variable interpolation** - Support `${VAR}` syntax in config values
  - `database.url: "postgres://${DB_HOST}:${DB_PORT}/mydb"`
  - Reference env vars and other config values
  - Recursive resolution with cycle detection

- [ ] **Official plugins** - First-party plugins for popular secret stores
  - `@zonfig/plugin-aws-secrets` - AWS Secrets Manager
  - `@zonfig/plugin-vault` - HashiCorp Vault
  - `@zonfig/plugin-dotenv-vault` - Dotenv Vault
  - `@zonfig/plugin-gcp-secrets` - Google Cloud Secret Manager

- [x] **Secrets masking** - Auto-redact sensitive values
  - Detect sensitive keys (password, secret, token, apiKey, etc.)
  - Mask in error messages and logs
  - `config.getMasked()` for safe logging

## Medium Priority

- [x] **Config references** - Reference other config values
  - `server.url: "${server.host}:${server.port}"`
  - Lazy evaluation after all sources merged
  - *(Included in Variable Interpolation feature)*

- [x] **Encrypted configs** - Encrypt sensitive values at rest
  - AES-256-GCM encryption with scrypt key derivation
  - `zonfig encrypt` / `zonfig decrypt` CLI commands
  - Auto-decrypt support in config loading
  - Support for AWS KMS, GCP KMS, age, PGP (future: via plugins)

- [x] **Schema migrations** - Help when schema changes
  - Detect breaking changes between versions
  - Generate migration scripts
  - `zonfig migrate` CLI command

- [x] **Interactive CLI** - Better developer experience
  - `zonfig init` with interactive prompts
  - `zonfig show` for browsing config in tree view
  - `zonfig check` for health checks

## Nice to Have

- [ ] **VSCode extension** - IDE integration
  - Autocomplete for config files based on schema
  - Inline validation errors
  - Go to definition for config keys

- [ ] **Config diffing** - Compare environments
  - `zonfig diff dev prod` command
  - Highlight differences
  - Export as markdown/JSON

- [ ] **Validation warnings** - Non-fatal issues
  - Deprecation warnings
  - Performance hints
  - Security recommendations

- [ ] **Audit logging** - Track config access
  - Log which values are accessed and when
  - Optional integration with logging libraries
  - Useful for compliance

## Ecosystem

- [ ] **Framework integrations**
  - `@zonfig/next` - Next.js integration
  - `@zonfig/elysia` - Elysia plugin
  - `@zonfig/express` - Express middleware
  - `@zonfig/fastify` - Fastify plugin

- [ ] **GitHub Action** - CI/CD integration
  - Validate configs in pull requests
  - Check for secrets in config files
  - Schema drift detection

- [ ] **Automated releases** - CI improvements
  - Tag-based GitHub releases
  - Auto-publish to npm on release
  - Changelog generation

## Completed

- [x] Core `defineConfig()` API
- [x] Multi-source loading (env, file, dotenv, object, plugin)
- [x] Zod validation with type inference
- [x] Environment profiles
- [x] Plugin system
- [x] CLI (docs, init, validate, analyze)
- [x] Auto-documentation (markdown, json-schema, env-example)
- [x] Monorepo support in CLI
- [x] Watch mode with file watching, debouncing, and event system
- [x] Variable interpolation with `${VAR}` syntax and cycle detection
- [x] Config references (part of variable interpolation)
- [x] Secrets masking with `config.getMasked()` and utility functions
- [x] Encrypted configs with AES-256-GCM, CLI commands, and auto-decrypt in config loading
- [x] Schema migrations with `zonfig migrate` CLI, breaking change detection, and auto-migration
- [x] Interactive CLI with `zonfig init -i`, `zonfig check`, and `zonfig show`
