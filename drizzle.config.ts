import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/server/workspaces/schema.ts",
  out: "./drizzle",
});
