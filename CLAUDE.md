# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hermes Agent is a self-improving AI agent with built-in learning loop — creates skills from experience, improves them during use, and runs across multiple platforms (CLI, Telegram, Discord, Slack, WhatsApp, Signal). Supports any OpenAI-compatible LLM provider.

## Development Commands

```bash
# Setup (recommended)
./setup-hermes.sh          # Creates venv, installs deps, symlinks hermes CLI

# Manual setup
uv venv venv --python 3.11
source venv/bin/activate
uv pip install -e ".[all,dev]"

# Run tests (ALWAYS use the wrapper - do NOT call pytest directly)
scripts/run_tests.sh                     # full suite
scripts/run_tests.sh tests/agent/        # one directory
scripts/run_tests.sh tests/agent/test_foo.py::test_method  # one test

# Run CLI
./hermes                  # Uses venv auto-detection
hermes --tui              # Ink-based terminal UI
hermes setup              # Setup wizard
hermes doctor             # Diagnostics
```

**Why use `scripts/run_tests.sh`:** Ensures CI-parity (TZ=UTC, LANG=C.UTF-8, 4 xdist workers, all credential env vars unset). Direct `pytest` diverges and causes "works locally, fails in CI" issues.

## Architecture Overview

### Core Files

| File | Purpose |
|------|---------|
| `run_agent.py` | `AIAgent` class — core conversation loop (~12k LOC) |
| `cli.py` | `HermesCLI` — interactive CLI with prompt_toolkit (~11k LOC) |
| `model_tools.py` | Tool orchestration, dispatch to registry |
| `toolsets.py` | Tool groupings and platform presets |
| `hermes_state.py` | SQLite session store with FTS5 search |
| `agent/` | Extracted modules: prompt_builder, context_compressor, memory_manager, etc. |
| `tools/` | Self-registering tool implementations |
| `gateway/` | Messaging gateway (Telegram, Discord, etc.) |
| `ui-tui/` | Ink (React) terminal UI — TypeScript |
| `tui_gateway/` | Python JSON-RPC backend for TUI |
| `hermes_cli/` | CLI subcommands, setup wizard, skin engine |

### Import Chain (critical for understanding circular-import safety)

```
tools/registry.py  (no deps — imported by all tool files)
       ↑
tools/*.py  (each calls registry.register() at import time)
       ↑
model_tools.py  (imports tools/registry + triggers tool discovery)
       ↑
run_agent.py, cli.py, batch_runner.py, environments/
```

### Agent Loop

```python
while api_call_count < max_iterations:
    response = client.chat.completions.create(model, messages, tools)
    if response.tool_calls:
        for tool_call in response.tool_calls:
            result = handle_function_call(tool_call.name, tool_call.args)
            messages.append(tool_result_message(result))
    else:
        return response.content
```

### Profiles: Multi-Instance Support

Hermes supports isolated profiles with separate `HERMES_HOME` directories. `_apply_profile_override()` in `hermes_cli/main.py` sets `HERMES_HOME` before any imports.

**Rule:** Always use `get_hermes_home()` from `hermes_constants` — NEVER hardcode `~/.hermes` or `Path.home() / ".hermes"`.

## Adding a Tool

1. Create `tools/your_tool.py` with `registry.register()` call at module level
2. Add to toolset in `toolsets.py` if needed

Auto-discovery: any `tools/*.py` with `registry.register()` is imported automatically by `model_tools.py`.

## Adding a Skill

Bundled skills in `skills/`, optional skills in `optional-skills/`. Each skill has `SKILL.md` with frontmatter:

```yaml
---
name: my-skill
description: Brief description
version: 1.0.0
platforms: [macos, linux]  # OS-gating, optional
metadata:
  hermes:
    tags: [Category]
    fallback_for_toolsets: [web]  # Show when toolset unavailable
---
```

**Rule:** Most capabilities should be skills, not tools. Tools require end-to-end integration (API keys, auth flows, binary data). Skills are instructions + shell commands + existing tools.

## Slash Command System

All slash commands defined in central `COMMAND_REGISTRY` in `hermes_cli/commands.py`. Adding an alias requires only updating the `aliases` tuple — dispatch, help, autocomplete all update automatically.

## Important Policies

### Prompt Caching Must Not Break

Do NOT alter past context mid-conversation, change toolsets mid-conversation, or reload memories mid-conversation. Cache-breaking forces dramatically higher costs. Slash commands that mutate system-prompt state must default to deferred invalidation (next session), with opt-in `--now` flag.

### DO NOT Hardcode `~/.hermes` Paths

Use `get_hermes_home()` for code paths, `display_hermes_home()` for user-facing messages. Hardcoding breaks profiles.

### DO NOT Introduce New `simple_term_menu` Usage

Has ghost-duplication bugs in tmux/iTerm2. Use `hermes_cli/curses_ui.py` for new interactive menus.

### Tests Must Not Write to `~/.hermes/`

The `_isolate_hermes_home` autouse fixture redirects `HERMES_HOME` to a temp dir.

### Don't Write Change-Detector Tests

Tests that fail when expected-to-change data updates (model catalogs, config versions, enumeration counts) add no behavioral coverage and break CI routinely. Assert relationships/invariants, not snapshots.

### Gateway Has TWO Message Guards

Both base adapter (`gateway/platforms/base.py`) and gateway runner (`gateway/run.py`) intercept messages. Commands that must reach the runner while agent is blocked must bypass BOTH guards.

## User Configuration Locations

| Path | Purpose |
|------|---------|
| `~/.hermes/config.yaml` | Settings |
| `~/.hermes/.env` | API keys (SECRETS ONLY) |
| `~/.hermes/skills/` | Active skills |
| `~/.hermes/memories/` | Persistent memory |
| `~/.hermes/state.db` | SQLite session database |

Non-secret settings belong in `config.yaml`, not `.env`.

## Key Config Loaders

| Loader | Used by | Location |
|--------|---------|----------|
| `load_cli_config()` | CLI mode | `cli.py` |
| `load_config()` | CLI subcommands | `hermes_cli/config.py` |
| Direct YAML | Gateway runtime | `gateway/run.py` |

If CLI sees a config key but gateway doesn't, check loader coverage.

## TUI Architecture

```
hermes --tui
  └─ Node (Ink)  ──stdio JSON-RPC──  Python (tui_gateway)
       │                                  └─ AIAgent + tools + sessions
       └─ renders transcript, composer, prompts
```

TypeScript owns the screen. Python owns sessions, tools, model calls. See `ui-tui/README.md` for dev commands.

## Plugin System

Two surfaces:
- **General plugins** (`hermes_cli/plugins.py`): lifecycle hooks, tool registration, CLI subcommands
- **Memory plugins** (`plugins/memory/`): pluggable memory backends (honcho, mem0, supermemory, etc.)

**Rule:** Plugins MUST NOT modify core files. Expand the generic plugin surface instead.