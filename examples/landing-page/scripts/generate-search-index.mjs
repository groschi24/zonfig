import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.join(__dirname, '../src/app/docs');
const outputPath = path.join(__dirname, '../src/generated/search-index.json');

// Map of paths to titles and sections (from docs-nav)
const pageMetadata = {
  '/docs': { title: 'Introduction', section: 'Get Started' },
  '/docs/installation': { title: 'Installation', section: 'Get Started' },
  '/docs/quick-start': { title: 'Quick Start', section: 'Get Started' },
  '/docs/schema': { title: 'Schema Definition', section: 'Core Concepts' },
  '/docs/sources': { title: 'Configuration Sources', section: 'Core Concepts' },
  '/docs/profiles': { title: 'Environment Profiles', section: 'Core Concepts' },
  '/docs/validation': { title: 'Validation', section: 'Core Concepts' },
  '/docs/sources/file': { title: 'File Sources', section: 'Sources' },
  '/docs/sources/env': { title: 'Environment Variables', section: 'Sources' },
  '/docs/sources/dotenv': { title: 'Dotenv Files', section: 'Sources' },
  '/docs/sources/plugins': { title: 'Plugins', section: 'Sources' },
  '/docs/api/define-config': { title: 'defineConfig', section: 'API Reference' },
  '/docs/api/config': { title: 'Config Object', section: 'API Reference' },
  '/docs/api/types': { title: 'Types', section: 'API Reference' },
  '/docs/cli': { title: 'CLI Overview', section: 'CLI' },
  '/docs/cli/init': { title: 'init', section: 'CLI' },
  '/docs/cli/validate': { title: 'validate', section: 'CLI' },
  '/docs/cli/docs': { title: 'docs', section: 'CLI' },
  '/docs/cli/analyze': { title: 'analyze', section: 'CLI' },
  '/docs/guides/typescript': { title: 'TypeScript Setup', section: 'Guides' },
  '/docs/guides/monorepo': { title: 'Monorepo Support', section: 'Guides' },
  '/docs/guides/secrets': { title: 'Secret Management', section: 'Guides' },
};

function extractTextFromMDX(content) {
  // Remove frontmatter
  content = content.replace(/^---[\s\S]*?---\n?/, '');

  // Remove code blocks but keep inline code
  content = content.replace(/```[\s\S]*?```/g, '');

  // Remove JSX/HTML tags
  content = content.replace(/<[^>]+>/g, ' ');

  // Remove markdown links but keep text
  content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove images
  content = content.replace(/!\[[^\]]*\]\([^)]+\)/g, '');

  // Remove markdown formatting
  content = content.replace(/[#*_`~]/g, ' ');

  // Remove multiple spaces and newlines
  content = content.replace(/\s+/g, ' ').trim();

  return content;
}

function extractHeadings(content) {
  const headings = [];
  const headingRegex = /^#{1,3}\s+(.+)$/gm;
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    headings.push(match[1].trim());
  }

  return headings;
}

function getAllMDXFiles(dir, basePath = '/docs') {
  const files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const newBasePath = basePath === '/docs' && entry.name === 'docs'
        ? '/docs'
        : `${basePath}/${entry.name}`;
      files.push(...getAllMDXFiles(fullPath, newBasePath));
    } else if (entry.name === 'page.mdx') {
      files.push({ filePath: fullPath, urlPath: basePath });
    }
  }

  return files;
}

function generateSearchIndex() {
  const mdxFiles = getAllMDXFiles(docsDir);
  const searchIndex = [];

  for (const { filePath, urlPath } of mdxFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const text = extractTextFromMDX(content);
      const headings = extractHeadings(content);
      const metadata = pageMetadata[urlPath] || { title: urlPath.split('/').pop(), section: 'Docs' };

      searchIndex.push({
        href: urlPath,
        title: metadata.title,
        section: metadata.section,
        content: text.slice(0, 2000), // Limit content length
        headings: headings.slice(0, 10), // Limit headings
      });
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error.message);
    }
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(searchIndex, null, 2));
  console.log(`Search index generated with ${searchIndex.length} pages`);
}

generateSearchIndex();
