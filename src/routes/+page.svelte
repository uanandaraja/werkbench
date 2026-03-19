<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { formatDateTime, formatRelativeExpiry } from "$lib/devbox/format";
  import type { Workspace } from "$lib/devbox/types";
  import type { PageData } from "./$types";
  import {
    createWorkspaceCommand,
    deleteWorkspaceCommand,
    killSandboxCommand,
    launchWorkspace,
    pauseSandboxCommand,
    resumeSandboxCommand,
    updateWorkspaceCommand,
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
  import {
    Boxes,
    Clock3,
    FolderGit2,
    Pencil,
    Play,
    Plus,
    RefreshCcw,
    Rocket,
    SquareTerminal,
    Trash2,
    X,
  } from "lucide-svelte";

  let { data }: { data: PageData } = $props();

  const fieldClass =
    "flex h-10 w-full rounded-lg border border-border/70 bg-background/55 px-3 text-sm outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20";
  const textareaClass =
    "flex min-h-24 w-full rounded-lg border border-border/70 bg-background/55 px-3 py-2 text-sm outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20";

  function emptyWorkspaceForm() {
    return {
      name: "",
      owner: "",
      repo: "",
      defaultBranch: "",
      notes: "",
    };
  }

  let createForm = $state(emptyWorkspaceForm());
  let editForm = $state(emptyWorkspaceForm());
  let editingWorkspaceId = $state<string | null>(null);
  let pendingLaunch = $state<string | null>(null);
  let pendingWorkspaceAction = $state<string | null>(null);
  let pendingSandboxAction = $state<string | null>(null);
  let errorMessage = $state("");

  function sandboxesForWorkspace(workspaceId: string) {
    return data.dashboard.sandboxes.filter(
      (sandbox) => sandbox.metadata?.workspaceId === workspaceId,
    );
  }

  function orphanedSandboxes() {
    const workspaceIds = new Set(data.dashboard.workspaces.map((workspace) => workspace.id));
    return data.dashboard.sandboxes.filter((sandbox) => {
      const workspaceId = sandbox.metadata?.workspaceId;
      return workspaceId ? !workspaceIds.has(workspaceId) : true;
    });
  }

  function beginEdit(workspace: Workspace) {
    editingWorkspaceId = workspace.id;
    editForm = {
      name: workspace.name,
      owner: workspace.owner,
      repo: workspace.repo,
      defaultBranch: workspace.defaultBranch ?? "",
      notes: workspace.notes ?? "",
    };
  }

  function cancelEdit() {
    editingWorkspaceId = null;
    editForm = emptyWorkspaceForm();
  }

  async function refreshDashboard() {
    errorMessage = "";

    try {
      await invalidateAll();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to refresh";
    }
  }

  async function handleCreateWorkspace(event: SubmitEvent) {
    event.preventDefault();
    pendingWorkspaceAction = "create";
    errorMessage = "";

    try {
      await createWorkspaceCommand({
        name: createForm.name,
        owner: createForm.owner,
        repo: createForm.repo,
        defaultBranch: createForm.defaultBranch || null,
        notes: createForm.notes || null,
      });
      createForm = emptyWorkspaceForm();
      await invalidateAll();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to create workspace";
    } finally {
      pendingWorkspaceAction = null;
    }
  }

  async function handleUpdateWorkspace(event: SubmitEvent, workspaceId: string) {
    event.preventDefault();
    pendingWorkspaceAction = workspaceId;
    errorMessage = "";

    try {
      await updateWorkspaceCommand({
        workspaceId,
        name: editForm.name,
        owner: editForm.owner,
        repo: editForm.repo,
        defaultBranch: editForm.defaultBranch || null,
        notes: editForm.notes || null,
      });
      cancelEdit();
      await invalidateAll();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to update workspace";
    } finally {
      pendingWorkspaceAction = null;
    }
  }

  async function handleDeleteWorkspace(workspaceId: string) {
    pendingWorkspaceAction = workspaceId;
    errorMessage = "";

    try {
      await deleteWorkspaceCommand({ workspaceId });
      if (editingWorkspaceId === workspaceId) {
        cancelEdit();
      }
      await invalidateAll();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Failed to delete workspace";
    } finally {
      pendingWorkspaceAction = null;
    }
  }

  async function handleLaunch(workspaceId: string) {
    pendingLaunch = workspaceId;
    errorMessage = "";

    try {
      const sandbox = await launchWorkspace({ workspaceId });
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
  <meta name="description" content="Personal E2B workspace dashboard" />
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
            Workspace control plane
          </CardTitle>
          <CardDescription class="max-w-2xl text-sm leading-6 md:text-base">
            Each workspace maps to one GitHub repo. Launch sandboxes, land directly in the
            repo, and keep push and PR access ready inside the box.
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

  <Card class="surface-shadow border-border/70 bg-card/82 backdrop-blur-xl">
    <CardHeader>
      <CardTitle class="text-2xl">New workspace</CardTitle>
      <CardDescription>
        Minimal POC record: display name, GitHub repo, optional default branch, optional
        notes.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <form class="grid gap-4 md:grid-cols-2" onsubmit={handleCreateWorkspace}>
        <label class="grid gap-2 text-sm">
          <span class="text-muted-foreground">Display name</span>
          <input class={fieldClass} bind:value={createForm.name} placeholder="Myfounder" />
        </label>
        <label class="grid gap-2 text-sm">
          <span class="text-muted-foreground">Default branch</span>
          <input class={fieldClass} bind:value={createForm.defaultBranch} placeholder="main" />
        </label>
        <label class="grid gap-2 text-sm">
          <span class="text-muted-foreground">GitHub owner</span>
          <input class={fieldClass} bind:value={createForm.owner} placeholder="uanandaraja" />
        </label>
        <label class="grid gap-2 text-sm">
          <span class="text-muted-foreground">GitHub repo</span>
          <input class={fieldClass} bind:value={createForm.repo} placeholder="devbox" />
        </label>
        <label class="grid gap-2 text-sm md:col-span-2">
          <span class="text-muted-foreground">Notes</span>
          <textarea class={textareaClass} bind:value={createForm.notes} placeholder="Optional notes for this workspace."></textarea>
        </label>
        <div class="md:col-span-2">
          <Button type="submit" disabled={pendingWorkspaceAction === "create"}>
            <Plus class="size-4" />
            {pendingWorkspaceAction === "create" ? "Creating..." : "Create workspace"}
          </Button>
        </div>
      </form>
    </CardContent>
  </Card>

  {#if data.dashboard.workspaces.length === 0}
    <Card class="surface-shadow border-dashed border-border/80 bg-card/78 backdrop-blur-xl">
      <CardContent class="py-12 text-center text-muted-foreground">
        No workspaces yet. Create one above and launch your first repo-backed sandbox.
      </CardContent>
    </Card>
  {:else}
    <div class="grid gap-4 xl:grid-cols-2">
      {#each data.dashboard.workspaces as workspace (workspace.id)}
        <Card class="surface-shadow h-full border-border/70 bg-card/82 backdrop-blur-xl">
          <CardHeader class="gap-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="space-y-1">
                <CardTitle class="text-xl">{workspace.name}</CardTitle>
                <CardDescription class="flex items-center gap-2 break-all leading-6">
                  <FolderGit2 class="size-4" />
                  {workspace.owner}/{workspace.repo}
                </CardDescription>
              </div>
              <Badge variant="outline" class="rounded-full">
                <Clock3 class="size-3.5" />
                60m ttl
              </Badge>
            </div>

            <div class="grid gap-3 text-sm sm:grid-cols-3">
              <div class="rounded-lg border border-border/70 bg-background/55 p-3">
                <p class="text-muted-foreground text-xs uppercase tracking-[0.14em]">Branch</p>
                <p class="mt-1 break-all font-medium">{workspace.defaultBranch ?? "repo default"}</p>
              </div>
              <div class="rounded-lg border border-border/70 bg-background/55 p-3">
                <p class="text-muted-foreground text-xs uppercase tracking-[0.14em]">Created</p>
                <p class="mt-1 break-all font-medium">{formatDateTime(workspace.createdAt)}</p>
              </div>
              <div class="rounded-lg border border-border/70 bg-background/55 p-3">
                <p class="text-muted-foreground text-xs uppercase tracking-[0.14em]">Sandboxes</p>
                <p class="mt-1 break-all font-medium">{sandboxesForWorkspace(workspace.id).length}</p>
              </div>
            </div>

            {#if workspace.notes}
              <div class="rounded-lg border border-border/70 bg-background/45 p-3 text-sm leading-6 text-muted-foreground">
                {workspace.notes}
              </div>
            {/if}
          </CardHeader>

          <CardContent class="space-y-4">
            <div class="flex flex-wrap gap-2">
              <Button
                class="justify-center"
                onclick={() => handleLaunch(workspace.id)}
                disabled={pendingLaunch === workspace.id}
              >
                <Rocket class="size-4" />
                {pendingLaunch === workspace.id ? "Launching..." : "Launch sandbox"}
              </Button>
              {#if editingWorkspaceId === workspace.id}
                <Button variant="outline" onclick={cancelEdit}>
                  <X class="size-4" />
                  Cancel
                </Button>
              {:else}
                <Button variant="outline" onclick={() => beginEdit(workspace)}>
                  <Pencil class="size-4" />
                  Edit
                </Button>
              {/if}
              <Button
                variant="destructive"
                onclick={() => handleDeleteWorkspace(workspace.id)}
                disabled={pendingWorkspaceAction === workspace.id}
              >
                <Trash2 class="size-4" />
                Delete
              </Button>
            </div>

            {#if editingWorkspaceId === workspace.id}
              <form class="grid gap-4 rounded-xl border border-border/80 bg-background/45 p-4 md:grid-cols-2" onsubmit={(event) => handleUpdateWorkspace(event, workspace.id)}>
                <label class="grid gap-2 text-sm">
                  <span class="text-muted-foreground">Display name</span>
                  <input class={fieldClass} bind:value={editForm.name} />
                </label>
                <label class="grid gap-2 text-sm">
                  <span class="text-muted-foreground">Default branch</span>
                  <input class={fieldClass} bind:value={editForm.defaultBranch} />
                </label>
                <label class="grid gap-2 text-sm">
                  <span class="text-muted-foreground">GitHub owner</span>
                  <input class={fieldClass} bind:value={editForm.owner} />
                </label>
                <label class="grid gap-2 text-sm">
                  <span class="text-muted-foreground">GitHub repo</span>
                  <input class={fieldClass} bind:value={editForm.repo} />
                </label>
                <label class="grid gap-2 text-sm md:col-span-2">
                  <span class="text-muted-foreground">Notes</span>
                  <textarea class={textareaClass} bind:value={editForm.notes}></textarea>
                </label>
                <div class="md:col-span-2">
                  <Button type="submit" disabled={pendingWorkspaceAction === workspace.id}>
                    <Pencil class="size-4" />
                    {pendingWorkspaceAction === workspace.id ? "Saving..." : "Save workspace"}
                  </Button>
                </div>
              </form>
            {/if}

            <Separator />

            {#if sandboxesForWorkspace(workspace.id).length === 0}
              <div class="rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-6 text-sm text-muted-foreground">
                No sandbox yet.
              </div>
            {:else}
              <div class="space-y-3">
                {#each sandboxesForWorkspace(workspace.id) as sandbox (sandbox.sandboxID)}
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
            <span>{workspace.owner}/{workspace.repo}</span>
            <span>{sandboxesForWorkspace(workspace.id).length} active record(s)</span>
          </CardFooter>
        </Card>
      {/each}
    </div>
  {/if}

  {#if orphanedSandboxes().length > 0}
    <Card class="surface-shadow border-border/70 bg-card/82 backdrop-blur-xl">
      <CardHeader>
        <CardTitle class="text-xl">Orphaned sandboxes</CardTitle>
        <CardDescription>
          These sandboxes still exist in E2B but no longer map to a saved workspace.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        {#each orphanedSandboxes() as sandbox (sandbox.sandboxID)}
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/50 p-4">
            <div class="space-y-1">
              <a
                class="text-sm font-medium text-foreground underline-offset-4 hover:text-accent hover:underline"
                href={`/sandboxes/${sandbox.sandboxID}`}
              >
                {sandbox.sandboxID}
              </a>
              <p class="text-muted-foreground text-sm">
                {sandbox.metadata?.repoFullName ?? "unmapped"} · {formatRelativeExpiry(sandbox.endAt)}
              </p>
            </div>
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
        {/each}
      </CardContent>
    </Card>
  {/if}
</div>
