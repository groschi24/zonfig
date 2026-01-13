import { DocsSidebar, DocsHeader, TableOfContents } from '@/components/docs';

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="docs-layout">
      <DocsHeader />
      <div className="docs-container">
        <DocsSidebar />
        <main className="docs-main">
          <article className="docs-content">
            {children}
          </article>
        </main>
        <TableOfContents />
      </div>
    </div>
  );
}
