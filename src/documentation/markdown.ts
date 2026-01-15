import type { z } from 'zod';

interface FieldInfo {
  path: string;
  type: string;
  required: boolean;
  default?: unknown;
  description?: string;
}

/**
 * Extract field information from a Zod schema
 */
function extractFields(
  schema: z.ZodType,
  prefix: string = ''
): FieldInfo[] {
  const fields: FieldInfo[] = [];

  // Handle ZodObject
  if ('shape' in schema && typeof schema.shape === 'object') {
    const shape = schema.shape as Record<string, z.ZodType>;

    for (const [key, value] of Object.entries(shape)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const info = getFieldInfo(value, path);

      // Recursively extract nested objects
      if ('shape' in value) {
        fields.push(...extractFields(value, path));
      } else {
        fields.push(info);
      }
    }
  }

  return fields;
}

/**
 * Get the type name from Zod _def (works with both Zod 3 and Zod 4)
 */
function getDefType(def: Record<string, unknown>): string {
  // Zod 4 uses 'type', Zod 3 uses 'typeName'
  return (def.type as string) || (def.typeName as string) || '';
}

/**
 * Get field information from a Zod type
 */
function getFieldInfo(zodType: z.ZodType, path: string): FieldInfo {
  let type = getZodTypeName(zodType);
  let required = true;
  let defaultValue: unknown;
  let description: string | undefined;

  // Unwrap and analyze type
  let current = zodType;

  // Check for optional
  if ('_def' in current) {
    const def = current._def as unknown as Record<string, unknown>;
    const defType = getDefType(def);

    if (defType === 'optional' || defType === 'ZodOptional') {
      required = false;
      current = def.innerType as z.ZodType;
    }

    if (defType === 'default' || defType === 'ZodDefault') {
      required = false;
      defaultValue = typeof def.defaultValue === 'function'
        ? (def.defaultValue as () => unknown)()
        : def.defaultValue;
      current = def.innerType as z.ZodType;
    }

    if (def.description && typeof def.description === 'string') {
      description = def.description;
    }
  }

  type = getZodTypeName(current);

  const field: FieldInfo = {
    path,
    type,
    required,
  };

  if (defaultValue !== undefined) field.default = defaultValue;
  if (description !== undefined) field.description = description;

  return field;
}

/**
 * Get human-readable type name from Zod type
 */
function getZodTypeName(zodType: z.ZodType): string {
  if (!('_def' in zodType)) return 'unknown';

  const def = zodType._def as unknown as Record<string, unknown>;
  const typeName = getDefType(def);

  // Normalize to lowercase for comparison (Zod 4 uses lowercase)
  const normalizedType = typeName.toLowerCase().replace('zod', '');

  switch (normalizedType) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'array';
    case 'object':
      return 'object';
    case 'enum':
      // Zod 4 uses 'entries', Zod 3 uses 'values'
      const enumValues = (def.entries as string[]) || (def.values as string[]) || [];
      return `enum(${enumValues.join(', ')})`;
    case 'union':
      return 'union';
    case 'optional':
      return getZodTypeName(def.innerType as z.ZodType) + '?';
    case 'default':
      return getZodTypeName(def.innerType as z.ZodType);
    case 'nullable':
      return getZodTypeName(def.innerType as z.ZodType) + ' | null';
    default:
      return normalizedType || 'unknown';
  }
}

/**
 * Generate markdown documentation from a Zod schema
 */
export function generateMarkdown(
  schema: z.ZodType,
  options: { title?: string; includeDefaults?: boolean } = {}
): string {
  const { title = 'Configuration Reference', includeDefaults = true } = options;
  const fields = extractFields(schema);
  const lines: string[] = [];

  lines.push(`# ${title}`, '');

  // Group fields by top-level key
  const grouped = new Map<string, FieldInfo[]>();

  for (const field of fields) {
    const topLevel = field.path.split('.')[0] ?? field.path;
    const existing = grouped.get(topLevel) ?? [];
    existing.push(field);
    grouped.set(topLevel, existing);
  }

  // Generate table for each group
  for (const [group, groupFields] of grouped) {
    lines.push(`## ${group}`, '');

    // Table header
    const headers = ['Key', 'Type', 'Required'];
    if (includeDefaults) headers.push('Default');
    headers.push('Description');

    lines.push(`| ${headers.join(' | ')} |`);
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`);

    // Table rows
    for (const field of groupFields) {
      const row = [
        `\`${field.path}\``,
        field.type,
        field.required ? 'Yes' : 'No',
      ];

      if (includeDefaults) {
        row.push(
          field.default !== undefined
            ? `\`${JSON.stringify(field.default)}\``
            : '-'
        );
      }

      row.push(field.description ?? '-');

      lines.push(`| ${row.join(' | ')} |`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
