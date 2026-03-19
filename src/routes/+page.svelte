<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { formatDateTime, formatRelativeExpiry } from "$lib/devbox/format";
  import type { PageData } from "./$types";
  import {
    killSandboxCommand,
    launchProfile,
    pauseSandboxCommand,
    resumeSandboxCommand,
  } from "$lib/remote/devbox.remote";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { Boxes, Clock3, Play, RefreshCcw, Rocket, SquareTerminal, Trash2 } from "lucide-svelte";

  let { data }: { data: PageData } = $props();

  let pendingLaunch = $state<string | null>(null);
  let pendingSandboxAction = $state<string | null>(null);
  let errorMessage = $state("");

  function sandboxesForProfile(profileId: string) {
    return data.dashboard.sandboxes.filter(
      (sandbox) => sandbox.metadata?.profileId === profileId,
    );
  }

  async function refreshDashboard() {
    errorMessage = "";

    try {
      await invalidateAll();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to refresh";
    }
  }

  async function handleLaunch(profileId: string) {
    pendingLaunch = profileId;
    errorMessage = "";

    try {
      const sandbox = await launchProfile({ profileId });
      await invalidateAll();
      await goto(`/sandboxes/${sandbox.sandboxID}`);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to launch sandbox";
    } finally {
      pendingLaunch = null;
    }
  }

  async function handleResume(sandboxId: string) {
    pendingSandboxAction = sandboxId;
    errorMessage = "";

    try {
      await resumeSandboxCommand({ sandboxId });
      await invalidateAll();
      await goto(`/sandboxes/${sandboxId}`);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to resume sandbox";
    } finally {
      pendingSandboxAction = null;
    }
  }

  async function handlePause(sandboxId: string) {
    pendingSandboxAction = sandboxId;
    errorMessage = "";

    try {
      await pauseSandboxCommand({ sandboxId });
      await invalidateAll();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to pause sandbox";
    } finally {
      pendingSandboxAction = null;
    }
  }

  async function handleKill(sandboxId: string) {
    pendingSandboxAction = sandboxId;
    errorMessage = "";

    try {
      await killSandboxCommand({ sandboxId });
      await invalidateAll();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to kill sandbox";
    } finally {
      pendingSandboxAction = null;
    }
  }
</script>

<svelte:head>
  <title>Devbox</title>
  <meta name="description" content="Personal E2B devbox dashboard" />
</svelte:head>

