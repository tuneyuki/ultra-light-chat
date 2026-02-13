# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ultra Light Chat is a minimalist chat interface for OpenAI's API built with SvelteKit 2 + Svelte 5 (runes). It runs as a client-side SPA with a server-side API proxy for OpenAI streaming.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build (output: build/)
npm run preview      # Preview production build
npm run check        # Type check with svelte-check
npm run check:watch  # Type check in watch mode
```

Deploy: `npm run build && firebase deploy`

## Architecture

**SPA with server API proxy**: SSR is disabled (`src/routes/+layout.js`). The app is a single-page application with one server endpoint.

**Data flow**:
```
User Input → +page.svelte → streamChat() → /api/chat (+server.js) → OpenAI /v1/responses
                                                    ↓
                                              SSE stream back
                                                    ↓
                                        localStorage persistence
```

**Key modules in `src/lib/`**:
- `api.js` — Streaming client using ReadableStream (manual SSE parsing, not EventSource)
- `chatStore.js` — Conversation CRUD backed by localStorage (key: `ulc-conversations`)
- `types.js` — JSDoc type definitions (Message, Conversation)
- `Sidebar.svelte` — Conversation list with mobile hamburger menu
- `SettingsModal.svelte` — Theme toggle

**API contract** (`/api/chat` POST):
- Request: `{ input, chat_id?, model?, system_prompt? }`
- Response: SSE stream with `response.output_text.delta` and `response.completed` events
- Conversation continuity uses `previous_response_id` via `chat_id`

## Tech Conventions

- **JavaScript with JSDoc types** — no TypeScript source files, strict checking via `jsconfig.json`
- **Svelte 5 runes** — uses `$state`, `$derived`, `$props` (not legacy reactive syntax)
- **CSS variables** for theming — light/dark themes defined in `app.css` with `:root` / `:root.dark`
- **Mobile breakpoint**: 768px
- **HTML lang**: `ja` (Japanese)

## Environment Variables

Required in `.env` (see `.env.example`):
- `OPENAI_API_KEY` — API key for OpenAI
- `OPENAI_MODEL` — Default model (fallback: `gpt-4.1-mini`)

Accessed server-side via `$env/dynamic/private`.

## Supported Models

GPT-4.1, GPT-4.1 mini, GPT-4.1 nano, o4-mini, o3, o3-mini.
