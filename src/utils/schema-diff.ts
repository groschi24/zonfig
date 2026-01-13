import type { z } from 'zod';

/**
 * Types of schema changes
 */
export type ChangeType =
  | 'added'
  | 'removed'
  | 'type_changed'
  | 'made_required'
  | 'made_optional'
  | 'default_added'
  | 'default_removed'
  | 'default_changed'
  | 'constraint_changed'
  | 'description_changed';

/**
 * Severity of a schema change
 */
export type ChangeSeverity = 'breaking' | 'warning' | 'info';

/**
 * A single schema change
 */
export interface SchemaChange {
  path: string;
  type: ChangeType;
  severity: ChangeSeverity;
  message: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Result of comparing two schemas
 */
export interface SchemaDiffResult {
  breaking: SchemaChange[];
  warnings: SchemaChange[];
  info: SchemaChange[];
  hasBreakingChanges: boolean;
  summary: string;
}

/**
 * Extracted schema information for comparison
 */
export interface SchemaField {
  type: string;
  isOptional: boolean;
  isNullable: boolean;
  hasDefault: boolean;
  defaultValue?: unknown;
  description?: string;
  constraints?: Record<string, unknown>;
  children?: Record<string, SchemaField>;
  itemType?: SchemaField;
}

/**
 * Get the type name from a Zod schema, handling both old and new Zod internal structures
 */
function getZodTypeName(schema: z.ZodType): string {
  const def = (schema as unknown as { _def: Record<string, unknown> })._def;

  // Old Zod (v3.x) uses typeName like 'ZodObject'
  if (def.typeName) {
    return def.typeName as string;
  }

  // New Zod (v4.x / mini) uses type as lowercase string like 'object'
  if (def.type && typeof def.type === 'string') {
    // Normalize to match old format
    const typeMap: Record<string, string> = {
      object: 'ZodObject',
      string: 'ZodString',
      number: 'ZodNumber',
      boolean: 'ZodBoolean',
      array: 'ZodArray',
      optional: 'ZodOptional',
      nullable: 'ZodNullable',
      default: 'ZodDefault',
      union: 'ZodUnion',
      enum: 'ZodEnum',
      literal: 'ZodLiteral',
      effects: 'ZodEffects',
      undefined: 'ZodUndefined',
      null: 'ZodNull',
      any: 'ZodAny',
      unknown: 'ZodUnknown',
      never: 'ZodNever',
      void: 'ZodVoid',
      date: 'ZodDate',
      bigint: 'ZodBigInt',
      symbol: 'ZodSymbol',
      record: 'ZodRecord',
      map: 'ZodMap',
      set: 'ZodSet',
      tuple: 'ZodTuple',
      intersection: 'ZodIntersection',
      lazy: 'ZodLazy',
      promise: 'ZodPromise',
      function: 'ZodFunction',
      nativeEnum: 'ZodNativeEnum',
      catch: 'ZodCatch',
      branded: 'ZodBranded',
      pipeline: 'ZodPipeline',
      readonly: 'ZodReadonly',
      nonoptional: 'ZodNonoptional',
      success: 'ZodSuccess',
      file: 'ZodFile',
      transform: 'ZodTransform',
    };
    return typeMap[def.type as string] || `Zod${(def.type as string).charAt(0).toUpperCase()}${(def.type as string).slice(1)}`;
  }

  // Fallback to constructor name
  const constructorName = schema.constructor.name;
  if (constructorName && constructorName !== 'Object') {
    return constructorName;
  }

  return 'ZodUnknown';
}

/**
 * Extract field information from a Zod schema
 */
export function extractSchemaInfo(schema: z.ZodType): SchemaField {
  const def = (schema as unknown as { _def: Record<string, unknown> })._def;
  const typeName = getZodTypeName(schema);

  const field: SchemaField = {
    type: typeName,
    isOptional: false,
    isNullable: false,
    hasDefault: false,
  };

  // Handle wrapped types
  if (typeName === 'ZodOptional') {
    const inner = extractSchemaInfo(def.innerType as z.ZodType);
    return { ...inner, isOptional: true };
  }

  if (typeName === 'ZodNullable') {
    const inner = extractSchemaInfo(def.innerType as z.ZodType);
    return { ...inner, isNullable: true };
  }

  if (typeName === 'ZodDefault') {
    const inner = extractSchemaInfo(def.innerType as z.ZodType);
    // In Zod 3.x, defaultValue is a function that returns the value
    // In newer Zod versions, it's the value itself
    const defaultValue = typeof def.defaultValue === 'function'
      ? def.defaultValue()
      : def.defaultValue;
    return {
      ...inner,
      hasDefault: true,
      defaultValue,
    };
  }

  if (typeName === 'ZodEffects') {
    return extractSchemaInfo(def.schema as z.ZodType);
  }

  // Handle description (check both old and new locations)
  if (def.description) {
    field.description = def.description as string;
  }

  // Handle objects
  if (typeName === 'ZodObject') {
    // shape can be a function (old Zod) or object (new Zod)
    const shapeValue = def.shape as (() => Record<string, z.ZodType>) | Record<string, z.ZodType>;
    const shapeObj = typeof shapeValue === 'function' ? shapeValue() : shapeValue;
    field.children = {};
    for (const [key, value] of Object.entries(shapeObj)) {
      // In new Zod, values in shape might have a 'def' property instead of '_def'
      if (value && typeof value === 'object' && ('safeParse' in value || '_def' in value || 'def' in value)) {
        field.children[key] = extractSchemaInfo(value as z.ZodType);
      }
    }
  }

  // Handle arrays - in new Zod, element type might be in 'element' instead of 'type'
  if (typeName === 'ZodArray') {
    const elementType = def.type || def.element;
    if (elementType && typeof elementType === 'object') {
      field.itemType = extractSchemaInfo(elementType as z.ZodType);
    }
  }

  // Handle unions
  if (typeName === 'ZodUnion') {
    const options = def.options as z.ZodType[];
    if (options) {
      field.constraints = {
        unionTypes: options.map((opt) => extractSchemaInfo(opt).type),
      };
    }
  }

  // Handle enums
  if (typeName === 'ZodEnum' || typeName === 'ZodNativeEnum') {
    field.constraints = {
      values: def.values || def.enum,
    };
  }

  // Handle literals
  if (typeName === 'ZodLiteral') {
    field.constraints = {
      literal: def.value,
    };
  }

  // Extract constraints for primitives
  if (typeName === 'ZodString') {
    const checks = def.checks as Array<{ kind: string; value?: unknown }> | undefined;
    if (checks && checks.length > 0) {
      field.constraints = {};
      for (const check of checks) {
        field.constraints[check.kind] = check.value ?? true;
      }
    }
  }

  if (typeName === 'ZodNumber') {
    const checks = def.checks as Array<{ kind: string; value?: unknown }> | undefined;
    if (checks && checks.length > 0) {
      field.constraints = {};
      for (const check of checks) {
        field.constraints[check.kind] = check.value ?? true;
      }
    }
  }

  return field;
}

/**
 * Compare two schema fields and return the differences
 */
function compareFields(
  oldField: SchemaField | undefined,
  newField: SchemaField | undefined,
  path: string
): SchemaChange[] {
  const changes: SchemaChange[] = [];

  // Field was removed
  if (oldField && !newField) {
    changes.push({
      path,
      type: 'removed',
      severity: 'breaking',
      message: `Field "${path}" was removed`,
      oldValue: oldField.type,
    });
    return changes;
  }

  // Field was added
  if (!oldField && newField) {
    const isBreaking = !newField.isOptional && !newField.hasDefault;
    changes.push({
      path,
      type: 'added',
      severity: isBreaking ? 'breaking' : 'info',
      message: isBreaking
        ? `Required field "${path}" was added without a default value`
        : `Field "${path}" was added${newField.hasDefault ? ' with default value' : ' (optional)'}`,
      newValue: newField.type,
    });
    return changes;
  }

  // Both exist - compare them
  if (oldField && newField) {
    // Type changed
    if (oldField.type !== newField.type) {
      changes.push({
        path,
        type: 'type_changed',
        severity: 'breaking',
        message: `Field "${path}" type changed from ${oldField.type} to ${newField.type}`,
        oldValue: oldField.type,
        newValue: newField.type,
      });
    }

    // Optional to required
    if (oldField.isOptional && !newField.isOptional && !newField.hasDefault) {
      changes.push({
        path,
        type: 'made_required',
        severity: 'breaking',
        message: `Field "${path}" changed from optional to required without a default`,
        oldValue: 'optional',
        newValue: 'required',
      });
    }

    // Required to optional
    if (!oldField.isOptional && newField.isOptional) {
      changes.push({
        path,
        type: 'made_optional',
        severity: 'info',
        message: `Field "${path}" changed from required to optional`,
        oldValue: 'required',
        newValue: 'optional',
      });
    }

    // Default added
    if (!oldField.hasDefault && newField.hasDefault) {
      changes.push({
        path,
        type: 'default_added',
        severity: 'info',
        message: `Field "${path}" now has a default value`,
        newValue: newField.defaultValue,
      });
    }

    // Default removed
    if (oldField.hasDefault && !newField.hasDefault) {
      changes.push({
        path,
        type: 'default_removed',
        severity: 'warning',
        message: `Field "${path}" default value was removed`,
        oldValue: oldField.defaultValue,
      });
    }

    // Default changed
    if (
      oldField.hasDefault &&
      newField.hasDefault &&
      JSON.stringify(oldField.defaultValue) !== JSON.stringify(newField.defaultValue)
    ) {
      changes.push({
        path,
        type: 'default_changed',
        severity: 'info',
        message: `Field "${path}" default value changed`,
        oldValue: oldField.defaultValue,
        newValue: newField.defaultValue,
      });
    }

    // Constraints changed
    if (JSON.stringify(oldField.constraints) !== JSON.stringify(newField.constraints)) {
      const oldConstraints = oldField.constraints ?? {};
      const newConstraints = newField.constraints ?? {};

      // Check for more restrictive constraints (breaking)
      const moreRestrictive =
        (newConstraints.min !== undefined &&
          (oldConstraints.min === undefined ||
            (newConstraints.min as number) > (oldConstraints.min as number))) ||
        (newConstraints.max !== undefined &&
          (oldConstraints.max === undefined ||
            (newConstraints.max as number) < (oldConstraints.max as number))) ||
        (newConstraints.minLength !== undefined &&
          (oldConstraints.minLength === undefined ||
            (newConstraints.minLength as number) > (oldConstraints.minLength as number))) ||
        (newConstraints.maxLength !== undefined &&
          (oldConstraints.maxLength === undefined ||
            (newConstraints.maxLength as number) < (oldConstraints.maxLength as number)));

      changes.push({
        path,
        type: 'constraint_changed',
        severity: moreRestrictive ? 'breaking' : 'warning',
        message: `Field "${path}" constraints changed${moreRestrictive ? ' (more restrictive)' : ''}`,
        oldValue: oldConstraints,
        newValue: newConstraints,
      });
    }

    // Description changed
    if (oldField.description !== newField.description) {
      changes.push({
        path,
        type: 'description_changed',
        severity: 'info',
        message: `Field "${path}" description changed`,
        oldValue: oldField.description,
        newValue: newField.description,
      });
    }

    // Compare children (for objects)
    if (oldField.children || newField.children) {
      const oldChildren = oldField.children ?? {};
      const newChildren = newField.children ?? {};
      const allKeys = new Set([...Object.keys(oldChildren), ...Object.keys(newChildren)]);

      for (const key of allKeys) {
        const childPath = path ? `${path}.${key}` : key;
        changes.push(...compareFields(oldChildren[key], newChildren[key], childPath));
      }
    }

    // Compare array item types
    if (oldField.itemType || newField.itemType) {
      if (oldField.itemType && newField.itemType) {
        changes.push(...compareFields(oldField.itemType, newField.itemType, `${path}[]`));
      } else if (oldField.itemType && !newField.itemType) {
        changes.push({
          path: `${path}[]`,
          type: 'type_changed',
          severity: 'breaking',
          message: `Array item type at "${path}" was removed`,
          oldValue: oldField.itemType.type,
        });
      } else if (!oldField.itemType && newField.itemType) {
        changes.push({
          path: `${path}[]`,
          type: 'type_changed',
          severity: 'breaking',
          message: `Array item type at "${path}" was added`,
          newValue: newField.itemType?.type,
        });
      }
    }
  }

  return changes;
}

/**
 * Compare two Zod schemas and return the differences
 */
export function diffSchemas(oldSchema: z.ZodType, newSchema: z.ZodType): SchemaDiffResult {
  const oldInfo = extractSchemaInfo(oldSchema);
  const newInfo = extractSchemaInfo(newSchema);

  const allChanges = compareFields(oldInfo, newInfo, '');

  const breaking = allChanges.filter((c) => c.severity === 'breaking');
  const warnings = allChanges.filter((c) => c.severity === 'warning');
  const info = allChanges.filter((c) => c.severity === 'info');

  const hasBreakingChanges = breaking.length > 0;

  let summary = '';
  if (allChanges.length === 0) {
    summary = 'No changes detected between schemas.';
  } else {
    const parts: string[] = [];
    if (breaking.length > 0) {
      parts.push(`${breaking.length} breaking change${breaking.length > 1 ? 's' : ''}`);
    }
    if (warnings.length > 0) {
      parts.push(`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`);
    }
    if (info.length > 0) {
      parts.push(`${info.length} info change${info.length > 1 ? 's' : ''}`);
    }
    summary = `Found ${parts.join(', ')}.`;
  }

  return {
    breaking,
    warnings,
    info,
    hasBreakingChanges,
    summary,
  };
}

/**
 * Generate a migration report as a string
 */
export function generateMigrationReport(diff: SchemaDiffResult): string {
  const lines: string[] = [];

  lines.push('# Schema Migration Report');
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push(diff.summary);
  lines.push('');

  if (diff.hasBreakingChanges) {
    lines.push('⚠️  **This migration contains breaking changes!**');
    lines.push('');
  }

  if (diff.breaking.length > 0) {
    lines.push('## Breaking Changes');
    lines.push('');
    for (const change of diff.breaking) {
      lines.push(`- ❌ **${change.path || '(root)'}**: ${change.message}`);
      if (change.oldValue !== undefined) {
        lines.push(`  - Old: \`${JSON.stringify(change.oldValue)}\``);
      }
      if (change.newValue !== undefined) {
        lines.push(`  - New: \`${JSON.stringify(change.newValue)}\``);
      }
    }
    lines.push('');
  }

  if (diff.warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const change of diff.warnings) {
      lines.push(`- ⚠️  **${change.path || '(root)'}**: ${change.message}`);
      if (change.oldValue !== undefined) {
        lines.push(`  - Old: \`${JSON.stringify(change.oldValue)}\``);
      }
      if (change.newValue !== undefined) {
        lines.push(`  - New: \`${JSON.stringify(change.newValue)}\``);
      }
    }
    lines.push('');
  }

