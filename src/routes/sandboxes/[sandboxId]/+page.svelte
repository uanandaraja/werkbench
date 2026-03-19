<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { onMount, tick } from "svelte";
  import { FitAddon } from "@xterm/addon-fit";
  import { Terminal } from "@xterm/xterm";
  import "@xterm/xterm/css/xterm.css";
  import { formatDateTime, formatRelativeExpiry } from "$lib/devbox/format";
  import type { PageData } from "./$types";
  import {
    killSandboxCommand,
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
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import {
    ArrowLeft,
    Cpu,
    HardDrive,
    Pause,
    Play,
    ArrowsCounterClockwise,
    ArrowCounterClockwise,
    TerminalWindow,
    Trash,
  } from "phosphor-svelte";

  let { data }: { data: PageData } = $props();

  const sandboxId = $derived(data.sandbox.sandboxID);
  const sandbox = $derived(data.sandbox);

  let terminalElement = $state<HTMLDivElement | null>(null);
  let terminalState = $state<"idle" | "connecting" | "open" | "closed" | "error">("idle");
  let terminalError = $state("");
  let actionPending = $state(false);
  let pageError = $state("");

  let terminal: Terminal | null = null;
  let fitAddon: FitAddon | null = null;
  let socket: WebSocket | null = null;
  let sessionId = "";
  let resizeObserver: ResizeObserver | null = null;

  function cssVariable(name: string, fallback: string) {
    if (typeof document === "undefined") {
      return fallback;
    }

    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  async function refreshSandbox() {
    pageError = "";

    try {
      await invalidateAll();
    } catch (error) {
      pageError = error instanceof Error ? error.message : "Failed to refresh sandbox";
    }
  }

  function cleanupSocket() {
    resizeObserver?.disconnect();
    resizeObserver = null;

    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
      socket = null;
    }
  }

  function sendResize() {
    if (!socket || socket.readyState !== WebSocket.OPEN || !terminal) {
      return;
    }

    socket.send(
      JSON.stringify({
        type: "resize",
        cols: terminal.cols,
        rows: terminal.rows,
      }),
    );
  }

  async function openTerminal() {
    if (!terminal || sandbox.state !== "running") {
      return;
    }

    cleanupSocket();
    terminal.reset();
    terminal.clear();
    terminalState = "connecting";
    terminalError = "";
    sessionId = crypto.randomUUID();

    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const url = new URL(`${protocol}://${location.host}/api/terminal/${sandbox.sandboxID}`);
    url.searchParams.set("session", sessionId);

    socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
      const currentTerminal = terminal;
      if (!currentTerminal) {
        return;
      }

      terminalState = "open";
      currentTerminal.focus();
      sendResize();
      resizeObserver = new ResizeObserver(() => {
        fitAddon?.fit();
        sendResize();
      });
      if (terminalElement) {
        resizeObserver.observe(terminalElement);
      }
    };

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        terminal?.write(event.data);
        return;
      }

      terminal?.write(new Uint8Array(event.data));
    };

    socket.onerror = () => {
      terminalState = "error";
      terminalError = "Terminal socket failed";
    };

    socket.onclose = () => {
      if (terminalState !== "error") {
        terminalState = "closed";
      }
    };
  }

  async function handleResume() {
    actionPending = true;
    pageError = "";

    try {
      await resumeSandboxCommand({ sandboxId });
      await invalidateAll();
      await tick();
      await openTerminal();
    } catch (error) {
      pageError = error instanceof Error ? error.message : "Failed to resume sandbox";
    } finally {
      actionPending = false;
    }
  }

  async function handlePause() {
    actionPending = true;
    pageError = "";

    try {
      cleanupSocket();
      await pauseSandboxCommand({ sandboxId });
      await refreshSandbox();
      terminalState = "idle";
    } catch (error) {
      pageError = error instanceof Error ? error.message : "Failed to pause sandbox";
    } finally {
      actionPending = false;
    }
  }

  async function handleKill() {
    actionPending = true;
    pageError = "";

    try {
      cleanupSocket();
      await killSandboxCommand({ sandboxId });
      await goto("/");
    } catch (error) {
      pageError = error instanceof Error ? error.message : "Failed to kill sandbox";
    } finally {
      actionPending = false;
    }
  }

  onMount(() => {
    if (!terminalElement) {
      return;
    }

    terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: cssVariable("--font-mono", "ui-monospace, monospace"),
      fontSize: 14,
      theme: {
        background: cssVariable("--terminal-background", "#0b0f14"),
        foreground: cssVariable("--terminal-foreground", "#edf4ff"),
        cursor: cssVariable("--terminal-cursor", "#6ee7b7"),
        selectionBackground: cssVariable("--terminal-selection", "rgba(103, 200, 255, 0.22)"),
      },
    });
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalElement);
    fitAddon.fit();

    terminal.onData((input) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "input", data: input }));
      }
    });

    if (sandbox.state === "running") {
      void openTerminal();
    }

    return () => {
      cleanupSocket();
      terminal?.dispose();
      terminal = null;
      fitAddon = null;
    };
  });

  $effect(() => {
    if (sandbox.state === "running" && terminalState === "idle" && terminal) {
      void openTerminal();
    }
  });
