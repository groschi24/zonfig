import { CodeBlock, Keyword, String, Func, Comment, Num, Prop, Var, Err } from './CodeBlock';

export function ProblemSection() {
  return (
    <section id="problem" className="problem-section">
      <div className="container">
        <div className="section-header">
          <span className="section-label">The Problem</span>
          <h2 className="section-title">Configuration is a mess</h2>
          <p className="section-subtitle">
            Scattered process.env calls, no type safety, runtime crashes,
            and documentation that{"'"}s always out of date.
          </p>
        </div>

        <div className="comparison-grid">
          {/* Before - The Problem */}
          <div className="comparison-card comparison-card-bad">
            <div className="comparison-header">
              <div className="comparison-icon comparison-icon-bad">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <div className="comparison-header-text">
                <h3>Without zonfig</h3>
                <p>Scattered, untyped, error-prone</p>
              </div>
            </div>
            <div className="comparison-body">
              <CodeBlock filename="server.ts">
                <Comment>{`// Scattered across 20+ files...`}</Comment>{'\n'}
                <Keyword>const</Keyword> port = <Var>process</Var>.env.PORT || <String>{"'3000'"}</String>;{'\n'}
                <Keyword>const</Keyword> dbUrl = <Var>process</Var>.env.<Err>DATABASE_URL</Err>;{'\n'}
                {'\n'}
                <Comment>{`// Oops, typo - fails silently at runtime`}</Comment>{'\n'}
                <Keyword>const</Keyword> secret = <Var>process</Var>.env.<Err>JWT_SECRT</Err>;{'\n'}
                {'\n'}
                <Comment>{`// Is this a string or number? Who knows!`}</Comment>{'\n'}
                <Keyword>const</Keyword> timeout = <Var>process</Var>.env.TIMEOUT;{'\n'}
                {'\n'}
                <Comment>{`// Forgot to check if it exists`}</Comment>{'\n'}
                db.<Func>connect</Func>(dbUrl); <Comment>{`// 💥 Runtime crash`}</Comment>
              </CodeBlock>
            </div>
          </div>

          {/* After - The Solution */}
          <div className="comparison-card comparison-card-good">
            <div className="comparison-header">
              <div className="comparison-icon comparison-icon-good">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div className="comparison-header-text">
                <h3>With zonfig</h3>
                <p>Centralized, typed, validated</p>
              </div>
            </div>
            <div className="comparison-body">
              <CodeBlock filename="config.ts">
                <Keyword>const</Keyword> config = <Keyword>await</Keyword> <Func>defineConfig</Func>({'{'}
                {'\n'}  <Prop>schema</Prop>: z.<Func>object</Func>({'{'}
                {'\n'}    <Prop>port</Prop>: z.<Func>number</Func>().<Func>default</Func>(<Num>3000</Num>),
                {'\n'}    <Prop>database</Prop>: z.<Func>object</Func>({'{'}
                {'\n'}      <Prop>url</Prop>: z.<Func>string</Func>().<Func>url</Func>(),
                {'\n'}    {'}'}),
                {'\n'}    <Prop>jwt</Prop>: z.<Func>object</Func>({'{'}
                {'\n'}      <Prop>secret</Prop>: z.<Func>string</Func>().<Func>min</Func>(<Num>32</Num>),
                {'\n'}    {'}'}),
                {'\n'}    <Prop>timeout</Prop>: z.<Func>number</Func>().<Func>default</Func>(<Num>5000</Num>),
                {'\n'}  {'}'}),
                {'\n'}{'}'});
                {'\n'}{'\n'}
                <Comment>{`// ✅ Type-safe, validated at startup`}</Comment>{'\n'}
                config.<Func>get</Func>(<String>{"'database.url'"}</String>); <Comment>{`// string`}</Comment>
              </CodeBlock>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
