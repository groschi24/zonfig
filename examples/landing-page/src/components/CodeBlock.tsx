import React from 'react';

interface CodeBlockProps {
  filename?: string;
  children: React.ReactNode;
}

export function CodeBlock({ filename, children }: CodeBlockProps) {
  return (
    <div className="code-block">
      {filename && (
        <div className="code-block-header">
          <span className="code-dot code-dot-red" />
          <span className="code-dot code-dot-yellow" />
          <span className="code-dot code-dot-green" />
          <span className="code-filename">{filename}</span>
        </div>
      )}
      <div className="code-body">
        <pre>{children}</pre>
      </div>
    </div>
  );
}

// Syntax highlighting components
export const Keyword = ({ children }: { children: React.ReactNode }) => (
  <span className="token-keyword">{children}</span>
);

export const String = ({ children }: { children: React.ReactNode }) => (
  <span className="token-string">{children}</span>
);

export const Func = ({ children }: { children: React.ReactNode }) => (
  <span className="token-function">{children}</span>
);

export const Comment = ({ children }: { children: React.ReactNode }) => (
  <span className="token-comment">{children}</span>
);

export const Num = ({ children }: { children: React.ReactNode }) => (
  <span className="token-number">{children}</span>
);

export const Prop = ({ children }: { children: React.ReactNode }) => (
  <span className="token-property">{children}</span>
);

export const Var = ({ children }: { children: React.ReactNode }) => (
  <span className="token-variable">{children}</span>
);

export const Err = ({ children }: { children: React.ReactNode }) => (
  <span className="token-error">{children}</span>
);
