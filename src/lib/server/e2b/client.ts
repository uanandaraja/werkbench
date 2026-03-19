import { Sandbox } from "e2b";
import type {
  ListedSandbox,
  SandboxDetail,
  Workspace,
} from "$lib/devbox/types";
import type { PlatformEnv, WorkspaceLaunchEnv } from "$lib/server/env";

const defaultDomain = "e2b.app";
const defaultTerminalPort = 7681;

function getDomain(env: PlatformEnv) {
  return env.E2B_DOMAIN || defaultDomain;
}

function getApiBaseUrl(env: PlatformEnv) {
  return `https://api.${getDomain(env)}`;
}

function getTimeoutSeconds(timeoutMs: number) {
  return Math.max(15, Math.ceil(timeoutMs / 1000));
}

function getDefaultTimeoutMs(env: PlatformEnv) {
  return Number(env.E2B_SANDBOX_TIMEOUT_MS ?? 3600000);
}

function getTerminalPort(env: PlatformEnv) {
  return Number(env.E2B_TERMINAL_PORT ?? defaultTerminalPort);
}

async function e2bFetch<T>(env: PlatformEnv, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl(env)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": env.E2B_API_KEY,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`E2B ${response.status}: ${message || response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function listSandboxes(env: PlatformEnv) {
  const sandboxes = await e2bFetch<ListedSandbox[]>(env, "/sandboxes", {
    method: "GET",
  });

  return sandboxes.sort(
    (left, right) =>
      new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  );
}

export async function getSandboxDetail(env: PlatformEnv, sandboxId: string) {
  return e2bFetch<SandboxDetail>(env, `/sandboxes/${sandboxId}`, {
    method: "GET",
  });
}

function getWorkspaceDir(workspace: Pick<Workspace, "repo">) {
  return `/home/user/workspace/${workspace.repo}`;
}

function shellEscape(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

async function provisionWorkspaceSandbox(
  env: WorkspaceLaunchEnv,
  sandboxId: string,
  workspace: Workspace,
) {
  const cwd = getWorkspaceDir(workspace);
  const repoUrl = `https://github.com/${workspace.owner}/${workspace.repo}.git`;
  const terminalConfig = JSON.stringify({
    cwd,
    command: "bash -l",
  });
  const sandbox = await Sandbox.connect(sandboxId, {
    apiKey: env.E2B_API_KEY,
    domain: env.E2B_DOMAIN,
    timeoutMs: getDefaultTimeoutMs(env),
  });
  const bootstrapSteps = [
    "mkdir -p /home/user/.cache/devbox /home/user/workspace",
    `printf '%s' ${shellEscape(terminalConfig)} > /home/user/.cache/devbox/terminal-session.json`,
    "mkdir -p /home/user/.config/gh",
    `if [ ! -f /home/user/.config/gh/hosts.yml ]; then printf '%s' \"$GITHUB_TOKEN\" | env -u GH_TOKEN -u GITHUB_TOKEN gh auth login --with-token --hostname github.com --git-protocol https --insecure-storage; fi`,
    "git config --global --unset-all credential.helper >/dev/null 2>&1 || true",
    "git config --global --unset-all credential.https://github.com.helper >/dev/null 2>&1 || true",
    "env -u GH_TOKEN -u GITHUB_TOKEN gh auth setup-git >/dev/null 2>&1 || true",
    `if [ ! -d ${shellEscape(`${cwd}/.git`)} ]; then git clone ${shellEscape(repoUrl)} ${shellEscape(cwd)}; fi`,
    `git -C ${shellEscape(cwd)} remote set-url origin ${shellEscape(repoUrl)}`,
  ];

  if (workspace.defaultBranch) {
    bootstrapSteps.push(
      `git -C ${shellEscape(cwd)} checkout ${shellEscape(workspace.defaultBranch)} || true`,
    );
  }

  await sandbox.commands.run(bootstrapSteps.join(" && "), {
    user: "user",
    envs: {
      GH_TOKEN: env.GITHUB_TOKEN,
      GITHUB_TOKEN: env.GITHUB_TOKEN,
    },
    timeoutMs: 120000,
  });
}

export async function createSandbox(env: WorkspaceLaunchEnv, workspace: Workspace) {
  const timeoutMs = getDefaultTimeoutMs(env);

  if (!env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is not configured");
  }

  const sandbox = await e2bFetch<{
    alias?: string;
    domain?: string | null;
    sandboxID: string;
    templateID: string;
  }>(env, "/sandboxes", {
    method: "POST",
    body: JSON.stringify({
      templateID: env.E2B_TEMPLATE,
      timeout: getTimeoutSeconds(timeoutMs),
      autoPause: true,
      metadata: {
        kind: "devbox",
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        repoOwner: workspace.owner,
        repoName: workspace.repo,
        repoFullName: `${workspace.owner}/${workspace.repo}`,
      },
      envVars: {
        E2B_TERMINAL_PORT: String(getTerminalPort(env)),
      },
    }),
  });

  try {
    await provisionWorkspaceSandbox(env, sandbox.sandboxID, workspace);
  } catch (error) {
    await killSandbox(env, sandbox.sandboxID).catch(() => undefined);
    throw error;
  }

  return sandbox;
}

export async function resumeSandbox(
  env: PlatformEnv,
  sandboxId: string,
  timeoutMs?: number,
) {
  return e2bFetch<{
    alias?: string;
    domain?: string | null;
    sandboxID: string;
    templateID: string;
  }>(env, `/sandboxes/${sandboxId}/connect`, {
    method: "POST",
    body: JSON.stringify({
      timeout: getTimeoutSeconds(timeoutMs ?? getDefaultTimeoutMs(env)),
    }),
  });
}

export async function pauseSandbox(env: PlatformEnv, sandboxId: string) {
  await e2bFetch<void>(env, `/sandboxes/${sandboxId}/pause`, {
    method: "POST",
  });
}

export async function killSandbox(env: PlatformEnv, sandboxId: string) {
  await e2bFetch<void>(env, `/sandboxes/${sandboxId}`, {
    method: "DELETE",
  });
}

export function getSandboxTerminalUrl(
  env: PlatformEnv,
  sandbox: Pick<SandboxDetail, "domain" | "sandboxID">,
) {
  const domain = sandbox.domain || getDomain(env);
  const port = getTerminalPort(env);
  return `wss://${port}-${sandbox.sandboxID}.${domain}`;
}
