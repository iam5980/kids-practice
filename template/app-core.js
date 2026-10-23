/* =====================================================================
   app-core.js — shared core for the kids' exam-practice apps
   Canonical copy: github.com/iam5980/kids-practice/template/app-core.js
   Version: 2026-10-23

   HOW TO USE (for the Reading / Science / Grammar skills)
   - Paste this whole file INSIDE the app's single <script> block, before
     the app's own code. Do NOT link it with <script src>. Each app stays
     one self-contained HTML file (offline, Artifact preview, no shared
     breakage).
   - Call AppCore.injectCSS() once at start-up.
   - Use these helpers instead of writing your own versions.
   - Wire buttons with addEventListener or AppCore.btn(). Do NOT build
     inline onclick="..." strings with escaped double quotes (iPad Safari
     fails to parse them).

   WHAT IS IN HERE (each part was fixed after a real bug on iPad)
     shuffle(arr)              Fisher-Yates, returns a NEW array
     speak(text, opts)         best English voice, rate .88, onDone callback
     stopSpeech()              cancel TTS
     dealer()                  MC answer positions evenly spread A/B/C/D,
                               never 3 in a row
     stars(pct) / result(log)  scoring + 1-5 stars
     drillBar(opts)            sticky bar: Back + Finish & Score
     resultView(log, opts)     score screen, wrong answers first, Try Again
     recorder(opts)            iOS-safe recording + playback
     oralCard(el, q, opts)     record-first, reveal-later oral flow
     WEBVIEW_NOTICE            "open in Safari/Chrome" notice HTML
   ===================================================================== */
