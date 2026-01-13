# Contributing to zonfig

Thank you for your interest in contributing to zonfig! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

Before submitting a bug report:

1. Check the [existing issues](../../issues) to avoid duplicates
2. Use the latest version of zonfig
3. Provide a minimal reproduction

When reporting a bug, include:

- zonfig version
- Node.js version
- Operating system
- Minimal code example that reproduces the issue
- Expected vs actual behavior
- Full error message and stack trace

### Suggesting Features

Feature requests are welcome! Please:

1. Check existing issues for similar suggestions
2. Describe the use case and problem you're solving
3. Explain why this would benefit other users
4. Consider if it could be implemented as a plugin

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Add or update tests as needed
5. Ensure all tests pass
6. Submit a pull request

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/zonfig.git
cd zonfig

# Install dependencies
npm install

# Run tests
npm test

# Build the package
npm run build

# Type check
npm run lint
```

### Project Structure

```
zonfig/
├── src/
│   ├── index.ts              # Public API exports
│   ├── core/
│   │   ├── config.ts         # Main Config class
│   │   └── types.ts          # TypeScript types
│   ├── loaders/
│   │   ├── base.ts           # Loader interface
│   │   ├── env.ts            # Environment variable loader
│   │   ├── file.ts           # File loader (JSON/YAML)
│   │   └── dotenv.ts         # .env parser
│   ├── plugins/
│   │   ├── types.ts          # Plugin interface
│   │   └── registry.ts       # Plugin registration
│   ├── documentation/
│   │   ├── markdown.ts       # Markdown generator
│   │   ├── json-schema.ts    # JSON Schema generator
│   │   └── env-example.ts    # .env.example generator
│   ├── errors/
│   │   └── validation.ts     # Error classes
│   └── utils/
│       └── deep-merge.ts     # Utility functions
├── tests/
│   ├── config.test.ts        # Core config tests
│   ├── documentation.test.ts # Doc generator tests
│   └── plugins.test.ts       # Plugin system tests
└── dist/                     # Built output (ESM + CJS)
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build the package (ESM + CJS) |
| `npm run dev` | Build in watch mode |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Type check with TypeScript |

## Coding Guidelines

### TypeScript

- Use strict TypeScript - the project has `strict: true` and `exactOptionalPropertyTypes: true`
- Prefer explicit types over `any`
- Export types from `src/core/types.ts`
- Use `unknown` instead of `any` when type is truly unknown

### Code Style

- Use descriptive variable and function names
- Add JSDoc comments for public APIs
- Keep functions focused and small
- Prefer composition over inheritance

### Testing

- Write tests for new features
- Maintain existing test coverage
- Use descriptive test names
- Test edge cases and error conditions

Example test structure:

```typescript
import { describe, it, expect } from 'vitest';

describe('FeatureName', () => {
  describe('methodName', () => {
    it('does expected behavior', () => {
      // Arrange
      const input = ...;

      // Act
      const result = methodName(input);

      // Assert
      expect(result).toBe(expected);
    });

    it('handles edge case', () => {
      // ...
    });
  });
});
```

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add YAML file support
fix: handle undefined env values correctly
docs: update README with plugin examples
test: add tests for profile switching
refactor: simplify deep merge logic
```

Prefixes:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `refactor:` - Code changes that don't add features or fix bugs
- `chore:` - Maintenance tasks

## Pull Request Process

1. **Update documentation** - If you change the API, update the README
2. **Add tests** - New features need tests, bug fixes should have regression tests
3. **Pass CI** - All tests must pass and TypeScript must compile
4. **One feature per PR** - Keep PRs focused and reviewable
5. **Describe your changes** - Explain what and why in the PR description

### PR Checklist

- [ ] Tests added/updated
- [ ] Documentation updated (if applicable)
- [ ] `npm run build` succeeds
- [ ] `npm run test:run` passes
- [ ] `npm run lint` passes

## Creating Plugins

Plugins are a great way to contribute without modifying core code:

```typescript
import { definePlugin, registerPlugin } from 'zonfig';

export const myPlugin = definePlugin({
  name: 'my-source',
  async load(options, context) {
    // Load config from your source
    return { key: 'value' };
  },
});

// Users can then:
registerPlugin(myPlugin);
```

Consider publishing useful plugins as separate packages (e.g., `zonfig-plugin-vault`).

## Release Process

Releases are managed by maintainers:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create a git tag
4. Publish to npm

## Getting Help

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues and discussions first

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
