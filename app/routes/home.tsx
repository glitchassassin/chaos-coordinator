import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Chaos Coordinator" },
    { name: "description", content: "Claude Code orchestrator" },
  ];
}

export default function Home() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>
        Chaos Coordinator
      </h1>
      <p style={{ color: "#555555" }}>Claude Code orchestrator — coming soon.</p>
    </main>
  );
}
