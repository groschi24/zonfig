import type { MDXComponents } from 'mdx/types';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="docs-h1">{children}</h1>
    ),
    h2: ({ children, id }) => (
      <h2 id={id} className="docs-h2">{children}</h2>
    ),
    h3: ({ children, id }) => (
      <h3 id={id} className="docs-h3">{children}</h3>
    ),
    h4: ({ children, id }) => (
      <h4 id={id} className="docs-h4">{children}</h4>
    ),
    p: ({ children }) => (
      <p className="docs-p">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="docs-ul">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="docs-ol">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="docs-li">{children}</li>
    ),
    code: ({ children, ...props }) => (
      <code {...props}>{children}</code>
    ),
    pre: ({ children, ...props }) => (
      <pre {...props}>{children}</pre>
    ),
    a: ({ href, children }) => (
      <a href={href} className="docs-link">{children}</a>
    ),
    blockquote: ({ children }) => (
      <blockquote className="docs-blockquote">{children}</blockquote>
    ),
    table: ({ children }) => (
      <div className="docs-table-wrapper">
        <table className="docs-table">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="docs-th">{children}</th>
    ),
    td: ({ children }) => (
      <td className="docs-td">{children}</td>
    ),
    hr: () => <hr className="docs-hr" />,
    // Callout component
    Callout: ({ type = 'info', children }: { type?: 'info' | 'warning' | 'error' | 'tip'; children: React.ReactNode }) => (
      <div className={`docs-callout docs-callout-${type}`}>
        {children}
      </div>
    ),
    // API property component
    ApiProperty: ({ name, type, required, children }: { name: string; type: string; required?: boolean; children: React.ReactNode }) => (
      <div className="docs-api-property">
        <div className="docs-api-property-header">
          <code className="docs-api-property-name">{name}</code>
          <span className="docs-api-property-type">{type}</span>
          {required && <span className="docs-api-property-required">required</span>}
        </div>
        <div className="docs-api-property-desc">{children}</div>
      </div>
    ),
    ...components,
  };
}
