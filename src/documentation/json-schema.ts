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
 * Convert a Zod type to JSON Schema
 */
function convertZodType(zodType: z.ZodType): JSONSchema {
  if (!('_def' in zodType)) {
    return {};
  }

  const def = zodType._def as Record<string, unknown>;
  const typeName = def.typeName as string;

  switch (typeName) {
    case 'ZodString':
      return convertString(def);

    case 'ZodNumber':
      return convertNumber(def);

    case 'ZodBoolean':
      return { type: 'boolean' };

    case 'ZodArray':
      return {
        type: 'array',
        items: convertZodType(def.type as z.ZodType),
      };

    case 'ZodObject':
      return convertObject(zodType);

    case 'ZodEnum':
      return {
        type: 'string',
        enum: def.values as unknown[],
      };

    case 'ZodUnion':
      return {
        anyOf: (def.options as z.ZodType[]).map(convertZodType),
      };

    case 'ZodOptional':
      return convertZodType(def.innerType as z.ZodType);

    case 'ZodNullable': {
      const inner = convertZodType(def.innerType as z.ZodType);
      const result: JSONSchema = { ...inner };
      if (inner.type) {
        result.type = [inner.type as string, 'null'];
      }
      return result;
    }

    case 'ZodDefault': {
      const inner = convertZodType(def.innerType as z.ZodType);
      return {
        ...inner,
        default: typeof def.defaultValue === 'function'
          ? (def.defaultValue as () => unknown)()
          : def.defaultValue,
      };
    }

    case 'ZodLiteral':
      return {
        const: def.value,
      } as JSONSchema;

    case 'ZodRecord':
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
function convertString(def: Record<string, unknown>): JSONSchema {
  const schema: JSONSchema = { type: 'string' };

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
function convertNumber(def: Record<string, unknown>): JSONSchema {
  const schema: JSONSchema = { type: 'number' };

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

  const def = zodType._def as Record<string, unknown>;
  const typeName = def.typeName as string;

  return typeName === 'ZodOptional' || typeName === 'ZodDefault';
}
