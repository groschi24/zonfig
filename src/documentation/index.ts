import type { z } from 'zod';
import type { DocOptions } from '../core/types.js';
import { generateMarkdown } from './markdown.js';
import { toJsonSchema } from './json-schema.js';
import { generateEnvExample } from './env-example.js';

export { generateMarkdown } from './markdown.js';
export { toJsonSchema } from './json-schema.js';
export { generateEnvExample } from './env-example.js';

/**
 * Generate documentation from a Zod schema
 */
export function generateDocs(
  schema: z.ZodType,
  options: DocOptions & { prefix?: string; title?: string } = { format: 'markdown' }
): string {
  const { format, prefix, title } = options;

  switch (format) {
    case 'markdown': {
      const mdOptions: { title?: string; includeDefaults?: boolean } = {
        includeDefaults: options.includeDefaults ?? true,
      };
      if (title !== undefined) mdOptions.title = title;
      return generateMarkdown(schema, mdOptions);
    }

    case 'json-schema':
      return JSON.stringify(toJsonSchema(schema), null, 2);

    case 'env-example': {
      const envOptions: { prefix?: string; includeComments?: boolean } = {};
      if (prefix !== undefined) envOptions.prefix = prefix;
      return generateEnvExample(schema, envOptions);
    }

    default:
      throw new Error(`Unknown documentation format: ${format}`);
  }
}
