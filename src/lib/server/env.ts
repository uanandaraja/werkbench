import { getRequestEvent } from "$app/server";

export type PlatformEnv = App.Platform["env"] & {
  DB: D1Database;
};

export type WorkspaceLaunchEnv = PlatformEnv & {
  GITHUB_TOKEN: string;
};

export function getPlatformEnv(): PlatformEnv {
  const event = getRequestEvent();

  if (!event.platform) {
    throw new Error("Cloudflare platform bindings are unavailable");
  }

  return event.platform.env as PlatformEnv;
}