</script>

<svelte:head>
  <title>{sandboxId} · Devbox</title>
</svelte:head>

<div class="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <Button variant="ghost" href="/" class="w-fit">
      <ArrowLeft class="size-4" />
      Back
    </Button>

    <div class="flex flex-wrap gap-2">
      <Button variant="outline" onclick={refreshSandbox} disabled={actionPending}>
        <ArrowsCounterClockwise class="size-4" />
        Refresh status
      </Button>
      {#if sandbox.state === "paused"}
        <Button onclick={handleResume} disabled={actionPending}>
          <Play class="size-4" />
          Resume
        </Button>
      {:else}
        <Button variant="outline" onclick={handlePause} disabled={actionPending}>
          <Pause class="size-4" />
          Pause
        </Button>
      {/if}
      <Button variant="destructive" onclick={handleKill} disabled={actionPending}>
        <Trash class="size-4" />
        Kill
      </Button>
    </div>
  </div>

  {#if pageError}
    <Alert variant="destructive" class="surface-shadow border-destructive/30 bg-destructive/8">
      <AlertTitle>Sandbox action failed</AlertTitle>
      <AlertDescription>{pageError}</AlertDescription>
    </Alert>
  {/if}

  <Card class="surface-shadow border-border/70 bg-card/85 backdrop-blur-xl">
    <CardHeader class="gap-5 md:grid-cols-[1fr_auto]">
      <div class="space-y-3">
        <div class="flex flex-wrap items-center gap-3">
          <CardTitle class="text-3xl tracking-tight md:text-4xl">{sandbox.sandboxID}</CardTitle>
          <Badge
            variant={sandbox.state === "running" ? "default" : "secondary"}
            class={sandbox.state === "running"
              ? "rounded-full bg-primary/18 text-primary"
              : "rounded-full bg-secondary text-secondary-foreground"}
          >
            {sandbox.state}
          </Badge>
        </div>

        <CardDescription class="text-sm leading-6 md:text-base">
          {sandbox.metadata?.profileLabel ?? sandbox.metadata?.profileId ?? "unprofiled"} ·
          started {formatDateTime(sandbox.startedAt)} · {formatRelativeExpiry(sandbox.endAt)}
        </CardDescription>
      </div>

      <CardContent class="grid w-full gap-3 px-0 sm:grid-cols-3 md:w-auto md:min-w-[25rem]">
        <div class="rounded-xl border border-border/80 bg-background/55 p-3">
          <p class="text-muted-foreground text-xs uppercase tracking-[0.14em]">Template</p>
          <p class="mt-1 break-all text-sm font-medium">{sandbox.templateID}</p>
        </div>
        <div class="rounded-xl border border-border/80 bg-background/55 p-3">
          <p class="text-muted-foreground flex items-center gap-1 text-xs uppercase tracking-[0.14em]">
            <HardDrive class="size-3.5" />
            Memory
          </p>
          <p class="mt-1 text-sm font-medium">{sandbox.memoryMB} MiB</p>
        </div>
        <div class="rounded-xl border border-border/80 bg-background/55 p-3">
          <p class="text-muted-foreground flex items-center gap-1 text-xs uppercase tracking-[0.14em]">
            <Cpu class="size-3.5" />
            CPU
          </p>
          <p class="mt-1 text-sm font-medium">{sandbox.cpuCount}</p>
        </div>
      </CardContent>
    </CardHeader>
  </Card>

  <Card class="surface-shadow overflow-hidden border-border/70 bg-card/84 backdrop-blur-xl">
    <CardHeader class="gap-4">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="space-y-2">
          <CardTitle class="flex items-center gap-2 text-xl">
            <TerminalWindow class="size-5 text-accent" />
            Terminal
          </CardTitle>
          <CardDescription class="max-w-2xl leading-6">
            New PTY on each reconnect. Use <code class="rounded bg-muted px-1.5 py-0.5 text-xs">tmux</code>
            inside the sandbox if you want persistence.
          </CardDescription>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Badge variant="outline" class="rounded-full capitalize">
            {terminalState}
          </Badge>
          <Button onclick={openTerminal} disabled={sandbox.state !== "running"}>
            <ArrowCounterClockwise class="size-4" />
            Reconnect
          </Button>
        </div>
      </div>
    </CardHeader>

    <CardContent class="space-y-4">
      {#if terminalError}
        <Alert variant="destructive" class="border-destructive/30 bg-destructive/8">
          <AlertTitle>Terminal error</AlertTitle>
          <AlertDescription>{terminalError}</AlertDescription>
        </Alert>
      {/if}

      {#if sandbox.state === "paused"}
        <Alert class="border-border/80 bg-background/50">
          <AlertTitle>Sandbox paused</AlertTitle>
          <AlertDescription>
            Resume this sandbox to open a fresh terminal session.
          </AlertDescription>
        </Alert>
      {/if}

      <Separator />

      <div
        class="terminal-shell overflow-hidden rounded-xl border border-border/80 p-1"
      >
        <div
          class="min-h-[50vh] rounded-[calc(var(--radius)-0.2rem)] md:min-h-[62vh]"
          bind:this={terminalElement}
        ></div>
      </div>
    </CardContent>
  </Card>
</div>
