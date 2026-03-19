import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const workspacesTable = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    owner: text("owner").notNull(),
    repo: text("repo").notNull(),
    defaultBranch: text("default_branch"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("workspaces_owner_repo_unique").on(table.owner, table.repo),
  ],
);
