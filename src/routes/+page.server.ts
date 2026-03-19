import type { PageServerLoad } from "./$types";
import { listSandboxes } from "$lib/server/e2b/client";
import { listWorkspaces } from "$lib/server/workspaces/service";

export const load: PageServerLoad = async ({ platform }) => {
  if (!platform) {
    throw new Error("Cloudflare platform bindings are unavailable");
  }

  return {
    dashboard: {
      workspaces: await listWorkspaces(platform.env),
      sandboxes: await listSandboxes(platform.env),
    },
  };
};
