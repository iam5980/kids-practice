/* =====================================================================
   site-home.js — "📚 小站" (back to 練習小站) button for every practice page
   Canonical copy: github.com/iam5980/kids-practice/template/site-home.js
   Version: 2026-10-24

   HOW TO USE: paste this whole file in its own <script> block just before
   </body> of EVERY page published to kids-practice (English and 中文部,
   apps, oral pages, listening players). No other code is needed.

   - Small "📚 小站" pill fixed at the bottom-left (safe-area aware)
   - Tap → in-page card: "回到練習小站嗎？" [回到練習小站] [繼續練習]
     (no window.confirm — it is blocked/ugly on iPad and stops speech)
   - Goes to the site root (…/kids-practice/), or the live site when the
     page is opened outside it (Artifact preview, local file)
   - Adds bottom padding so the button never hides the last line
   ===================================================================== */
(function () {
  "use strict";
  if (window.__siteHome || !document.body) return;
  window.__siteHome = true;
  var LIVE = "https://iam5980.github.io/kids-practice/";
  function homeUrl() {
    var p = location.pathname, i = p.indexOf("/kids-practice/");
    if (location.protocol.indexOf("http") === 0 && i >= 0) return location.origin + p.slice(0, i) + "/kids-practice/";
    return LIVE;
  }
  var css = document.createElement("style");
  css.textContent =
    "#sh-btn{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));z-index:9000;" +
    "height:44px;padding:0 14px 0 10px;border-radius:999px;border:2px solid rgba(255,255,255,.9);background:#334155;color:#fff;font:700 16px/1 -apple-system,'PingFang TC','Noto Sans TC',sans-serif;" +
    "box-shadow:0 4px 14px rgba(0,0,0,.28);cursor:pointer;opacity:.9;touch-action:manipulation;white-space:nowrap}" +
    "#sh-btn:active{transform:scale(.94)}" +
    "#sh-mask{position:fixed;inset:0;z-index:9001;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}" +
    "#sh-card{background:#fff;color:#0f172a;border-radius:18px;padding:20px 18px;max-width:340px;width:100%;text-align:center;" +
    "font:17px/1.5 -apple-system,'PingFang TC','Noto Sans TC',sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3)}" +
    "#sh-card h3{margin:0 0 6px;font-size:20px}#sh-card p{margin:0 0 16px;color:#475569;font-size:15px}" +
    "#sh-card button{font:inherit;min-height:48px;border-radius:12px;border:0;padding:10px 16px;margin:4px;cursor:pointer}" +
    "#sh-go{background:#0284c7;color:#fff;font-weight:700}#sh-stay{background:#e2e8f0;color:#0f172a}" +
    "@media (prefers-color-scheme:dark){#sh-card{background:#1e293b;color:#e2e8f0}#sh-card p{color:#94a3b8}#sh-stay{background:#334155;color:#e2e8f0}}" +
    "body{padding-bottom:max(76px,calc(64px + env(safe-area-inset-bottom)))!important}";
  document.head.appendChild(css);

  var b = document.createElement("button");
  b.id = "sh-btn"; b.type = "button";
  b.setAttribute("aria-label", "回到練習小站"); b.title = "回到練習小站";
  b.textContent = "📚 小站";
  b.addEventListener("click", function () {
    if (document.getElementById("sh-mask")) return;
    var m = document.createElement("div"); m.id = "sh-mask";
    m.innerHTML = '<div id="sh-card" role="dialog" aria-modal="true"><h3>📚 回到練習小站？</h3>' +
      '<p>這一輪的作答不會保留（最高分紀錄會留著）。</p>' +
      '<button id="sh-go" type="button">回到練習小站</button><button id="sh-stay" type="button">繼續練習</button></div>';
    document.body.appendChild(m);
    function close() { m.remove(); }
    m.addEventListener("click", function (e) { if (e.target === m) close(); });
    document.getElementById("sh-stay").addEventListener("click", close);
    document.getElementById("sh-go").addEventListener("click", function () {
      try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
      location.href = homeUrl();
    });
    document.getElementById("sh-go").focus();
  });
  document.body.appendChild(b);
})();
