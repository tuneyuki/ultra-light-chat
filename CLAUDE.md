# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ultra Light Chat is a minimalist chat interface for OpenAI and Google Gemini APIs built with SvelteKit 2 + Svelte 5 (runes). It runs as a client-side SPA with a server-side API proxy for streaming.

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
                                                                   → Gemini streamGenerateContent
                                                    ↓
                                              SSE stream back (unified format)
                                                    ↓
                                        localStorage persistence
```

**Key modules in `src/lib/`**:
- `api.js` — Streaming client using ReadableStream (manual SSE parsing, not EventSource)
- `chatStore.js` — Conversation CRUD backed by localStorage (key: `ulc-conversations`)
- `models.js` — Model definitions with provider, capabilities, and reasoning effort options
- `types.js` — JSDoc type definitions (Message, Conversation)
- `Sidebar.svelte` — Conversation list with mobile hamburger menu
- `EmptyState.svelte` — New chat setup (model select, reasoning effort, system prompt)
- `SettingsModal.svelte` — Theme toggle

**API contract** (`/api/chat` POST):
- Request: `{ input, chat_id?, model?, system_prompt?, web_search?, image_generation?, code_interpreter?, reasoning_effort?, messages? }`
- Response: SSE stream with `response.output_text.delta` and `response.completed` events
- Conversation continuity uses `previous_response_id` via `chat_id` (OpenAI) or full message history via `messages` (Gemini)
- Provider auto-detected from model ID (`gemini-*` → Gemini, otherwise OpenAI)
- `reasoning_effort` mapped to `reasoning.effort` (OpenAI) or `thinkingConfig.thinkingLevel` (Gemini)

## Tech Conventions

- **JavaScript with JSDoc types** — no TypeScript source files, strict checking via `jsconfig.json`
- **Svelte 5 runes** — uses `$state`, `$derived`, `$props` (not legacy reactive syntax)
- **CSS variables** for theming — light/dark themes defined in `app.css` with `:root` / `:root.dark`
- **Mobile breakpoint**: 768px
- **HTML lang**: `ja` (Japanese)

## Environment Variables

Required in `.env` (see `.env.example`):
- `OPENAI_API_KEY` — API key for OpenAI
- `OPENAI_MODEL` — Default model (fallback: `gpt-5-mini`)
- `GOOGLE_API_KEY` — API key for Google Gemini

Accessed server-side via `$env/dynamic/private`.

## Supported Models

**OpenAI**: GPT-5.2, GPT-5.1, GPT-5 mini, GPT-5 nano
**Gemini**: Gemini 3 Pro Preview, Gemini 3 Flash Preview, Gemini 2.5 Pro, Gemini 2.5 Flash

### Reasoning Effort

Models that support reasoning effort control:

| Model | Available Levels |
|---|---|
| GPT-5.2 | none, low, medium, high |
| GPT-5.1 / 5 mini / 5 nano | low, medium, high |
| Gemini 3 Pro Preview | low, high |
| Gemini 3 Flash Preview | minimal, low, medium, high |
