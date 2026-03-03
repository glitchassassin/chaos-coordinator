import { useEffect } from "react";
import { redirect, useRevalidator } from "react-router";
import type { Route } from "./+types/projects.$encodedDir.agents.$agentId";
import { getProject } from "../../server/projects.js";
import { getAgent } from "../../server/agents.js";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Starting Agent — ${loaderData.project.name}` }];
}

export function loader({ params }: Route.LoaderArgs) {
  const project = getProject(params.encodedDir);
  if (!project) throw new Response("Project not found", { status: 404 });

  const agent = getAgent(params.agentId);
  if (!agent) {
    // Agent was terminated or doesn't exist — go back to project
    throw redirect(`/projects/${params.encodedDir}`);
  }

  // If the conversation is already linked, redirect straight there
  if (agent.claudeSessionId) {
    throw redirect(
      `/projects/${params.encodedDir}/conversations/${agent.claudeSessionId}`,
    );
  }

  return {
    project,
    agent: {
      id: agent.id,
      status: agent.status,
      initialPrompt: agent.initialPrompt,
      createdAt: agent.createdAt,
    },
  };
}

export default function AgentLoading({ loaderData }: Route.ComponentProps) {
  const { project, agent } = loaderData;
  const revalidator = useRevalidator();

  // Poll every 2s — when the loader detects claudeSessionId, it redirects
  useEffect(() => {
    const id = setInterval(() => {
      if (revalidator.state === "idle") revalidator.revalidate();
    }, 2_000);
    return () => clearInterval(id);
  }, [revalidator]);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "1.5rem", fontSize: "0.875rem" }}>
        <a href="/" style={{ color: "#1565c0" }}>
          Projects
        </a>
        {" / "}
        <a
          href={`/projects/${project.encodedDir}`}
          style={{ color: "#1565c0" }}
        >
          {project.name}
        </a>
        {" / "}
        <span style={{ color: "#555555" }}>New Agent</span>
      </div>

      {/* Loading state */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "4rem 1rem",
        }}
      >
        <div
          style={{
            fontSize: "1.25rem",
            marginBottom: "1rem",
          }}
        >
          Starting agent…
        </div>

        <p style={{ color: "#555555", fontSize: "0.875rem", textAlign: "center" }}>
          Waiting for Claude to initialize.
        </p>

        {agent.initialPrompt && (
          <p
            style={{
              color: "#555555",
              fontSize: "0.8125rem",
              marginTop: "1rem",
              maxWidth: 500,
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Prompt: {agent.initialPrompt}
          </p>
        )}
      </div>
    </main>
  );
}
