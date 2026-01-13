export function CLISection() {
  return (
    <section id="cli" className="cli-section">
      <div className="container">
        <div className="cli-content">
          <div>
            <span className="section-label section-label-primary">CLI Tools</span>
            <h2 className="section-title">Migrate in minutes, not days</h2>
            <p className="section-subtitle">
              Our CLI analyzes your existing project, finds all your config sources,
              and generates a type-safe schema automatically.
            </p>

            <ul className="cli-features">
              <li className="cli-feature">
                <div className="cli-feature-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <div className="cli-feature-text">
                  <h4>zonfig analyze</h4>
                  <p>Scans .env files, config folders, and source code to find all your config values</p>
                </div>
              </li>

              <li className="cli-feature">
                <div className="cli-feature-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <div className="cli-feature-text">
                  <h4>zonfig docs</h4>
                  <p>Generate markdown docs, .env.example, or JSON Schema from your Zod schema</p>
                </div>
              </li>

              <li className="cli-feature">
                <div className="cli-feature-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div className="cli-feature-text">
                  <h4>zonfig validate</h4>
                  <p>Validate config files against your schema in CI/CD pipelines</p>
                </div>
              </li>

              <li className="cli-feature">
                <div className="cli-feature-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                </div>
                <div className="cli-feature-text">
                  <h4>Monorepo support</h4>
                  <p>Works with Turborepo, Nx, pnpm workspaces, and more</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="cli-terminal">
            <div className="cli-terminal-header">
              <span className="code-dot code-dot-red" />
              <span className="code-dot code-dot-yellow" />
              <span className="code-dot code-dot-green" />
            </div>
            <div className="cli-terminal-body">
              <div className="cli-line">
                <span className="cli-prompt">$ </span>
                <span className="cli-command">npx zonfig analyze --dry-run</span>
              </div>
              <div className="cli-line cli-output">
                Analyzing project: ./my-express-app
              </div>
              <div className="cli-line cli-output">&nbsp;</div>
              <div className="cli-line cli-output">
                <span className="cli-success">Found:</span>
              </div>
              <div className="cli-line cli-output">
                &nbsp;&nbsp;.env files: <span className="cli-highlight">3</span> (.env, .env.local, .env.example)
              </div>
              <div className="cli-line cli-output">
                &nbsp;&nbsp;Config files: <span className="cli-highlight">2</span> (config/default.json, config/production.json)
              </div>
              <div className="cli-line cli-output">
                &nbsp;&nbsp;process.env usage: <span className="cli-highlight">14 variables</span> across 8 files
              </div>
              <div className="cli-line cli-output">
                &nbsp;&nbsp;Framework: <span className="cli-highlight">Express</span>
              </div>
              <div className="cli-line cli-output">
                &nbsp;&nbsp;Existing libs: <span className="cli-highlight">dotenv</span>
              </div>
              <div className="cli-line cli-output">&nbsp;</div>
              <div className="cli-line cli-output">
                <span className="cli-success">Generated schema with 14 config values:</span>
              </div>
              <div className="cli-line cli-output">
                &nbsp;&nbsp;• server (host, port)
              </div>
              <div className="cli-line cli-output">
                &nbsp;&nbsp;• database (url, poolSize)
              </div>
              <div className="cli-line cli-output">
                &nbsp;&nbsp;• redis (url)
              </div>
              <div className="cli-line cli-output">
                &nbsp;&nbsp;• auth (jwtSecret, sessionTtl)
              </div>
              <div className="cli-line cli-output">
                &nbsp;&nbsp;• ...
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
