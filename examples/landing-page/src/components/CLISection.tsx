'use client';

import { useState } from 'react';

interface CLICommand {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  terminal: {
    command: string;
    output: React.ReactNode;
  };
}

const cliCommands: CLICommand[] = [
  {
    id: 'analyze',
    title: 'zonfig analyze',
    description: 'Scans .env files, config folders, and source code to find all your config values',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    terminal: {
      command: 'npx zonfig analyze --dry-run',
      output: (
        <>
          <div className="cli-line cli-output">Analyzing project: ./my-express-app</div>
          <div className="cli-line cli-output">&nbsp;</div>
          <div className="cli-line cli-output"><span className="cli-success">Found:</span></div>
          <div className="cli-line cli-output">&nbsp;&nbsp;.env files: <span className="cli-highlight">3</span> (.env, .env.local, .env.example)</div>
          <div className="cli-line cli-output">&nbsp;&nbsp;Config files: <span className="cli-highlight">2</span> (config/default.json, config/production.json)</div>
          <div className="cli-line cli-output">&nbsp;&nbsp;process.env usage: <span className="cli-highlight">14 variables</span> across 8 files</div>
          <div className="cli-line cli-output">&nbsp;&nbsp;Framework: <span className="cli-highlight">Express</span></div>
          <div className="cli-line cli-output">&nbsp;&nbsp;Existing libs: <span className="cli-highlight">dotenv</span></div>
          <div className="cli-line cli-output">&nbsp;</div>
          <div className="cli-line cli-output"><span className="cli-success">Generated schema with 14 config values:</span></div>
          <div className="cli-line cli-output">&nbsp;&nbsp;• server (host, port)</div>
          <div className="cli-line cli-output">&nbsp;&nbsp;• database (url, poolSize)</div>
          <div className="cli-line cli-output">&nbsp;&nbsp;• redis (url)</div>
          <div className="cli-line cli-output">&nbsp;&nbsp;• auth (jwtSecret, sessionTtl)</div>
          <div className="cli-line cli-output">&nbsp;&nbsp;• ...</div>
        </>
      ),
    },
  },
  {
    id: 'docs',
    title: 'zonfig docs',
    description: 'Generate markdown docs, .env.example, or JSON Schema from your Zod schema',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    terminal: {
      command: 'npx zonfig docs -s ./src/config.ts',
      output: (
        <>
          <div className="cli-line cli-output">Loading schema from: ./src/config.ts</div>
          <div className="cli-line cli-output">&nbsp;</div>
          <div className="cli-line cli-output"><span className="cli-success">Generated documentation:</span></div>
          <div className="cli-line cli-output">&nbsp;&nbsp;Created: <span className="cli-highlight">./CONFIG.md</span></div>
          <div className="cli-line cli-output">&nbsp;&nbsp;Created: <span className="cli-highlight">./.env.example</span></div>
          <div className="cli-line cli-output">&nbsp;&nbsp;Created: <span className="cli-highlight">./config.schema.json</span></div>
          <div className="cli-line cli-output">&nbsp;</div>
          <div className="cli-line cli-output">Documentation generated successfully!</div>
        </>
      ),
    },
  },
  {
    id: 'validate',
    title: 'zonfig validate',
    description: 'Validate config files against your schema in CI/CD pipelines',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    terminal: {
      command: 'npx zonfig validate -s ./src/config.ts -c ./config/prod.json',
      output: (
        <>
          <div className="cli-line cli-output">Validating configuration...</div>
          <div className="cli-line cli-output">&nbsp;&nbsp;Schema: ./src/config.ts</div>
          <div className="cli-line cli-output">&nbsp;&nbsp;Config: ./config/prod.json</div>
          <div className="cli-line cli-output">&nbsp;</div>
          <div className="cli-line cli-output"><span className="cli-success">✓ Validation successful!</span></div>
          <div className="cli-line cli-output">&nbsp;</div>
          <div className="cli-line cli-output">Parsed configuration:</div>
          <div className="cli-line cli-output">&nbsp;&nbsp;<span className="cli-highlight">server.host</span>: &quot;0.0.0.0&quot;</div>
          <div className="cli-line cli-output">&nbsp;&nbsp;<span className="cli-highlight">server.port</span>: 8080</div>
          <div className="cli-line cli-output">&nbsp;&nbsp;<span className="cli-highlight">database.url</span>: &quot;postgres://...&quot;</div>
          <div className="cli-line cli-output">&nbsp;&nbsp;<span className="cli-highlight">logging.level</span>: &quot;info&quot;</div>
        </>
      ),
    },
  },
  {
    id: 'encrypt',
    title: 'zonfig encrypt',
    description: 'Encrypt secrets at rest with AES-256-GCM, safely commit configs to git',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    terminal: {
      command: 'npx zonfig encrypt -c ./config/production.json',
      output: (
        <>
          <div className="cli-line cli-output">Encrypting: ./config/production.json</div>
          <div className="cli-line cli-output">&nbsp;</div>
          <div className="cli-line cli-output"><span className="cli-success">Encrypted 3 value(s):</span></div>
          <div className="cli-line cli-output">&nbsp;&nbsp;• <span className="cli-highlight">database.password</span></div>
          <div className="cli-line cli-output">&nbsp;&nbsp;• <span className="cli-highlight">database.connectionString</span></div>
          <div className="cli-line cli-output">&nbsp;&nbsp;• <span className="cli-highlight">api.token</span></div>
          <div className="cli-line cli-output">&nbsp;</div>
          <div className="cli-line cli-output">Output: ./config/production.json</div>
          <div className="cli-line cli-output">&nbsp;</div>
          <div className="cli-line cli-output"><span className="cli-success">Encryption complete!</span></div>
          <div className="cli-line cli-output" style={{ opacity: 0.6, marginTop: '8px' }}>
            # Safe to commit - secrets are AES-256-GCM encrypted
          </div>
        </>
      ),
    },
  },
  {
    id: 'decrypt',
    title: 'zonfig decrypt',
    description: 'Decrypt encrypted config files for viewing or editing',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      </svg>
    ),
    terminal: {
      command: 'npx zonfig decrypt -c ./config/production.json',
      output: (
        <>
          <div className="cli-line cli-output">Decrypting: ./config/production.json</div>
          <div className="cli-line cli-output">&nbsp;&nbsp;Found <span className="cli-highlight">3</span> encrypted value(s)</div>
          <div className="cli-line cli-output">&nbsp;</div>
          <div className="cli-line cli-output"><span className="cli-success">Decrypted values:</span></div>
          <div className="cli-line cli-output">&nbsp;&nbsp;• database.password → <span className="cli-highlight">&quot;super-secret&quot;</span></div>
          <div className="cli-line cli-output">&nbsp;&nbsp;• database.connectionString → <span className="cli-highlight">&quot;postgres://...&quot;</span></div>
          <div className="cli-line cli-output">&nbsp;&nbsp;• api.token → <span className="cli-highlight">&quot;sk_live_...&quot;</span></div>
          <div className="cli-line cli-output">&nbsp;</div>
          <div className="cli-line cli-output">Output: ./config/production.json</div>
          <div className="cli-line cli-output">&nbsp;</div>
          <div className="cli-line cli-output"><span className="cli-success">Decryption complete!</span></div>
        </>
      ),
    },
  },
];

export function CLISection() {
  const [selectedCommand, setSelectedCommand] = useState<string>('analyze');

  const activeCommand = cliCommands.find((cmd) => cmd.id === selectedCommand) || cliCommands[0];

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
              {cliCommands.map((cmd) => (
                <li
                  key={cmd.id}
                  className={`cli-feature ${selectedCommand === cmd.id ? 'cli-feature-active' : ''}`}
                  onClick={() => setSelectedCommand(cmd.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedCommand(cmd.id);
                    }
                  }}
                >
                  <div className="cli-feature-icon">{cmd.icon}</div>
                  <div className="cli-feature-text">
                    <h4>{cmd.title}</h4>
                    <p>{cmd.description}</p>
                  </div>
                </li>
              ))}
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
                <span className="cli-command">{activeCommand?.terminal.command}</span>
              </div>
              {activeCommand?.terminal.output}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
