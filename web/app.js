'use strict';
/*
 * Hittem - fully client-side. Contacts and decisions live only in this browser
 * (localStorage). There are no network calls and no analytics. Nothing leaves the device.
 */
(function () {
  const KEY = 'hittem:data:v1';
  const THRESH = 110;   // px drag to commit a swipe
  const STACK = 3;      // cards rendered in the stack

  let store = { contacts: [], decisions: {} };
  let deck = [];        // contact ids, index 0 = top
  let view = 'loading';
  let pending = null;   // candidate awaiting a call outcome
  let undo = null;      // { id, prevDecision } for one-level undo

  const app = document.getElementById('app');

  // ---------- icons ----------
  const I = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.6 15.6 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.3 1z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10a6 6 0 1 1 0 12H7"/><path d="M3 8l4-4M3 8l4 4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>',
    nosignal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 4l16 16"/><path d="M6.6 10.8a15.6 15.6 0 0 0 6.6 6.6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg>'
  };

  // ---------- storage ----------
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) store = JSON.parse(raw); } catch (e) {}
    if (!store.contacts) store.contacts = [];
    if (!store.decisions) store.decisions = {};
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { toast('Storage is full'); }
  }

  // ---------- helpers ----------
  const esc = (s) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
  const digits = (s) => (s || '').replace(/[^\d+*#]/g, '');
  function idFor(phone, name) {
    const d = digits(phone).replace(/\D/g, '');
    if (d.length >= 6) return 'p:' + d.slice(-11);
    return 'x:' + (name || '').toLowerCase().replace(/\s+/g, '') + ':' + Math.random().toString(36).slice(2, 7);
  }
  function initials(name) {
    const p = (name || '').trim().split(/\s+/).slice(0, 2).map((x) => x[0] || '');
    return (p.join('').toUpperCase()) || '?';
  }
  function rel(ts) {
    if (!ts) return '';
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return 'just now';
    const m = s / 60; if (m < 60) return Math.floor(m) + 'm ago';
    const h = m / 60; if (h < 24) return Math.floor(h) + 'h ago';
    const d = h / 24; if (d < 7) return Math.floor(d) + 'd ago';
    const w = d / 7; if (w < 4.5) return Math.floor(w) + 'w ago';
    const mo = d / 30.4; if (mo < 12) return Math.floor(mo) + 'mo ago';
    return Math.floor(d / 365) + 'y ago';
  }
  function statusLine(d) {
    if (!d || !d.lastActionDate) return 'New to Hittem';
    const o = d.lastOutcome;
    const tag = o === 'reached' ? 'Reached' : o === 'noAnswer' ? 'No answer' : o === 'skipped' ? 'Skipped' : 'Called';
    return tag + ' · ' + rel(d.lastActionDate);
  }
  const byId = (id) => store.contacts.find((c) => c.id === id);

  // ---------- ranking ----------
  function rank(a, b) {
    const da = store.decisions[a.id] && store.decisions[a.id].lastActionDate;
    const db = store.decisions[b.id] && store.decisions[b.id].lastActionDate;
    if (!da && !db) return a.name.localeCompare(b.name);
    if (!da) return -1;
    if (!db) return 1;
    return da - db;
  }
  function buildDeck() {
    deck = [...store.contacts].sort(rank).map((c) => c.id);
  }

  // ---------- mutations ----------
  function record(id, outcome) {
    const prev = store.decisions[id] ? Object.assign({}, store.decisions[id]) : null;
    const d = store.decisions[id] || { callCount: 0, skipCount: 0 };
    d.lastActionDate = Date.now();
    d.lastOutcome = outcome;
    if (outcome === 'skipped') d.skipCount = (d.skipCount || 0) + 1;
    else d.callCount = (d.callCount || 0) + 1;
    store.decisions[id] = d;
    save();
    return prev;
  }
  function addContacts(list) {
    let added = 0;
    for (const c of list) {
      const id = c.id || idFor(c.phone, c.name);
      if (store.contacts.some((x) => x.id === id)) continue;
      store.contacts.push({ id, name: c.name || c.phone, phone: c.phone, label: c.label || '' });
      added++;
    }
    save();
    return added;
  }

  // ---------- render ----------
  function render() {
    if (view === 'deck') return renderDeck();
    if (view === 'empty') return renderEmpty();
    return renderOnboarding();
  }

  function topbar() {
    return `<div class="topbar">
      <button class="iconbtn" data-act="manage" aria-label="Manage contacts">${I.menu}</button>
      <div class="brand">Hittem<span>.</span></div>
      <div class="count">${deck.length || ''}</div>
    </div>`;
  }

  function renderDeck() {
    const cards = deck.slice(0, STACK).map((id, i) => {
      const c = byId(id), d = store.decisions[id];
      return `<article class="card" data-id="${id}" style="--i:${i}">
        <div class="stamp call">Call</div>
        <div class="stamp skip">Skip</div>
        <div class="ava">${esc(initials(c.name))}</div>
        <h2 class="name">${esc(c.name)}</h2>
        <div class="tel">${c.label ? esc(cap(c.label)) + ' · ' : ''}${esc(c.phone)}</div>
        <div class="meta">${esc(statusLine(d))}</div>
      </article>`;
    }).join('');

    app.innerHTML = topbar() +
      `<div class="stage" id="stage">${cards}</div>
       <div class="actions">
         <button class="act undo" data-act="undo" aria-label="Undo" ${undo ? '' : 'disabled'}>${I.undo}</button>
         <button class="act skip" data-act="skip" aria-label="Skip">${I.x}</button>
         <button class="act call" data-act="call" aria-label="Call">${I.phone}</button>
       </div>`;

    const top = document.querySelector('.card');
    if (top) attachDrag(top);
  }

  function renderEmpty() {
    app.innerHTML = topbar() +
      `<div class="center">
        <div class="mark">✓</div>
        <h1>All caught up</h1>
        <p>You've been through everyone for now. Start over to run the deck again.</p>
        <div class="stack">
          <button class="btn" data-act="restart">Start over</button>
          <button class="btn ghost" data-act="manage">Manage contacts</button>
        </div>
      </div>`;
  }

  function renderOnboarding() {
    app.innerHTML = topbar().replace(/<div class="count.*?<\/div>/, '<div class="count"></div>') +
      `<div class="center">
        <div class="mark">Hittem<span style="color:var(--brand)">.</span></div>
        <h1>Who are you calling?</h1>
        <p>Bring in your contacts and Hittem deals them out one at a time. Swipe right to call, left to skip. Everything stays on this device.</p>
        <div class="stack">
          <button class="btn" data-act="import">Import a vCard (.vcf)</button>
          <button class="btn ghost" data-act="add">Add someone manually</button>
          <button class="btn subtle" data-act="sample">Try it with sample contacts</button>
        </div>
        <p class="muted">Export your contacts on a Mac: Contacts &rsaquo; Select All &rsaquo; File &rsaquo; Export &rsaquo; Export vCard, then open that file here.</p>
      </div>`;
  }

  // ---------- drag ----------
  function attachDrag(card) {
    let sx = 0, sy = 0, dx = 0, dy = 0, active = false;
    const callStamp = card.querySelector('.stamp.call');
    const skipStamp = card.querySelector('.stamp.skip');

    card.addEventListener('pointerdown', (e) => {
      active = true; sx = e.clientX; sy = e.clientY; dx = dy = 0;
      card.style.transition = 'none';
      try { card.setPointerCapture(e.pointerId); } catch (_) {}
    });
    card.addEventListener('pointermove', (e) => {
      if (!active) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 22}deg)`;
      callStamp.style.opacity = Math.max(0, Math.min(1, dx / THRESH));
      skipStamp.style.opacity = Math.max(0, Math.min(1, -dx / THRESH));
    });
    const end = () => {
      if (!active) return; active = false;
      card.style.transition = '';
      if (dx > THRESH) fling(card, 'right');
      else if (dx < -THRESH) fling(card, 'left');
      else {
        card.style.transform = '';
        callStamp.style.opacity = skipStamp.style.opacity = 0;
      }
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  }

  function fling(card, dir) {
    const id = card.getAttribute('data-id');
    const off = dir === 'right' ? window.innerWidth : -window.innerWidth;
    card.classList.add('gone');
    card.style.transform = `translate(${off}px, ${-40}px) rotate(${dir === 'right' ? 24 : -24}deg)`;
    card.style.opacity = '0';
    setTimeout(() => commit(id, dir), 240);
  }

  function commit(id, dir) {
    if (deck[0] !== id) return;
    deck.shift();
    if (dir === 'left') {
      undo = { id, prevDecision: record(id, 'skipped') };
      after();
    } else {
      const c = byId(id);
      undo = { id, prevDecision: store.decisions[id] ? Object.assign({}, store.decisions[id]) : null };
      pending = c;
      doCall(c);
      after();           // reveals next card behind the outcome sheet
      openOutcome(c);
    }
  }
  function after() {
    if (deck.length === 0) { view = 'empty'; render(); }
    else render();
  }

  function doCall(c) {
    const tel = digits(c.phone);
    if (tel) window.location.href = 'tel:' + tel;
  }

  // ---------- outcome sheet ----------
  function openOutcome(c) {
    closeOverlay();
    const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.dataset.act = 'dismiss-outcome';
    const sheet = document.createElement('div'); sheet.className = 'sheet';
    sheet.innerHTML = `<div class="grab"></div>
      <h2>How did it go?</h2>
      <p class="who">${esc(c.name)}</p>
      <div class="outcome">
        <button class="reached" data-act="reached">${I.check}Reached</button>
        <button class="noanswer" data-act="noanswer">${I.nosignal}No answer</button>
      </div>
      <button class="btn subtle" data-act="dismiss-outcome" style="width:100%;margin-top:14px">Didn't call</button>`;
    document.body.append(scrim, sheet);
  }
  function resolveOutcome(outcome) {
    if (pending && outcome) record(pending.id, outcome);
    pending = null; closeOverlay();
  }

  // ---------- manage sheet ----------
  function openManage() {
    closeOverlay();
    const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.dataset.act = 'close';
    const sheet = document.createElement('div'); sheet.className = 'sheet';
    const rows = store.contacts.length ? [...store.contacts].sort((a, b) => a.name.localeCompare(b.name)).map((c) =>
      `<div class="row">
        <div class="dot">${esc(initials(c.name))}</div>
        <div class="nm"><b>${esc(c.name)}</b><small>${esc(c.phone)}</small></div>
        <button class="del" data-act="del" data-id="${c.id}" aria-label="Delete">${I.trash}</button>
      </div>`).join('') : `<div class="empty-note">No contacts yet.</div>`;

    sheet.innerHTML = `<div class="grab"></div>
      <h2>Contacts</h2>
      <p class="who">${store.contacts.length} on this device</p>
      <div class="toolrow">
        <button class="btn ghost" data-act="import">Import vCard</button>
        <button class="btn ghost" data-act="add">Add manually</button>
        <button class="btn ghost" data-act="backup">Export backup</button>
        <button class="btn ghost" data-act="restore">Restore backup</button>
      </div>
      <div class="list">${rows}</div>
      <button class="btn subtle danger" data-act="clear" style="width:100%">Erase everything</button>
      <p class="muted">Stored only in this browser. Export a backup before clearing Safari data, an iOS update, or switching devices.</p>`;
    document.body.append(scrim, sheet);
  }

  function openAdd() {
    closeOverlay();
    const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.dataset.act = 'close';
    const sheet = document.createElement('div'); sheet.className = 'sheet';
    sheet.innerHTML = `<div class="grab"></div>
      <h2>Add someone</h2><p class="who">&nbsp;</p>
      <div class="field"><label>Name</label><input id="f-name" autocomplete="off" placeholder="Jane Doe" /></div>
      <div class="field"><label>Phone</label><input id="f-phone" inputmode="tel" autocomplete="off" placeholder="+354 555 1234" /></div>
      <button class="btn" data-act="save-add" style="width:100%">Add to deck</button>`;
    document.body.append(scrim, sheet);
    setTimeout(() => { const n = document.getElementById('f-name'); if (n) n.focus(); }, 60);
  }

  function closeOverlay() {
    document.querySelectorAll('.scrim, .sheet').forEach((n) => n.remove());
  }

  // ---------- vCard ----------
  function parseVCards(text) {
    const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
    const blocks = unfolded.split(/BEGIN:VCARD/i).slice(1);
    const out = [];
    for (const b of blocks) {
      const lines = b.split(/\r\n|\n|\r/);
      let fn = '', n = '', tels = [];
      for (const line of lines) {
        if (/^FN[:;]/i.test(line)) fn = afterColon(line);
        else if (/^N[:;]/i.test(line)) n = afterColon(line);
        else if (/^(?:item\d+\.)?TEL/i.test(line)) {
          const val = afterColon(line);
          const head = line.split(':')[0];
          const m = head.match(/TYPE=([^;:]+)/i);
          if (val.trim()) tels.push({ number: val.trim(), label: m ? m[1].toLowerCase() : 'phone' });
        }
      }
      let name = deescape(fn).trim();
      if (!name && n) name = deescape(n).split(';').filter(Boolean).reverse().join(' ').trim();
      if (tels.length) {
        tels.sort((a, b) => score(b.label) - score(a.label));
        const t = tels[0];
        out.push({ name: name || t.number, phone: t.number, label: cleanLabel(t.label) });
      }
    }
    return out;
  }
  const afterColon = (l) => { const i = l.indexOf(':'); return i < 0 ? '' : l.slice(i + 1); };
  const deescape = (s) => (s || '').replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  const score = (l) => /(cell|mobile|iphone)/i.test(l) ? 3 : /(main|pref)/i.test(l) ? 2 : /home/i.test(l) ? 1 : 0;
  const cleanLabel = (l) => { l = (l || '').replace(/[^a-z]/gi, '').toLowerCase(); return l === 'cell' ? 'mobile' : l; };

  function importFile(accept, handler) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept;
    inp.addEventListener('change', () => { const f = inp.files[0]; if (f) { const r = new FileReader(); r.onload = () => handler(String(r.result)); r.readAsText(f); } });
    inp.click();
  }

  // ---------- backup ----------
  function exportBackup() {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hittem-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup downloaded');
  }

  // ---------- samples ----------
  const SAMPLES = [
    { name: 'Anna Haro', phone: '+354 555 0142', label: 'mobile' },
    { name: 'Gunnar Pétursson', phone: '+354 555 0188', label: 'mobile' },
    { name: 'Maria Olsen', phone: '+47 555 0119', label: 'home' },
    { name: 'David Chen', phone: '+1 415 555 0177', label: 'mobile' },
    { name: 'Sara Lind', phone: '+354 555 0163', label: 'work' },
    { name: 'Tomás Reyes', phone: '+34 555 0150', label: 'mobile' }
  ];

  // ---------- events ----------
  function start(list) {
    addContacts(list);
    buildDeck();
    view = deck.length ? 'deck' : 'empty';
    closeOverlay();
    render();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act;
    switch (act) {
      case 'skip': { const top = document.querySelector('.card'); if (top) fling(top, 'left'); break; }
      case 'call': { const top = document.querySelector('.card'); if (top) fling(top, 'right'); break; }
      case 'undo': doUndo(); break;
      case 'restart': buildDeck(); view = deck.length ? 'deck' : 'empty'; render(); break;
      case 'manage': openManage(); break;
      case 'add': openAdd(); break;
      case 'save-add': {
        const name = (document.getElementById('f-name').value || '').trim();
        const phone = (document.getElementById('f-phone').value || '').trim();
        if (!phone) { toast('Add a phone number'); break; }
        start([{ name: name || phone, phone, label: 'mobile' }]);
        toast('Added');
        break;
      }
      case 'import': importFile('.vcf,text/vcard,text/x-vcard', (txt) => {
        const found = parseVCards(txt);
        if (!found.length) { toast('No contacts found in that file'); return; }
        const n = addContacts(found); buildDeck(); view = deck.length ? 'deck' : 'empty'; closeOverlay(); render();
        toast(n ? `Imported ${n} contact${n > 1 ? 's' : ''}` : 'Already imported');
      }); break;
      case 'sample': start(SAMPLES); break;
      case 'backup': exportBackup(); break;
      case 'restore': importFile('.json,application/json', (txt) => {
        try { const data = JSON.parse(txt); store.contacts = data.contacts || []; store.decisions = data.decisions || {}; save(); buildDeck(); view = deck.length ? 'deck' : 'empty'; closeOverlay(); render(); toast('Backup restored'); }
        catch (_) { toast('That file is not a Hittem backup'); }
      }); break;
      case 'del': {
        const id = el.dataset.id;
        store.contacts = store.contacts.filter((c) => c.id !== id);
        delete store.decisions[id]; save();
        buildDeck();
        view = store.contacts.length ? (deck.length ? 'deck' : 'empty') : 'onboarding';
        render(); openManage();
        break;
      }
      case 'clear':
        if (confirm('Erase all contacts and history on this device?')) {
          store = { contacts: [], decisions: {} }; save(); deck = []; undo = null; view = 'onboarding'; closeOverlay(); render();
        }
        break;
      case 'reached': resolveOutcome('reached'); break;
      case 'noanswer': resolveOutcome('noAnswer'); break;
      case 'dismiss-outcome': resolveOutcome(null); break;
      case 'close': closeOverlay(); break;
    }
  });

  function doUndo() {
    if (!undo) return;
    const { id, prevDecision } = undo;
    if (prevDecision) store.decisions[id] = prevDecision; else delete store.decisions[id];
    save();
    deck.unshift(id);
    undo = null;
    if (view !== 'deck') view = 'deck';
    render();
  }

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.append(t); }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
  }

  // ---------- boot ----------
  load();
  if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(() => {}); }
  if (store.contacts.length) { buildDeck(); view = deck.length ? 'deck' : 'empty'; }
  else { view = 'onboarding'; }
  render();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
  }
})();