var AppCore = (function () {
  "use strict";

  /* ---------- small DOM helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function btn(label, cls, onClick) {
    var b = el("button", "ac-btn " + (cls || ""), label);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  /* ---------- shuffle: always returns a new array ---------- */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- TTS ----------
     speak(text)                         default rate 0.88
     speak(text, {rate: 0.7})
     speak(text, {onDone: function(){}}) onDone fires on end OR error
     The 2nd argument is ALWAYS an options object (a past bug passed a
     callback where a number was expected and the button got stuck). */
  var _voices = [];
  function loadVoices() {
    if (window.speechSynthesis) _voices = window.speechSynthesis.getVoices() || [];
  }
  if (window.speechSynthesis) {
    loadVoices();
    if (window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    } else {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }
  function getBestVoice() {
    var v = _voices.length ? _voices : (window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
    var tests = [
      function (x) { return x.name === "Samantha"; },
      function (x) { return x.name === "Karen"; },
      function (x) { return x.name === "Daniel"; },
      function (x) { return x.name.indexOf("Google US English") >= 0; },
      function (x) { return x.name.indexOf("Google UK English") >= 0; },
      function (x) { return x.name.indexOf("Microsoft Aria") >= 0; },
      function (x) { return x.lang === "en-US" && x.localService; },
      function (x) { return x.lang === "en-GB" && x.localService; },
      function (x) { return x.lang.indexOf("en") === 0; }
    ];
    for (var t = 0; t < tests.length; t++) {
      for (var i = 0; i < v.length; i++) if (tests[t](v[i])) return v[i];
    }
    return null;
  }
  function speak(text, opts) {
    opts = (opts && typeof opts === "object") ? opts : {};
    var done = typeof opts.onDone === "function" ? opts.onDone : null;
    if (!window.speechSynthesis) { if (done) done(); return; }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(String(text));
    u.lang = "en-US";
    u.rate = typeof opts.rate === "number" ? opts.rate : 0.88;
    u.pitch = 1.0;
    var voice = getBestVoice();
    if (voice) u.voice = voice;
    var fired = false;
    function fin() { if (fired) return; fired = true; if (done) done(); }
    u.onend = fin; u.onerror = fin;
    speak._last = u; // keep a reference so Safari does not drop it mid-sentence
    window.speechSynthesis.speak(u);
  }
  function stopSpeech() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  /* ---------- MC answer positions ----------
     var D = AppCore.dealer();          // one per drill / mock exam
     var r = D.place(correctText, [wrong1, wrong2]);
     r.choices -> array to show as A, B, C ...   r.answer -> correct index
     var m = D.placeMulti([c1, c2], [w1]);   // "choose two"
     m.answers -> sorted indexes
     Positions are dealt from a balanced deck, so A/B/C come up equally
     often and the same letter never appears 3 times in a row.
     Store choices in the bank as TEXT, never as a fixed letter. */
  function dealer() {
    var decks = {}, last = [], pairs = [];
    function runOK(deck, prev) {
      var s = prev.concat(deck);
      for (var i = 2; i < s.length; i++) if (s[i] === s[i - 1] && s[i] === s[i - 2]) return false;
      return true;
    }
    function build(n) {
      var base = [], d, k = 0;
      for (var r = 0; r < 3; r++) for (var i = 0; i < n; i++) base.push(i);
      do { d = shuffle(base); k++; } while (!runOK(d, last.slice(-2)) && k < 300);
      return d;
    }
    function nextPos(n) {
      if (!decks[n] || !decks[n].length) decks[n] = build(n);
      var p = decks[n].shift();
      if (last.length >= 2 && last[last.length - 1] === p && last[last.length - 2] === p) {
        // deck boundary produced a triple: swap with the next different one
        for (var i = 0; i < decks[n].length; i++) if (decks[n][i] !== p) {
          var q = decks[n][i]; decks[n][i] = p; p = q; break;
        }
      }
      last.push(p); if (last.length > 4) last.shift();
      return p;
    }
    function fill(out, wrong) {
      var w = shuffle(wrong);
      for (var i = 0; i < out.length; i++) if (out[i] === undefined) out[i] = w.shift();
      return out;
    }
    return {
      place: function (correct, wrong) {
        var n = wrong.length + 1, pos = nextPos(n), out = new Array(n);
        out[pos] = correct;
        return { choices: fill(out, wrong), answer: pos };
      },
      placeMulti: function (correct, wrong) {
        var n = correct.length + wrong.length, out = new Array(n), slots;
        if (correct.length === 2 && n === 3) {
          if (!pairs.length) pairs = shuffle([[0, 1], [0, 2], [1, 2], [0, 1], [0, 2], [1, 2]]);
          slots = pairs.shift();
        } else {
          slots = shuffle(Array.apply(null, { length: n }).map(function (_, i) { return i; }))
            .slice(0, correct.length);
        }
        var c = shuffle(correct);
        slots.forEach(function (s, k) { out[s] = c[k]; });
        return { choices: fill(out, wrong), answers: slots.slice().sort() };
      }
    };
  }

  /* ---------- scoring ----------
     log = [{q:"question text", given:"student answer", correct:"answer", ok:true}] */
  function stars(pct) {
    return pct >= 90 ? 5 : pct >= 75 ? 4 : pct >= 55 ? 3 : pct >= 40 ? 2 : 1;
  }
  function result(log) {
    var n = log.length, c = 0;
    for (var i = 0; i < n; i++) if (log[i].ok) c++;
    var pct = n ? Math.round(100 * c / n) : 0;
    return { answered: n, correct: c, pct: pct, stars: n ? stars(pct) : 0,
             wrong: log.filter(function (x) { return !x.ok; }) };
  }

  /* ---------- sticky Back + Finish & Score bar ----------
     Put it at the top of EVERY drill (topic, story, mock exam, oral).
     drillBar({title:"Vocab · 3 / 20", onBack: goHome, onFinish: showResult}) */
  function drillBar(o) {
    var bar = el("div", "ac-bar");
    if (o.onBack) bar.appendChild(btn("⬅ Back", "ac-ghost", o.onBack));
    bar.appendChild(el("span", "ac-bar-title", esc(o.title || "")));
    bar.appendChild(btn("🏁 Finish &amp; Score", "ac-finish", function () {
      stopSpeech(); if (o.onFinish) o.onFinish();
    }));
    return bar;
  }

  /* ---------- result screen ----------
     resultView(log, {onAgain: restartSameDrill, onHome: goHome}) -> element */
  function resultView(log, o) {
    o = o || {};
    var r = result(log), box = el("div", "ac-result");
    if (!r.answered) {
      box.appendChild(el("h2", null, "You have not answered any questions yet."));
    } else {
      box.appendChild(el("div", "ac-stars", new Array(r.stars + 1).join("⭐")));
      box.appendChild(el("h2", null, "Answered " + r.answered + " question" + (r.answered > 1 ? "s" : "") +
        " — " + r.correct + " correct (" + r.pct + "%)"));
      if (r.wrong.length) {
        var ul = el("div", "ac-review");
        ul.appendChild(el("h3", null, "Review these"));
        r.wrong.forEach(function (w) {
          ul.appendChild(el("div", "ac-review-item",
            "<div>" + esc(w.q) + "</div>" +
            (w.given != null && w.given !== "" ? "<div class='ac-given'>Your answer: " + esc(w.given) + "</div>" : "") +
            "<div class='ac-correct'>Answer: " + esc(w.correct) + "</div>"));
        });
        box.appendChild(ul);
      } else {
        box.appendChild(el("p", null, "Perfect — no mistakes! 🎉"));
      }
    }
    var row = el("div", "ac-row");
    if (o.onAgain) row.appendChild(btn("🔄 Try Again", "ac-primary", o.onAgain));
    if (o.onHome) row.appendChild(btn("🏠 Home", "ac-ghost", o.onHome));
    box.appendChild(row);
    return box;
  }

  /* ---------- recording (iOS Safari safe) ----------
     var R = AppCore.recorder({maxSecs: 60, onTick, onState, onError});
     recordBtn.addEventListener("click", function(){ R.toggle(); });  // direct
     playBtn.addEventListener("click",   function(){ R.play();   });  // direct
     Rules baked in:
       - getUserMedia is called synchronously inside start() — so start()
         / toggle() must be called DIRECTLY from a click handler
       - MIME type is chosen after permission is granted
       - play() calls audio.play() synchronously — call it from a click
       - nothing plays from onstop
     States: "idle" | "asking" | "recording" | "ready"  */
  var WEBVIEW_NOTICE =
    '<div class="ac-notice"><strong>🎙 Recording needs Safari or Chrome</strong><br>' +
    'Open this page in Safari (iPad/iPhone) or Chrome — not inside another app.<br>' +
    'iPad: tap ••• or the share button → <b>Open in Safari</b></div>';

  function pickMime() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
    var t = ["audio/mp4", "audio/aac", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
    for (var i = 0; i < t.length; i++) { try { if (MediaRecorder.isTypeSupported(t[i])) return t[i]; } catch (e) {} }
    return "";
  }
  function recorder(o) {
    o = o || {};
    var max = o.maxSecs || 60, rec = null, stream = null, chunks = [], url = null,
        timer = null, secs = 0, audio = null, state = "idle";
    function set(s) { state = s; if (o.onState) o.onState(s); }
    function fail(msg) {
      cleanup(); set(url ? "ready" : "idle");
      if (o.onError) o.onError(msg);
    }
    function cleanup() {
      clearInterval(timer); timer = null;
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    }
    function supported() {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    }
    function start() {
      if (state === "recording" || state === "asking") return;
      if (!supported()) { fail("This browser cannot record here. Open the page in Safari or Chrome."); return; }
      if (audio) { audio.pause(); audio = null; }
      stopSpeech();
      var gum = navigator.mediaDevices.getUserMedia({ audio: true, video: false }); // inside the tap
      set("asking");
      var to = setTimeout(function () { if (state === "asking") fail("No microphone permission. Open the page in Safari or Chrome and allow the microphone."); }, 8000);
      gum.then(function (s) {
        clearTimeout(to);
        if (state !== "asking") { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = s; chunks = [];
        var mime = pickMime();
        try { rec = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s); }
        catch (e) { rec = new MediaRecorder(s); }
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          var b = new Blob(chunks, { type: (rec && rec.mimeType) || mime || "audio/webm" });
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(b);
          cleanup(); set("ready");           // only store the clip — never auto-play
        };
        rec.start(200);
        secs = 0; set("recording"); if (o.onTick) o.onTick(0, max);
        timer = setInterval(function () {
          secs++; if (o.onTick) o.onTick(secs, max);
          if (secs >= max) stop();
        }, 1000);
      }).catch(function (err) {
        clearTimeout(to);
        var n = err && err.name;
        fail(n === "NotAllowedError" ? "Microphone blocked. Allow the microphone in Safari settings, or open the page in Safari/Chrome."
           : n === "NotFoundError" ? "No microphone found on this device."
           : "Could not start recording. Open the page in Safari or Chrome.");
      });
    }
    function stop() {
      clearInterval(timer); timer = null;
      if (rec && rec.state !== "inactive") { try { rec.stop(); } catch (e) { cleanup(); set(url ? "ready" : "idle"); } }
    }
    function play() {                       // call DIRECTLY from the Play button's click
      if (!url) return;
      if (audio) audio.pause();
      audio = new Audio();
      audio.src = url;
      var p = audio.play();
      if (p && p.catch) p.catch(function (e) { if (o.onError) o.onError("Playback failed: " + e.message); });
    }
    function reset() {
      stop(); cleanup();
      if (audio) { audio.pause(); audio = null; }
      if (url) { URL.revokeObjectURL(url); url = null; }
      set("idle");
    }
    return {
      start: start, stop: stop, play: play, reset: reset, supported: supported,
      toggle: function () { if (state === "recording") stop(); else start(); },
      hasClip: function () { return !!url; },
      state: function () { return state; }
    };
  }

  /* ---------- oral question card: record first, reveal later ----------
     AppCore.oralCard(container, {
        q: "What is a fossil?", a: "A fossil is ...",
        keywords: ["remains", "rock"],   // shown ONLY after Reveal
        mustKnow: true                   // red "Exam Must-Know" badge
     }, {onSelfScore: function(ok){ ... }, maxSecs: 60});
     Flow: 🔊 Hear Q → 🎙 Record → ⏹ Stop → ▶ My Voice → 👁 Reveal Answer
           → model answer + 🔊 Hear Model → ✓ Got it / ✗ Still learning.
     The model answer and keywords are never in the page before Reveal.
     If recording is impossible, the student taps "I said my answer" to
     unlock Reveal, so practice can continue. Returns {destroy()}. */
  function oralCard(container, q, o) {
    o = o || {};
    container.innerHTML = "";
    var card = el("div", "ac-oral");
    if (q.mustKnow) card.appendChild(el("span", "ac-badge", "⭐ Exam Must-Know"));
    card.appendChild(el("div", "ac-oral-q", esc(q.q)));
    var row = el("div", "ac-row"), status = el("div", "ac-status"), out = el("div", "ac-oral-out");

    var hearQ = btn("🔊 Hear Question", "ac-ghost", function () { speak(q.q); });
    var recB = btn("🎙 Record", "ac-rec");
    var playB = btn("▶ My Voice", "ac-ghost"); playB.hidden = true;
    var saidB = btn("I said my answer", "ac-ghost"); saidB.hidden = true;
    var revealB = btn("👁 Reveal Answer", "ac-primary"); revealB.hidden = true;
    var revealed = false;

    var R = recorder({
      maxSecs: o.maxSecs || 60,
      onTick: function (s, m) { status.textContent = "● Recording " + s + "s / " + m + "s"; },
      onState: function (s) {
        card.classList.toggle("ac-recording", s === "recording");
        if (s === "asking") { status.textContent = "⏳ Asking for the microphone…"; recB.disabled = true; }
        if (s === "recording") { recB.disabled = false; recB.innerHTML = "⏹ Stop"; }
        if (s === "ready") {
          recB.disabled = false; recB.innerHTML = "🎙 Record Again";
          status.textContent = "✓ Recorded. Listen to yourself, then reveal the answer.";
          playB.hidden = false; revealB.hidden = revealed;
        }
        if (s === "idle") { recB.disabled = false; recB.innerHTML = "🎙 Record"; }
      },
      onError: function (msg) {
        status.textContent = msg;
        if (!R.hasClip()) saidB.hidden = revealed;
      }
    });
    recB.addEventListener("click", function () { R.toggle(); });     // direct tap → getUserMedia
    playB.addEventListener("click", function () { R.play(); });      // direct tap → audio.play()
    saidB.addEventListener("click", function () { saidB.hidden = true; revealB.hidden = false; });
    revealB.addEventListener("click", function () {
      revealed = true; revealB.hidden = true; saidB.hidden = true;
      var m = el("div", "ac-model", "<b>📖 Model Answer</b><div>" + esc(q.a) + "</div>" +
        (q.keywords && q.keywords.length ? "<div class='ac-kw'>Key words: " + q.keywords.map(esc).join(" · ") + "</div>" : ""));
      m.appendChild(btn("🔊 Hear Model Answer", "ac-ghost", function () { speak(q.a); }));
      out.appendChild(m);
      var self = el("div", "ac-row");
      function pick(ok) {
        self.innerHTML = "<div class='ac-fb " + (ok ? "ok" : "bad") + "'>" +
          (ok ? "Great job! ✓" : "Keep practising — try it again later.") + "</div>";
        if (o.onSelfScore) o.onSelfScore(ok);
      }
      self.appendChild(btn("✓ Got it", "ac-ok", function () { pick(true); }));
      self.appendChild(btn("✗ Still learning", "ac-ghost", function () { pick(false); }));
      out.appendChild(self);
    });

    [hearQ, recB, playB, saidB, revealB].forEach(function (b) { row.appendChild(b); });
    card.appendChild(row); card.appendChild(status); card.appendChild(out);
    container.appendChild(card);
    return { destroy: function () { R.reset(); stopSpeech(); } };
  }

  /* ---------- styles (call once) ---------- */
  var CSS =
    ".ac-btn{font:inherit;font-size:1.05rem;min-height:50px;padding:10px 16px;border-radius:12px;border:2px solid transparent;cursor:pointer;margin:4px 6px 4px 0;touch-action:manipulation}" +
    ".ac-btn[disabled]{opacity:.5}" +
    ".ac-primary{background:#0284c7;color:#fff}.ac-ok{background:#16a34a;color:#fff}" +
    ".ac-rec{background:#dc2626;color:#fff}.ac-finish{background:#f59e0b;color:#1f2937;font-weight:700}" +
    ".ac-ghost{background:transparent;color:inherit;border-color:currentColor}" +
    ".ac-bar{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;margin:0 -10px 12px;background:inherit;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-bottom:1px solid rgba(127,127,127,.3)}" +
    ".ac-bar-title{flex:1;min-width:120px;opacity:.8}" +
    ".ac-row{display:flex;flex-wrap:wrap;align-items:center}" +
    ".ac-result{text-align:center}.ac-stars{font-size:2.2rem;margin:8px 0}" +
    ".ac-review{text-align:left;margin:16px 0}.ac-review-item{padding:10px 12px;border-left:4px solid #dc2626;margin:8px 0;border-radius:8px;background:rgba(220,38,38,.08)}" +
    ".ac-given{opacity:.8}.ac-correct{font-weight:700;color:#15803d}" +
    ".ac-notice{background:#1a0a2a;border:2px solid #a855f7;color:#e9d5ff;border-radius:12px;padding:14px 16px;margin-bottom:16px;font-size:.92rem;line-height:1.7}" +
    ".ac-notice strong{color:#c084fc}" +
    ".ac-oral{padding:14px;border-radius:14px;border:1px solid rgba(127,127,127,.35);margin-bottom:14px}" +
    ".ac-oral-q{font-size:1.25rem;font-weight:700;margin:8px 0 10px}" +
    ".ac-badge{display:inline-block;background:#dc2626;color:#fff;border-radius:999px;padding:2px 10px;font-size:.85rem}" +
    ".ac-recording{box-shadow:0 0 0 3px #dc2626}" +
    ".ac-status{min-height:1.4em;margin:6px 0;opacity:.85}" +
    ".ac-model{background:rgba(22,163,74,.12);border:2px solid #16a34a;border-radius:12px;padding:12px;margin:10px 0}" +
    ".ac-kw{margin-top:6px;opacity:.85}" +
    ".ac-fb{padding:10px 14px;border-radius:10px;font-weight:700}.ac-fb.ok{background:rgba(22,163,74,.15);color:#15803d}.ac-fb.bad{background:rgba(245,158,11,.18)}";
  function injectCSS() {
    if (document.getElementById("ac-css")) return;
    var s = document.createElement("style"); s.id = "ac-css"; s.textContent = CSS;
    document.head.appendChild(s);
  }

  return {
    VERSION: "2026-10-23",
    esc: esc, el: el, btn: btn, shuffle: shuffle,
    speak: speak, stopSpeech: stopSpeech, getBestVoice: getBestVoice,
    dealer: dealer, stars: stars, result: result,
    drillBar: drillBar, resultView: resultView,
    recorder: recorder, oralCard: oralCard, pickMime: pickMime,
    WEBVIEW_NOTICE: WEBVIEW_NOTICE, injectCSS: injectCSS
  };
})();
