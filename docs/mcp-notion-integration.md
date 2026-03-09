# MCP (Model Context Protocol) - Notion連携機能

## 概要

OpenAI Responses API の MCP ツール機能を利用して、チャット内から Notion ワークスペースのページを検索・参照・作成できる機能を実装。

ユーザーは OAuth 認証で Notion と接続し、MCP トグルを ON にするだけで、チャットの中で「Notion のページを要約して」などの指示が可能になる。

## アーキテクチャ

```
ブラウザ (SPA)                    SvelteKit Server                    外部サービス
┌─────────────┐              ┌──────────────────┐              ┌──────────────────┐
│ McpModal    │──OAuth開始──→│/api/auth/notion   │──Discovery──→│mcp.notion.com    │
│             │              │  ├ .well-known取得 │              │ /.well-known/... │
│             │              │  ├ Client登録      │              │                  │
│             │              │  └ PKCE生成→302   │──認可───────→│Notion OAuth画面  │
│             │              │                    │              │                  │
│             │←─postMessage─│/api/auth/notion/   │←─code────────│                  │
│             │              │  callback          │──token交換──→│token_endpoint    │
│             │              │                    │              │                  │
│ ChatInput   │──MCP ON────→│/api/chat           │──MCP tool───→│OpenAI API        │
│             │              │  (openai.js)       │              │  ↓               │
│             │←─SSE stream──│                    │←─stream──────│  mcp.notion.com  │
└─────────────┘              └──────────────────┘              └──────────────────┘
```

## OAuth フロー詳細

Notion MCP は **OAuth 2.0 Authorization Code + PKCE** を採用しており、通常の Notion Integration OAuth とは異なる。

### 1. OAuth Discovery

```
GET https://mcp.notion.com/.well-known/oauth-protected-resource
  → authorization_servers[0] を取得

GET {authServerUrl}/.well-known/oauth-authorization-server
  → authorization_endpoint, token_endpoint, registration_endpoint を取得
```

### 2. Dynamic Client Registration

事前に Notion Integration を作成する必要はない。認証開始時にサーバーが自動的にクライアントを登録する。

```json
POST {registration_endpoint}
{
  "client_name": "Ultra Light Chat",
  "redirect_uris": ["http://localhost:5174/api/auth/notion/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
→ { "client_id": "..." }
```

### 3. PKCE (Proof Key for Code Exchange)

公開クライアント（SPA）向けのセキュリティ機構。`client_secret` の代わりに一時的な `code_verifier` を使用。

```
code_verifier  = base64url(random 32 bytes)
code_challenge = base64url(SHA-256(code_verifier))
```

`code_challenge` を認可リクエストに含め、`code_verifier` はサーバー側の Cookie に保存。
トークン交換時に `code_verifier` を送ることで、認可リクエストの発行者であることを証明する。

### 4. 認可 → コールバック → トークン交換

```
[ブラウザ] window.open('/api/auth/notion')
    ↓
[サーバー] Discovery + Registration + PKCE生成
    ↓ 302リダイレクト
[ブラウザ] Notion OAuth同意画面（ユーザーがページアクセスを許可）
    ↓ 302リダイレクト
[サーバー] /api/auth/notion/callback?code=xxx&state=yyy
    ↓ Cookie から code_verifier を取得
    ↓ POST token_endpoint (grant_type=authorization_code, code, code_verifier)
    ↓ access_token + refresh_token を取得
[ブラウザ] postMessage でトークンを受け取り localStorage に保存
```

### 5. トークンリフレッシュ

- アクセストークンは **1時間** で失効
- チャット送信前に自動チェックし、期限5分前で自動リフレッシュ
- リフレッシュトークンはローテーション方式（使用ごとに新しいものが発行される）

```
POST /api/auth/notion/refresh
{ refresh_token, client_id, token_endpoint }
→ { access_token, refresh_token, expires_in }
```

## OpenAI MCP ツール連携

チャット送信時に MCP が有効な場合、OpenAI Responses API に MCP ツール定義を含めて送信する。

```json
{
  "type": "mcp",
  "server_label": "notion",
  "server_url": "https://mcp.notion.com/mcp",
  "require_approval": "never",
  "headers": {
    "Authorization": "Bearer {access_token}"
  }
}
```

OpenAI サーバーが直接 `mcp.notion.com` に接続し、Notion のツール（検索、ページ取得、作成等）を自動的に呼び出す。アプリケーション側でのツール実行実装は不要。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `src/lib/mcpStore.js` | MCP サーバー定義、設定の CRUD、トークンリフレッシュ |
| `src/lib/McpModal.svelte` | MCP 設定 UI（接続/切断） |
| `src/lib/ChatInput.svelte` | MCP トグルボタン |
| `src/lib/chatState.svelte.js` | MCP 状態管理、`getActiveMcpServers()` |
| `src/routes/api/auth/notion/+server.js` | OAuth 開始（Discovery + Registration + PKCE） |
| `src/routes/api/auth/notion/callback/+server.js` | OAuth コールバック（トークン交換） |
| `src/routes/api/auth/notion/refresh/+server.js` | トークンリフレッシュ |
| `src/routes/api/chat/openai.js` | MCP ツール定義の組み立て、エラー転送 |

## 環境変数

MCP 機能に追加の環境変数は不要。Dynamic Client Registration により、`NOTION_OAUTH_CLIENT_ID` / `NOTION_OAUTH_CLIENT_SECRET` は不要になった。

## セキュリティ

- PKCE による認可コード横取り攻撃の防止
- `state` パラメータによる CSRF 防止
- `code_verifier` は HttpOnly Cookie に保存（JavaScript からアクセス不可）
- Cookie は 10分で失効（認可フロー完了後に削除）
- トークンは localStorage に保存（ローカル開発用途）

## スクリーンショット

| 画面 | ファイル |
|---|---|
| MCP 設定モーダル | `docs/スクリーンショット 2026-03-09 101610.png` |
| Notion OAuth 同意画面 | `docs/スクリーンショット 2026-03-09 111932.png` |
| 接続完了状態 | `docs/スクリーンショット 2026-03-09 111953.png` |
| Notion ページ要約結果 | `docs/スクリーンショット 2026-03-09 112012.png` |
