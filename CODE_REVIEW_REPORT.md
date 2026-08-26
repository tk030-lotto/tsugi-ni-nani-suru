# コードレビュー報告書

**次に何する？ツール (tsugi-ni-nani-suru)**

---

## 0. レビュー概要

| 項目 | 内容 |
|---|---|
| レビュー日 | 2026-08-26 |
| レビュー対象 | `index.html` / `style.css` / `app.js` / `.github/workflows/deploy-pages.yml` / `README.md` / `RECORD.md` |
| 突合資料 | `仕様書.md`（§4〜§17）、`README.md`、`RECORD.md`（GATE-007-05 対応記録） |
| 検証方法 | 全ソース精読、仕様書との突合、Git 状態確認、`node --check app.js` による構文検証（Node v22.22.3 → **SYNTAX OK**） |
| 総合判定 | **PASS（軽微な改善推奨）** — リリース阻害となる重大バグ・セキュリティ欠陥はゼロ |

### 評価サマリー

| カテゴリ | 指摘数 | 重要度 内訳 | 判定 |
|---|---|---|---|
| バグ・機能 | 5 | 中×2 / 低×3 | 要改善（軽微） |
| アクセシビリティ | 5 | 中×2 / 低×3 | 要改善（軽微） |
| セキュリティ | 4 | 合格×1 / 低×2 / 情報×1 | 合格 |
| 品質・保守性 | 3 | 低×2 / 情報×1 | 合格 |
| 仕様適合性 | 主要フロー全適合＋軽微乖離2件 | — | 合格 |
| デプロイ/衛生 | 3 | 合格×1 / 低×1 / 情報×1 | 合格 |

---

## 1. バグ・機能上の問題

### 【中】B-1. エラートーストのアイコンが常に「✓」

`app.js` の `showToast(msg, isError)` は CSS クラス `toast-error` を付与するが、グリフ本体は `index.html` L196 の `<span class="toast-icon">✓</span>` に固定されている。エラー時（例：「今どこまでできていますか？」未入力警告）に赤いチェックマークが表示され、意味的に不一致。

**推奨修正**（app.js `showToast` 内。HTML 側に `id="toast-icon"` 付与が必要）:

```js
if (isError) {
  toast.classList.add('toast-error');
  if (toastIcon) toastIcon.textContent = '!';
} else {
  toast.classList.remove('toast-error');
  if (toastIcon) toastIcon.textContent = '✓';
}
```

### 【中】B-2. クリップボードフォールバックの失敗が成功扱い／DOMリーク

`copyToClipboard`（app.js L223–244）の2点：

- `document.execCommand('copy')` の戻り値 `boolean` を検査しておらず、失敗しても成功トーストを出す。
- `execCommand` が例外を投げた場合、`document.body.removeChild(textarea)` が実行されず textarea が DOM に残留する。

**推奨修正**：

```js
} else {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    if (!ok) throw new Error('execCommand returned false');
    showToast('質問文をクリップボードにコピーしました！');
  } finally {
    document.body.removeChild(textarea);
  }
}
```

### 【低】B-3. 空テキストコピー時の無反応

`if (!text) return;`（L224）— ユーザーが contenteditable を全消去後にコピーボタンを押すと何のフィードバックもない。`showToast('コピーする内容がありません。', true)` 等の通知を推奨。

### 【低】B-4. チップ連結時の読点重複

chip 追加処理（app.js L133–142）は末尾が `。` か `\n` の場合のみ判定し、「、」で終わる文字列にさらに「、」を足して「〜、、画面はできた」になり得る。除外条件への追加を推奨：

```js
if (currentVal.endsWith('。') || currentVal.endsWith('\n') || currentVal.endsWith('、')) {
  inputStatus.value = currentVal + chipText;
}
```

### 【低】B-5. refine 再生成による手動編集の無警告上書き

result 画面で直接編集（contenteditable）した後、クイック調整ボタンを押すと `buildPrompt()` の結果で編集内容が黙って失われる。トーストは出るが消失自体は通知されない。確認ダイアログ化 or 編集済みフラグによる保護を検討。

---
---

## 2. アクセシビリティ

| No | 重要度 | 指摘内容 | 推奨対応 |
|---|---|---|---|
| A-1 | 中 | **ビュー切替時のフォーカス管理不整合**：`btnStart→input` では `inputStatus.focus()` があるのに、`btnGenerate→result` ではフォーカス移動なし。スクリーンリーダー利用者に結果表示が伝わらない。 | 結果コンテナに `tabindex="-1"` を付与し `resultContainer.focus()` を実行 |
| A-2 | 中 | **エラー状態の ARIA 不足**：必須エラーは視覚シェイク＋トーストのみ。（トーストが `role="alert"` のため最低限の読み上げは担保される） | `inputStatus` への `aria-invalid="true"` 付与、エラー文言要素との `aria-describedby` 関連付け |
| A-3 | 低 | アコーディオンボタンに `aria-controls="accordion-content"` がない（`aria-expanded` は適切）。開閉は `display:none` 制御のため SR 的には実質 OK。 | 属性1行追加 |
| A-4 | 低 | `<pre contenteditable="true">` に `role="textbox"` + `aria-label` がない。編集可能領域として SR で説明されにくい。 | `role="textbox" aria-label="生成された質問文（編集可能）"` 追加 |
| A-5 | 低 | `prefers-reduced-motion: reduce` 非対応。shake/smooth scroll/transition が動作軽減設定ユーザーに影響。 | メディアクエリで animation/scroll-behavior 無効化 |

```css
/* A-5 対応例 */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**コントラスト**: 主要組み合わせは WCAG AA 合格水準（例：`--text-muted #71717a` on `#09090b` ≒ 4.9:1）。問題なし。

