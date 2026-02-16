<script>
    let { onClose } = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="help-overlay" onclick={onClose} onkeydown={() => {}}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="help-modal"
        onclick={(e) => e.stopPropagation()}
        onkeydown={() => {}}
    >
        <div class="help-header">
            <h2 class="help-title">Ultra Light Chat の使い方</h2>
            <button class="help-close" onclick={onClose} aria-label="Close">
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    ><line x1="4" y1="4" x2="12" y2="12" /><line
                        x1="12"
                        y1="4"
                        x2="4"
                        y2="12"
                    /></svg
                >
            </button>
        </div>
        <div class="help-content">
            <section>
                <h3>基本操作</h3>
                <ul>
                    <li>
                        <strong>New Chat</strong> — サイドバーから新しい会話を開始
                    </li>
                    <li>
                        <strong>Model</strong> — 会話開始前にモデルを選択（OpenAI
                        / Gemini）
                    </li>
                    <li>
                        <strong>System Prompt</strong> — AIの振る舞いを指示するプロンプトを設定
                    </li>
                    <li>
                        <strong>Reasoning Effort</strong> — 対応モデルで推論の深さを制御
                    </li>
                </ul>
            </section>
            <section>
                <h3>ツールトグル</h3>
                <ul>
                    <li>
                        <strong>Search</strong> — Web検索を使って最新情報を取得
                    </li>
                    <li>
                        <strong>Image</strong> — AIが画像を生成（OpenAIのみ）
                    </li>
                    <li>
                        <strong>Code</strong> — Pythonコードを実行して計算やファイル処理
                    </li>
                </ul>
            </section>
            <section>
                <h3>入力</h3>
                <ul>
                    <li>
                        <strong>画像添付</strong> — ドラッグ＆ドロップ、貼り付け、またはクリップアイコンから添付
                    </li>
                    <li>
                        <strong>ファイル添付</strong> — Code有効時にあらゆるファイルを添付可能
                    </li>
                    <li>
                        <strong>Enter</strong> で送信、<strong
                            >Shift+Enter</strong
                        > で改行
                    </li>
                </ul>
            </section>
            <section>
                <h3>その他</h3>
                <ul>
                    <li>
                        チャット履歴はブラウザの LocalStorage に保存されます
                    </li>
                    <li>Settings からダーク/ライトテーマを切り替え可能</li>
                    <li>保存したプロンプトは次回以降も利用できます</li>
                </ul>
            </section>
        </div>
    </div>
</div>

<style>
    .help-overlay {
        position: fixed;
        inset: 0;
        background: var(--overlay-bg);
        z-index: 200;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .help-modal {
        background: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-radius: 12px;
        max-width: 520px;
        width: 90%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
    }

    .help-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px 12px;
        flex-shrink: 0;
    }

    .help-title {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
    }

    .help-close {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: none;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .help-close:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
    }

    .help-content {
        padding: 0 24px 24px;
        overflow-y: auto;
    }

    .help-content section {
        margin-bottom: 16px;
    }

    .help-content section:last-child {
        margin-bottom: 0;
    }

    .help-content h3 {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 8px;
    }

    .help-content ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .help-content li {
        font-size: 0.85rem;
        color: var(--text-secondary);
        line-height: 1.7;
        padding-left: 14px;
        position: relative;
    }

    .help-content li::before {
        content: "·";
        position: absolute;
        left: 0;
        color: var(--text-muted);
        font-weight: bold;
    }
</style>
