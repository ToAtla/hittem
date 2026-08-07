'use strict';
/*
 * Google identity and Contacts read access.
 *
 * Auth model: one OAuth token flow covers both jobs. We ask for `openid email profile`
 * alongside the Contacts scope, then read identity from the userinfo endpoint rather than
 * running a second Sign-In flow and verifying an ID token. A browser app cannot verify a
 * JWT signature in a way that means anything (it holds no secret and the check would run
 * on the same untrusted side as the caller), so a second flow would buy nothing.
 *
 * Access tokens live in memory only. They are deliberately not persisted: localStorage is
 * readable by any script on the origin, and a token there outlives the tab for an hour.
 * The identity session is persisted so the app opens offline without a round trip.
 *
 * Scope is contacts.readonly. Write-back needs the read/write `contacts` scope, which is
 * a separate consent, and is out of scope until sync lands.
 */
(function () {
  const SESSION_KEY = 'hittem:auth:v1';
  const GSI_SRC = 'https://accounts.google.com/gsi/client';
  const SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/contacts.readonly'
  ].join(' ');

  let tokenClient = null;
  let token = null;        // { value, expiresAt } - memory only, never persisted
  let sdkPromise = null;

  const clientId = () => (window.HITTEM_CONFIG && window.HITTEM_CONFIG.googleClientId) || '';
  const configured = () => !!clientId();

  function session() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }
  function setSession(s) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (_) {}
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
    token = null;
  }

  // The GIS script is the one third-party request Hittem makes. It is loaded lazily, only
  // when a sign-in is actually attempted, so a signed-in user opening the app offline
  // never waits on it.
  function loadSdk() {
    if (window.google && window.google.accounts) return Promise.resolve();
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = GSI_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => { sdkPromise = null; reject(new Error('offline')); };
      document.head.appendChild(s);
    });
    return sdkPromise;
  }

  function ensureTokenClient() {
    if (tokenClient) return tokenClient;
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: SCOPES,
      callback: () => {}   // replaced per request below
    });
    return tokenClient;
  }

  // `interactive: false` asks Google to re-issue silently for a user who has already
  // consented. It fails rather than prompting, which is what we want on app open; the
  // interactive path is reserved for an explicit tap.
  function requestToken(interactive) {
    return loadSdk().then(() => new Promise((resolve, reject) => {
      const now = Date.now();
      if (token && token.expiresAt > now + 60000) return resolve(token.value);
      const client = ensureTokenClient();
      client.callback = (res) => {
        if (!res || !res.access_token) return reject(new Error('no_token'));
        // expires_in is seconds; keep a minute of headroom so a call cannot start on a
        // token that expires mid-flight.
        token = { value: res.access_token, expiresAt: Date.now() + ((res.expires_in || 3600) * 1000) };
        resolve(token.value);
      };
      client.error_callback = (err) => reject(new Error((err && err.type) || 'auth_failed'));
      try {
        client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
      } catch (e) { reject(e); }
    }));
  }

  function api(url, accessToken) {
    return fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } }).then((r) => {
      if (r.status === 401 || r.status === 403) { token = null; throw new Error('auth_expired'); }
      if (!r.ok) throw new Error('http_' + r.status);
      return r.json();
    });
  }

  function signIn() {
    return requestToken(true)
      .then((t) => api('https://www.googleapis.com/oauth2/v3/userinfo', t))
      .then((info) => {
        const s = {
          sub: info.sub,
          email: info.email || '',
          name: info.name || info.email || 'Signed in',
          signedInAt: Date.now()
        };
        setSession(s);
        return s;
      });
  }

  // Contact group names carry the local/distant tags, exactly as CATEGORIES does in the
  // vCard path. Google returns memberships as opaque group resource names, so the group
  // list has to be pulled separately to resolve them.
  function fetchGroups(accessToken) {
    const url = 'https://people.googleapis.com/v1/contactGroups?pageSize=200';
    return api(url, accessToken).then((res) => {
      const map = {};
      for (const g of res.contactGroups || []) {
        if (g.resourceName) map[g.resourceName] = (g.formattedName || g.name || '').toLowerCase();
      }
      return map;
    }).catch(() => ({}));   // tags are a bonus; a group failure must not sink the import
  }

  const PAGE = 1000;
  const FIELDS = 'names,phoneNumbers,biographies,memberships,metadata';

  function fetchPage(accessToken, pageToken) {
    let url = 'https://people.googleapis.com/v1/people/me/connections'
      + '?personFields=' + encodeURIComponent(FIELDS)
      + '&pageSize=' + PAGE
      + '&sortOrder=FIRST_NAME_ASCENDING';
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
    return api(url, accessToken);
  }

  function fetchAllConnections(accessToken) {
    const out = [];
    const next = (pageToken) => fetchPage(accessToken, pageToken).then((res) => {
      for (const p of res.connections || []) out.push(p);
      if (res.nextPageToken) return next(res.nextPageToken);
      return out;
    });
    return next(null);
  }

  const score = (l) => /(cell|mobile)/i.test(l) ? 3 : /(main|pref)/i.test(l) ? 2 : /home/i.test(l) ? 1 : 0;

  function mapPerson(p, groups) {
    const phones = (p.phoneNumbers || []).filter((x) => x && x.value);
    if (!phones.length) return null;
    phones.sort((a, b) => score(b.type || '') - score(a.type || ''));
    const best = phones[0];
    const name = (p.names && p.names[0] && p.names[0].displayName) || best.value;

    // biographies is the Notes box in the Contacts UI. Singleton per source, so the first
    // entry is the whole of it. Capped because it lands in localStorage alongside
    // everything else and a few long notes would crowd out the contact list itself.
    const bio = (p.biographies || []).find((b) => b && b.value);
    const note = bio ? String(bio.value).trim().slice(0, 2000) : undefined;

    let tag;
    for (const m of p.memberships || []) {
      const rn = m.contactGroupMembership && m.contactGroupMembership.contactGroupResourceName;
      const gname = rn && groups[rn];
      if (gname === 'local' || gname === 'distant') { tag = gname; break; }
    }

    return {
      name: name,
      phone: best.value,
      label: (best.type || '').toLowerCase() === 'cell' ? 'mobile' : (best.type || '').toLowerCase(),
      tag: tag,
      note: note,
      gid: p.resourceName || undefined
    };
  }

  function fetchContacts() {
    return requestToken(false)
      .catch(() => requestToken(true))
      .then((t) => Promise.all([fetchGroups(t), fetchAllConnections(t)])
        .then(([groups, people]) => {
          const contacts = [];
          let hadTags = false;
          for (const p of people) {
            const c = mapPerson(p, groups);
            if (!c) continue;
            if (c.tag) hadTags = true;
            contacts.push(c);
          }
          return { contacts, hadTags };
        }));
  }

  window.HittemGoogle = {
    configured, session, signIn, signOut: clearSession, fetchContacts
  };
})();
