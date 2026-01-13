# zonfig Example Application

This example demonstrates how to use zonfig in a typical Node.js application.

## Setup

```bash
npm install
```

## Running

### Development mode

```bash
npm run dev
```

Uses `config/development.json` overrides and sets logging to debug/pretty.

### Production mode

```bash
npm start
```

Uses production profile with SSL enabled and JSON logging.

### With environment variables

```bash
APP_SERVER__PORT=8080 APP_DATABASE__URL=postgres://prod:5432/myapp npm start
```

## Generate Documentation

```bash
npm run generate:docs
```

This creates:
- `CONFIG.md` - Markdown documentation
- `.env.example` - Environment variable template
- `config.schema.json` - JSON Schema for IDE support

## Configuration Sources (in order of priority)

1. `config/default.json` - Base configuration
2. `config/{environment}.json` - Environment-specific overrides
3. `.env` file (development only)
4. `APP_*` environment variables

Later sources override earlier ones.

## Environment Variables

Prefix all environment variables with `APP_`. Use double underscore for nesting:

```bash
APP_SERVER__HOST=0.0.0.0
APP_SERVER__PORT=8080
APP_DATABASE__URL=postgres://localhost/myapp
APP_DATABASE__POOL_SIZE=20
APP_AUTH__JWT_SECRET=your-secret-here
APP_FEATURES__ENABLE_CACHE=false
APP_LOGGING__LEVEL=debug
```

## Project Structure

```
src/
├── config.ts          # Schema definition and loader
├── index.ts           # Main application
├── generate-docs.ts   # Documentation generator
└── config/
    ├── default.json       # Base config
    └── development.json   # Dev overrides
```
