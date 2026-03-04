// Opencode data model (subset relevant to our UI)

export interface Instance {
  id: string;
  name: string;
  port: number;
  directory: string;
  remote?: "github" | "azuredevops";
}

export interface Session {
  id: string;
  title?: string;
  time?: { created?: number; updated?: number; archived?: number };
}

// Message info (discriminated by role)
export interface MessageInfo {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  time: { created: number; completed?: number };
  agent?: string;
  modelID?: string;
  providerID?: string;
  [key: string]: unknown;
}

// Part base — all parts have these
export interface PartBase {
  id: string;
  sessionID: string;
  messageID: string;
  type: string;
}

export interface TextPart extends PartBase {
  type: "text";
  text: string;
}

export interface ToolPart extends PartBase {
  type: "tool";
  tool: string;
  callID: string;
  state: {
    status: "pending" | "running" | "completed" | "error";
    input?: Record<string, unknown>;
    output?: string;
    title?: string;
    error?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface ReasoningPart extends PartBase {
  type: "reasoning";
  text: string;
}

export type Part = TextPart | ToolPart | ReasoningPart | (PartBase & Record<string, unknown>);

// API response shape for message list
export interface MessageWithParts {
  info: MessageInfo;
  parts: Part[];
}

// Permission request from opencode
export interface PermissionRequest {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: { messageID: string; callID: string };
}

// SSE event envelope
export interface SSEEvent {
  type: string;
  properties: Record<string, unknown>;
}

// Filesystem entry for directory picker
export interface FsEntry {
  name: string;
  path: string;
}

// Git file status from /file/status
export interface FileStatus {
  path: string;
  added: number;
  removed: number;
  status: "added" | "deleted" | "modified";
}

// Directory listing entry from /file/file
export interface FileNode {
  name: string;
  path: string;
  absolute: string;
  type: "file" | "directory";
  ignored: boolean;
}

// File content from /file/content
export interface FileContent {
  type: string;
  content: string;
  diff?: string;
  patch?: string;
  encoding?: string;
  mimeType?: string;
}
