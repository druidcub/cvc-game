(() => {
  'use strict';
  const status = document.getElementById('offline-status');
  const install = document.getElementById('install-game');
  const update = document.getElementById('update-game');
  let ready = false, promptEvent = null, registration = null, refreshing = false;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function showStatus() {
    status.textContent = ready
      ? navigator.onLine ? '🌿 已備妥離線練習' : '🍃 離線模式 · 複習與測驗可用'
      : navigator.onLine ? '☁️ 正在準備離線練習…' : '☁️ 尚未備妥離線內容，請先連線載入一次';
    install.hidden = standalone();
  }
  async function checkReady(worker) {
    if (!worker) return;
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      if (!ready) status.textContent = '離線內容尚未確認，請連線後重新開啟遊戲。';
    }, 5000);
    channel.port1.onmessage = event => {
      clearTimeout(timer); channel.port1.close(); ready = event.data.ready === true; showStatus();
    };
    worker.postMessage({ type: 'OFFLINE_STATUS' }, [channel.port2]);
  }
  function showWaiting() { update.hidden = !registration?.waiting; }
  window.addEventListener('online', () => { showStatus(); checkReady(registration?.active); registration?.update().catch(() => {}); });
  window.addEventListener('offline', showStatus);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); promptEvent = event; });
  window.addEventListener('appinstalled', () => { promptEvent = null; install.hidden = true; });
  install.onclick = async () => {
    if (promptEvent) { const event = promptEvent; promptEvent = null; await event.prompt(); await event.userChoice; return; }
    document.getElementById('install-help').showModal();
  };
  update.onclick = () => {
    if (!registration?.waiting) return;
    // Reload only after a deliberate click; completed practice is saved on pagehide.
    refreshing = true; update.disabled = true;
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  };
  showStatus();
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    status.textContent = '離線安裝需要支援的瀏覽器與 HTTPS 網址'; return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) { location.reload(); return; }
    checkReady(navigator.serviceWorker.controller);
  });
  navigator.serviceWorker.register('../sw.js', { scope: '../', updateViaCache: 'none' }).then(reg => {
    registration = reg; showWaiting(); checkReady(reg.active);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') showWaiting();
        if (worker.state === 'redundant' && !ready) status.textContent = '離線準備未完成，請檢查網路並重新開啟。';
      });
    });
    navigator.serviceWorker.ready.then(activeReg => checkReady(activeReg.active));
  }).catch(() => { status.textContent = '離線準備未完成，可繼續線上練習，稍後再重新開啟。'; });
})();
