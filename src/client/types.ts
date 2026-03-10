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
  directory?: string;
  parentID?: string;
  revert?: {
    messageID: string;
    partID?: string;
    snapshot?: string;
    diff?: string;
  };
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

// Question request from opencode
export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionInfo {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface QuestionRequest {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
  tool?: { messageID: string; callID: string };
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

// API error shape from session.error events and message info
export interface ApiError {
  name: string;
  data?: Record<string, unknown>;
}

// Session busy/idle status from session.status events
export type SessionStatus = { type: "busy" } | { type: "idle" };

// SSE event envelope
export interface SSEEvent {
  type: string;
  properties: Record<string, unknown>;
}

// Provider/model types from GET /provider
export interface ProviderModel {
  id: string;
  name: string;
  reasoning: boolean;
  cost?: { input: number; output: number; cache_read?: number; cache_write?: number };
  limit: { context: number; output: number };
  status?: "alpha" | "beta" | "deprecated";
  [key: string]: unknown;
}
export interface Provider {
  id: string;
  name: string;
  models: Record<string, ProviderModel>;
}
export interface ProviderList {
  all: Provider[];
  connected: string[];
  default: Record<string, string>;
}
export interface ModelKey {
  providerID: string;
  modelID: string;
}

// Agent types from GET /agent
export interface AgentInfo {
  name: string;
  description?: string;
  mode: "subagent" | "primary" | "all";
  hidden?: boolean;
  color?: string;
  variant?: string;
  model?: {
    providerID: string;
    modelID: string;
  };
  [key: string]: unknown;
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
