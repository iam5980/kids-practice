/* =====================================================================
   study-kit.js — read-aloud, level map and 素養題組 for any practice app
   Canonical copy: github.com/iam5980/kids-practice/template/study-kit.js
   Version: 2026-10-25

   HOW TO USE: paste the whole file inside the page's main <script> (before
   the app code). Works for 中文部 apps and English apps alike. Call
   KidKit.injectCSS() once. Points/badges are reported to SitePoints
   (from site-home.js) automatically when it is on the page.

   1) READ-ALOUD
      KidKit.say(text, {lang: "zh-TW" | "en-US", rate, math: true})
      KidKit.sayBtn(text, label, opts)  -> HTML string for a 🔊 button
        Clicks are handled by one delegated listener (no inline onclick).
        math: true turns 6 1/2 → 6又2分之1, 13/2 → 2分之13, × → 乘 …
        Put the definition's 🔊 INSIDE the element that "考自己" covers,
        so it cannot be heard before the answer is revealed.

   2) LEVEL MAP (闖關地圖) — one level per lesson/unit, 1–3 stars, never locked
      var map = KidKit.levelMap(container, {
          key: "au-zh-science-1151-mid",          // unique per app
          levels: [{id: "L1", name: "第 1 課 …"}, …, {id: "LIT", name: "素養題組"}],
          lang: "zh-TW",
          onPlay: function (id) { … start that level … } });
      KidKit.levelResult(key, id, pct)   -> stars earned (call when a level ends)
      Stars: ≥90% ★★★, ≥70% ★★, ≥40% ★, else 0. Best result is kept.

   3) 素養題組 (reading-heavy question sets)
      KidKit.passageSet(container, {
          title: "颱風來了",
          source: "teacher" | "self",               // self → 「自編」 label
          passage: "長文…（可含 <b>、<br>、<img>）",
          figure: "data:image/…",                    // optional
          lang: "zh-TW",
          questions: [
            {type: "mc",    q: "…", choices: ["對的", "錯1", "錯2"], exp: "…"},  // first choice = correct
            {type: "tf",    q: "…", answer: true, exp: "…"},
            {type: "multi", q: "…（選出兩個）", choices: [...], correct: [0, 2], exp: "…"},
            {type: "order", q: "…", items: ["第1步", "第2步", "第3步"], exp: "…"},       // items in correct order
            {type: "open",  q: "…", a: "參考答案", points: [["蒸發"], ["凝結", "變成水滴"]], need: 2}
          ]}, {onDone: function (r) { … r = {correct, total, allOk} … }});
      Passage stays one tap away (📖 看文章), can be read aloud, questions are
      judged one by one, choices are shuffled, and the set reports to
      SitePoints.literacy() when finished.
   ===================================================================== */