  if (diff.info.length > 0) {
    lines.push('## Other Changes');
    lines.push('');
    for (const change of diff.info) {
      lines.push(`- ℹ️  **${change.path || '(root)'}**: ${change.message}`);
      if (change.oldValue !== undefined) {
        lines.push(`  - Old: \`${JSON.stringify(change.oldValue)}\``);
      }
      if (change.newValue !== undefined) {
        lines.push(`  - New: \`${JSON.stringify(change.newValue)}\``);
      }
    }
    lines.push('');
  }

  if (diff.breaking.length > 0) {
    lines.push('## Migration Steps');
    lines.push('');
    lines.push('To migrate your configuration:');
    lines.push('');

    let step = 1;
    for (const change of diff.breaking) {
      if (change.type === 'removed') {
        lines.push(`${step}. Remove the \`${change.path}\` field from your config files`);
        step++;
      } else if (change.type === 'added') {
        lines.push(`${step}. Add \`${change.path}\` field to your config files`);
        step++;
      } else if (change.type === 'type_changed') {
        lines.push(
          `${step}. Update \`${change.path}\` value to match the new type (${change.oldValue} → ${change.newValue})`
        );
        step++;
      } else if (change.type === 'made_required') {
        lines.push(`${step}. Ensure \`${change.path}\` is present in all config files`);
        step++;
      } else if (change.type === 'constraint_changed') {
        lines.push(`${step}. Update \`${change.path}\` value to meet new constraints`);
        step++;
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Validate a config object against schema changes
 */
export function validateConfigAgainstChanges(
  config: Record<string, unknown>,
  diff: SchemaDiffResult
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const change of diff.breaking) {
    if (change.type === 'added') {
      // Check if the new required field exists in config
      const value = getValueByPath(config, change.path);
      if (value === undefined) {
        errors.push(`Missing required field: ${change.path}`);
      }
    } else if (change.type === 'removed') {
      // Check if the removed field still exists in config
      const value = getValueByPath(config, change.path);
      if (value !== undefined) {
        errors.push(`Deprecated field still present: ${change.path}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get a value from an object by dot-notation path
 */
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  if (!path) return obj;

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Apply automatic migrations to a config object where possible
 */
export function applyAutoMigrations(
  config: Record<string, unknown>,
  diff: SchemaDiffResult,
  _newSchema: z.ZodType
): { config: Record<string, unknown>; applied: string[]; manual: string[] } {
  const result = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
  const applied: string[] = [];
  const manual: string[] = [];

  for (const change of diff.breaking) {
    if (change.type === 'removed') {
      // Auto-remove deprecated fields
      deleteValueByPath(result, change.path);
      applied.push(`Removed deprecated field: ${change.path}`);
    } else if (change.type === 'added' && change.newValue !== undefined) {
      // Can't auto-add required fields - need manual intervention
      manual.push(`Add required field: ${change.path}`);
    } else {
      manual.push(`Manual migration required: ${change.message}`);
    }
  }

  // Apply default values from new schema for new optional fields
  for (const change of diff.info) {
    if (change.type === 'added' && change.newValue !== undefined) {
      // Field is optional or has default - already handled by schema
      applied.push(`New optional field available: ${change.path}`);
    }
  }

  return { config: result, applied, manual };
}

/**
 * Delete a value from an object by dot-notation path
 */
function deleteValueByPath(obj: Record<string, unknown>, path: string): void {
  if (!path) return;

  const parts = path.split('.');
  const lastPart = parts.pop();
  if (!lastPart) return;

  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return;
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (current && typeof current === 'object') {
    delete (current as Record<string, unknown>)[lastPart];
  }
}
