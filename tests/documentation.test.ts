import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { generateDocs, generateMarkdown, generateEnvExample, toJsonSchema } from '../src/index.js';

describe('Documentation Generators', () => {
  const schema = z.object({
    server: z.object({
      host: z.string().default('localhost'),
      port: z.number().min(1).max(65535).default(3000),
    }),
    database: z.object({
      url: z.string(),
    }),
    debug: z.boolean().default(false),
  });

  describe('generateMarkdown', () => {
    it('generates markdown documentation', () => {
      const markdown = generateMarkdown(schema);

      expect(markdown).toContain('# Configuration Reference');
      expect(markdown).toContain('server');
      expect(markdown).toContain('database');
      expect(markdown).toContain('`server.host`');
      expect(markdown).toContain('string');
      expect(markdown).toContain('number');
    });

    it('includes default values', () => {
      const markdown = generateMarkdown(schema, { includeDefaults: true });

      expect(markdown).toContain('localhost');
      expect(markdown).toContain('3000');
    });

    it('respects custom title', () => {
      const markdown = generateMarkdown(schema, { title: 'My Config' });

      expect(markdown).toContain('# My Config');
    });
  });

  describe('generateEnvExample', () => {
    it('generates .env.example format', () => {
      const envExample = generateEnvExample(schema);

      expect(envExample).toContain('SERVER__HOST=');
      expect(envExample).toContain('SERVER__PORT=');
      expect(envExample).toContain('DATABASE__URL=');
      expect(envExample).toContain('DEBUG=');
    });

    it('supports custom prefix', () => {
      const envExample = generateEnvExample(schema, { prefix: 'APP_' });

      expect(envExample).toContain('APP_SERVER__HOST=');
      expect(envExample).toContain('APP_DATABASE__URL=');
    });

    it('includes comments by default', () => {
      const envExample = generateEnvExample(schema);

      expect(envExample).toContain('# Type:');
      expect(envExample).toContain('# Configuration Environment Variables');
    });

    it('can exclude comments', () => {
      const envExample = generateEnvExample(schema, { includeComments: false });

      expect(envExample).not.toContain('# Type:');
    });
  });

  describe('toJsonSchema', () => {
    it('generates valid JSON Schema', () => {
      const jsonSchema = toJsonSchema(schema);

      expect(jsonSchema.$schema).toBe('https://json-schema.org/draft-07/schema#');
      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties).toBeDefined();
      expect(jsonSchema.properties?.server).toBeDefined();
      expect(jsonSchema.properties?.database).toBeDefined();
    });

    it('converts string types correctly', () => {
      const simpleSchema = z.object({
        name: z.string().min(1).max(100),
      });

      const jsonSchema = toJsonSchema(simpleSchema);

      expect(jsonSchema.properties?.name?.type).toBe('string');
      expect(jsonSchema.properties?.name?.minLength).toBe(1);
      expect(jsonSchema.properties?.name?.maxLength).toBe(100);
    });

    it('converts number types with constraints', () => {
      const simpleSchema = z.object({
        age: z.number().min(0).max(150),
      });

      const jsonSchema = toJsonSchema(simpleSchema);

      expect(jsonSchema.properties?.age?.type).toBe('number');
      expect(jsonSchema.properties?.age?.minimum).toBe(0);
      expect(jsonSchema.properties?.age?.maximum).toBe(150);
    });

    it('handles default values', () => {
      const simpleSchema = z.object({
        enabled: z.boolean().default(true),
      });

      const jsonSchema = toJsonSchema(simpleSchema);

      expect(jsonSchema.properties?.enabled?.default).toBe(true);
    });

    it('marks required fields', () => {
      const simpleSchema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const jsonSchema = toJsonSchema(simpleSchema);

      expect(jsonSchema.required).toContain('required');
      expect(jsonSchema.required).not.toContain('optional');
    });
  });

  describe('generateDocs', () => {
    it('supports markdown format', () => {
      const result = generateDocs(schema, { format: 'markdown' });

      expect(result).toContain('# Configuration Reference');
    });

    it('supports json-schema format', () => {
      const result = generateDocs(schema, { format: 'json-schema' });
      const parsed = JSON.parse(result);

      expect(parsed.$schema).toBeDefined();
      expect(parsed.type).toBe('object');
    });

    it('supports env-example format', () => {
      const result = generateDocs(schema, { format: 'env-example' });

      expect(result).toContain('SERVER__HOST=');
    });
  });
});
