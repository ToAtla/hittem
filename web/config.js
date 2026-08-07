'use strict';
/*
 * Deployment config. An OAuth client ID is public by design (it is visible in every
 * authorization request), so it is safe to commit. There is no client secret here and
 * there must never be one: this app is a public client and cannot keep a secret.
 *
 * Leave googleClientId empty to run Hittem exactly as before, fully local with no
 * sign-in gate. See README for how to mint the ID.
 */
window.HITTEM_CONFIG = {
  googleClientId: ''
};
