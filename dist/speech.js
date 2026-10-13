(function (root) {
  'use strict';
  function normalize(text) {
    return String(text).normalize('NFKC').toLowerCase().replace(/[.,!?;:"“”‘’]/g, '').trim().replace(/\s+/g, ' ');
  }
  function matchesWord(target, transcript) {
    const expected = normalize(target), actual = normalize(transcript);
    return expected === actual || (expected === 'ten' && actual === '10');
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { normalize, matchesWord };
  if (!root.document) return;
  const Recognition = root.SpeechRecognition || root.webkitSpeechRecognition;
  let active = null, timer = null, consent = false, pendingStart = null;
  function cancel() {
    clearTimeout(timer);
    if (!active) return;
    const previous = active; active = null;
    previous.recognition.abort();
    if (previous.button.isConnected) {
      previous.button.textContent = '🎤 換我讀讀看';
      previous.button.classList.remove('recording');
      previous.status.textContent = '已停止收音，隨時可以再試一次。';
    }
  }
  function consentDialog(start) {
    pendingStart = start;
    let dialog = document.getElementById('mic-consent');
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = 'mic-consent';
      dialog.innerHTML = '<h2>🎤 讓小耳朵聽你讀</h2><p>按開始後，瀏覽器會詢問麥克風權限。每次只聽一個單字，最多 8 秒；你可以隨時停止。</p><p class="muted">語音辨識可能將聲音傳送給瀏覽器的語音服務處理。本遊戲不保存錄音或辨識文字，也不會上傳到 GitHub。請由家長陪同決定是否使用。</p><p class="muted">辨識結果只是跟讀提示，並非專業發音評分；短單字、兒童聲音或背景噪音可能辨識錯誤。</p><div class="practice-actions"><button id="mic-not-now">先不要</button><button id="mic-confirm" class="primary">同意並開始收音</button></div>';
      document.body.append(dialog);
      dialog.querySelector('#mic-not-now').onclick = () => { pendingStart = null; dialog.close(); };
      dialog.querySelector('#mic-confirm').onclick = () => {
        const action = pendingStart; pendingStart = null; consent = true; dialog.close(); action?.();
      };
      dialog.addEventListener('cancel', () => { pendingStart = null; });
    }
    dialog.showModal();
  }
  function attach(word) {
    const button = document.getElementById('mic-button'), status = document.getElementById('mic-status');
    if (!button || !status) return;
    if (!Recognition || !root.isSecureContext) {
      button.disabled = true;
      status.textContent = !Recognition ? '目前瀏覽器沒有語音辨識功能。請試用支援的瀏覽器，或繼續聽音跟讀。' : '麥克風跟讀需要 HTTPS 網站或 localhost，請使用公開遊戲網址。';
      return;
    }
    function start() {
      if (!button.isConnected) return; if (root.navigator?.onLine === false) { status.textContent = '目前離線，麥克風辨識需要網路；可以繼續看字跟讀與測驗。'; return; }
      cancel(); root.speechSynthesis?.cancel();
      const recognition = new Recognition(), attempt = { recognition, button, status };
      active = attempt;
      recognition.lang = 'en-US'; recognition.continuous = false; recognition.interimResults = false; recognition.maxAlternatives = 3;
      let received = false;
      const live = () => active === attempt && button.isConnected;
      const finishButton = () => { button.textContent = '🎤 再讀一次'; button.classList.remove('recording'); };
      recognition.onstart = () => {
        if (!live()) return;
        button.textContent = '⏹ 停止收音'; button.classList.add('recording');
        status.textContent = `正在聽，請只讀「${word}」。`;
      };
      recognition.onresult = event => {
        if (!live()) return;
        const transcript = event.results[event.resultIndex]?.[0]?.transcript || '';
        received = true; clearTimeout(timer);
        status.textContent = matchesWord(word, transcript)
          ? `🌟 辨識到「${transcript}」，和「${word}」一致！再大聲讀一次吧。`
          : `🌱 這次辨識到「${transcript}」，沒有辨識成「${word}」。先聽一次，再試試看；也可能是小耳朵聽錯了。`;
        finishButton();
      };
      recognition.onerror = event => {
        if (!live()) return;
        received = true; clearTimeout(timer);
        const messages = {
          'not-allowed': '麥克風或語音服務尚未獲准。請在瀏覽器的網站權限設定允許麥克風，再試一次。',
          'service-not-allowed': '目前語音辨識服務無法使用，可以繼續聽音跟讀。',
          'audio-capture': '找不到可用的麥克風，請檢查裝置或連線。',
          'no-speech': '沒有聽到清楚的聲音，靠近麥克風再讀一次吧。',
          network: '語音服務連線失敗，請檢查網路後再試。',
          'language-not-supported': '語音服務目前不支援英文，請使用其他支援的瀏覽器。'
        };
        status.textContent = messages[event.error] || '這次沒有完成辨識，請再試一次。'; finishButton();
      };
      recognition.onend = () => {
        if (!live()) return;
        clearTimeout(timer); active = null; finishButton();
        if (!received) status.textContent = '沒有辨識到單字，再按麥克風試一次吧。';
      };
      status.textContent = '準備收音，請允許麥克風權限…';
      try {
        recognition.start();
        timer = setTimeout(() => { if (live()) { cancel(); status.textContent = '這次收音已結束，再按麥克風就可以重試。'; } }, 8000);
      } catch (error) {
        active = null; status.textContent = '暫時無法開始收音，請稍後再試。'; finishButton();
      }
    }
    button.onclick = () => {
      if (active) { cancel(); return; }
      if (consent) start(); else consentDialog(start);
    };
  }
  root.document.getElementById('settings-button')?.addEventListener('click', cancel);
  root.WordSpeech = { attach, cancel, matchesWord };
})(typeof window !== 'undefined' ? window : globalThis);
