import { writeFileSync } from 'node:fs';
import { generateDocs } from 'zonfig';
import { configSchema } from './config.js';

console.log('Generating configuration documentation...\n');

// Generate Markdown documentation
const markdown = generateDocs(configSchema, {
  format: 'markdown',
  title: 'Application Configuration',
});
writeFileSync('CONFIG.md', markdown);
console.log('Created: CONFIG.md');

// Generate .env.example
const envExample = generateDocs(configSchema, {
  format: 'env-example',
  prefix: 'APP_',
});
writeFileSync('.env.example', envExample);
console.log('Created: .env.example');

// Generate JSON Schema (useful for IDE autocompletion)
const jsonSchema = generateDocs(configSchema, {
  format: 'json-schema',
});
writeFileSync('config.schema.json', jsonSchema);
console.log('Created: config.schema.json');

console.log('\nDone!');
