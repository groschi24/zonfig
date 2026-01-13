import { CodeBlock, Keyword, String, Func, Comment, Prop } from './CodeBlock';

export function FlowSection() {
  return (
    <section id="how-it-works" className="flow-section">
      <div className="container">
        <div className="section-header">
          <span className="section-label section-label-primary">How It Works</span>
          <h2 className="section-title">Multiple sources, one typed config</h2>
          <p className="section-subtitle">
            Load configuration from environment variables, JSON files, YAML, .env files,
            or even secret stores. Later sources override earlier ones.
          </p>
        </div>

        <div className="flow-diagram">
          <div className="flow-source">
            <div className="flow-source-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <span className="flow-source-label">config.json</span>
            <span className="flow-source-desc">Default values</span>
          </div>

          <div className="flow-arrow">→</div>

          <div className="flow-source">
            <div className="flow-source-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M12 18v-6" />
                <path d="M9 15l3 3 3-3" />
              </svg>
            </div>
            <span className="flow-source-label">.env</span>
            <span className="flow-source-desc">Local overrides</span>
          </div>

          <div className="flow-arrow">→</div>

          <div className="flow-source">
            <div className="flow-source-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <span className="flow-source-label">Environment</span>
            <span className="flow-source-desc">Runtime vars</span>
          </div>

          <div className="flow-arrow">→</div>

          <div className="flow-source">
            <div className="flow-source-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <span className="flow-source-label">Secrets</span>
            <span className="flow-source-desc">AWS, Vault, etc.</span>
          </div>

          <div className="flow-arrow">→</div>

          <div className="flow-result">
            <div className="flow-result-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <path d="M9 12l2 2 4-4" />
                <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
            </div>
            <div className="flow-result-title">Typed Config</div>
            <div className="flow-result-desc">Validated & frozen</div>
          </div>
        </div>

        <div className="container-narrow" style={{ marginTop: '64px' }}>
          <CodeBlock filename="config.ts">
            <Keyword>const</Keyword> config = <Keyword>await</Keyword> <Func>defineConfig</Func>({'{'}
            {'\n'}  <Prop>schema</Prop>,
            {'\n'}  <Prop>sources</Prop>: [
            {'\n'}    {'{ '}<Prop>type</Prop>: <String>{"'file'"}</String>, <Prop>path</Prop>: <String>{"'./config/default.json'"}</String>{' }'},
            {'\n'}    {'{ '}<Prop>type</Prop>: <String>{"'file'"}</String>, <Prop>path</Prop>: <String>{"'./.env'"}</String>, <Prop>format</Prop>: <String>{"'dotenv'"}</String>{' }'},
            {'\n'}    {'{ '}<Prop>type</Prop>: <String>{"'env'"}</String>, <Prop>prefix</Prop>: <String>{"'APP_'"}</String>{' }'},
            {'\n'}    {'{ '}<Prop>type</Prop>: <String>{"'plugin'"}</String>, <Prop>name</Prop>: <String>{"'aws-secrets'"}</String>, <Prop>options</Prop>: {'{ '}<Prop>secretId</Prop>: <String>{"'prod/api'"}</String>{' }'}{' }'},
            {'\n'}  ],
            {'\n'}{'}'});
            {'\n'}{'\n'}
            <Comment>{`// Each source overrides the previous one`}</Comment>{'\n'}
            <Comment>{`// Final config is validated against your Zod schema`}</Comment>{'\n'}
            <Comment>{`// Result is frozen - no accidental mutations`}</Comment>
          </CodeBlock>
        </div>
      </div>
    </section>
  );
}
