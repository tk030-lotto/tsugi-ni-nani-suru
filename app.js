/**
 * 次に何する？ツール (AI開発ナビゲーター)
 * Application Logic & Prompt Generator Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const views = {
    intro: document.getElementById('view-intro'),
    input: document.getElementById('view-input'),
    result: document.getElementById('view-result'),
  };

  // Buttons & Controls
  const btnStart = document.getElementById('btn-start');
  const btnGenerate = document.getElementById('btn-generate');
  const btnCopyHeader = document.getElementById('btn-copy');
  const btnCopyMain = document.getElementById('btn-copy-main');
  const btnEdit = document.getElementById('btn-edit');
  const btnReset = document.getElementById('btn-reset');
  const accordionToggle = document.getElementById('accordion-toggle');
  const accordionContent = document.getElementById('accordion-content');
  const chipButtons = document.querySelectorAll('.chip-btn');
  const refineButtons = document.querySelectorAll('.refine-btn');

  // Input Fields
  const inputStatus = document.getElementById('current-status');
  const inputGoal = document.getElementById('input-goal');
  const inputLastAction = document.getElementById('input-last-action');
  const inputTrouble = document.getElementById('input-trouble');
  const inputRemaining = document.getElementById('input-remaining');

  // Output Elements
  const promptOutput = document.getElementById('prompt-output');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');

  // State
  let activeRefineType = null;
  let toastTimer = null;

  // --- View Navigation ---
  function switchView(viewName) {
    Object.keys(views).forEach((key) => {
      if (key === viewName) {
        views[key].classList.add('active');
      } else {
        views[key].classList.remove('active');
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Accordion Toggle ---
  if (accordionToggle && accordionContent) {
    accordionToggle.addEventListener('click', () => {
      const isExpanded = accordionToggle.getAttribute('aria-expanded') === 'true';
      accordionToggle.setAttribute('aria-expanded', !isExpanded);
      accordionContent.classList.toggle('open', !isExpanded);
    });
  }

  // --- Quick Input Chips ---
  chipButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const chipText = btn.dataset.chip;
      if (!chipText) return;

      const currentVal = inputStatus.value.trim();
      if (!currentVal) {
        inputStatus.value = chipText;
      } else {
        // 既にテキストがある場合は読点か改行で追加
        if (currentVal.endsWith('。') || currentVal.endsWith('\n')) {
          inputStatus.value = currentVal + chipText;
        } else {
          inputStatus.value = currentVal + '、' + chipText;
        }
      }
      inputStatus.focus();
    });
  });

  // --- Prompt Builder Engine ---
  function buildPrompt() {
    const status = inputStatus.value.trim();
    const goal = inputGoal.value.trim();
    const lastAction = inputLastAction.value.trim();
    const trouble = inputTrouble.value.trim();
    const remaining = inputRemaining.value.trim();

    if (!status) {
      alert('「今どこまでできていますか？」を入力してください。');
      inputStatus.focus();
      return null;
    }

    let prompt = `# 依頼：現在の開発状況の整理と「次にやること」の提示\n\n`;
    prompt += `現在、個人開発（またはAI支援開発）を進めています。\n`;
    prompt += `今の進捗状況を入力しましたので、状況を整理した上で「次に行うべき具体的な作業」を教えてください。\n\n`;

    prompt += `## 1. 現在の開発状況\n`;
    prompt += `${status}\n\n`;

    // 補足情報セクション（入力がある場合のみ）
    const hasDetails = goal || lastAction || trouble || remaining;
    if (hasDetails) {
      prompt += `## 2. 補足情報\n`;
      if (goal) prompt += `- 作りたいもの・目標: ${goal}\n`;
      if (lastAction) prompt += `- 直前に行った作業: ${lastAction}\n`;
      if (trouble) prompt += `- 現在困っていること・エラー: ${trouble}\n`;
      if (remaining) prompt += `- 残っていると思う作業: ${remaining}\n`;
      prompt += `\n`;
    }

    // AIへの指示・出力フォーマット
    prompt += `## 3. AIへの依頼内容\n`;
    prompt += `上記の内容を踏まえ、以下のフォーマットで回答してください。\n`;
    prompt += `一度に大量のタスクを提示せず、作業を小さく分割して **「まず最初に着手する1つの作業」** を最優先で明確に提示してください。\n\n`;

    // クイック調整による特記事項
    if (activeRefineType === 'next-one') {
      prompt += `> **【特に重視する点】**\n`;
      prompt += `> 今後の全体計画は最小限にし、「今この瞬間に実行するべきたった1つの極小ステップ」だけを具体的に教えてください。\n\n`;
    } else if (activeRefineType === 'simple') {
      prompt += `> **【特に重視する点】**\n`;
      prompt += `> 初心者でも迷わずできる、もっとも簡単で心理的ハードルの低い作業から順に提示してください。\n\n`;
    } else if (activeRefineType === 'verify-only') {
      prompt += `> **【特に重視する点】**\n`;
      prompt += `> 新機能の追加は一旦行わず、現在動いている部分が正常に動作しているか確認する「動作検証・テスト手順」を教えてください。\n\n`;
    } else if (activeRefineType === 'postpone') {
      prompt += `> **【特に重視する点】**\n`;
      prompt += `> 複雑な設計や難しい機能は後回しにして、まずはシンプルに動く最小構成を完成させる手順を提示してください。\n\n`;
    } else if (activeRefineType === 'overview') {
      prompt += `> **【特に重視する点】**\n`;
      prompt += `> 「次の一歩」に加えて、完成までに必要な全体ステップ（大まかなロードマップ）も一覧で整理してください。\n\n`;
    }

    prompt += `### 回答フォーマット\n`;
    prompt += `1. **現在の状態の整理**\n`;
    prompt += `   - 完了していると思われること\n`;
    prompt += `   - 未完了・確認が必要なこと\n\n`;
    prompt += `2. **まず次にやるべきこと（最優先の1つ）**\n`;
    prompt += `   - 作業内容（具体的に何をどうするか）\n`;
    prompt += `   - なぜこの作業を先に行うのか（理由）\n\n`;
    prompt += `3. **作業完了後の確認方法**\n`;
    prompt += `   - 正常に動いたかどうかのチェック項目\n\n`;
    prompt += `4. **その後に続く予定のステップ（参考）**\n`;
    prompt += `   - 次のステップ以降の簡単な目安`;

    return prompt;
  }

  // --- Clipboard Copy ---
  async function copyToClipboard(text) {
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToast('質問文をクリップボードにコピーしました！');
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      showToast('コピーに失敗しました。直接選択してコピーしてください。');
    }
  }

  // --- Toast Notification ---
  function showToast(msg) {
    if (!toast) return;
    if (toastMessage) toastMessage.textContent = msg;

    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // --- Event Listeners ---

  // 1. 始めるボタン
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      switchView('input');
      setTimeout(() => inputStatus.focus(), 200);
    });
  }

  // 2. 質問文生成ボタン
  if (btnGenerate) {
    btnGenerate.addEventListener('click', () => {
      const promptText = buildPrompt();
      if (!promptText) return;

      promptOutput.textContent = promptText;
      switchView('result');
    });
  }

  // 3. コピーボタン (ヘッダー & メイン)
  if (btnCopyHeader) {
    btnCopyHeader.addEventListener('click', () => {
      copyToClipboard(promptOutput.textContent);
    });
  }
  if (btnCopyMain) {
    btnCopyMain.addEventListener('click', () => {
      copyToClipboard(promptOutput.textContent);
    });
  }

  // 4. クイック調整ボタン
  refineButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const refineType = btn.dataset.refine;
      
      // 同じボタンを再タップでトグル解除
      if (activeRefineType === refineType) {
        activeRefineType = null;
        btn.classList.remove('active');
      } else {
        refineButtons.forEach((b) => b.classList.remove('active'));
        activeRefineType = refineType;
        btn.classList.add('active');
      }

      // プロンプト再生成
      const updatedPrompt = buildPrompt();
      if (updatedPrompt) {
        promptOutput.textContent = updatedPrompt;
        showToast('質問文を調整・更新しました');
      }
    });
  });

  // 5. 入力修正ボタン
  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      switchView('input');
    });
  }

  // 6. リセットボタン
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('入力内容をクリアして新しく作成しますか？')) {
        inputStatus.value = '';
        inputGoal.value = '';
        inputLastAction.value = '';
        inputTrouble.value = '';
        inputRemaining.value = '';
        activeRefineType = null;
        refineButtons.forEach((b) => b.classList.remove('active'));
        if (accordionContent) accordionContent.classList.remove('open');
        if (accordionToggle) accordionToggle.setAttribute('aria-expanded', 'false');
        switchView('input');
        inputStatus.focus();
      }
    });
  }
});