---

## 3. セキュリティ

| No | 判定 | 内容 |
|---|---|---|
| S-1 | ✅ 合格 | **XSS 不可**：プロンプト出力は `innerText` 経由の代入のみで HTML パースされない。ユーザー入力は localStorage のみで外部送信なし（仕様 §14・§15 と整合）。 |
| S-2 | 低 | contenteditable への**リッチテキスト貼り付け**で DOM にタグが混入し得る（コピー読み取りは textContent のため実害小）。`paste` イベントでのプレーンテキスト正規化を推奨。 |
| S-3 | 情報 | Google Fonts 外部依存（プライバシー・オフライン時は fallback フォント動作）。`display=swap` 済みのため許容範囲。 |
| S-4 | 低 | `<form onsubmit="return false;">` のインライン JS。将来 CSP 導入時の障害になるため `addEventListener('submit', e => e.preventDefault())` への統一を推奨（現状 GitHub Pages に CSP はなく実害なし）。 |

---

## 4. 品質・保守性

- **D-1（低）null ガード方針の不統一**：リスナー登録は `if (el)` ガードするのに、`saveDraft()` 内の `inputStatus.value`、`switchView` 内の `views[key].classList`、リセット後の `inputStatus.focus()` は非ガード。静的サイトなので実害は薄いが、方針をどちらかに統一すべき。
- **D-2（情報）テスト不在**：規模的に許容範囲。`buildPrompt` の文字列組み立てだけでも Node 単体テスト（node:test 等）化すると回帰に強くなる。
- **D-3（情報）`required` 属性の二重管理**：フォーム送信が常時抑止されるためネイティブバリデーションは発火せず、実質セマンティックヒント止まり。JS バリデーションとの二重管理である点は認識しておくこと。

---
## 5. 仕様書（仕様書.md）との突合

| 仕様条項 | 判定 | 内容 |
|---|---|---|
| §4 基本フロー / §5 起動画面 | ✅ | タイトル・サブタイトル・導線［始める］とも一致 |
| §6 現在の状況入力 | ✅ | 自由入力＋必須バリデーション＋チップ6種（仕様の入力例と一致） |
| §7 追加情報 | ⚠️ 軽微な乖離① | 仕様は5項目に対し、実装は「作りたいもの・目指すゴール」に前者2つを統合した4入力。実用上問題なし。仕様書側の表記合わせを推奨。 |
| §8 質問生成 / §9 小分割指示 | ✅ | 回答フォーマット1〜4で完了/未完了/最優先1つ/確認方法を整理させる構成 |
| §10 「次の一個」重視 | ✅ | 基本指示に「まず最初に着手する1つの作業」を最優先、overview オプションで全体ロードマップも選択可 |
| §11 表示＋操作 | ⚠️ 軽微な乖離② | ボタン名［修正する］［もう一度作る］→ 実装は「条件入力に戻る」「新しく入力する」。UX 向上目的と判断し許容。仕様書更新を推奨。 |
| §12 修正 | ✅ | refine 5種が仕様の3例題（簡単な作業から／後回し／動作確認だけ）を網羅＋next-one／overview |
| §13 開発再開 | 📝 注意 | §15「プロジェクト履歴保存しない」と localStorage 下書き自動保存の関係。単一キー固定（`tsugi_ni_nani_suru_draft_v1`）であり履歴保存には該当しないため許容と判断。仕様書へ一言注記推奨。 |
| §14 AI API 不使用 / §15 実装外機能 | ✅ | 外部 API・サーバ連携なし。実装外機能の混入もなし。 |
| §17 完成条件 | ✅ | 11項目すべて満たす |

**補足**：RECORD.md 記載の GATE-007-05 対応（`html { font-size: 16px }` による iOS Safari 自動ズーム防止）を実装済みであることを確認（style.css L60）。

---

## 6. デプロイ・リポジトリ衛生

- ✅ **deploy-pages.yml は適切**：最小権限 permissions（contents: read / pages: write / id-token: write）、concurrency 制御、公式アクションの現行メジャーバージョン（checkout@v4 / configure-pages@v5 / upload-pages-artifact@v3 / deploy-pages@v4）。
- 💡 `path: '.'` によりリポジトリ全体（demo.gif 等）が配信 artifact に入る。秘密情報はないため実害なし。配信物の最小化（path 限定 or ビルドディレクトリ集約）は検討余地あり。
- ⚠️ **未コミット変更あり**（レビュー時点）：`M .agents/AGENTS.md`、`M SKILLS.md`、`?? .agents/agents/`。作業ツリー整理・コミットを推奨。
- ℹ️ PowerShell の `Get-Content` で `.clinerules` / `RECORD.md` の日本語が文字化けするが、ファイル自体は UTF-8 正常（コンソールコードページ起因の表示上の問題のみ。実ファイル欠陥ではない）。

---

## 7. 対応優先度ロードマップ

| 優先度 | 項目 | 工数目安 |
|---|---|---|
| P0（今すぐ） | B-1 エラーアイコン切替、B-2 クリップボード fallback 修正 | 各数行 |
| P1（次の機会） | A-1 result 遷移時フォーカス、A-2 aria-invalid、未コミット変更の整理 | 小 |
| P2（余裕があれば） | A-5 reduced-motion、S-2 paste 正規化、B-4 読点重複、B-5 上書き保護、A-3/A-4/S-4 | 小〜中 |

---

## 8. 受入判定

> **PASS**
>
> 重大な欠陥なく、仕様 §17 の完成条件（11項目）をすべて満たす。上記 P0/P1 の軽微修正を推奨するが、リリース・公開の阻害要因はない。

---
*本報告書は 2026-08-26 時点のコードベース（HEAD: 307f580）に基づく。*


