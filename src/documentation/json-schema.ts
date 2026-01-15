import type { z } from 'zod';

interface JSONSchema {
  $schema?: string;
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  default?: unknown;
  description?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  additionalProperties?: boolean | JSONSchema;
}

/**
 * Convert a Zod schema to JSON Schema
 */
export function toJsonSchema(zodSchema: z.ZodType): JSONSchema {
  const schema: JSONSchema = {
    $schema: 'https://json-schema.org/draft-07/schema#',
  };

  Object.assign(schema, convertZodType(zodSchema));

  return schema;
}

/**
 * Get the type name from Zod _def (works with both Zod 3 and Zod 4)
 */
function getDefType(def: Record<string, unknown>): string {
  // Zod 4 uses 'type', Zod 3 uses 'typeName'
  const typeName = (def.type as string) || (def.typeName as string) || '';
  // Normalize to lowercase for comparison
  return typeName.toLowerCase().replace('zod', '');
}

/**
 * Convert a Zod type to JSON Schema
 */
function convertZodType(zodType: z.ZodType): JSONSchema {
  if (!('_def' in zodType)) {
    return {};
  }

  const def = zodType._def as unknown as Record<string, unknown>;
  const typeName = getDefType(def);

  switch (typeName) {
    case 'string':
      return convertString(def, zodType);

    case 'number':
      return convertNumber(def, zodType);

    case 'boolean':
      return { type: 'boolean' };

    case 'array':
      // Zod 4 uses 'element', Zod 3 uses 'type'
      const elementType = (def.element as z.ZodType) || (def.type as z.ZodType);
      return {
        type: 'array',
        items: elementType ? convertZodType(elementType) : {},
      };

    case 'object':
      return convertObject(zodType);

    case 'enum':
      // Zod 4 uses 'entries', Zod 3 uses 'values'
      return {
        type: 'string',
        enum: (def.entries as unknown[]) || (def.values as unknown[]),
      };

    case 'union':
      return {
        anyOf: (def.options as z.ZodType[]).map(convertZodType),
      };

    case 'optional':
      return convertZodType(def.innerType as z.ZodType);

    case 'nullable': {
      const inner = convertZodType(def.innerType as z.ZodType);
      const result: JSONSchema = { ...inner };
      if (inner.type) {
        result.type = [inner.type as string, 'null'];
      }
      return result;
    }

    case 'default': {
      const inner = convertZodType(def.innerType as z.ZodType);
      return {
        ...inner,
        default: typeof def.defaultValue === 'function'
          ? (def.defaultValue as () => unknown)()
          : def.defaultValue,
      };
    }

    case 'literal':
      return {
        const: def.value,
      } as JSONSchema;

    case 'record':
      return {
        type: 'object',
        additionalProperties: convertZodType(def.valueType as z.ZodType),
      };

    default:
      return {};
  }
}

/**
 * Convert ZodString to JSON Schema
 */
function convertString(def: Record<string, unknown>, zodType?: z.ZodType): JSONSchema {
  const schema: JSONSchema = { type: 'string' };

  // Zod 4: constraints are directly on the schema object
  const zod = zodType as Record<string, unknown> | undefined;
  if (zod) {
    if (typeof zod.minLength === 'number') schema.minLength = zod.minLength;
    if (typeof zod.maxLength === 'number') schema.maxLength = zod.maxLength;
    if (typeof zod.format === 'string') {
      const formatMap: Record<string, string> = { email: 'email', url: 'uri', uuid: 'uuid' };
      schema.format = formatMap[zod.format] || zod.format;
    }
  }

  // Zod 3: constraints are in checks array
  const checks = def.checks as Array<{ kind: string; value?: unknown }> | undefined;
  if (checks) {
    for (const check of checks) {
      switch (check.kind) {
        case 'min':
          schema.minLength = check.value as number;
          break;
        case 'max':
          schema.maxLength = check.value as number;
          break;
        case 'email':
          schema.format = 'email';
          break;
        case 'url':
          schema.format = 'uri';
          break;
        case 'uuid':
          schema.format = 'uuid';
          break;
        case 'regex':
          schema.pattern = (check.value as RegExp).source;
          break;
      }
    }
  }

  if (def.description) {
    schema.description = def.description as string;
  }

  return schema;
}

/**
 * Convert ZodNumber to JSON Schema
 */
function convertNumber(def: Record<string, unknown>, zodType?: z.ZodType): JSONSchema {
  const schema: JSONSchema = { type: 'number' };

  // Zod 4: constraints are directly on the schema object
  const zod = zodType as Record<string, unknown> | undefined;
  if (zod) {
    if (typeof zod.minValue === 'number') schema.minimum = zod.minValue;
    if (typeof zod.maxValue === 'number') schema.maximum = zod.maxValue;
    if (zod.isInt === true) schema.type = 'integer';
  }

  // Zod 3: constraints are in checks array
  const checks = def.checks as Array<{ kind: string; value?: number }> | undefined;
  if (checks) {
    for (const check of checks) {
      switch (check.kind) {
        case 'min':
          if (check.value !== undefined) schema.minimum = check.value;
          break;
        case 'max':
          if (check.value !== undefined) schema.maximum = check.value;
          break;
        case 'int':
          schema.type = 'integer';
          break;
      }
    }
  }

  if (def.description) {
    schema.description = def.description as string;
  }

  return schema;
}

/**
 * Convert ZodObject to JSON Schema
 */
function convertObject(zodType: z.ZodType): JSONSchema {
  const schema: JSONSchema = {
    type: 'object',
    properties: {},
    required: [],
  };

  if (!('shape' in zodType)) {
    return schema;
  }

  const shape = zodType.shape as Record<string, z.ZodType>;

  for (const [key, value] of Object.entries(shape)) {
    schema.properties![key] = convertZodType(value);

    // Check if required
    if (!isOptional(value)) {
      schema.required!.push(key);
    }
  }

  // Remove empty required array
  if (schema.required!.length === 0) {
    delete schema.required;
  }

  return schema;
}

/**
 * Check if a Zod type is optional or has a default
 */
function isOptional(zodType: z.ZodType): boolean {
  if (!('_def' in zodType)) return false;

  const def = zodType._def as unknown as Record<string, unknown>;
  const typeName = getDefType(def);

  return typeName === 'optional' || typeName === 'default';
}
