/* =====================================================================
   site-home.js — 📚 小站 button + 全站集點 (site-wide points & badges)
   Canonical copy: github.com/iam5980/kids-practice/template/site-home.js
   Version: 2026-10-25

   HOW TO USE: paste this whole file in its own <script> block just before
   </body> of EVERY page published to kids-practice (English and 中文部,
   apps, oral pages, listening players). Nothing else is required.

   1) "📚 小站" pill, bottom-left → in-page confirm card → site home.
   2) SitePoints — points and badges per kid, shared by every app on the
      site (same origin), shown on the home page 集點卡. Kept only on
      this device (localStorage).
        SitePoints.answer(ok)       after every judged answer
        SitePoints.roundEnd(pct)    when a round / drill ends (0–100)
        SitePoints.literacy(allOk)  when a 素養題組 is finished
      Points: correct +10, streak bonus +2 per answer in a row (max +10).
      No speed bonus — accuracy only.
   3) Auto-hooks, so older apps need no code changes:
        中文部 engine:  rtAns(right) → answer;  celebrate() → perfect round
        AppCore apps:   AppCore calls SitePoints itself (app-core ≥ 2026-10-25)
   ===================================================================== */
(function () {
  "use strict";
  if (window.__siteHome) return;
  window.__siteHome = true;
  var LIVE = "https://iam5980.github.io/kids-practice/";
  function homeUrl() {
    var p = location.pathname, i = p.indexOf("/kids-practice/");
    if (location.protocol.indexOf("http") === 0 && i >= 0) return location.origin + p.slice(0, i) + "/kids-practice/";
    return LIVE;
  }

  /* ---------------- SitePoints ---------------- */
  var BADGES = [
    { id: "first",   icon: "🌱", name: "第一次答對" },
    { id: "perfect", icon: "💯", name: "第一次滿分" },
    { id: "streak10",icon: "🔥", name: "連對 10 題" },
    { id: "streak20",icon: "🚀", name: "連對 20 題" },
    { id: "days3",   icon: "📅", name: "連續練習 3 天" },
    { id: "days7",   icon: "🗓️", name: "連續練習 7 天" },
    { id: "lit1",    icon: "🧩", name: "第一組素養題全對" },
    { id: "lit10",   icon: "🎓", name: "素養題達人（10 組全對）" },
    { id: "p500",    icon: "⭐", name: "累積 500 點" },
    { id: "p2000",   icon: "🌟", name: "累積 2000 點" },
    { id: "p5000",   icon: "🏆", name: "累積 5000 點" }
  ];
  function kidFromPath() {
    var m = location.pathname.match(/\/kids-practice\/([a-z0-9]+)\//i);
    return m && m[1] !== "template" && m[1] !== "shadowing" ? m[1] : null;
  }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function dayDiff(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }
  function load(kid) {
    var d = null;
    try { d = JSON.parse(localStorage.getItem("kp-points-" + kid) || "null"); } catch (e) {}
    return d || { points: 0, today: "", todayPts: 0, days: [], badges: {}, correct: 0, perfects: 0, lit: 0, bestStreak: 0 };
  }
  function save(kid, d) { try { localStorage.setItem("kp-points-" + kid, JSON.stringify(d)); } catch (e) {} }
  function dayStreak(days) {
    if (!days.length) return 0;
    var s = days.slice().sort(), n = 1;
    if (dayDiff(s[s.length - 1], today()) > 1) return 0;
    for (var i = s.length - 1; i > 0; i--) { if (dayDiff(s[i - 1], s[i]) === 1) n++; else break; }
    return n;
  }
  var kid = kidFromPath(), streak = 0;
  function toast(html, big) {
    var t = document.createElement("div");
    t.className = "sp-toast" + (big ? " sp-big" : "");
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("sp-out"); }, big ? 2200 : 900);
    setTimeout(function () { t.remove(); }, big ? 2700 : 1300);
  }
  function grant(d, id) {
    if (d.badges[id]) return;
    d.badges[id] = today();
    var b = BADGES.filter(function (x) { return x.id === id; })[0];
    if (b) toast("🏅 獲得徽章<br><b>" + b.icon + " " + b.name + "</b>", true);
  }
  function update(fn) {
    if (!kid) return;
    var d = load(kid), t = today();
    if (d.today !== t) { d.today = t; d.todayPts = 0; }
    if (d.days.indexOf(t) < 0) { d.days.push(t); if (d.days.length > 60) d.days = d.days.slice(-60); }
    fn(d);
    var ds = dayStreak(d.days);
    if (ds >= 3) grant(d, "days3");
    if (ds >= 7) grant(d, "days7");
    if (d.points >= 500) grant(d, "p500");
    if (d.points >= 2000) grant(d, "p2000");
    if (d.points >= 5000) grant(d, "p5000");
    save(kid, d);
  }
  var SitePoints = {
    kid: kid,
    badges: BADGES,
    read: function (k) { var d = load(k || kid); d.dayStreak = dayStreak(d.days); return d; },
    answer: function (ok) {
      update(function (d) {
        if (ok) {
          streak++;
          var pts = 10 + Math.min(10, (streak - 1) * 2);
          d.points += pts; d.todayPts += pts; d.correct++;
          d.bestStreak = Math.max(d.bestStreak, streak);
          grant(d, "first");
          if (streak >= 10) grant(d, "streak10");
          if (streak >= 20) grant(d, "streak20");
          toast("+" + pts);
        } else { streak = 0; }
      });
    },
    roundEnd: function (pct) {
      if (pct >= 100) update(function (d) { d.perfects++; grant(d, "perfect"); });
    },
    literacy: function (allOk) {
      if (allOk) update(function (d) { d.lit++; grant(d, "lit1"); if (d.lit >= 10) grant(d, "lit10"); });
    }
  };
  window.SitePoints = SitePoints;

  /* auto-hooks for the 中文部 engine (global rtAns / celebrate) */
  if (typeof window.rtAns === "function" && !window.rtAns.__sp) {
    var oAns = window.rtAns;
    window.rtAns = function (right) { try { SitePoints.answer(!!right); } catch (e) {} return oAns.apply(this, arguments); };
    window.rtAns.__sp = true;
  }
  if (typeof window.celebrate === "function" && !window.celebrate.__sp) {
    var oCel = window.celebrate;
    window.celebrate = function () { try { SitePoints.roundEnd(100); } catch (e) {} return oCel.apply(this, arguments); };
    window.celebrate.__sp = true;
  }

  /* ---------------- styles ---------------- */
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
    "body{padding-bottom:max(76px,calc(64px + env(safe-area-inset-bottom)))!important}" +
    ".sp-toast{position:fixed;left:max(84px,calc(72px + env(safe-area-inset-left)));bottom:max(18px,calc(6px + env(safe-area-inset-bottom)));z-index:9002;" +
    "background:#f59e0b;color:#1f2937;font:800 16px/1.3 -apple-system,'PingFang TC',sans-serif;padding:8px 12px;border-radius:999px;" +
    "box-shadow:0 4px 12px rgba(0,0,0,.25);pointer-events:none;transition:opacity .4s,transform .4s}" +
    ".sp-toast.sp-big{left:50%;bottom:auto;top:30%;transform:translateX(-50%);text-align:center;font-size:18px;padding:14px 22px;border-radius:18px}" +
    ".sp-toast.sp-out{opacity:0;transform:translateY(-14px)}.sp-toast.sp-big.sp-out{transform:translate(-50%,-14px)}";
  document.head.appendChild(css);

  /* ---------------- 📚 小站 button ---------------- */
  if (!document.body) return;
  var b = document.createElement("button");
  b.id = "sh-btn"; b.type = "button";
  b.setAttribute("aria-label", "回到練習小站"); b.title = "回到練習小站";
  b.textContent = "📚 小站";
  b.addEventListener("click", function () {
    if (document.getElementById("sh-mask")) return;
    var m = document.createElement("div"); m.id = "sh-mask";
    var pts = kid ? "<p>目前集點：⭐ " + load(kid).points + " 點</p>" : "";
    m.innerHTML = '<div id="sh-card" role="dialog" aria-modal="true"><h3>📚 回到練習小站？</h3>' +
      '<p>這一輪的作答不會保留（點數和最高分紀錄會留著）。</p>' + pts +
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
