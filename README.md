# OpenConclave Plugin for Claude Code

Claude Code plugin for [OpenConclave](https://openconclave.com) — visual multi-agent orchestration with channel events, MCP tools, and auto-start.

## Install (current path)

> **⚠ Important:** The marketplace install path below is still being finalized. Until then, load the channel plugin in dev mode:

```bash
claude --dangerously-load-development-channels plugin:openconclave-channel@openconclave
```

Run this every time you start Claude Code (or alias it). Without it, the OpenConclave channel events (channel loop prompts, conclave outputs) won't reach your Claude Code session.

## Install (eventual path — not fully working yet)

Once marketplace registration lands:

```
/plugin marketplace add openconclave/openconclave-marketplace
/plugin install openconclave
```

## What you get

- **Channel events** — receive `channel:output` and `prompt:question` events from running conclaves, respond inline
- **MCP tools** — manage conclaves, runs, agents, and KBs directly from Claude Code (`oc_list_conclaves`, `oc_trigger_conclave`, `oc_respond`, etc.)
- **Conclaves as tools** — every enabled conclave with a `toolName` shows up as its own MCP tool, callable directly
- **Auto-start server** — launches the OC server on Claude Code session start
- **`/create-conclave` skill** — build conclaves from natural-language descriptions

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (latest)
- A running OpenConclave instance — see [openconclave/oc](https://github.com/openconclave/oc) for install

## Links

- [OpenConclave](https://openconclave.com)
- [Main repo](https://github.com/openconclave/oc)
- [Starter conclaves](https://github.com/openconclave/conclaves)
