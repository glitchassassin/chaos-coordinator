import type { Route } from "./+types/design-system";
import { AppLayout } from "~/components/AppLayout";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Design System — Chaos Coordinator" }];
}

const COLORS = [
  { role: "Text", value: "#1a1a1a", css: "var(--color-text)", usage: "Body text, headings" },
  { role: "Secondary", value: "#555555", css: "var(--color-secondary)", usage: "Timestamps, metadata, dimmed" },
  { role: "Border", value: "#888888", css: "var(--color-border)", usage: "Card borders, separators" },
  { role: "Background", value: "#ffffff", css: "var(--color-bg)", usage: "Page background" },
  { role: "Active", value: "#2e7d32", css: "var(--color-active)", usage: "Active status badge" },
  { role: "Waiting", value: "#92400e", css: "var(--color-waiting)", usage: "Waiting / idle status" },
  { role: "Error", value: "#c62828", css: "var(--color-error)", usage: "Error / terminated status" },
  { role: "Link / Action", value: "#1565c0", css: "var(--color-action)", usage: "Links, buttons" },
] as const;

const SYNTAX_TOKENS = [
  { token: "keyword", label: "Keyword", sample: "function", style: { color: "#2e4057", fontWeight: "bold" } },
  { token: "string", label: "String", sample: '"hello"', style: { color: "#5b7553" } },
  { token: "comment", label: "Comment", sample: "// remark", style: { color: "#777777", fontStyle: "italic" } },
  { token: "number", label: "Number", sample: "42", style: { color: "#8b5e3c" } },
  { token: "function", label: "Function", sample: "render()", style: { color: "#1a1a1a", fontWeight: "bold" } },
  { token: "operator", label: "Operator", sample: "===", style: { color: "#555555" } },
  { token: "type", label: "Type", sample: "string", style: { color: "#4a6b8a" } },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg border-b-ui pb-2 mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ role, value, css, usage }: (typeof COLORS)[number]) {
  return (
    <div className="flex items-center gap-3 py-2 border-b-ui">
      <div
        aria-label={`${role} color swatch`}
        style={{ backgroundColor: value }}
        className="size-11 border-ui shrink-0"
      />
      <div>
        <div className="font-semibold">{role}</div>
        <div className="text-secondary text-sm">
          <code className="font-mono text-xs">{value}</code>
          {" · "}
          <code className="font-mono text-xs">{css}</code>
        </div>
        <div className="text-secondary text-xs">{usage}</div>
      </div>
    </div>
  );
}

export default function DesignSystem() {
  const sidebar = (
    <div>
      <div className="font-semibold mb-4">Design System</div>
      <nav>
        {["Colors", "Typography", "Layout", "Syntax Highlighting", "Interactive"].map((s) => (
          <div key={s} className="py-2 border-b-ui">
            <a href={`#${s.toLowerCase().replace(/ /g, "-")}`}>{s}</a>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <AppLayout sidebar={sidebar}>
      <div className="max-w-2xl pb-12">
        <h1 className="text-2xl mb-1">Design System</h1>
        <p className="text-secondary mb-8">E-ink-optimized design tokens and component styles.</p>

        {/* ── Colors ── */}
        <Section title="Colors">
          <div id="colors">
            {COLORS.map((c) => (
              <Swatch key={c.role} {...c} />
            ))}
          </div>
        </Section>

        {/* ── Typography ── */}
        <Section title="Typography">
          <div id="typography" className="flex flex-col gap-3">
            <div>
              {/* Font sizes shown explicitly for demo — keep as inline style */}
              <h1 style={{ fontSize: "2rem" }} className="mb-0">Heading 1 — 2rem / 600</h1>
              <h2 style={{ fontSize: "1.5rem" }} className="mb-0">Heading 2 — 1.5rem / 600</h2>
              <h3 style={{ fontSize: "1.25rem" }} className="mb-0">Heading 3 — 1.25rem / 600</h3>
              <h4 style={{ fontSize: "1.125rem" }} className="mb-0">Heading 4 — 1.125rem / 600</h4>
            </div>
            <div className="border-t-ui pt-3 flex flex-col gap-2">
              <p className="m-0">Body text — 18px / 400. System font stack: system-ui, -apple-system, sans-serif.</p>
              <p className="m-0 text-secondary">Secondary text — #555555. Used for timestamps, metadata, and dimmed labels.</p>
              <p className="m-0">Inline <code>code</code> and <a href="#typography">links</a> in running text.</p>
            </div>
          </div>
        </Section>

        {/* ── Layout ── */}
        <Section title="Layout">
          <div id="layout">
            <p className="mb-3 text-secondary text-sm">
              Resize the window to ≥768px to see the sidebar + main layout active on this page.
              Below 768px, the sidebar stacks above content.
            </p>
            <div className="border-ui p-3">
              <div className="grid gap-2 text-xs" style={{ gridTemplateColumns: "80px 1fr" }}>
                <div className="border-ui p-2 text-center text-secondary">sidebar<br />240px</div>
                <div className="border-ui p-2 text-center text-secondary">main<br />fluid</div>
              </div>
              <div className="mt-2 text-xs text-center text-secondary">≥768px</div>
            </div>
          </div>
        </Section>

        {/* ── Syntax Highlighting ── */}
        <Section title="Syntax Highlighting">
          <div id="syntax-highlighting">
            <p className="mb-3 text-secondary text-sm">
              E-ink theme: differentiate by weight and mild hue, not vivid color.
            </p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {["Token", "Sample", "Hex"].map((h) => (
                    <th key={h} className="text-left px-2 py-1 border-b-ui font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SYNTAX_TOKENS.map(({ token, label, sample, style }) => (
                  <tr key={token}>
                    <td className="px-2 py-1 border-b-ui text-secondary">{label}</td>
                    <td className="px-2 py-1 border-b-ui">
                      <code className={`token ${token} font-mono`} style={style}>{sample}</code>
                    </td>
                    <td className="px-2 py-1 border-b-ui text-secondary font-mono text-xs">
                      {typeof style.color === "string" ? style.color : "—"}
                      {"fontWeight" in style ? " / bold" : ""}
                      {"fontStyle" in style ? " / italic" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <pre className="language-ts mt-4">
              <code className="language-ts">
                <span className="token comment">{"// Example TypeScript snippet"}</span>{"\n"}
                <span className="token keyword">function</span>{" "}
                <span className="token function">greet</span>
                <span className="token punctuation">(</span>
                <span className="token parameter">name</span>
                <span className="token operator">:</span>{" "}
                <span className="token type">string</span>
                <span className="token punctuation">)</span>
                <span className="token operator">:</span>{" "}
                <span className="token type">string</span>{" "}{`{`}{"\n"}
                {"  "}<span className="token keyword">return</span>{" "}
                <span className="token string">{"`Hello, ${name}!`"}</span>
                <span className="token punctuation">;</span>{"\n"}
                {`}`}
              </code>
            </pre>
          </div>
        </Section>

        {/* ── Interactive elements ── */}
        <Section title="Interactive">
          <div id="interactive" className="flex flex-col gap-3">
            <div className="flex gap-3 flex-wrap items-center">
              <button
                type="button"
                className="border-[3px] border-action text-action bg-transparent px-4 font-sans text-base"
              >
                Button (44px tall)
              </button>
              <a href="#interactive" className="inline-flex items-center min-h-11">Link (44px target)</a>
            </div>
            <div>
              <input
                type="text"
                placeholder="Text input (44px tall)"
                className="border-ui px-3 w-full max-w-xs"
              />
            </div>
          </div>
        </Section>
      </div>
    </AppLayout>
  );
}