var KidKit = (function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function sp(name) { return window.SitePoints && window.SitePoints[name] ? window.SitePoints : null; }

  /* ---------- read-aloud ---------- */
  var voices = [];
  function loadVoices() { try { voices = speechSynthesis.getVoices() || []; } catch (e) {} }
  if (window.speechSynthesis) {
    loadVoices();
    try { speechSynthesis.addEventListener("voiceschanged", loadVoices); } catch (e) { speechSynthesis.onvoiceschanged = loadVoices; }
  }
  function pickVoice(lang) {
    var v = voices.length ? voices : (window.speechSynthesis ? speechSynthesis.getVoices() : []);
    var tests = lang.indexOf("zh") === 0
      ? [/zh[-_]TW/i, /zh[-_](HK|Hant)/i, /^(zh|cmn)/i]
      : [/^Samantha$/, /^Karen$/, /Google US English/, /en[-_]US/i, /^en/i];
    for (var t = 0; t < tests.length; t++) for (var i = 0; i < v.length; i++) {
      if (tests[t].test(lang.indexOf("zh") === 0 ? v[i].lang : (t < 3 ? v[i].name : v[i].lang))) return v[i];
    }
    return null;
  }
  function plain(html) { var d = document.createElement("div"); d.innerHTML = String(html); return (d.textContent || "").replace(/\s+/g, " ").trim(); }
  function mathSpeech(s) {
    return s
      .replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/g, "$1又$3分之$2")
      .replace(/(\d+)\s*\/\s*(\d+)/g, "$2分之$1")
      .replace(/[×xX＊*](?=\s*\d)/g, "乘").replace(/[÷]/g, "除以")
      .replace(/[＋+]/g, "加").replace(/(\d)\s*[－-]\s*(\d)/g, "$1減$2")
      .replace(/[＝=]/g, "等於").replace(/[→⇒]/g, "，變成").replace(/＞|>/g, "大於").replace(/＜|</g, "小於")
      .replace(/≒/g, "約等於").replace(/（例/g, "（例如");
  }
  function say(text, o) {
    o = o || {};
    var lang = o.lang || "zh-TW";
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") { hint("這個瀏覽器不支援朗讀，請改用 Safari 或 Chrome。"); return; }
    var t = plain(text);
    if (o.math) t = mathSpeech(t);
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(t);
      u.lang = lang; u.rate = o.rate || (lang.indexOf("zh") === 0 ? 0.85 : 0.88);
      var v = pickVoice(lang); if (v) u.voice = v;
      say._u = u;
      speechSynthesis.speak(u);
      if (!v && lang.indexOf("zh") === 0) hint("找不到中文語音，聲音可能不正確。可在 iPad 設定裡加裝「中文（台灣）」語音。");
    } catch (e) { hint("朗讀失敗，請再按一次。"); }
  }
  function hint(msg) {
    var t = document.getElementById("kk-hint");
    if (!t) { t = el("div"); t.id = "kk-hint"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.className = "kk-hint kk-show";
    clearTimeout(hint._t); hint._t = setTimeout(function () { t.className = "kk-hint"; }, 3200);
  }
  function sayBtn(text, label, o) {
    o = o || {};
    return '<button type="button" class="kk-say" data-kk-say="' + esc(plain(text)) + '"' +
      (o.lang ? ' data-kk-lang="' + esc(o.lang) + '"' : "") + (o.math ? ' data-kk-math="1"' : "") +
      ' aria-label="' + esc((label || "朗讀") + "：" + plain(text).slice(0, 40)) + '">🔊' + (label ? " " + esc(label) : "") + "</button>";
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-kk-say]");
    if (!b) return;
    e.stopPropagation(); e.preventDefault();
    say(b.getAttribute("data-kk-say"), { lang: b.getAttribute("data-kk-lang") || "zh-TW", math: b.hasAttribute("data-kk-math") });
  }, true);

  /* ---------- level map ---------- */
  function lvLoad(key) { try { return JSON.parse(localStorage.getItem("kk-lv-" + key) || "{}"); } catch (e) { return {}; } }
  function starsFor(pct) { return pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0; }
  function levelResult(key, id, pct) {
    var d = lvLoad(key), s = starsFor(pct);
    if (!d[id] || s > d[id]) { d[id] = s; try { localStorage.setItem("kk-lv-" + key, JSON.stringify(d)); } catch (e) {} }
    var p = sp("roundEnd"); if (p) p.roundEnd(pct);
    return s;
  }
  function levelMap(container, o) {
    var zh = (o.lang || "zh-TW").indexOf("zh") === 0;
    function draw() {
      var d = lvLoad(o.key), total = 0;
      var h = '<div class="kk-map">';
      o.levels.forEach(function (lv, i) {
        var s = d[lv.id] || 0; total += s;
        h += '<button type="button" class="kk-lv' + (s === 3 ? " kk-full" : "") + '" data-lv="' + esc(lv.id) + '">' +
          '<span class="kk-no">' + (lv.icon || (i + 1)) + '</span><span class="kk-name">' + esc(lv.name) + "</span>" +
          '<span class="kk-stars" aria-label="' + s + ' stars">' + "★★★".slice(0, s) + '<i>' + "☆☆☆".slice(0, 3 - s) + "</i></span></button>";
      });
      h += "</div>";
      var max = o.levels.length * 3;
      h = '<div class="kk-maphead">' + (zh ? "🗺️ 闖關地圖" : "🗺️ Level map") + ' <span>⭐ ' + total + " / " + max + "</span></div>" +
        '<p class="kk-maptip">' + (zh ? "每一關都可以直接玩。答對 90% 以上拿 3 顆星！" : "Play any level. Get 90%+ for 3 stars!") + "</p>" + h;
      container.innerHTML = h;
      Array.prototype.forEach.call(container.querySelectorAll(".kk-lv"), function (b) {
        b.addEventListener("click", function () { if (o.onPlay) o.onPlay(b.getAttribute("data-lv")); });
      });
    }
    draw();
    return { refresh: draw };
  }

  /* ---------- 素養題組 ---------- */
  function normZh(s) { return String(s || "").toLowerCase().replace(/[\s，。、！？；：「」『』（）()．.,!?;:"'—-]/g, ""); }
  function passageSet(container, spec, o) {
    o = o || {};
    var lang = spec.lang || "zh-TW", zh = lang.indexOf("zh") === 0;
    var T = zh ? { read: "📖 看文章", hide: "收起文章", listen: "🔊 朗讀文章", check: "✔ 對答案", next: "下一題 ▶", done: "完成題組 🏁",
                   ok: "答對了！", no: "再想想，答案是：", q: "第 {n} 題 / 共 {t} 題", self: "自編", teacher: "老師的題目",
                   res: "題組完成：{c} / {t} 題答對", all: "全部答對！素養題達人 🧩", again: "🔄 再做一次", tip: "先讀完文章再作答，作答時可以隨時點「📖 看文章」。",
                   order: "依照順序點選", pick2: "（可以選多個）", say: "🎤 用說的", typ: "或在這裡打字…" }
               : { read: "📖 Read the passage", hide: "Hide passage", listen: "🔊 Read aloud", check: "✔ Check", next: "Next ▶", done: "Finish set 🏁",
                   ok: "Correct!", no: "Not quite. The answer is:", q: "Question {n} of {t}", self: "Practice set", teacher: "Teacher's question",
                   res: "Set finished: {c} / {t} correct", all: "All correct! 🧩", again: "🔄 Try again", tip: "Read the passage first. Tap 📖 any time to look back.",
                   order: "Tap in order", pick2: "(choose all that apply)", say: "🎤 Speak", typ: "or type here…" };
    var qs = spec.questions, i = 0, correct = 0;
    container.innerHTML = "";
    var box = el("div", "kk-set");
    box.appendChild(el("div", "kk-sethead", '<span class="kk-tag' + (spec.source === "self" ? " kk-self" : "") + '">' +
      (spec.source === "self" ? T.self : T.teacher) + "</span> <b>" + esc(spec.title || "") + "</b>"));
    var pas = el("div", "kk-passage");
    pas.innerHTML = (spec.figure ? '<img src="' + esc(spec.figure) + '" alt="">' : "") + '<div class="kk-ptext">' + spec.passage + "</div>";
    var bar = el("div", "kk-pbar");
    var toggle = el("button", "kk-btn kk-ghost", T.hide); toggle.type = "button";
    var listen = el("button", "kk-btn kk-ghost", T.listen); listen.type = "button";
    listen.addEventListener("click", function () { say(spec.passage, { lang: lang, math: !!spec.math }); });
    toggle.addEventListener("click", function () {
      var open = pas.classList.toggle("kk-closed") === false;
      toggle.textContent = open ? T.hide : T.read;
      if (open) pas.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    bar.appendChild(toggle); bar.appendChild(listen);
    box.appendChild(el("p", "kk-maptip", T.tip));
    box.appendChild(pas); box.appendChild(bar);
    var qbox = el("div", "kk-qbox"); box.appendChild(qbox);
    container.appendChild(box);

    function finishQ(ok, answerHtml, exp, showAlways) {
      if (ok) correct++;
      var p = sp("answer"); if (p) p.answer(ok);
      var f = el("div", "kk-fb " + (ok ? "kk-ok" : "kk-bad"),
        ok ? "✓ " + T.ok + (showAlways ? '<div class="kk-ans">' + answerHtml + "</div>" : "") : "✗ " + T.no + '<div class="kk-ans">' + answerHtml + "</div>");
      if (exp) f.appendChild(el("div", "kk-exp", esc(exp)));
      qbox.appendChild(f);
      var last = i === qs.length - 1;
      var nb = el("button", "kk-btn kk-primary", last ? T.done : T.next); nb.type = "button";
      nb.addEventListener("click", function () { if (last) done(); else { i++; show(); } });
      qbox.appendChild(nb);
    }
    function show() {
      var q = qs[i]; qbox.innerHTML = "";
      qbox.appendChild(el("div", "kk-qno", T.q.replace("{n}", i + 1).replace("{t}", qs.length)));
      qbox.appendChild(el("div", "kk-q", esc(q.q) + " " + sayBtn(q.q, "", { lang: lang, math: !!spec.math }) +
        (q.type === "multi" ? ' <small>' + T.pick2 + "</small>" : "")));
      var area = el("div", "kk-area"); qbox.appendChild(area);
      if (q.type === "mc" || q.type === "tf") {
        var opts = q.type === "tf" ? [zh ? "⭕ 對" : "TRUE", zh ? "❌ 錯" : "FALSE"] : shuffle(q.choices);
        var right = q.type === "tf" ? (q.answer ? 0 : 1) : opts.indexOf(q.choices[0]);
        var used = false;
        opts.forEach(function (c, k) {
          var b = el("button", "kk-opt", (q.type === "tf" ? "" : "ABCD"[k] + ". ") + esc(c)); b.type = "button";
          b.addEventListener("click", function () {
            if (used) return; used = true;
            b.classList.add(k === right ? "kk-right" : "kk-wrong");
            area.children[right].classList.add("kk-right");
            finishQ(k === right, esc(opts[right]), q.exp);
          });
          area.appendChild(b);
        });
      } else if (q.type === "multi") {
        var ord = shuffle(q.choices.map(function (c, k) { return k; })), sel = [];
        var chk = el("button", "kk-btn kk-primary", T.check); chk.type = "button"; chk.disabled = true;
        ord.forEach(function (orig) {
          var b = el("button", "kk-opt", esc(q.choices[orig])); b.type = "button";
          b.addEventListener("click", function () {
            if (chk.hidden) return;
            var at = sel.indexOf(orig);
            if (at < 0) sel.push(orig); else sel.splice(at, 1);
            b.classList.toggle("kk-sel"); chk.disabled = !sel.length;
          });
          area.appendChild(b);
        });
        chk.addEventListener("click", function () {
          chk.hidden = true;
          var want = q.correct.slice().sort().join(), got = sel.slice().sort().join();
          Array.prototype.forEach.call(area.children, function (b, k) {
            if (q.correct.indexOf(ord[k]) >= 0) b.classList.add("kk-right"); else if (sel.indexOf(ord[k]) >= 0) b.classList.add("kk-wrong");
          });
          finishQ(want === got, q.correct.map(function (k) { return esc(q.choices[k]); }).join("、"), q.exp);
        });
        qbox.appendChild(chk);
      } else if (q.type === "order") {
        var src = shuffle(q.items), ans = [];
        if (src.join("|") === q.items.join("|") && q.items.length > 1) src.push(src.shift());
        var line = el("div", "kk-tiles kk-line"), pool = el("div", "kk-tiles");
        var c2 = el("button", "kk-btn kk-primary", T.check); c2.type = "button";
        function draw() {
          line.innerHTML = ans.length ? "" : '<span class="kk-ph">' + T.order + "</span>"; pool.innerHTML = "";
          ans.forEach(function (t, k) { var b = el("button", "kk-tile kk-in", (k + 1) + ". " + esc(t)); b.type = "button";
            b.addEventListener("click", function () { if (c2.hidden) return; src.push(ans.splice(k, 1)[0]); draw(); }); line.appendChild(b); });
          src.forEach(function (t, k) { var b = el("button", "kk-tile", esc(t)); b.type = "button";
            b.addEventListener("click", function () { if (c2.hidden) return; ans.push(src.splice(k, 1)[0]); draw(); }); pool.appendChild(b); });
          c2.disabled = src.length > 0;
        }
        c2.addEventListener("click", function () { c2.hidden = true; finishQ(ans.join("|") === q.items.join("|"), q.items.map(esc).join(" → "), q.exp); });
        area.appendChild(line); area.appendChild(pool); qbox.appendChild(c2); draw();
      } else if (q.type === "open") {
        var ta = el("textarea", "kk-input"); ta.placeholder = T.typ;
        var row = el("div", "kk-row");
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        var mic = el("button", "kk-btn kk-ghost", T.say); mic.type = "button";
        if (!SR) mic.hidden = true;
        mic.addEventListener("click", function () {
          try { var r = new SR(); r.lang = lang; r.interimResults = true;
            var base = ta.value ? ta.value + " " : "";
            r.onresult = function (e) { var s = ""; for (var k = 0; k < e.results.length; k++) s += e.results[k][0].transcript; ta.value = base + s; c3.disabled = !ta.value.trim(); };
            r.start(); mic.textContent = "● …"; r.onend = function () { mic.textContent = T.say; };
          } catch (e) { mic.hidden = true; }
        });
        var c3 = el("button", "kk-btn kk-primary", T.check); c3.type = "button"; c3.disabled = true;
        ta.addEventListener("input", function () { c3.disabled = !ta.value.trim(); });
        c3.addEventListener("click", function () {
          c3.hidden = true; mic.hidden = true; ta.disabled = true;
          var pts = q.points || [], txt = normZh(ta.value), hits = 0, list = [];
          pts.forEach(function (alts) {
            var hit = alts.some(function (a) { return txt.indexOf(normZh(a)) >= 0; });
            if (hit) hits++; list.push((hit ? "✓ " : "✗ ") + esc(alts[0]));
          });
          var need = q.need || (pts.length <= 2 ? pts.length : Math.ceil(pts.length * 0.7));
          finishQ(pts.length ? hits >= need : false, (zh ? "參考答案：" : "Model answer: ") + esc(q.a) + '<div class="kk-exp">' + list.join("　") + "</div>", q.exp, true);
        });
        area.appendChild(ta); row.appendChild(mic); row.appendChild(c3); qbox.appendChild(row);
      }
      qbox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    function done() {
      var allOk = correct === qs.length;
      qbox.innerHTML = '<div class="kk-result"><div class="kk-big">' + T.res.replace("{c}", correct).replace("{t}", qs.length) + "</div>" +
        (allOk ? "<div>" + T.all + "</div>" : "") + "</div>";
      var again = el("button", "kk-btn kk-primary", T.again); again.type = "button";
      again.addEventListener("click", function () { passageSet(container, spec, o); });
      qbox.appendChild(again);
      var p = sp("literacy"); if (p) p.literacy(allOk);
      if (o.onDone) o.onDone({ correct: correct, total: qs.length, allOk: allOk });
    }
    show();
  }

  /* ---------- styles ---------- */
  function injectCSS() {
    if (document.getElementById("kk-css")) return;
    var s = document.createElement("style"); s.id = "kk-css";
    s.textContent =
      ".kk-say{font:inherit;font-size:14px;line-height:1;min-height:34px;padding:6px 10px;margin:2px 4px;border-radius:999px;border:1.5px solid currentColor;background:transparent;color:inherit;cursor:pointer;opacity:.85;vertical-align:middle;touch-action:manipulation}" +
      ".kk-hint{position:fixed;left:50%;bottom:calc(70px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#1f2937;color:#fff;padding:10px 14px;border-radius:12px;font-size:14px;z-index:9003;opacity:0;pointer-events:none;transition:opacity .3s;max-width:90vw}" +
      ".kk-hint.kk-show{opacity:.95}" +
      ".kk-maphead{font-size:20px;font-weight:800;display:flex;justify-content:space-between;align-items:center}.kk-maphead span{font-size:16px}" +
      ".kk-maptip{opacity:.75;font-size:14px;margin:4px 0 10px}" +
      ".kk-map{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}" +
      ".kk-lv{font:inherit;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:12px;border-radius:14px;border:2px solid rgba(127,127,127,.35);background:transparent;color:inherit;cursor:pointer;text-align:left;min-height:96px;touch-action:manipulation}" +
      ".kk-lv.kk-full{border-color:#f59e0b;background:rgba(245,158,11,.12)}" +
      ".kk-no{display:inline-grid;place-items:center;min-width:30px;height:30px;border-radius:50%;background:#0284c7;color:#fff;font-weight:800;padding:0 6px}" +
      ".kk-name{font-weight:700;font-size:15px}.kk-stars{color:#f59e0b;font-size:20px;letter-spacing:2px}.kk-stars i{font-style:normal;opacity:.35}" +
      ".kk-set{border-radius:16px}.kk-sethead{font-size:18px;margin-bottom:6px}" +
      ".kk-tag{display:inline-block;font-size:12px;padding:2px 8px;border-radius:999px;background:#16a34a;color:#fff;vertical-align:2px}.kk-tag.kk-self{background:#7c3aed}" +
      ".kk-passage{border:2px solid rgba(127,127,127,.3);border-radius:14px;padding:14px;line-height:1.9;font-size:17px;max-height:46vh;overflow:auto;background:rgba(127,127,127,.06)}" +
      ".kk-passage.kk-closed{display:none}.kk-passage img{max-width:100%;border-radius:8px;display:block;margin:0 auto 8px}" +
      ".kk-pbar{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px}" +
      ".kk-btn{font:inherit;font-size:16px;min-height:48px;padding:10px 16px;border-radius:12px;border:2px solid transparent;cursor:pointer;margin:6px 6px 0 0;touch-action:manipulation}" +
      ".kk-btn[disabled]{opacity:.45}.kk-primary{background:#0284c7;color:#fff}.kk-ghost{background:transparent;color:inherit;border-color:currentColor}" +
      ".kk-qno{font-size:13px;opacity:.7}.kk-q{font-size:18px;font-weight:700;margin:4px 0 10px;line-height:1.6}" +
      ".kk-opt{font:inherit;display:block;width:100%;text-align:left;min-height:50px;padding:10px 14px;margin:6px 0;border-radius:12px;border:2px solid rgba(127,127,127,.45);background:transparent;color:inherit;cursor:pointer;touch-action:manipulation}" +
      ".kk-opt.kk-sel{border-color:#0284c7;background:rgba(2,132,199,.12)}.kk-opt.kk-right{border-color:#16a34a;background:rgba(22,163,74,.15)}.kk-opt.kk-wrong{border-color:#dc2626;background:rgba(220,38,38,.12)}" +
      ".kk-tiles{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.kk-line{min-height:58px;padding:6px;border:2px dashed rgba(127,127,127,.5);border-radius:12px;align-items:center}" +
      ".kk-ph{opacity:.55;padding:0 6px}.kk-tile{font:inherit;min-height:48px;padding:8px 12px;border-radius:12px;border:2px solid #0284c7;background:transparent;color:inherit;cursor:pointer}.kk-tile.kk-in{background:#0284c7;color:#fff}" +
      ".kk-input{font:inherit;font-size:17px;width:100%;min-height:90px;padding:10px;border-radius:12px;border:2px solid rgba(127,127,127,.5);background:transparent;color:inherit}" +
      ".kk-row{display:flex;flex-wrap:wrap;align-items:center}" +
      ".kk-fb{margin-top:10px;padding:10px 14px;border-radius:12px;font-weight:700}.kk-ok{background:rgba(22,163,74,.15);color:#15803d}.kk-bad{background:rgba(245,158,11,.18)}" +
      ".kk-ans{font-size:17px;margin-top:4px}.kk-exp{font-weight:400;margin-top:6px;opacity:.9}" +
      ".kk-result{text-align:center;padding:14px}.kk-big{font-size:22px;font-weight:800;margin-bottom:6px}";
    document.head.appendChild(s);
  }
  return { say: say, sayBtn: sayBtn, mathSpeech: mathSpeech, levelMap: levelMap, levelResult: levelResult,
           starsFor: starsFor, passageSet: passageSet, injectCSS: injectCSS, esc: esc, VERSION: "2026-10-25" };
})();
