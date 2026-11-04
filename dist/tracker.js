/* 學習足跡上傳器 · Learning footprint tracker
 * 把遊戲裡的練習結果送到家長自己部署的 Google Apps Script 網址，
 * 由那支腳本寫進家長 Google Drive 的「學習歷程追蹤」試算表。
 * - 沒填網址就不會送出任何資料（預設關閉）。
 * - 離線時事件先放進 localStorage 佇列，連線後自動補送。
 * - 只送練習結果（單字／詞語、對錯、時間），不含錄音或辨識文字。
 * 兩個遊戲（cvc-game、bopomofo_game）共用同一份檔案。
 */
(function (root) {
  'use strict';
  const QUEUE_LIMIT = 500, BATCH = 50, PING_TIMEOUT = 8000;
  const DEFAULT_SETTINGS = { enabled: false, url: '', token: '', learner: '' };

  function create(options) {
    const app = options.app;
    const key = options.key || `${app}-tracker-v1`;
    const storage = options.storage || root.localStorage;
    const fetchFn = options.fetch || (root.fetch ? root.fetch.bind(root) : null);
    const now = options.now || (() => Date.now());
    const isOnline = options.onLine || (() => root.navigator ? root.navigator.onLine !== false : true);
    const doc = options.document || root.document;
    const listeners = new Set();

    const read = (name, fallback) => { try { const v = JSON.parse(storage.getItem(`${key}:${name}`) || 'null'); return v === null ? fallback : v; } catch (e) { return fallback; } };
    const write = (name, value) => { try { storage.setItem(`${key}:${name}`, JSON.stringify(value)); return true; } catch (e) { return false; } };

    let settings = { ...DEFAULT_SETTINGS, ...sanitize(read('settings', {})) };
    let queue = Array.isArray(read('queue', [])) ? read('queue', []) : [];
    let sending = false, lastError = '';

    function sanitize(s) {
      const out = {};
      if (typeof s.enabled === 'boolean') out.enabled = s.enabled;
      if (typeof s.url === 'string' && /^https:\/\/script\.google(usercontent)?\.com\//.test(s.url.trim())) out.url = s.url.trim();
      else if (s.url === '') out.url = '';
      if (typeof s.token === 'string' && s.token.length <= 128) out.token = s.token.trim();
      if (typeof s.learner === 'string' && s.learner.length <= 40) out.learner = s.learner.trim();
      return out;
    }
    function notify() { listeners.forEach(fn => { try { fn(status()); } catch (e) { /* ignore listener errors */ } }); }
    function status() { return { enabled: active(), pending: queue.length, lastError, settings: { ...settings } }; }
    function active() { return settings.enabled && !!settings.url; }

    function localDate(ts) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

    function track(type, data) {
      if (!settings.enabled) return null;           // 家長沒開啟就完全不留痕跡
      const at = now();
      const event = { id: `${at.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, type, app, learner: settings.learner, at, date: localDate(at), ...data };
      queue.push(event);
      if (queue.length > QUEUE_LIMIT) queue.splice(0, queue.length - QUEUE_LIMIT);
      write('queue', queue); notify();
      flush();
      return event;
    }

    async function flush(opts) {
      if (sending || !active() || !queue.length || !fetchFn || !isOnline()) return false;
      sending = true;
      const batch = queue.slice(0, BATCH);
      try {
        // no-cors：Apps Script 會 302 轉址，一般 CORS 請求會被擋；no-cors + text/plain 可送達，只是讀不到回應。
        await fetchFn(settings.url, { method: 'POST', mode: 'no-cors', keepalive: !!(opts && opts.keepalive), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: settings.token, events: batch }) });
        queue = queue.filter(e => !batch.includes(e)); write('queue', queue); lastError = '';
      } catch (e) { lastError = (e && e.message) || String(e); }
      sending = false; notify();
      if (!lastError && queue.length) return flush(opts);
      return !lastError;
    }

    // 測試連線：用 JSONP 呼叫 doGet(callback=...)，可以真的讀到回應。
    function test() {
      return new Promise(resolve => {
        if (!settings.url) return resolve({ ok: false, error: '尚未填寫紀錄網址' });
        if (!doc) return resolve({ ok: false, error: '此環境無法測試' });
        const name = `__tracker_cb_${Date.now().toString(36)}`;
        const script = doc.createElement('script');
        const done = result => { clearTimeout(timer); delete root[name]; if (script.parentNode) script.parentNode.removeChild(script); resolve(result); };
        const timer = setTimeout(() => done({ ok: false, error: '沒有回應，請確認網址與部署權限（任何人可存取）' }), PING_TIMEOUT);
        root[name] = result => done(result && typeof result === 'object' ? result : { ok: false, error: '回應格式不正確' });
        script.onerror = () => done({ ok: false, error: '無法連線到紀錄網址' });
        const sep = settings.url.includes('?') ? '&' : '?';
        script.src = `${settings.url}${sep}token=${encodeURIComponent(settings.token)}&app=${encodeURIComponent(app)}&callback=${name}`;
        (doc.head || doc.documentElement).appendChild(script);
      });
    }

    function configure(next) { settings = { ...settings, ...sanitize(next || {}) }; write('settings', settings); notify(); if (active()) flush(); return { ...settings }; }
    function clear() { queue = []; write('queue', queue); notify(); }
    function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    if (root.addEventListener) {
      root.addEventListener('online', () => flush());
      root.addEventListener('pagehide', () => flush({ keepalive: true }));
    }
    flush();
    return { track, flush, test, configure, clear, status, onChange, settings: () => ({ ...settings }), queue: () => queue.slice() };
  }

  const api = { create, DEFAULT_SETTINGS, QUEUE_LIMIT, BATCH };
  root.GardenTracker = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
