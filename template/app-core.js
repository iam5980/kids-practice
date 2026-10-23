/* =====================================================================
   app-core.js — shared core for the kids' exam-practice apps
   Canonical copy: github.com/iam5980/kids-practice/template/app-core.js
   Version: 2026-10-23c (speech/typed short answers scored on key points)

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

   TAP-TO-ANSWER (iPad/phone friendly — avoid the keyboard)
     wordBank(el, spec, o)     tap a word-bank chip → it fills the blank
     tiles(el, spec, o)        tap word / letter / step tiles to build the
                               answer (unscramble, spelling, ordering)
     openAnswer(el, spec, o)   🎤 speak (speech → text) or type → scored
                               automatically on key points (short answers)
     Each draws its own ✔ Check button and calls o.onResult(ok, given).

   GAME LAYER
     game(key)                 points, 🔥 streaks, cheers, confetti,
                               best score per drill on this device
     drillBar({game}) shows the HUD; resultView(log, {game, onRetryWrong})
     shows points, best streak, new-best badge and "Practise my mistakes".
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
    if (o.game) bar.appendChild(o.game.hud());
    bar.appendChild(btn("🏁 Finish &amp; Score", "ac-finish", function () {
      stopSpeech(); if (o.onFinish) o.onFinish();
    }));
    return bar;
  }

  /* ---------- result screen ----------
     resultView(log, {onAgain: restartSameDrill, onHome: goHome}) -> element */
  var CHEERS = {5: "Perfect! You are a star! 🌟", 4: "Great work — almost perfect! 🎉", 3: "Good job! Keep practising 👍",
                2: "Nice try! Practise your mistakes and try again 💪", 1: "Every try makes you stronger. Let's practise again! 🌱"};
  function resultView(log, o) {
    o = o || {};
    var r = result(log), box = el("div", "ac-result");
    if (!r.answered) {
      box.appendChild(el("h2", null, "You have not answered any questions yet."));
    } else {
      box.appendChild(el("div", "ac-stars", new Array(r.stars + 1).join("⭐")));
      box.appendChild(el("h2", null, "Answered " + r.answered + " question" + (r.answered > 1 ? "s" : "") +
        " — " + r.correct + " correct (" + r.pct + "%)"));
      box.appendChild(el("p", "ac-cheerline", CHEERS[r.stars]));
      if (o.game) {
        var g = o.game.summary();
        box.appendChild(el("div", "ac-gamebox",
          "<span>⭐ <b>" + g.points + "</b> points</span><span>🔥 Best streak <b>" + g.bestStreak + "</b></span>" +
          "<span>" + (g.newBest ? "🏆 <b>New best score!</b>" : "🏅 Best <b>" + g.best + "</b>") + "</span>"));
      }
      if (r.pct === 100 && r.answered >= 3) setTimeout(function () { confetti(80); }, 200);
      if (r.wrong.length) {
        var ul = el("div", "ac-review");
        ul.appendChild(el("h3", null, "Review these"));
        r.wrong.forEach(function (w) {
          ul.appendChild(el("div", "ac-review-item",
            "<div>" + esc(w.q) + "</div>" +
            (w.given != null && w.given !== "" ? "<div class='ac-given'>Your answer: " + esc(w.given) + "</div>" : "") +
            "<div class='ac-correct'>Answer: " + esc(w.correct) + "</div>" +
            (w.appeal ? "<div><span class='ac-flag'>🙋 Ask a parent to check</span></div>" : "")));
        });
        box.appendChild(ul);
      } else {
        box.appendChild(el("p", null, "Perfect — no mistakes! 🎉"));
      }
    }
    var row = el("div", "ac-row ac-center");
    if (o.onRetryWrong && r.wrong.length) row.appendChild(btn("🎯 Practise my " + r.wrong.length + " mistake" + (r.wrong.length > 1 ? "s" : ""), "ac-finish", o.onRetryWrong));
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

  /* ---------- answer normalising (for Check) ---------- */
  function norm(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[’‘`]/g, "'").replace(/[“”]/g, '"')
      .replace(/[.,!?;:"]/g, " ").replace(/\s+/g, " ").trim();
  }
  function matches(given, answers) {
    var list = Array.isArray(answers) ? answers : [answers];
    for (var i = 0; i < list.length; i++) if (norm(given) === norm(list[i])) return true;
    return false;
  }

  /* ---------- TAP-TO-ANSWER widgets (no keyboard needed on iPad/phone) ----
     All three share the same contract:
       AppCore.xxx(container, spec, {onResult: function(ok, given){...}})
     They draw their own ✔ Check button (Enter also checks when typing),
     lock after checking, and show green ✓ or the yellow correct-answer box.
     Every widget has a small "⌨ Type instead" link for older kids.        */

  function checkRow(onCheck) {
    var row = el("div", "ac-row");
    var b = btn("✔ Check", "ac-primary ac-check", onCheck);
    b.disabled = true;
    row.appendChild(b);
    return { row: row, btn: b };
  }
  function feedback(box, ok, correctText, exp) {
    var f = el("div", "ac-fb " + (ok ? "ok" : "bad"),
      ok ? "✓ " + praise() :
      "✗ Not quite. The answer is:<div class='ac-ans'>" + esc(correctText) + "</div>" +
      (exp ? "<div class='ac-exp'>" + esc(exp) + "</div>" : ""));
    box.appendChild(f);
    return f;
  }
  function typeToggle(box, onType) {
    var t = el("button", "ac-link", "⌨ Type instead");
    t.type = "button";
    t.addEventListener("click", function () { t.remove(); onType(); });
    box.appendChild(t);
  }
  function typedInput(box, answers, done, exp, shown) {
    var inp = el("input", "ac-input"); inp.setAttribute("autocapitalize", "off");
    inp.setAttribute("autocomplete", "off"); inp.setAttribute("spellcheck", "false");
    box.appendChild(inp);
    var c = checkRow(function () { go(); });
    box.appendChild(c.row);
    inp.addEventListener("input", function () { c.btn.disabled = !inp.value.trim(); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && inp.value.trim()) go(); });
    var used = false;
    function go() {
      if (used) return; used = true; inp.disabled = true; c.row.remove();
      var ok = matches(inp.value, answers);
      feedback(box, ok, shown, exp);
      done(ok, inp.value);
    }
    inp.focus();
  }

  /* 1) Word bank → tap a word to fill the blank(s)
     AppCore.wordBank(el, {
        text: "The cat is ___ the box.",      // "___" marks each blank
        bank: ["in", "on", "under"],          // chips shown under the sentence
        answers: ["under"],                   // one per blank (string or array of accepted)
        exp: "optional explanation"
     }, {onResult})
     Tap a chip → it goes into the first empty blank. Tap a filled blank → it
     goes back. Words can be re-used if the bank has duplicates.            */
  function wordBank(container, spec, o) {
    o = o || {};
    container.innerHTML = "";
    var box = el("div", "ac-q"), parts = String(spec.text).split("___");
    var n = parts.length - 1, filled = [], used = false;
    for (var z = 0; z < n; z++) filled.push(null);
    var line = el("div", "ac-sentence"), chips = el("div", "ac-chips");
    var pool = spec.bank.map(function (w, i) { return { w: w, id: i, out: false }; });
    var c = checkRow(check);
    function render() {
      line.innerHTML = "";
      parts.forEach(function (p, i) {
        line.appendChild(document.createTextNode(p));
        if (i < n) {
          var slot = el("button", "ac-slot" + (filled[i] ? " ac-filled" : ""), filled[i] ? esc(filled[i].w) : "&nbsp;");
          slot.type = "button";
          slot.addEventListener("click", function () {
            if (used || !filled[i]) return;
            filled[i].out = false; filled[i] = null; render();
          });
          line.appendChild(slot);
        }
      });
      chips.innerHTML = "";
      pool.forEach(function (it) {
        var ch = el("button", "ac-chip" + (it.out ? " ac-used" : ""), esc(it.w));
        ch.type = "button"; ch.disabled = used || it.out;
        ch.addEventListener("click", function () {
          var k = filled.indexOf(null);
          if (k < 0) return;
          filled[k] = it; it.out = true; render();
        });
        chips.appendChild(ch);
      });
      c.btn.disabled = used || filled.filter(Boolean).length < n;
    }
    function check() {
      if (used) return; used = true; c.row.remove(); render();
      var given = filled.map(function (f) { return f ? f.w : ""; });
      var ok = given.every(function (g, i) { return matches(g, spec.answers[i]); });
      var full = parts.map(function (p, i) {
        var a = spec.answers[i]; return p + (i < n ? (Array.isArray(a) ? a[0] : a) : "");
      }).join("");
      feedback(box, ok, full, spec.exp);
      if (o.onResult) o.onResult(ok, given.join(" / "));
    }
    box.appendChild(line); box.appendChild(chips); box.appendChild(c.row);
    container.appendChild(box);
    render();
  }

  /* 2) Build from tiles → unscramble a sentence, spell a word, order steps
     AppCore.tiles(el, {
        answer: "She always eats breakfast at seven.",   // or ["acceptable", ...]
        unit: "word" | "letter" | "item",   // word: split on spaces, letter: per letter
        items: [...],        // only for unit "item": the pieces in the CORRECT order
        extra: ["never"],    // optional distractor tiles
        hint: "optional instruction shown above",
        exp: "optional explanation"
     }, {onResult})
     Tap a tile → it moves to the answer line; tap it there → it moves back.
     Spelling (unit "letter") also offers "⌨ Type instead".                  */
  function tiles(container, spec, o) {
    o = o || {};
    container.innerHTML = "";
    var box = el("div", "ac-q"), unit = spec.unit || "word";
    var first = Array.isArray(spec.answer) ? spec.answer[0] : spec.answer;
    var pieces = unit === "item" ? spec.items.slice()
      : unit === "letter" ? String(first).replace(/\s+/g, "").split("")
      : String(first).replace(/[.!?]$/, "").split(/\s+/);
    var tail = unit === "word" ? (String(first).match(/[.!?]$/) || [""])[0] : "";
    var all = pieces.concat(spec.extra || []).map(function (t, i) { return { t: t, id: i }; });
    var src;
    do { src = shuffle(all); } while (all.length > 1 && src.map(function (x) { return x.t; }).join("|") === pieces.join("|"));
    var ans = [], used = false;
    if (spec.hint) box.appendChild(el("div", "ac-hint", esc(spec.hint)));
    var line = el("div", "ac-tiles ac-answer-line"), pool = el("div", "ac-tiles");
    var c = checkRow(check);
    function joinUp(arr) {
      var s = arr.map(function (x) { return x.t; });
      return unit === "letter" ? s.join("") : unit === "item" ? s.join(" → ") : s.join(" ") + tail;
    }
    function render() {
      line.innerHTML = ""; pool.innerHTML = "";
      if (!ans.length) line.appendChild(el("span", "ac-placeholder", "Tap the tiles below in order"));
      ans.forEach(function (x, i) {
        var b = btn(esc(x.t), "ac-tile ac-in", function () { if (used) return; src.push(ans.splice(i, 1)[0]); render(); });
        line.appendChild(b);
      });
      src.forEach(function (x, i) {
        var b = btn(esc(x.t), "ac-tile", function () { if (used) return; ans.push(src.splice(i, 1)[0]); render(); });
        pool.appendChild(b);
      });
      c.btn.disabled = used || !ans.length;
    }
    function check() {
      if (used) return; used = true; c.row.remove(); render();
      var given = joinUp(ans);
      var target = unit === "item" ? [pieces.join(" → ")] : (Array.isArray(spec.answer) ? spec.answer : [spec.answer]);
      var ok = unit === "letter" ? matches(given, target.map(function (a) { return String(a).replace(/\s+/g, ""); }))
                                 : matches(given, target);
      feedback(box, ok, unit === "item" ? pieces.join(" → ") : first, spec.exp);
      if (o.onResult) o.onResult(ok, given);
    }
    box.appendChild(line); box.appendChild(pool); box.appendChild(c.row);
    if (unit === "letter") typeToggle(box, function () {
      line.remove(); pool.remove(); c.row.remove();
      typedInput(box, spec.answer, function (ok, g) { used = true; if (o.onResult) o.onResult(ok, g); }, spec.exp, first);
    });
    container.appendChild(box);
    render();
  }

  /* 3) Open answer (short answer, "write a sentence", "name 3 things")
     Speak (🎤 → text) or type, then the answer is scored AUTOMATICALLY on
     key points, the way a teacher marks a short answer.
     AppCore.openAnswer(el, {
        a: "Plants need water, sunlight and air.",          // model answer
        points: [["water"], ["sunlight", "sun", "sunshine"], ["air"]],
                     // each key point = accepted words/phrases (first = label)
                     // or {label: "sunlight", any: ["sun", "sunshine"]}
        need: 2,     // points needed to count as correct (default: all if
                     // 1–2 points, otherwise ~70% rounded up)
        exp: "optional explanation"
     }, {onResult: function(ok, given, info){}})
     info = {hits, total, appeal}. Matching ignores case, punctuation,
     plurals (-s/-es/-ies), -ed/-ing and number words (three = 3).
     "🙋 I think I'm right" marks the answer for a parent to check
     (info.appeal = true); it does NOT change the score.               */
  var NUMS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
              "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
  function stem(w) {
    var n = NUMS.indexOf(w); if (n >= 0) return String(n);
    w = w.replace(/'s$/, "");
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + "y";
    if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 5 && /ing$/.test(w)) return w.slice(0, -3);
    if (w.length > 4 && /ied$/.test(w)) return w.slice(0, -3) + "y";
    if (w.length > 4 && /ed$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function stems(s) { return norm(s).split(" ").filter(Boolean).map(stem); }
  function hasPhrase(words, phrase) {
    var p = stems(phrase); if (!p.length) return false;
    for (var i = 0; i + p.length <= words.length; i++) {
      var ok = true;
      for (var k = 0; k < p.length; k++) if (words[i + k] !== p[k]) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }
  function keyPoints(spec) {
    var src = spec.points && spec.points.length ? spec.points : (spec.keywords || []).map(function (k) { return [k]; });
    return src.map(function (p) {
      if (Array.isArray(p)) return { label: p[0], any: p };
      return { label: p.label, any: [p.label].concat(p.any || []) };
    });
  }
  function scorePoints(text, pts) {
    var w = stems(text);
    return pts.map(function (p) {
      for (var i = 0; i < p.any.length; i++) if (hasPhrase(w, p.any[i])) return true;
      return false;
    });
  }
  function speechSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

  function openAnswer(container, spec, o) {
    o = o || {};
    container.innerHTML = "";
    var pts = keyPoints(spec), total = pts.length;
    var need = spec.need || (total <= 2 ? total : Math.ceil(total * 0.7));
    var box = el("div", "ac-q"), done = false, rec = null, listening = false;
    box.appendChild(el("div", "ac-hint", speechSupported()
      ? "🎤 Tap the mic and say your answer, or type it. Then tap ✔ Check."
      : "⌨ Type your answer (tip: the 🎤 key on the iPad keyboard lets you speak it). Then tap ✔ Check."));
    var inp = el("textarea", "ac-input");
    inp.setAttribute("autocapitalize", "sentences"); inp.setAttribute("spellcheck", "false");
    inp.placeholder = "Your answer…";
    var row = el("div", "ac-row"), status = el("div", "ac-status");
    var mic = btn("🎤 Speak", "ac-rec");
    var c = checkRow(check);
    row.appendChild(mic); row.appendChild(c.btn);
    if (!speechSupported()) mic.hidden = true;
    inp.addEventListener("input", function () { c.btn.disabled = done || !inp.value.trim(); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && inp.value.trim()) { e.preventDefault(); check(); } });

    mic.addEventListener("click", function () {          // start inside the tap (iOS)
      if (done) return;
      if (listening && rec) { rec.stop(); return; }
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      stopSpeech();
      rec = new SR(); rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      var base = inp.value.trim() ? inp.value.trim() + " " : "";
      rec.onresult = function (e) {
        var t = "";
        for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
        inp.value = base + t; c.btn.disabled = !inp.value.trim();
      };
      rec.onerror = function (e) {
        status.textContent = e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone or speech not allowed. Open in Safari/Chrome, allow the mic — or type your answer."
          : e.error === "no-speech" ? "I didn't hear anything. Tap 🎤 and try again." : "Speech didn't work — please type your answer.";
      };
      rec.onend = function () { listening = false; mic.innerHTML = "🎤 Speak"; card(false); if (inp.value.trim()) status.textContent = "✓ Check the words, fix any mistakes, then tap ✔ Check."; };
      try { rec.start(); listening = true; mic.innerHTML = "⏹ Stop"; card(true); status.textContent = "● Listening…"; }
      catch (err) { status.textContent = "Speech didn't start — please type your answer."; }
    });
    function card(on) { box.classList.toggle("ac-recording", on); }

    function check() {
      if (done || !inp.value.trim()) return;
      if (listening && rec) { try { rec.stop(); } catch (e) {} }
      done = true; inp.disabled = true; row.remove();
      var hits = scorePoints(inp.value, pts), n = hits.filter(Boolean).length, ok = n >= need;
      var list = pts.map(function (p, i) {
        return "<span class='ac-kp " + (hits[i] ? "hit" : "miss") + "'>" + (hits[i] ? "✓ " : "✗ ") + esc(p.label) + "</span>";
      }).join(" ");
      var f = el("div", "ac-fb " + (ok ? "ok" : "bad"),
        (ok ? "✓ " + praise() : "Not quite — keep going! 💪") +
        "<div class='ac-kps'>" + list + "</div><div class='ac-exp'>Key points: " + n + " / " + total +
        (ok ? "" : " (need " + need + ")") + "</div>");
      box.appendChild(f);
      var m = el("div", "ac-model", "<b>Model answer</b><div>" + esc(spec.a) + "</div>" +
        (spec.exp ? "<div class='ac-kw'>" + esc(spec.exp) + "</div>" : ""));
      m.appendChild(btn("🔊 Hear it", "ac-ghost", function () { speak(spec.a); }));
      box.appendChild(m);
      var info = { hits: n, total: total, appeal: false };
      if (!ok) {
        var ap = btn("🙋 I think I'm right", "ac-ghost", function () {
          info.appeal = true; ap.remove();
          box.appendChild(el("div", "ac-exp", "Marked for a parent to check. 👍"));
          if (o.onAppeal) o.onAppeal(inp.value, info);
        });
        box.appendChild(ap);
      }
      if (o.onResult) o.onResult(ok, inp.value, info);
    }
    box.appendChild(inp); box.appendChild(row); box.appendChild(status);
    container.appendChild(box);
  }

  /* ---------- GAME LAYER: points, streaks, praise, confetti, best score ----
     var G = AppCore.game("audrey-reading-1151-vocab");   // one per drill, key = unique
     G.hud()                -> element: ⭐ points · 🔥 streak  (put it in the drill bar area)
     G.record(ok)           -> call after EVERY judged answer (any mode)
     G.summary()            -> {points, bestStreak, best, newBest}
     resultView(log, {game: G, onRetryWrong: fn, ...}) shows it all.
     Scoring: correct +10, streak bonus +2 per answer in a row (max +10).
     Streak milestones (3, 5, 10, …) pop a cheer; 5+ and 100% fire confetti.
     The best score per drill is kept on this device (localStorage, safe).  */
  var PRAISE = ["Great job!", "Awesome!", "You got it!", "Super!", "Well done!", "Nice work!", "Brilliant!", "Fantastic!", "Way to go!", "Excellent!"];
  function praise() { return PRAISE[Math.floor(Math.random() * PRAISE.length)]; }
  function cheer(text) {
    var t = el("div", "ac-cheer", esc(text));
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("ac-out"); }, 1100);
    setTimeout(function () { t.remove(); }, 1600);
  }
  function confetti(n) {
    var colors = ["#f59e0b", "#0284c7", "#16a34a", "#dc2626", "#a855f7", "#ec4899"];
    var layer = el("div", "ac-confetti");
    for (var i = 0; i < (n || 60); i++) {
      var p = el("i");
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.4) + "s";
      p.style.animationDuration = (1.2 + Math.random() * 1.2) + "s";
      p.style.transform = "rotate(" + Math.floor(Math.random() * 360) + "deg)";
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(function () { layer.remove(); }, 3000);
  }
  function game(key) {
    var pts = 0, streak = 0, bestStreak = 0, hudEl = null, best = 0, newBest = false;
    try { best = parseInt(localStorage.getItem("ac-best-" + key) || "0", 10) || 0; } catch (e) { best = 0; }
    function draw() {
      if (hudEl) hudEl.innerHTML = "⭐ " + pts + (streak >= 2 ? " &nbsp; 🔥 " + streak + " in a row" : "");
    }
    return {
      hud: function () { hudEl = el("span", "ac-hud"); draw(); return hudEl; },
      record: function (ok) {
        if (ok) {
          streak++; bestStreak = Math.max(bestStreak, streak);
          pts += 10 + Math.min(10, (streak - 1) * 2);
          if (streak === 3) cheer("🔥 3 in a row!");
          else if (streak === 5) { cheer("🚀 5 in a row! Amazing!"); confetti(40); }
          else if (streak > 5 && streak % 5 === 0) { cheer("🏆 " + streak + " in a row! Unstoppable!"); confetti(60); }
        } else {
          if (streak >= 3) cheer("Good try! Start a new streak 💪");
          streak = 0;
        }
        draw();
      },
      summary: function () {
        if (pts > best) {
          newBest = best > 0 || pts > 0; best = pts;
          try { localStorage.setItem("ac-best-" + key, String(pts)); } catch (e) {}
        }
        return { points: pts, bestStreak: bestStreak, best: best, newBest: newBest };
      }
    };
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
    ".ac-fb{padding:10px 14px;border-radius:10px;font-weight:700;margin-top:8px}.ac-fb.ok{background:rgba(22,163,74,.15);color:#15803d}.ac-fb.bad{background:rgba(245,158,11,.18)}" +
    ".ac-ans{font-size:1.25rem;margin-top:4px}.ac-exp{font-weight:400;margin-top:4px;opacity:.85}" +
    ".ac-q{margin:6px 0}.ac-hint{opacity:.8;margin-bottom:8px}" +
    ".ac-sentence{font-size:1.2rem;line-height:2.4;margin-bottom:10px}" +
    ".ac-slot{font:inherit;min-width:90px;min-height:44px;margin:0 4px;padding:4px 12px;border:none;border-bottom:3px solid #0284c7;border-radius:6px;background:rgba(2,132,199,.08);color:inherit;cursor:pointer}" +
    ".ac-slot.ac-filled{background:#0284c7;color:#fff;border-bottom-color:#075985}" +
    ".ac-chips,.ac-tiles{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}" +
    ".ac-chip,.ac-tile{font:inherit;font-size:1.1rem;min-height:48px;min-width:48px;padding:8px 14px;border-radius:12px;border:2px solid #0284c7;background:transparent;color:inherit;cursor:pointer;touch-action:manipulation}" +
    ".ac-chip.ac-used{opacity:.3}.ac-tile.ac-in{background:#0284c7;color:#fff}" +
    ".ac-answer-line{min-height:62px;padding:6px;border:2px dashed rgba(127,127,127,.5);border-radius:12px;align-items:center}" +
    ".ac-placeholder{opacity:.55;padding:0 6px}" +
    ".ac-input{font:inherit;font-size:1.15rem;width:100%;max-width:520px;min-height:50px;padding:8px 12px;border-radius:10px;border:2px solid rgba(127,127,127,.5);background:transparent;color:inherit;display:block;margin:8px 0}" +
    "textarea.ac-input{min-height:90px}" +
    ".ac-link{font:inherit;font-size:.9rem;background:none;border:none;color:#0284c7;text-decoration:underline;cursor:pointer;padding:6px 0;margin-top:4px}" +
    ".ac-hud{font-weight:700;white-space:nowrap}" +
    ".ac-cheer{position:fixed;left:50%;top:22%;transform:translate(-50%,0) scale(1);z-index:9999;background:#f59e0b;color:#1f2937;font-weight:800;font-size:1.4rem;padding:14px 24px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.25);animation:ac-pop .35s ease-out;transition:opacity .5s,transform .5s;pointer-events:none}" +
    ".ac-cheer.ac-out{opacity:0;transform:translate(-50%,-30px)}" +
    "@keyframes ac-pop{from{transform:translate(-50%,0) scale(.4)}to{transform:translate(-50%,0) scale(1)}}" +
    ".ac-confetti{position:fixed;inset:0;pointer-events:none;z-index:9998;overflow:hidden}" +
    ".ac-confetti i{position:absolute;top:-12px;width:10px;height:14px;border-radius:2px;animation:ac-fall linear forwards}" +
    "@keyframes ac-fall{to{top:105vh;transform:rotate(720deg)}}" +
    ".ac-cheerline{font-size:1.15rem;font-weight:700}" +
    ".ac-gamebox{display:flex;flex-wrap:wrap;justify-content:center;gap:16px;margin:10px 0;padding:10px;border-radius:12px;background:rgba(245,158,11,.14)}" +
    ".ac-center{justify-content:center}" +
    ".ac-kps{margin:6px 0;display:flex;flex-wrap:wrap;gap:6px}.ac-kp{padding:3px 10px;border-radius:999px;font-weight:700}" +
    ".ac-kp.hit{background:rgba(22,163,74,.18);color:#15803d}.ac-kp.miss{background:rgba(220,38,38,.12);color:#b91c1c}" +
    ".ac-flag{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:#fde68a;color:#78350f;font-size:.85rem}" +
    "@media (prefers-reduced-motion:reduce){.ac-confetti{display:none}.ac-cheer{animation:none}}";
  function injectCSS() {
    if (document.getElementById("ac-css")) return;
    var s = document.createElement("style"); s.id = "ac-css"; s.textContent = CSS;
    document.head.appendChild(s);
  }

  return {
    VERSION: "2026-10-23c",
    esc: esc, el: el, btn: btn, shuffle: shuffle,
    speak: speak, stopSpeech: stopSpeech, getBestVoice: getBestVoice,
    dealer: dealer, stars: stars, result: result,
    drillBar: drillBar, resultView: resultView,
    recorder: recorder, oralCard: oralCard, pickMime: pickMime,
    norm: norm, matches: matches, scorePoints: function (t, p) { return scorePoints(t, keyPoints({points: p})); },
    wordBank: wordBank, tiles: tiles, openAnswer: openAnswer,
    game: game, praise: praise, cheer: cheer, confetti: confetti,
    WEBVIEW_NOTICE: WEBVIEW_NOTICE, injectCSS: injectCSS
  };
})();
