/* Part 2 QnA – a Pastest-style MCQ bank for the daily study topics.
   Plain JavaScript, no build tools. Progress is stored in this browser (localStorage).
   Use Settings → Export/Import to move progress between phone and laptop. */
(function () {
  "use strict";

  // ---------- data ----------
  const BANK = (window.QBANK && window.QBANK.chapters) || [];
  const Q = {};                 // qid -> question (with chapter info)
  BANK.forEach(ch => ch.questions.forEach(q => { Q[q.id] = Object.assign({ ch: ch.no, chTitle: ch.title, section: ch.section }, q); }));
  const ALL_IDS = Object.keys(Q);
  const LET = ["A", "B", "C", "D", "E", "F"];
  const SECS_PER_Q = 72;       // exam mode: 72 s per question (≈ MRCS-style pacing)

  // ---------- storage ----------
  const KEY = "p2qna.v1", SKEY = "p2qna.session";
  function load() {
    try { return Object.assign({ ans: {}, flags: {}, notes: {}, history: [], settings: {} }, JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (e) { return { ans: {}, flags: {}, notes: {}, history: [], settings: {} }; }
  }
  let DB = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }
  let S = null;
  try { S = JSON.parse(localStorage.getItem(SKEY) || "null"); } catch (e) { S = null; }
  if (S && !S.qids.every(id => Q[id])) S = null;
  function saveS() { try { S ? localStorage.setItem(SKEY, JSON.stringify(S)) : localStorage.removeItem(SKEY); } catch (e) {} }

  function record(qid, pick, mode) {
    const ok = pick === Q[qid].answer;
    const a = DB.ans[qid] || { n: 0, nOk: 0 };
    a.n += 1; if (ok) a.nOk += 1; a.last = pick; a.ok = ok; a.t = Date.now();
    DB.ans[qid] = a;
    if (!ok) enqueueWrong(qid, pick, mode);
    return ok;
  }

  // ---------- wrong answers → Google Drive (via Apps Script web app) ----------
  function wrongItem(qid, pick, mode) {
    const q = Q[qid], a = DB.ans[qid] || {};
    return {
      t: Date.now(), id: qid, ch: q.ch, chTitle: q.chTitle, stem: q.stem, options: q.options,
      pick: pick === undefined ? "(not answered)" : LET[pick] + ". " + q.options[pick],
      correct: LET[q.answer] + ". " + q.options[q.answer],
      explanation: q.explanation, ref: q.ref, mode: mode || "practice",
      n: a.n || 0, nOk: a.nOk || 0, note: DB.notes[qid] || ""
    };
  }
  function enqueueWrong(qid, pick, mode) {
    DB.outbox = DB.outbox || [];
    DB.outbox.push(wrongItem(qid, pick, mode));
    scheduleSync();
  }
  let syncT = null, syncing = false;
  function scheduleSync() { clearTimeout(syncT); syncT = setTimeout(() => syncNow(false), 1500); }
  async function syncNow(loud) {
    const url = (DB.settings.syncUrl || "").trim();
    DB.outbox = DB.outbox || [];
    if (!url) { if (loud) toast("Add your Google Drive sync link in Settings first"); return false; }
    if (!DB.outbox.length) { if (loud) toast("Nothing waiting to send"); return true; }
    if (syncing) return false;
    if (!navigator.onLine) { if (loud) toast("Offline – will send when you're back online"); return false; }
    syncing = true;
    const batch = DB.outbox.slice(0, 100);
    const body = JSON.stringify({ token: DB.settings.syncToken || "", items: batch });
    let ok = false, msg = "";
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
      const j = await r.json(); ok = !!j.ok; msg = j.error || "";
    } catch (e) {
      // Some browsers block reading the reply; send blind and trust it.
      try { await fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body }); ok = true; }
      catch (e2) { ok = false; msg = "network error"; }
    }
    syncing = false;
    if (ok) {
      DB.outbox = DB.outbox.slice(batch.length); DB.settings.lastSync = Date.now(); save();
      if (loud) toast(`Sent ${batch.length} wrong answer${batch.length > 1 ? "s" : ""} to Google Drive`);
      if (DB.outbox.length) return syncNow(loud);
    } else { save(); if (loud) toast("Sync failed" + (msg ? ": " + msg : "") + " – will retry later"); }
    refreshSyncBadges();
    return ok;
  }
  function refreshSyncBadges() {
    document.querySelectorAll("[data-outbox]").forEach(el => el.textContent = (DB.outbox || []).length);
  }
  function wrongMarkdown() {
    const ids = ALL_IDS.filter(id => DB.ans[id] && !DB.ans[id].ok);
    let md = `# Part 2 QnA – wrong answers\nExported ${new Date().toLocaleString()} · ${ids.length} questions\n\n`;
    ids.forEach((id, k) => {
      const it = wrongItem(id, DB.ans[id].last, "export");
      md += `## ${k + 1}. [${String(it.ch).padStart(3, "0")} ${it.chTitle}] ${id}\n\n${it.stem}\n\n`;
      it.options.forEach((o, i) => md += `- ${LET[i]}. ${o}\n`);
      md += `\n**My answer:** ${it.pick}  \n**Correct:** ${it.correct}  \n**Record:** ${it.nOk}/${it.n} correct\n\n**Explanation:** ${it.explanation}\n\n*Source: ${it.ref}*\n`;
      if (it.note) md += `\n**My notes:** ${it.note}\n`;
      md += `\n---\n\n`;
    });
    return { md, n: ids.length };
  }
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type || "text/plain" }));
    a.download = name; a.click();
  }
  window.addEventListener("online", () => syncNow(false));

  // ---------- helpers ----------
  const app = document.getElementById("app");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
  const fmtTime = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }
  function statsFor(ids) {
    let answered = 0, correct = 0;
    ids.forEach(id => { const a = DB.ans[id]; if (a) { answered++; if (a.ok) correct++; } });
    return { total: ids.length, answered, correct, wrong: answered - correct };
  }
  function bar(st) {
    return `<div class="bar"><span class="c" style="width:${pct(st.correct, st.total)}%"></span><span class="w" style="width:${pct(st.wrong, st.total)}%"></span></div>`;
  }
  const chIds = ch => ch.questions.map(q => q.id);
  const filterIds = (ids, f) => ids.filter(id => {
    const a = DB.ans[id];
    if (f === "unanswered") return !a;
    if (f === "incorrect") return a && !a.ok;
    if (f === "flagged") return !!DB.flags[id];
    return true;
  });

  // ---------- sessions ----------
  function startSession(ids, opts) {
    if (!ids.length) { toast("No questions match those filters."); return; }
    stopTimer();
    if (opts.shuffle) ids = shuffle(ids);
    if (opts.limit && opts.limit < ids.length) ids = ids.slice(0, opts.limit);
    S = {
      title: opts.title || "Session", mode: opts.mode || "practice", qids: ids, idx: 0,
      picks: {}, done: {}, struck: {}, started: Date.now(), elapsed: 0,
      limit: opts.mode === "exam" ? ids.length * SECS_PER_Q : null, finished: false
    };
    saveS(); location.hash = "#/q";
  }
  function finishSession() {
    if (!S) return;
    stopTimer();
    if (S.mode === "exam") {
      S.qids.forEach(id => { if (S.picks[id] !== undefined) record(id, S.picks[id], "exam"); S.done[id] = true; });
    }
    const st = { n: S.qids.length, ok: 0, ans: 0 };
    S.qids.forEach(id => { if (S.picks[id] !== undefined && S.done[id]) { st.ans++; if (S.picks[id] === Q[id].answer) st.ok++; } });
    DB.history.unshift({ t: Date.now(), title: S.title, mode: S.mode, n: st.n, ok: st.ok, ans: st.ans, secs: Math.round(S.elapsed) });
    DB.history = DB.history.slice(0, 50);
    S.finished = true; S.mode = S.mode === "exam" ? "review" : S.mode;
    save(); saveS(); location.hash = "#/results";
  }

  // timer
  let timerH = null, lastTick = 0;
  function startTimer() {
    stopTimer(); lastTick = Date.now();
    timerH = setInterval(() => {
      if (!S || S.finished) return stopTimer();
      const now = Date.now(); S.elapsed += (now - lastTick) / 1000; lastTick = now;
      const el = document.getElementById("timer");
      if (S.limit) {
        const left = S.limit - S.elapsed;
        if (el) el.textContent = fmtTime(left);
        if (left <= 0) { saveS(); toast("Time is up"); finishSession(); return; }
      } else if (el) el.textContent = fmtTime(S.elapsed);
      if (Math.round(S.elapsed) % 5 === 0) saveS();
    }, 1000);
  }
  function stopTimer() { if (timerH) { clearInterval(timerH); timerH = null; if (S) saveS(); } }

  // ---------- views ----------
  function setNav(name) { document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === name)); }

  function viewDash() {
    setNav("dash");
    const st = statsFor(ALL_IDS);
    const wrongN = filterIds(ALL_IDS, "incorrect").length, flagN = filterIds(ALL_IDS, "flagged").length, unN = filterIds(ALL_IDS, "unanswered").length;
    const latest = BANK[BANK.length - 1];
    let h = `<h1>Dashboard</h1><p class="sub">${BANK.length} chapters · ${ALL_IDS.length} questions from your daily study topics</p>`;
    if (S && !S.finished) {
      h += `<div class="card" style="margin-bottom:14px;border-color:var(--teal)"><div class="row"><div><b>Session in progress:</b> ${esc(S.title)}<div class="ch-meta">Question ${S.idx + 1} of ${S.qids.length} · ${S.mode === "exam" ? "Exam mode" : "Practice mode"}</div></div><div class="spacer"></div><a class="btn primary" href="#/q">Resume</a></div></div>`;
    }
    h += `<div class="grid g3">
      <div class="card stat"><div class="k">Answered</div><div class="v">${st.answered}<small> / ${st.total}</small></div><div style="margin-top:10px">${bar(st)}</div>
        <div class="legend"><span><i class="dot" style="background:var(--good)"></i>${st.correct} correct</span><span><i class="dot" style="background:var(--bad)"></i>${st.wrong} incorrect</span></div></div>
      <div class="card stat"><div class="k">Score (answered)</div><div class="v">${pct(st.correct, st.answered)}<small>%</small></div><div class="ch-meta" style="margin-top:8px">Based on your latest attempt at each question</div></div>
      <div class="card stat"><div class="k">Latest topic</div><div style="font-weight:700;margin-top:4px">${latest ? String(latest.no).padStart(3, "0") + " · " + esc(latest.title) : "—"}</div>
        ${latest ? `<button class="btn sm primary" style="margin-top:10px" data-start-ch="${latest.no}">Practise it</button>` : ""}</div>
    </div>
    <h2>Quick start</h2>
    <div class="row">
      <button class="btn primary" data-quick="unanswered" ${unN ? "" : "disabled"}>▶ Unanswered (${unN})</button>
      <button class="btn" data-quick="incorrect" ${wrongN ? "" : "disabled"}>↻ Incorrect (${wrongN})</button>
      <button class="btn" data-quick="flagged" ${flagN ? "" : "disabled"}>⚑ Flagged (${flagN})</button>
      <button class="btn" data-quick="random">⤮ Random 20</button>
      <button class="btn" data-quick="mock">⏱ Timed mock (50)</button>
    </div>
    <h2>Progress by chapter</h2><div class="card list">`;
    BANK.forEach(ch => {
      const s = statsFor(chIds(ch));
      h += `<div class="ch" data-goto="#/chapter/${ch.no}"><div class="ch-no">${String(ch.no).padStart(3, "0")}</div>
        <div class="ch-main"><div class="ch-title">${esc(ch.title)}</div><div style="margin-top:6px">${bar(s)}</div></div>
        <div class="ch-score"><b>${s.answered ? pct(s.correct, s.answered) + "%" : "—"}</b>${s.answered}/${s.total}</div></div>`;
    });
    h += `</div>`;
    if (DB.history.length) {
      h += `<h2>Recent sessions</h2><div class="card list">`;
      DB.history.slice(0, 6).forEach(x => {
        h += `<div class="ch" style="cursor:default"><div class="ch-main"><div class="ch-title">${esc(x.title)}</div><div class="ch-meta">${new Date(x.t).toLocaleString()} · ${x.mode === "practice" ? "Practice" : "Exam"} · ${fmtTime(x.secs)}</div></div><div class="ch-score"><b>${pct(x.ok, x.n)}%</b>${x.ok}/${x.n}</div></div>`;
      });
      h += `</div>`;
    }
    app.innerHTML = h;
    app.querySelectorAll("[data-quick]").forEach(b => b.onclick = () => {
      const k = b.dataset.quick;
      if (k === "random") return startSession(ALL_IDS, { shuffle: true, limit: 20, title: "Random 20", mode: "practice" });
      if (k === "mock") return startSession(ALL_IDS, { shuffle: true, limit: 50, title: "Timed mock – 50 questions", mode: "exam" });
      startSession(filterIds(ALL_IDS, k), { shuffle: k !== "unanswered", title: { unanswered: "Unanswered questions", incorrect: "Retry incorrect", flagged: "Flagged questions" }[k], mode: "practice" });
    });
    bindCommon();
  }

  function viewChapters() {
    setNav("chapters");
    let h = `<h1>Chapters</h1><p class="sub">One chapter per daily topic. Tap a chapter to start.</p>`;
    const sections = [];
    BANK.forEach(ch => { if (!sections.includes(ch.section)) sections.push(ch.section); });
    sections.forEach(sec => {
      h += `<div class="section-h">${esc(sec)}</div><div class="card list">`;
      BANK.filter(c => c.section === sec).forEach(ch => {
        const s = statsFor(chIds(ch));
        h += `<div class="ch" data-goto="#/chapter/${ch.no}"><div class="ch-no">${String(ch.no).padStart(3, "0")}</div>
          <div class="ch-main"><div class="ch-title">${esc(ch.title)}</div><div class="ch-meta">${ch.questions.length} questions${ch.delivered ? " · topic sent " + esc(ch.delivered) : ""}</div><div style="margin-top:6px">${bar(s)}</div></div>
          <div class="ch-score"><b>${s.answered ? pct(s.correct, s.answered) + "%" : "—"}</b>${s.answered}/${s.total}</div></div>`;
      });
      h += `</div>`;
    });
    app.innerHTML = h; bindCommon();
  }

  function viewChapter(no) {
    setNav("chapters");
    const ch = BANK.find(c => c.no === no); if (!ch) return go("#/chapters");
    const ids = chIds(ch), s = statsFor(ids);
    const un = filterIds(ids, "unanswered").length, wr = filterIds(ids, "incorrect").length, fl = filterIds(ids, "flagged").length;
    let h = `<a href="#/chapters" class="ch-meta">← All chapters</a>
      <h1 style="margin-top:8px">${String(ch.no).padStart(3, "0")} · ${esc(ch.title)}</h1><p class="sub">${esc(ch.section)}${ch.delivered ? " · topic sent " + esc(ch.delivered) : ""}</p>
      <div class="card"><div class="row"><div class="stat"><div class="k">Progress</div><div class="v">${s.answered}<small> / ${s.total}</small></div></div><div class="spacer"></div>
      <div class="stat" style="text-align:right"><div class="k">Score</div><div class="v">${s.answered ? pct(s.correct, s.answered) : "—"}<small>${s.answered ? "%" : ""}</small></div></div></div>
      <div style="margin-top:10px">${bar(s)}</div></div>
      <h2>Start</h2>
      <div class="field"><span class="lbl">Mode</span><div class="seg" id="modeSeg"><button class="on" data-v="practice">Practice (instant answers)</button><button data-v="exam">Exam (timed, answers at end)</button></div></div>
      <div class="row">
        <button class="btn primary" data-f="all">All ${ids.length} in order</button>
        <button class="btn" data-f="unanswered" ${un ? "" : "disabled"}>Unanswered (${un})</button>
        <button class="btn" data-f="incorrect" ${wr ? "" : "disabled"}>Incorrect (${wr})</button>
        <button class="btn" data-f="flagged" ${fl ? "" : "disabled"}>Flagged (${fl})</button>
        <button class="btn" data-f="shuffle">Shuffled</button>
      </div>
      <h2>Questions in this chapter</h2><div class="card list">`;
    ids.forEach((id, i) => {
      const a = DB.ans[id];
      h += `<div class="res-item" data-goto="#/view/${id}" style="padding:12px 16px"><div class="res-ic ${a ? (a.ok ? "ok" : "no") : "sk"}">${a ? (a.ok ? "✓" : "✗") : i + 1}</div><div class="res-txt">${DB.flags[id] ? "⚑ " : ""}${esc(Q[id].stem)}</div></div>`;
    });
    h += `</div>`;
    app.innerHTML = h;
    let mode = "practice";
    app.querySelectorAll("#modeSeg button").forEach(b => b.onclick = () => { mode = b.dataset.v; app.querySelectorAll("#modeSeg button").forEach(x => x.classList.toggle("on", x === b)); });
    app.querySelectorAll("[data-f]").forEach(b => b.onclick = () => {
      const f = b.dataset.f;
      const list = f === "shuffle" || f === "all" ? ids : filterIds(ids, f);
      startSession(list, { shuffle: f === "shuffle", mode, title: `${String(ch.no).padStart(3, "0")} · ${ch.title}` });
    });
    bindCommon();
  }

  function viewCustom() {
    setNav("custom");
    let h = `<h1>Create a session</h1><p class="sub">Pick chapters, filters and mode – like building a Pastest test.</p>
      <div class="grid g2"><div class="card"><div class="row"><b>Chapters</b><div class="spacer"></div><button class="btn sm" id="selAll">Select all</button><button class="btn sm" id="selNone">Clear</button></div><div style="margin-top:8px">`;
    BANK.forEach(ch => {
      const s = statsFor(chIds(ch));
      h += `<label class="chk"><input type="checkbox" value="${ch.no}" checked><span><b>${String(ch.no).padStart(3, "0")}</b> ${esc(ch.title)}<br><span class="ch-meta">${s.answered}/${s.total} answered</span></span></label>`;
    });
    h += `</div></div><div class="card">
      <div class="field"><span class="lbl">Questions</span><div class="seg" id="fSeg"><button class="on" data-v="all">All</button><button data-v="unanswered">Unanswered</button><button data-v="incorrect">Incorrect</button><button data-v="flagged">Flagged</button></div></div>
      <div class="field"><span class="lbl">Mode</span><div class="seg" id="mSeg"><button class="on" data-v="practice">Practice</button><button data-v="exam">Exam (timed)</button></div>
        <div class="ch-meta" style="margin-top:6px">Exam mode gives ${SECS_PER_Q} s per question and shows answers only at the end.</div></div>
      <div class="field"><span class="lbl">Number of questions</span><input type="number" id="nQ" min="1" value="20" style="width:110px"> <span class="ch-meta" id="avail"></span></div>
      <div class="field"><label class="chk" style="border:0;padding-left:0"><input type="checkbox" id="shuf" checked><span>Shuffle question order</span></label></div>
      <button class="btn primary" id="go" style="width:100%">Start session</button></div></div>`;
    app.innerHTML = h;
    let f = "all", mode = "practice";
    const boxes = () => [...app.querySelectorAll("input[type=checkbox][value]")];
    const pool = () => { const chs = boxes().filter(b => b.checked).map(b => +b.value); return filterIds(ALL_IDS.filter(id => chs.includes(Q[id].ch)), f); };
    const upd = () => { const n = pool().length; app.querySelector("#avail").textContent = `${n} available`; };
    const seg = (id, cb) => app.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => { app.querySelectorAll(`#${id} button`).forEach(x => x.classList.toggle("on", x === b)); cb(b.dataset.v); upd(); });
    seg("fSeg", v => f = v); seg("mSeg", v => mode = v);
    boxes().forEach(b => b.onchange = upd);
    app.querySelector("#selAll").onclick = () => { boxes().forEach(b => b.checked = true); upd(); };
    app.querySelector("#selNone").onclick = () => { boxes().forEach(b => b.checked = false); upd(); };
    app.querySelector("#go").onclick = () => {
      const n = Math.max(1, parseInt(app.querySelector("#nQ").value, 10) || 20);
      startSession(pool(), { shuffle: app.querySelector("#shuf").checked, limit: n, mode, title: `Custom session (${mode === "exam" ? "exam" : "practice"})` });
    };
    upd();
  }

  function viewReview() {
    setNav("review");
    const wrong = filterIds(ALL_IDS, "incorrect"), flags = filterIds(ALL_IDS, "flagged"), notes = ALL_IDS.filter(id => DB.notes[id]);
    const block = (title, ids, f) => {
      let h = `<h2>${title} <span class="pill">${ids.length}</span></h2>`;
      if (!ids.length) return h + `<div class="card empty">Nothing here yet.</div>`;
      if (f) h += `<div class="row" style="margin-bottom:10px"><button class="btn sm primary" data-rev="${f}">Practise these</button></div>`;
      h += `<div class="card list">`;
      ids.forEach(id => h += `<div class="res-item" data-goto="#/view/${id}" style="padding:12px 16px"><span class="pill">${String(Q[id].ch).padStart(3, "0")}</span><div class="res-txt">${esc(Q[id].stem)}${f === null ? `<div class="ch-meta">📝 ${esc(DB.notes[id])}</div>` : ""}</div></div>`);
      return h + `</div>`;
    };
    const linked = !!(DB.settings.syncUrl || "").trim();
    const driveCard = `<div class="card" style="margin-bottom:6px"><div class="row"><div><b>☁ Google Drive</b>
      <div class="ch-meta">${linked ? `Wrong answers are sent automatically · <span data-outbox>${(DB.outbox || []).length}</span> waiting${DB.settings.lastSync ? " · last sent " + new Date(DB.settings.lastSync).toLocaleString() : ""}` : "Not linked yet – set it up in Settings so wrong answers go to Drive automatically"}</div></div>
      <div class="spacer"></div>${linked ? `<button class="btn sm primary" id="syncNow">Send now</button><button class="btn sm" id="sendAll">Send all ${wrong.length} wrong</button>` : `<a class="btn sm primary" href="#/settings">Set up</a>`}
      <button class="btn sm" id="dlWrong">Download (.md)</button></div></div>`;
    app.innerHTML = `<h1>Review</h1><p class="sub">Questions you got wrong, flagged, or wrote notes on.</p>` + driveCard +
      block("Incorrect", wrong, "incorrect") + block("Flagged", flags, "flagged") + block("My notes", notes, null);
    const sn = document.getElementById("syncNow"); if (sn) sn.onclick = () => syncNow(true).then(() => viewReview());
    const sa = document.getElementById("sendAll"); if (sa) sa.onclick = () => {
      if (!wrong.length) return toast("No wrong answers to send");
      wrong.forEach(id => { DB.outbox = DB.outbox || []; DB.outbox.push(wrongItem(id, DB.ans[id].last, "review-export")); });
      save(); syncNow(true).then(() => viewReview());
    };
    document.getElementById("dlWrong").onclick = () => { const { md, n } = wrongMarkdown(); if (!n) return toast("No wrong answers yet"); download(`part2qna-wrong-answers-${new Date().toISOString().slice(0, 10)}.md`, md, "text/markdown"); };
    app.querySelectorAll("[data-rev]").forEach(b => b.onclick = () => startSession(filterIds(ALL_IDS, b.dataset.rev), { shuffle: true, mode: "practice", title: b.dataset.rev === "incorrect" ? "Retry incorrect" : "Flagged questions" }));
    bindCommon();
  }

  // the question screen (session) – also used for single-question view
  function renderQuestion(qid, ctx) {
    const q = Q[qid];
    const pick = ctx.pick, revealed = ctx.revealed, struck = ctx.struck || [];
    let h = `<div class="qtop">`;
    if (ctx.session) {
      h += `<span class="qcount">Question ${S.idx + 1} of ${S.qids.length}</span>`;
      if (S.mode === "exam") h += `<span class="timer" id="timer">${fmtTime(S.limit - S.elapsed)}</span>`;
      else if (S.mode === "practice") h += `<span class="timer" id="timer" style="background:var(--navy-2)">${fmtTime(S.elapsed)}</span>`;
      else h += `<span class="pill">Reviewing</span>`;
    } else h += `<a href="javascript:history.back()" class="ch-meta">← Back</a>`;
    h += `<span class="spacer"></span><button class="flag ${DB.flags[qid] ? "on" : ""}" id="flagBtn">⚑ ${DB.flags[qid] ? "Flagged" : "Flag"}</button></div>
      <div class="card"><div class="qchap">${String(q.ch).padStart(3, "0")} · ${esc(q.chTitle)}</div>
      <div class="stem">${esc(q.stem)}</div><div class="opts">`;
    q.options.forEach((o, i) => {
      let cls = "opt";
      if (revealed) { cls += " locked"; if (i === q.answer) cls += " correct"; else if (i === pick) cls += " wrong"; }
      else if (i === pick) cls += " sel";
      if (struck.includes(i) && !revealed) cls += " struck";
      const tag = revealed ? (i === q.answer ? `<span class="tag">✓ Correct answer</span>` : i === pick ? `<span class="tag">Your answer</span>` : "") : "";
      h += `<div class="${cls}" data-opt="${i}" role="button" tabindex="0"><span class="let">${LET[i]}</span><span class="txt">${esc(o)}</span>${tag}${revealed ? "" : `<button class="strike" data-strike="${i}" title="Strike out">✕</button>`}</div>`;
    });
    h += `</div>`;
    if (revealed) {
      const ok = pick === q.answer;
      h += pick === undefined ? `<div class="verdict bad">Not answered</div>` : `<div class="verdict ${ok ? "good" : "bad"}">${ok ? "✓ Correct" : "✗ Incorrect"}</div>`;
      const a = DB.ans[qid];
      h += `<div class="explain"><h3>Explanation</h3><div>${esc(q.explanation)}</div>${q.ref ? `<div class="ref">Source: ${esc(q.ref)}</div>` : ""}
        ${a ? `<div class="ref">Your record: ${a.nOk}/${a.n} correct across attempts</div>` : ""}</div>
        <div class="field"><span class="lbl">My notes</span><textarea id="note" placeholder="Add a note to this question…">${esc(DB.notes[qid] || "")}</textarea></div>`;
    }
    h += `</div>`;
    return h;
  }

  function viewSession() {
    if (!S) return go("#/");
    const qid = S.qids[S.idx];
    const revealed = S.mode === "review" || (S.mode === "practice" && S.done[qid]);
    let h = renderQuestion(qid, { session: true, pick: S.picks[qid], revealed, struck: S.struck[qid] });
    const last = S.idx === S.qids.length - 1;
    h += `<div class="qnav"><button class="btn" id="prev" ${S.idx ? "" : "disabled"}>← Previous</button><span class="spacer"></span>`;
    if (S.mode === "practice" && !revealed) h += `<button class="btn primary" id="submit" ${S.picks[qid] === undefined ? "disabled" : ""}>Submit answer</button>`;
    else if (!last) h += `<button class="btn primary" id="next">Next →</button>`;
    if (S.mode === "review") h += `<a class="btn" href="#/results">Results</a>`;
    else if (last && (S.mode === "exam" || revealed)) h += `<button class="btn primary" id="finish">Finish session</button>`;
    else h += `<button class="btn" id="end">End session</button>`;
    h += `</div><details class="navbox"><summary>Question navigator</summary><div class="navgrid">`;
    S.qids.forEach((id, i) => {
      let c = i === S.idx ? "cur" : "";
      if (S.done[id] && S.mode !== "exam") c += S.picks[id] === Q[id].answer ? " ok" : " no";
      else if (S.picks[id] !== undefined) c += " ans";
      if (DB.flags[id]) c += " fl";
      h += `<button class="${c}" data-jump="${i}">${i + 1}</button>`;
    });
    h += `</div></details><div class="kbd">Keys: <kbd>A</kbd>–<kbd>E</kbd> choose · <kbd>Enter</kbd> submit/next · <kbd>←</kbd><kbd>→</kbd> move · <kbd>F</kbd> flag</div>`;
    app.innerHTML = h; window.scrollTo(0, 0);
    setNav("");
    if (S.mode !== "review" && !S.finished) startTimer(); else stopTimer();

    const choose = i => {
      if (revealed) return;
      S.picks[qid] = i; const st = S.struck[qid]; if (st) S.struck[qid] = st.filter(x => x !== i);
      saveS(); viewSession();
    };
    app.querySelectorAll("[data-opt]").forEach(el => el.onclick = e => { if (e.target.closest("[data-strike]")) return; choose(+el.dataset.opt); });
    app.querySelectorAll("[data-strike]").forEach(b => b.onclick = e => {
      e.stopPropagation(); const i = +b.dataset.strike; const st = S.struck[qid] || [];
      S.struck[qid] = st.includes(i) ? st.filter(x => x !== i) : st.concat(i);
      if (S.picks[qid] === i) delete S.picks[qid];
      saveS(); viewSession();
    });
    const sub = document.getElementById("submit");
    if (sub) sub.onclick = submit;
    const nx = document.getElementById("next"); if (nx) nx.onclick = () => move(1);
    const pv = document.getElementById("prev"); if (pv) pv.onclick = () => move(-1);
    const fin = document.getElementById("finish"); if (fin) fin.onclick = () => finishSession();
    const end = document.getElementById("end"); if (end) end.onclick = () => {
      const unans = S.qids.filter(id => S.picks[id] === undefined).length;
      if (confirm(S.mode === "exam" ? `Finish now? ${unans} question(s) unanswered.` : "End this session and see results?")) finishSession();
    };
    app.querySelectorAll("[data-jump]").forEach(b => b.onclick = () => { S.idx = +b.dataset.jump; saveS(); viewSession(); });
    bindFlagNote(qid);
  }
  function submit() {
    const qid = S.qids[S.idx];
    if (S.mode !== "practice" || S.done[qid] || S.picks[qid] === undefined) return;
    record(qid, S.picks[qid], "practice"); S.done[qid] = true; save(); saveS(); viewSession();
  }
  function move(d) { const n = S.idx + d; if (n < 0 || n >= S.qids.length) return; S.idx = n; saveS(); viewSession(); }

  function bindFlagNote(qid) {
    const fb = document.getElementById("flagBtn");
    if (fb) fb.onclick = () => { if (DB.flags[qid]) delete DB.flags[qid]; else DB.flags[qid] = true; save(); route(); };
    const nt = document.getElementById("note");
    if (nt) nt.oninput = () => { const v = nt.value.trim(); if (v) DB.notes[qid] = v; else delete DB.notes[qid]; save(); };
  }

  function viewSingle(qid) {
    if (!Q[qid]) return go("#/");
    setNav("");
    const a = DB.ans[qid];
    app.innerHTML = renderQuestion(qid, { pick: a ? a.last : undefined, revealed: true }) +
      `<div class="qnav"><button class="btn primary" id="tryAgain">Try this question again</button></div>`;
    bindFlagNote(qid);
    document.getElementById("tryAgain").onclick = () => startSession([qid], { mode: "practice", title: "Single question" });
  }

  function viewResults() {
    if (!S) return go("#/");
    stopTimer();
    const n = S.qids.length; let ok = 0, ans = 0;
    S.qids.forEach(id => { if (S.picks[id] !== undefined && S.done[id]) { ans++; if (S.picks[id] === Q[id].answer) ok++; } });
    let h = `<h1>Session results</h1><p class="sub">${esc(S.title)} · ${fmtTime(S.elapsed)}</p>
      <div class="grid g3"><div class="card stat"><div class="k">Score</div><div class="big-score">${pct(ok, n)}%</div></div>
      <div class="card stat"><div class="k">Correct</div><div class="v">${ok}<small> / ${n}</small></div></div>
      <div class="card stat"><div class="k">Answered</div><div class="v">${ans}<small> / ${n}</small></div></div></div>
      <div class="row" style="margin-top:16px"><button class="btn primary" id="revAll">Review all answers</button>
      <button class="btn" id="retryWrong" ${ok < n ? "" : "disabled"}>Retry the ones I missed</button><a class="btn" href="#/">Dashboard</a></div>
      <h2>Questions</h2><div class="card list">`;
    S.qids.forEach((id, i) => {
      const p = S.picks[id], done = S.done[id] && p !== undefined, good = done && p === Q[id].answer;
      h += `<div class="res-item" data-rv="${i}" style="padding:12px 16px"><div class="res-ic ${done ? (good ? "ok" : "no") : "sk"}">${done ? (good ? "✓" : "✗") : "–"}</div><div class="res-txt"><b>Q${i + 1}.</b> ${esc(Q[id].stem)}</div></div>`;
    });
    app.innerHTML = h + `</div>`;
    setNav("");
    const rv = i => { S.mode = "review"; S.idx = i; saveS(); location.hash = "#/q"; };
    document.getElementById("revAll").onclick = () => rv(0);
    app.querySelectorAll("[data-rv]").forEach(el => el.onclick = () => rv(+el.dataset.rv));
    document.getElementById("retryWrong").onclick = () => startSession(S.qids.filter(id => S.picks[id] !== Q[id].answer), { mode: "practice", title: "Retry missed questions" });
  }

  function viewSettings() {
    setNav("settings");
    app.innerHTML = `<h1>Settings</h1><p class="sub">Your progress is saved in this browser only.</p>
      <div class="card"><div class="row"><div><b>Dark mode</b></div><div class="spacer"></div><button class="btn sm" id="dark">${DB.settings.dark ? "On" : "Off"}</button></div></div>
      <h2>Send wrong answers to Google Drive</h2>
      <div class="card"><p style="margin-top:0">Paste the Web app link from your Google Apps Script (see <b>apps-script/SETUP.md</b> in the repo). Every wrong answer is then added to the Google Sheet <i>"Part 2 QnA – Wrong Answers"</i> in your Drive, ready for Claude to analyse.</p>
        <div class="field"><span class="lbl">Web app link</span><input id="syncUrl" style="width:100%" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(DB.settings.syncUrl || "")}"></div>
        <div class="field"><span class="lbl">Secret word (optional – must match TOKEN in the script)</span><input id="syncToken" style="width:100%" value="${esc(DB.settings.syncToken || "")}"></div>
        <div class="row"><button class="btn primary" id="saveSync">Save</button><button class="btn" id="testSync">Save &amp; send test</button>
        <span class="ch-meta"><span data-outbox>${(DB.outbox || []).length}</span> waiting to send${DB.settings.lastSync ? " · last sent " + new Date(DB.settings.lastSync).toLocaleString() : ""}</span></div></div>
      <h2>Move progress between devices</h2>
      <div class="card"><p style="margin-top:0">Export a backup file on one device and import it on the other (e.g. laptop → phone).</p>
        <div class="row"><button class="btn primary" id="exp">Export progress</button><label class="btn">Import progress<input type="file" id="imp" accept="application/json" hidden></label></div></div>
      <h2>Reset</h2>
      <div class="card"><div class="row"><button class="btn danger" id="reset">Reset all progress</button><span class="ch-meta">Clears answers, flags, notes and history.</span></div></div>
      <h2>About</h2><div class="card ch-meta">${BANK.length} chapters · ${ALL_IDS.length} questions. Questions were written from your daily study notes (Master of Surgery – Daily Study Notes). Add new chapters with build.py – see README.md.</div>`;
    const keep = () => { DB.settings.syncUrl = document.getElementById("syncUrl").value.trim(); DB.settings.syncToken = document.getElementById("syncToken").value.trim(); save(); };
    document.getElementById("saveSync").onclick = () => { keep(); toast("Saved"); syncNow(false); };
    document.getElementById("testSync").onclick = () => {
      keep();
      DB.outbox = DB.outbox || [];
      DB.outbox.push({ t: Date.now(), id: "TEST", ch: 0, chTitle: "Connection test", stem: "Test row from Part 2 QnA – you can delete this row.", options: [], pick: "-", correct: "-", explanation: "-", ref: "-", mode: "test", n: 0, nOk: 0, note: "" });
      save(); syncNow(true).then(() => viewSettings());
    };
    document.getElementById("dark").onclick = () => { DB.settings.dark = !DB.settings.dark; save(); applyTheme(); viewSettings(); };
    document.getElementById("exp").onclick = () => {
      const blob = new Blob([JSON.stringify(DB, null, 1)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `part2qna-progress-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    };
    document.getElementById("imp").onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader(); r.onload = () => {
        try { const d = JSON.parse(r.result); if (!d.ans) throw 0; DB = Object.assign({ ans: {}, flags: {}, notes: {}, history: [], settings: {} }, d); save(); applyTheme(); toast("Progress imported"); viewSettings(); }
        catch (err) { toast("That file isn't a Part 2 QnA backup"); }
      }; r.readAsText(f);
    };
    document.getElementById("reset").onclick = () => { if (confirm("Reset ALL progress? This cannot be undone.")) { DB = { ans: {}, flags: {}, notes: {}, history: [], settings: DB.settings }; S = null; save(); saveS(); toast("Progress reset"); } };
  }

  // ---------- router ----------
  function bindCommon() {
    app.querySelectorAll("[data-goto]").forEach(el => el.onclick = () => go(el.dataset.goto));
    app.querySelectorAll("[data-start-ch]").forEach(b => b.onclick = () => go("#/chapter/" + b.dataset.startCh));
  }
  function go(h) { location.hash = h; }
  function route() {
    const h = location.hash || "#/";
    if (!h.startsWith("#/q")) stopTimer();
    let m;
    if (h === "#/" || h === "#") viewDash();
    else if (h === "#/chapters") viewChapters();
    else if ((m = h.match(/^#\/chapter\/(\d+)/))) viewChapter(+m[1]);
    else if (h === "#/custom") viewCustom();
    else if (h === "#/review") viewReview();
    else if (h === "#/settings") viewSettings();
    else if (h === "#/q") viewSession();
    else if (h === "#/results") viewResults();
    else if ((m = h.match(/^#\/view\/(.+)/))) viewSingle(decodeURIComponent(m[1]));
    else viewDash();
  }
  function applyTheme() { document.body.classList.toggle("dark", !!DB.settings.dark); }

  document.addEventListener("keydown", e => {
    if (location.hash !== "#/q" || !S || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const k = e.key.toLowerCase(), qid = S.qids[S.idx];
    const revealed = S.mode === "review" || (S.mode === "practice" && S.done[qid]);
    const map = { a: 0, b: 1, c: 2, d: 3, e: 4, "1": 0, "2": 1, "3": 2, "4": 3, "5": 4 };
    if (k in map && !revealed && map[k] < Q[qid].options.length) { S.picks[qid] = map[k]; saveS(); viewSession(); }
    else if (k === "enter") { if (S.mode === "practice" && !revealed) submit(); else if (S.idx < S.qids.length - 1) move(1); }
    else if (k === "arrowright") move(1);
    else if (k === "arrowleft") move(-1);
    else if (k === "f") { if (DB.flags[qid]) delete DB.flags[qid]; else DB.flags[qid] = true; save(); viewSession(); }
  });
  window.addEventListener("hashchange", route);
  window.addEventListener("beforeunload", () => { if (S) saveS(); });
  applyTheme();
  route();
  setTimeout(() => syncNow(false), 2000);
})();
