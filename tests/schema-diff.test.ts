import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  extractSchemaInfo,
  diffSchemas,
  generateMigrationReport,
  validateConfigAgainstChanges,
  applyAutoMigrations,
} from '../src/utils/schema-diff.js';

describe('Schema Diff', () => {
  describe('extractSchemaInfo', () => {
    it('extracts basic types', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean(),
      });

      const info = extractSchemaInfo(schema);

      expect(info.type).toBe('ZodObject');
      expect(info.children?.name.type).toBe('ZodString');
      expect(info.children?.age.type).toBe('ZodNumber');
      expect(info.children?.active.type).toBe('ZodBoolean');
    });

    it('extracts optional fields', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const info = extractSchemaInfo(schema);

      expect(info.children?.required.isOptional).toBe(false);
      expect(info.children?.optional.isOptional).toBe(true);
    });

    it('extracts default values', () => {
      const schema = z.object({
        withDefault: z.string().default('hello'),
        withoutDefault: z.string(),
      });

      const info = extractSchemaInfo(schema);

      expect(info.children?.withDefault.hasDefault).toBe(true);
      expect(info.children?.withDefault.defaultValue).toBe('hello');
      expect(info.children?.withoutDefault.hasDefault).toBe(false);
    });

    it('extracts nullable fields', () => {
      const schema = z.object({
        nullable: z.string().nullable(),
        notNullable: z.string(),
      });

      const info = extractSchemaInfo(schema);

      expect(info.children?.nullable.isNullable).toBe(true);
      expect(info.children?.notNullable.isNullable).toBe(false);
    });

    it('extracts nested objects', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string(),
        }),
      });

      const info = extractSchemaInfo(schema);

      expect(info.children?.user.type).toBe('ZodObject');
      expect(info.children?.user.children?.name.type).toBe('ZodString');
      expect(info.children?.user.children?.email.type).toBe('ZodString');
    });

    it('extracts arrays', () => {
      const schema = z.object({
        items: z.array(z.string()),
      });

      const info = extractSchemaInfo(schema);

      expect(info.children?.items.type).toBe('ZodArray');
      expect(info.children?.items.itemType?.type).toBe('ZodString');
    });
  });

  describe('diffSchemas', () => {
    it('detects added fields', () => {
      const oldSchema = z.object({
        name: z.string(),
      });

      const newSchema = z.object({
        name: z.string(),
        email: z.string().optional(),
      });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.info).toHaveLength(1);
      expect(diff.info[0].path).toBe('email');
      expect(diff.info[0].type).toBe('added');
      expect(diff.hasBreakingChanges).toBe(false);
    });

    it('detects removed fields as breaking', () => {
      const oldSchema = z.object({
        name: z.string(),
        email: z.string(),
      });

      const newSchema = z.object({
        name: z.string(),
      });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.breaking).toHaveLength(1);
      expect(diff.breaking[0].path).toBe('email');
      expect(diff.breaking[0].type).toBe('removed');
      expect(diff.hasBreakingChanges).toBe(true);
    });

    it('detects type changes as breaking', () => {
      const oldSchema = z.object({
        count: z.string(),
      });

      const newSchema = z.object({
        count: z.number(),
      });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.breaking).toHaveLength(1);
      expect(diff.breaking[0].path).toBe('count');
      expect(diff.breaking[0].type).toBe('type_changed');
      expect(diff.hasBreakingChanges).toBe(true);
    });

    it('detects required field added without default as breaking', () => {
      const oldSchema = z.object({
        name: z.string(),
      });

      const newSchema = z.object({
        name: z.string(),
        email: z.string(), // Required without default
      });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.breaking).toHaveLength(1);
      expect(diff.breaking[0].path).toBe('email');
      expect(diff.breaking[0].type).toBe('added');
      expect(diff.hasBreakingChanges).toBe(true);
    });

    it('detects field with default added as non-breaking', () => {
      const oldSchema = z.object({
        name: z.string(),
      });

      const newSchema = z.object({
        name: z.string(),
        email: z.string().default('test@example.com'),
      });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.info).toHaveLength(1);
      expect(diff.info[0].path).toBe('email');
      expect(diff.info[0].type).toBe('added');
      expect(diff.hasBreakingChanges).toBe(false);
    });

    it('detects default value changes', () => {
      const oldSchema = z.object({
        port: z.number().default(3000),
      });

      const newSchema = z.object({
        port: z.number().default(8080),
      });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.info).toHaveLength(1);
      expect(diff.info[0].path).toBe('port');
      expect(diff.info[0].type).toBe('default_changed');
      expect(diff.info[0].oldValue).toBe(3000);
      expect(diff.info[0].newValue).toBe(8080);
    });

    it('detects default added', () => {
      const oldSchema = z.object({
        port: z.number().optional(),
      });

      const newSchema = z.object({
        port: z.number().default(3000),
      });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.info.some((c) => c.type === 'default_added')).toBe(true);
    });

    it('detects default removed as warning', () => {
      const oldSchema = z.object({
        port: z.number().default(3000),
      });

      const newSchema = z.object({
        port: z.number().optional(),
      });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.warnings).toHaveLength(1);
      expect(diff.warnings[0].type).toBe('default_removed');
    });

    it('handles nested object changes', () => {
      const oldSchema = z.object({
        server: z.object({
          host: z.string().default('localhost'),
          port: z.number().default(3000),
        }),
      });

      const newSchema = z.object({
        server: z.object({
          host: z.string().default('localhost'),
          port: z.number().default(8080),
          ssl: z.boolean().default(false),
        }),
      });

      const diff = diffSchemas(oldSchema, newSchema);

      expect(diff.info.some((c) => c.path === 'server.port' && c.type === 'default_changed')).toBe(true);
      expect(diff.info.some((c) => c.path === 'server.ssl' && c.type === 'added')).toBe(true);
    });

    it('handles no changes', () => {
      const schema = z.object({
        name: z.string(),
        port: z.number().default(3000),
      });

      const diff = diffSchemas(schema, schema);

      expect(diff.breaking).toHaveLength(0);
      expect(diff.warnings).toHaveLength(0);
      expect(diff.info).toHaveLength(0);
      expect(diff.hasBreakingChanges).toBe(false);
      expect(diff.summary).toContain('No changes');
    });
  });

  describe('generateMigrationReport', () => {
    it('generates markdown report', () => {
      const oldSchema = z.object({
        old: z.string(),
      });

      const newSchema = z.object({
        new: z.string().default('value'),
      });

      const diff = diffSchemas(oldSchema, newSchema);
      const report = generateMigrationReport(diff);

      expect(report).toContain('# Schema Migration Report');
      expect(report).toContain('## Summary');
      expect(report).toContain('Breaking Changes');
    });

    it('includes migration steps for breaking changes', () => {
      const oldSchema = z.object({
        deprecated: z.string(),
      });

      const newSchema = z.object({
        required: z.string(),
      });

      const diff = diffSchemas(oldSchema, newSchema);
      const report = generateMigrationReport(diff);

      expect(report).toContain('Migration Steps');
      expect(report).toContain('Remove');
      expect(report).toContain('Add');
    });

    it('shows no changes message when schemas are identical', () => {
      const schema = z.object({
        name: z.string(),
      });

      const diff = diffSchemas(schema, schema);
      const report = generateMigrationReport(diff);

      expect(report).toContain('No changes detected');
    });
  });

  describe('validateConfigAgainstChanges', () => {
    it('validates config has no deprecated fields', () => {
      const oldSchema = z.object({
        name: z.string(),
        deprecated: z.string(),
      });

      const newSchema = z.object({
        name: z.string(),
      });

      const diff = diffSchemas(oldSchema, newSchema);
      const config = { name: 'test', deprecated: 'value' };

      const result = validateConfigAgainstChanges(config, diff);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('deprecated'))).toBe(true);
    });

    it('validates config has required new fields', () => {
      const oldSchema = z.object({
        name: z.string(),
      });

      const newSchema = z.object({
        name: z.string(),
        required: z.string(), // No default
      });

      const diff = diffSchemas(oldSchema, newSchema);
      const config = { name: 'test' };

      const result = validateConfigAgainstChanges(config, diff);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('required'))).toBe(true);
    });

    it('passes when config is compatible', () => {
      const oldSchema = z.object({
        name: z.string(),
      });

      const newSchema = z.object({
        name: z.string(),
        optional: z.string().optional(),
      });

      const diff = diffSchemas(oldSchema, newSchema);
      const config = { name: 'test' };

      const result = validateConfigAgainstChanges(config, diff);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('applyAutoMigrations', () => {
    it('removes deprecated fields', () => {
      const oldSchema = z.object({
        name: z.string(),
        deprecated: z.string(),
      });

      const newSchema = z.object({
        name: z.string(),
      });

      const diff = diffSchemas(oldSchema, newSchema);
      const config = { name: 'test', deprecated: 'value' };

      const result = applyAutoMigrations(config, diff, newSchema);

      expect(result.config).toEqual({ name: 'test' });
      expect(result.applied.some((a) => a.includes('Removed'))).toBe(true);
    });

    it('reports manual migrations needed', () => {
      const oldSchema = z.object({
        name: z.string(),
      });

      const newSchema = z.object({
        name: z.string(),
        required: z.string(), // No default - requires manual migration
      });

      const diff = diffSchemas(oldSchema, newSchema);
      const config = { name: 'test' };

      const result = applyAutoMigrations(config, diff, newSchema);

      expect(result.manual.length).toBeGreaterThan(0);
      expect(result.manual.some((m) => m.includes('required'))).toBe(true);
    });

    it('does not modify config when no changes needed', () => {
      const schema = z.object({
        name: z.string(),
        port: z.number().default(3000),
      });

      const diff = diffSchemas(schema, schema);
      const config = { name: 'test' };

      const result = applyAutoMigrations(config, diff, schema);

      expect(result.config).toEqual({ name: 'test' });
      expect(result.applied).toHaveLength(0);
      expect(result.manual).toHaveLength(0);
    });

    it('handles nested field removal', () => {
      const oldSchema = z.object({
        server: z.object({
          host: z.string(),
          deprecated: z.string(),
        }),
      });

      const newSchema = z.object({
        server: z.object({
          host: z.string(),
        }),
      });

      const diff = diffSchemas(oldSchema, newSchema);
      const config = {
        server: {
          host: 'localhost',
          deprecated: 'value',
        },
      };

      const result = applyAutoMigrations(config, diff, newSchema);

      expect(result.config).toEqual({
        server: {
          host: 'localhost',
        },
      });
    });
  });
});
