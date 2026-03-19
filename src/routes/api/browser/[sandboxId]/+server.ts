import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  ensureBrowserSession,
  getSandboxBrowserUrl,
  getSandboxDetail,
} from "$lib/server/e2b/client";

export const GET: RequestHandler = async ({ params, platform, url }) => {
  if (!platform) {
    throw error(500, "Cloudflare platform unavailable");
  }

  const sandbox = await getSandboxDetail(platform.env, params.sandboxId);

  if (sandbox.state !== "running") {
    throw error(409, "Sandbox is not running");
  }

  const targetUrl = url.searchParams.get("target")?.trim() || undefined;
  await ensureBrowserSession(platform.env, params.sandboxId, targetUrl);

  redirect(307, getSandboxBrowserUrl(platform.env, sandbox));
};
