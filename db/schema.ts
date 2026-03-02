import { sql } from "drizzle-orm";
import { text, sqliteTable } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  directory: text("directory").notNull().unique(),
  remoteUrl: text("remote_url"),
  providerType: text("provider_type"),
  owner: text("owner"),
  repo: text("repo"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  removedAt: text("removed_at"),
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  tmuxSession: text("tmux_session").notNull().unique(),
  status: text("status").notNull().default("starting"),
  initialPrompt: text("initial_prompt"),
  linkedIssueId: text("linked_issue_id"),
  linkedPrId: text("linked_pr_id"),
  logPath: text("log_path"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  endedAt: text("ended_at"),
});
