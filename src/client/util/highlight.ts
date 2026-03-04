import { marked, type Tokens } from "marked";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-css";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-go";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-diff";

const ALIASES: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  rs: "rust",
  html: "markup",
  xml: "markup",
};

function resolveLanguage(lang: string): string | null {
  const resolved = ALIASES[lang] ?? lang;
  return Prism.languages[resolved] ? resolved : null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// highlight.js-compatible shim
export const hljs = {
  getLanguage(lang: string) {
    return Prism.languages[resolveLanguage(lang) ?? ""] ?? null;
  },
  highlight(text: string, { language }: { language: string }) {
    const resolved = resolveLanguage(language);
    if (!resolved) return { value: escapeHtml(text) };
    return { value: Prism.highlight(text, Prism.languages[resolved], resolved) };
  },
  highlightAuto(text: string) {
    return { value: escapeHtml(text) };
  },
};

marked.use({
  renderer: {
    code({ text, lang }: Tokens.Code) {
      const language = lang ? resolveLanguage(lang) : null;
      const highlighted = language
        ? Prism.highlight(text, Prism.languages[language], language)
        : escapeHtml(text);
      return `<pre class="language-${language ?? "plaintext"}"><code class="language-${language ?? "plaintext"}">${highlighted}</code></pre>`;
    },
  },
});

export function extensionToLanguage(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  const map: Record<string, string> = {
    js: "javascript", jsx: "jsx", mjs: "javascript",
    ts: "typescript", tsx: "tsx", mts: "typescript",
    py: "python", rb: "ruby",
    sh: "bash", bash: "bash", zsh: "bash",
    json: "json", yaml: "yaml", yml: "yaml",
    css: "css", html: "markup", xml: "markup",
    rs: "rust", go: "go", sql: "sql",
    md: "markdown", diff: "diff",
  };
  return map[ext] || null;
}

export { marked };