<div class="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
  <Card class="surface-shadow overflow-hidden border-border/70 bg-card/85 backdrop-blur-xl">
    <CardHeader class="gap-6 md:grid-cols-[1fr_auto]">
      <div class="space-y-4">
        <Badge variant="outline" class="border-accent/30 bg-accent/10 text-accent">
          personal poc
        </Badge>
        <div class="space-y-3">
          <CardTitle class="max-w-4xl text-4xl leading-none font-semibold tracking-tight md:text-6xl">
            Devbox control plane
          </CardTitle>
          <CardDescription class="max-w-2xl text-sm leading-6 md:text-base">
            Static E2B profiles, browser terminal sessions, and just enough control to
            launch, pause, resume, and kill sandboxes without leaving the page.
          </CardDescription>
        </div>
      </div>

      <CardContent class="flex flex-wrap items-center justify-start gap-3 px-0 md:justify-end">
        <Button onclick={refreshDashboard}>
          <RefreshCcw class="size-4" />
          Refresh
        </Button>
        <Badge variant="secondary" class="gap-1 rounded-full px-3 py-1">
          <Boxes class="size-3.5" />
          {data.dashboard.sandboxes.length}
          sandbox{data.dashboard.sandboxes.length === 1 ? "" : "es"}
        </Badge>
      </CardContent>
    </CardHeader>
  </Card>

  {#if errorMessage}
    <Alert variant="destructive" class="surface-shadow border-destructive/30 bg-destructive/8">
      <AlertTitle>Action failed</AlertTitle>
      <AlertDescription>{errorMessage}</AlertDescription>
    </Alert>
  {/if}

  <div class="grid gap-4 xl:grid-cols-3">
    {#each data.dashboard.profiles as profile (profile.id)}
      <Card class="surface-shadow h-full border-border/70 bg-card/82 backdrop-blur-xl">
        <CardHeader class="gap-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="space-y-1">
              <CardTitle class="text-xl">{profile.label}</CardTitle>
              <CardDescription class="leading-6">{profile.description}</CardDescription>
            </div>
            <Badge variant="outline" class="rounded-full">
              <Clock3 class="size-3.5" />
              {Math.round(profile.timeoutMs / 60000)}m ttl
            </Badge>
          </div>

          <div class="grid gap-3 text-sm sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <div class="rounded-lg border border-border/70 bg-background/55 p-3">
              <p class="text-muted-foreground text-xs uppercase tracking-[0.14em]">Template</p>
              <p class="mt-1 break-all font-medium">{profile.template}</p>
            </div>
            <div class="rounded-lg border border-border/70 bg-background/55 p-3">
              <p class="text-muted-foreground text-xs uppercase tracking-[0.14em]">Workdir</p>
              <p class="mt-1 break-all font-medium">{profile.cwd}</p>
            </div>
            <div class="rounded-lg border border-border/70 bg-background/55 p-3">
              <p class="text-muted-foreground text-xs uppercase tracking-[0.14em]">Shell</p>
              <p class="mt-1 break-all font-medium">{profile.terminalCommand}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent class="space-y-4">
          <Button
            class="w-full justify-center"
            onclick={() => handleLaunch(profile.id)}
            disabled={pendingLaunch === profile.id}
          >
            <Rocket class="size-4" />
            {pendingLaunch === profile.id ? "Launching..." : "Launch sandbox"}
          </Button>

          <Separator />

          {#if sandboxesForProfile(profile.id).length === 0}
            <div class="rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-6 text-sm text-muted-foreground">
              No sandbox yet.
            </div>
          {:else}
            <div class="space-y-3">
              {#each sandboxesForProfile(profile.id) as sandbox (sandbox.sandboxID)}
                <div class="space-y-3 rounded-xl border border-border/80 bg-background/50 p-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="space-y-1">
                      <a
                        class="text-sm font-medium text-foreground underline-offset-4 hover:text-accent hover:underline"
                        href={`/sandboxes/${sandbox.sandboxID}`}
                      >
                        {sandbox.sandboxID}
                      </a>
                      <p class="text-muted-foreground text-sm">
                        started {formatDateTime(sandbox.startedAt)} ·
                        {formatRelativeExpiry(sandbox.endAt)}
                      </p>
                    </div>

                    <Badge
                      variant={sandbox.state === "running" ? "default" : "secondary"}
                      class={sandbox.state === "running"
                        ? "rounded-full bg-primary/18 text-primary"
                        : "rounded-full bg-secondary text-secondary-foreground"}
                    >
                      {sandbox.state}
                    </Badge>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    {#if sandbox.state === "paused"}
                      <Button
                        size="sm"
                        onclick={() => handleResume(sandbox.sandboxID)}
                        disabled={pendingSandboxAction === sandbox.sandboxID}
                      >
                        <Play class="size-3.5" />
                        Resume
                      </Button>
                    {:else}
                      <Button size="sm" variant="secondary" href={`/sandboxes/${sandbox.sandboxID}`}>
                        <SquareTerminal class="size-3.5" />
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onclick={() => handlePause(sandbox.sandboxID)}
                        disabled={pendingSandboxAction === sandbox.sandboxID}
                      >
                        Pause
                      </Button>
                    {/if}

                    <Button
                      size="sm"
                      variant="destructive"
                      onclick={() => handleKill(sandbox.sandboxID)}
                      disabled={pendingSandboxAction === sandbox.sandboxID}
                    >
                      <Trash2 class="size-3.5" />
                      Kill
                    </Button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </CardContent>

        <CardFooter class="justify-between text-xs text-muted-foreground">
          <span>Profile: {profile.id}</span>
          <span>{sandboxesForProfile(profile.id).length} active record(s)</span>
        </CardFooter>
      </Card>
    {/each}
  </div>
</div>
