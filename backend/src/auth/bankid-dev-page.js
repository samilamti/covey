/**
 * Dev-only BankID validation page (served at GET /api/auth/bankid/dev).
 *
 * Drives the real v6 Secure Start flow so you can validate the integration
 * against the free test environment by scanning with a test BankID — without
 * rebuilding the production login UX. Same-origin fetches to /api/auth/*.
 *
 * The QR is rendered via an external image service (allow-listed in the route's
 * relaxed CSP) to avoid bundling a QR library into the backend. Inline script is
 * fine here: this response is dev-only and never served in production.
 */

export function devLoginPage() {
  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<title>BankID test — Covey</title>
<style>
  :root { --ink:#1F2A37; --paper:#FBF7F1; --accent:#E89B6F; --ok:#2f7a4f; --err:#a4453b; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, Inter, system-ui, sans-serif;
         background: var(--paper); color: var(--ink); display:flex; min-height:100vh;
         align-items:flex-start; justify-content:center; padding: 24px; }
  .card { width:100%; max-width: 420px; background:#fff; border:1px solid #eadfce;
          border-radius:16px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,.05); }
  h1 { font-size:18px; margin:0 0 4px; }
  .sub { color:#6b7280; font-size:13px; margin:0 0 20px; }
  .env { font-size:11px; color:#9aa3af; word-break:break-all; margin-bottom:16px; }
  .qrwrap { text-align:center; min-height:248px; display:flex; align-items:center;
            justify-content:center; flex-direction:column; gap:10px; }
  #qr { width:240px; height:240px; border-radius:12px; background:#f4f4f4; }
  .btn { display:inline-block; width:100%; text-align:center; padding:13px 16px;
         border-radius:12px; border:0; font-size:15px; font-weight:600; cursor:pointer;
         text-decoration:none; }
  .btn-primary { background: var(--accent); color:#fff; }
  .btn-ghost { background:#f1efe9; color:var(--ink); margin-top:10px; }
  .status { margin-top:16px; padding:12px 14px; border-radius:10px; font-size:14px;
            background:#f4f4f4; }
  .status.ok { background:#e7f3ec; color:var(--ok); }
  .status.err { background:#f6e7e5; color:var(--err); }
  .result { margin-top:14px; font-size:13px; }
  .result b { display:block; font-size:15px; }
  code { font-size:11px; word-break:break-all; color:#6b7280; }
  .hint { font-size:12px; color:#9aa3af; margin-top:8px; text-align:center; }
</style>
</head>
<body>
  <div class="card">
    <h1>BankID — testinloggning</h1>
    <p class="sub">Secure Start mot BankID:s testmiljö. Skanna med en test-BankID, eller öppna på samma enhet.</p>
    <div class="env" id="env">laddar…</div>

    <div class="qrwrap" id="qrwrap">
      <img id="qr" alt="QR-kod för BankID" />
      <div class="hint">QR uppdateras varje sekund</div>
    </div>

    <a class="btn btn-primary" id="autostart" href="#" style="display:none">Öppna BankID på den här enheten</a>
    <button class="btn btn-ghost" id="restart">Avbryt / börja om</button>

    <div class="status" id="status">Startar…</div>
    <div class="result" id="result"></div>
  </div>

<script>
(function () {
  var qrImg = document.getElementById('qr');
  var qrwrap = document.getElementById('qrwrap');
  var autostartBtn = document.getElementById('autostart');
  var statusEl = document.getElementById('status');
  var resultEl = document.getElementById('result');
  var envEl = document.getElementById('env');
  var restartBtn = document.getElementById('restart');

  var orderRef = null;
  var qrTimer = null;
  var collectTimer = null;

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
  }

  function stopTimers() {
    if (qrTimer) { clearInterval(qrTimer); qrTimer = null; }
    if (collectTimer) { clearInterval(collectTimer); collectTimer = null; }
  }

  function post(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json(); });
  }

  function refreshQr() {
    post('/api/auth/qr', { orderRef: orderRef }).then(function (d) {
      if (d && d.qr) {
        qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=' + encodeURIComponent(d.qr);
      }
    }).catch(function () {});
  }

  function poll() {
    post('/api/auth/collect', { orderRef: orderRef }).then(function (d) {
      if (!d) return;
      if (d.status === 'complete' && d.completionData) {
        stopTimers();
        qrwrap.style.display = 'none';
        autostartBtn.style.display = 'none';
        setStatus('Klart — verifierad med BankID', 'ok');
        var u = d.completionData.user || {};
        var tok = d.completionData.token || '';
        resultEl.innerHTML =
          '<b>' + (u.name || '') + '</b>' +
          'userId: <code>' + (u.userId || '') + '</code><br/>' +
          'JWT: <code>' + (tok ? tok.slice(0, 24) + '… (' + tok.length + ' tecken)' : '—') + '</code>';
        return;
      }
      if (d.status === 'failed') {
        stopTimers();
        setStatus('Misslyckades: ' + (d.hintCode || 'okänt fel'), 'err');
        return;
      }
      // pending
      setStatus('Väntar på BankID… (' + (d.hintCode || 'pending') + ')');
    }).catch(function () {
      setStatus('Nätverksfel vid pollning', 'err');
    });
  }

  function start() {
    stopTimers();
    resultEl.innerHTML = '';
    qrwrap.style.display = 'flex';
    qrImg.removeAttribute('src');
    setStatus('Startar BankID-order…');
    post('/api/auth/login', {}).then(function (d) {
      if (!d || !d.orderRef) {
        setStatus('Kunde inte starta. Är AUTH_PROVIDER=bankid och certifikaten på plats?', 'err');
        return;
      }
      orderRef = d.orderRef;
      if (d.autoStartToken) {
        autostartBtn.href = 'bankid:///?autostarttoken=' + d.autoStartToken + '&redirect=null';
        autostartBtn.style.display = 'block';
      }
      setStatus('Skanna QR-koden, eller öppna BankID på den här enheten.');
      refreshQr();
      qrTimer = setInterval(refreshQr, 1000);
      collectTimer = setInterval(poll, 2000);
    }).catch(function () {
      setStatus('Nätverksfel vid start', 'err');
    });
  }

  restartBtn.addEventListener('click', function () {
    if (orderRef) { post('/api/auth/cancel', { orderRef: orderRef }).catch(function () {}); }
    start();
  });

  // Show which environment we're pointed at (informational).
  fetch('/api/features').then(function (r) { return r.json(); }).then(function () {
    envEl.textContent = 'Miljö: ' + location.origin + ' → BankID testmiljö (Secure Start)';
  }).catch(function () { envEl.textContent = ''; });

  start();
})();
</script>
</body>
</html>`
}
