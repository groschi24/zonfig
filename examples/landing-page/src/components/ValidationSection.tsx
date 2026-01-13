import { CodeBlock, String, Comment } from './CodeBlock';

export function ValidationSection() {
  return (
    <section id="validation" className="validation-section">
      <div className="container">
        <div className="section-header">
          <span className="section-label section-label-success">Validation</span>
          <h2 className="section-title">Errors that actually help</h2>
          <p className="section-subtitle">
            No more cryptic runtime crashes. Get clear, actionable errors at startup
            that tell you exactly what{"'"}s wrong and where.
          </p>
        </div>

        <div className="validation-demo">
          <div className="validation-card">
            <div className="validation-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Your config sources
            </div>
            <div className="validation-card-body">
              <CodeBlock>
                <Comment># .env</Comment>{'\n'}
                DATABASE_URL=<String>not-a-valid-url</String>{'\n'}
                SERVER_PORT=<String>99999</String>{'\n'}
                API_TIMEOUT=<String>fast</String>{'\n'}
                <Comment># JWT_SECRET is missing entirely</Comment>
              </CodeBlock>
            </div>
          </div>

          <div className="validation-card">
            <div className="validation-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              What you see at startup
            </div>
            <div className="validation-card-body">
              <div className="error-message">
                <div className="error-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  Configuration validation failed
                </div>

                <div className="error-item">
                  <div className="error-path">database.url</div>
                  <div className="error-detail">Invalid URL format</div>
                  <div className="error-source">Source: .env → DATABASE_URL</div>
                </div>

                <div className="error-item">
                  <div className="error-path">server.port</div>
                  <div className="error-detail">Number must be ≤ 65535</div>
                  <div className="error-source">Source: .env → SERVER_PORT</div>
                </div>

                <div className="error-item">
                  <div className="error-path">api.timeout</div>
                  <div className="error-detail">Expected number, received string</div>
                  <div className="error-source">Source: .env → API_TIMEOUT</div>
                </div>

                <div className="error-item">
                  <div className="error-path">jwt.secret</div>
                  <div className="error-detail">Required field is missing</div>
                  <div className="error-source">Source: none</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
