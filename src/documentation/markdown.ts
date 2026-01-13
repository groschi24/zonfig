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
    const def = current._def as Record<string, unknown>;

    if (def.typeName === 'ZodOptional') {
      required = false;
      current = def.innerType as z.ZodType;
    }

    if (def.typeName === 'ZodDefault') {
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

  const def = zodType._def as Record<string, unknown>;
  const typeName = def.typeName as string;

  switch (typeName) {
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodArray':
      return 'array';
    case 'ZodObject':
      return 'object';
    case 'ZodEnum':
      return `enum(${(def.values as string[]).join(', ')})`;
    case 'ZodUnion':
      return 'union';
    case 'ZodOptional':
      return getZodTypeName(def.innerType as z.ZodType) + '?';
    case 'ZodDefault':
      return getZodTypeName(def.innerType as z.ZodType);
    case 'ZodNullable':
      return getZodTypeName(def.innerType as z.ZodType) + ' | null';
    default:
      return typeName.replace('Zod', '').toLowerCase();
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
