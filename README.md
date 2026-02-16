# Ultra Light Chat

Ultra Light Chatは、OpenAI・Google Gemini APIの高度な機能を活用するために設計された、ミニマリストかつ高性能なチャットインターフェースです。**SvelteKit 2** と **Svelte 5 (Runes)** で構築されており、ブラウザ上でネイティブアプリのようなプレミアムな体験を提供します。

## コンセプト

Ultra Light Chatの目標は、軽量でありながら、ネイティブアプリのような応答性を持つインターフェースを提供することです。シンプルなAPIプレイグラウンドとフル機能のチャットアプリケーションの間にあるギャップを埋め、スピード、美しさ、そして画像生成やコード解釈（Code Interpreter）といった最新モデル機能への直接的なアクセスに焦点を当てています。

## 主な機能

- **マルチプロバイダー対応**: OpenAI（GPT-5.2, 5.1, 5 mini, 5 nano）と Google Gemini（3 Pro/Flash Preview, 2.5 Pro/Flash）をサポート。
- **Reasoning Effort制御**: 対応モデルで推論の深さ（none/minimal/low/medium/high）を選択可能。OpenAIは `reasoning.effort`、Geminiは `thinkingConfig.thinkingLevel` にマッピング。
- **マルチモーダル機能**:
    - **ビジョン**: 画像をドラッグ＆ドロップまたは貼り付けて分析可能（OpenAI・Gemini両対応）。
    - **画像生成**: チャットフロー内で直接画像を生成（OpenAIのみ）。
    - **コードインタープリター**: コードを実行してデータを分析（OpenAIのみ）。
- **ウェブ検索**: 最新情報を取得するためのウェブブラウジング機能をトグルで切り替え可能。
- **ストリーミング応答**: Server-Sent Events (SSE) を使用したリアルタイムでスムーズなテキストストリーミング。
- **アプリライクなUI**:
    - 折りたたみ可能なサイドバーを備えたレスポンシブデザイン。
    - スムーズなアニメーションとトランジション。
    - **ダーク/ライトモード**: システム設定の自動検出と手動トグル。
    - ハンバーガーメニューを備えたモバイル最適化レイアウト。
- **プライバシー重視**:
    - **ローカルストレージ**: チャット履歴はブラウザの `localStorage` にローカル保存されます。
    - **ダイレクトプロキシ**: APIキーを隠蔽するための最小限のサーバープロキシを経由し、データをログに記録することはありません。

## 技術スタック

### フレームワーク & 言語
- **SvelteKit 2**: ルーティング、サーバーサイドAPI処理、最適化されたビルド出力に使用。
- **Svelte 5**: きめ細やかなリアクティビティとクリーンなコードのために、新しい **Runes** システム (`$state`, `$derived`, `$props`) を採用。
- **JavaScript**: JSDocによる型チェック（TypeScriptのコンパイルオーバーヘッドなし）。
- **Vite**: 超高速な開発サーバーおよびバンドラー。

### スタイリング
- **Vanilla CSS**: テーマ設定とレイアウトのためのカスタムCSS変数。
- **CSSフレームワークなし**: パフォーマンスを最大化し、デザインシステムを完全に制御するために手書きのスタイルを使用。

## アーキテクチャ

Ultra Light Chatは、軽量なサーバーコンポーネントを持つ **シングルページアプリケーション (SPA)** として動作します。

1.  **フロントエンド (SPA)**:
    -   初期ロード後は完全にブラウザ内で動作します。
    -   Svelte 5 Runesを使用して状態を管理します。
    -   データを `localStorage` に保存します。

2.  **バックエンド (APIプロキシ)**:
    -   `/api/chat` でホストされています。
    -   OpenAI API / Google Gemini APIへのセキュアなゲートウェイとして機能します。
    -   モデルIDに基づいてプロバイダーを自動判別し、各APIのフォーマットに変換します。
    -   ストリーミング応答を処理し、統一されたSSEフォーマットでクライアントに転送します。

## 始め方

### 前提条件
- Node.js (最新のLTS推奨)
- OpenAI API キー

### インストール

1.  リポジトリをクローンします:
    ```bash
    git clone https://github.com/yourusername/ultra-light-chat.git
    cd ultra-light-chat
    ```

2.  依存関係をインストールします:
    ```bash
    npm install
    # または
    pnpm install
    ```

3.  環境変数を設定します:
    ルートディレクトリに `.env` ファイルを作成してください:
    ```env
    OPENAI_API_KEY=sk-...
    OPENAI_MODEL=gpt-5-mini
    GOOGLE_API_KEY=AIza...
    ```

4.  開発サーバーを起動します:
    ```bash
    npm run dev
    ```

## コマンド

- `npm run dev`: 開発サーバーを起動
- `npm run build`: 本番用ビルドを作成
- `npm run preview`: 本番ビルドをプレビュー
- `npm run check`: `svelte-check` で型チェックを実行

## Azureへのデプロイ

このプロジェクトは `adapter-node` を使用しているため、Azure App Service (Linux Web App) へのデプロイが推奨されます。

### 手順

1.  **ビルド**:
    ローカルまたはCI/CDパイプラインでアプリケーションをビルドします。
    ```bash
    npm run build
    ```
    これにより `build/` ディレクトリが生成されます。

2.  **Azure App Serviceの作成**:
    -   **Publish**: Code
    -   **Runtime stack**: Node 20 LTS (またはそれ以降)
    -   **Operating System**: Linux

3.  **デプロイ**:
    -   **VS Code拡張機能を使用する場合**: "Azure App Service" 拡張機能をインストールし、`build/` フォルダ、`package.json`、`package-lock.json` をデプロイします（node_modulesはAzure上でインストールさせることが可能です）。
    -   **Local Git / ZIPデプロイ**: `build` フォルダと依存関係を含むファイルをデプロイします。
    
    *推奨*: `package.json` に `"start": "node build"` スクリプトを追加済みですので、Azureは自動的にこのコマンドを使ってサーバーを起動しようとします。もし起動しない場合は、Azureポータルの **Configuration** > **General settings** > **Startup Command** に以下を入力してください:
    ```bash
    node build
    ```

4.  **環境変数の設定**:
    Azureポータルの **Settings** > **Environment variables** で以下の設定を追加してください:
    -   `OPENAI_API_KEY`: あなたのOpenAI APIキー
    -   `OPENAI_MODEL`: (任意) デフォルトモデル (デフォルト: `gpt-5-mini`)
    -   `GOOGLE_API_KEY`: あなたのGoogle Gemini APIキー
    -   `ORIGIN`: 本番環境のURL (例: `https://your-app-name.azurewebsites.net`) ※CSRF保護のため重要です
    -   `PORT`: `8080` (Azure App Service のデフォルトポートに合わせて自動設定されますが、明示的に指定も可能)

### 注意点
-   **Node.jsバージョン**: 開発環境とAzureのランタイムバージョン（Node 20など）を合わせてください。
-   **Websockets / SSE**: このアプリはSSE (Server-Sent Events) を使用しています。Azure App Serviceでは特に設定なしで動作しますが、プロキシ設定等でバッファリングされないように注意が必要な場合があります（通常はデフォルトで問題ありません）。

