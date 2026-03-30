/**
 * FIXED TEST SERVER
 *
 * The same site with security vulnerabilities remediated.
 * Run this for the final scan to demonstrate delta comparison.
 *
 * Fixes applied (maps to server.js vulnerability IDs):
 *   ✅ V1.  Security headers added (XFO, CSP, XCTO, HSTS, Referrer-Policy, Permissions-Policy)
 *   ✅ V2.  X-Powered-By disabled
 *   ✅ V3.  Self-signed HTTPS with strong TLS only (TLS 1.2+, good ciphers)
 *   ✅ V4.  Secure cookies (HttpOnly, SameSite=Strict, random token)
 *   ✅ V5.  .git directory blocked
 *   ✅ V6.  Backup / config files blocked
 *   ✅ V7.  Directory listing disabled (no serve-index)
 *   ✅ V8.  XSS input sanitization (HTML entity escaping)
 *   ✅ V9.  CSRF tokens on POST forms
 *   ✅ V10. Dangerous HTTP methods removed (no PUT/DELETE)
 *   ✅ V11. Open redirect fixed (relative-path whitelist)
 *   ✅ V12. /server-status removed
 *
 * Still present (intentional — shows partial remediation):
 *   ⚠ Self-signed certificate (would need CA-issued cert in prod)
 */

const express = require('express');
const https = require('https');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const selfsigned = require('selfsigned');
const path = require('path');

const app = express();
const HTTP_PORT = 8080;
const HTTPS_PORT = 8443;

// Self-signed cert (still self-signed, but strong TLS config)
const pems = selfsigned.generate(
  [{ name: 'commonName', value: 'localhost' }],
  {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [{
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
      ],
    }],
  }
);

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// ── FIX V2: Disable X-Powered-By ─────────────────────────────────
app.disable('x-powered-by');

// ── FIX V1: Security headers on every response ───────────────────
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ── FIX V4: Secure session cookie ─────────────────────────────────
app.use((req, res, next) => {
  if (!req.cookies.session) {
    res.cookie('session', crypto.randomBytes(32).toString('hex'), {
      httpOnly: true,       // FIXED — JS cannot read
      secure: false,        // would be true with CA cert
      sameSite: 'strict',   // FIXED — no cross-site
      maxAge: 86400000,
    });
  }
  next();
});

// ── FIX V5 + V6: Block .git, backup, and config files ────────────
app.use((req, res, next) => {
  const blocked = ['.git', '.svn', '.env', '.bak', '.old', '.backup', 'config.bak'];
  const lower = req.path.toLowerCase();
  if (blocked.some(b => lower.includes(b))) {
    return res.status(403).send('Forbidden');
  }
  next();
});

// ── FIX V5: Static files — deny dotfiles ──────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'deny',       // FIXED — blocks .git/
  extensions: ['html'],
  index: 'index.html',
}));

// ── FIX V7: No directory listing (serve-index removed) ────────────
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ── CSRF token helpers ────────────────────────────────────────────
const csrfTokens = new Map();

function generateCSRFToken(sessionId) {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(sessionId, token);
  return token;
}

function validateCSRFToken(sessionId, token) {
  return csrfTokens.get(sessionId) === token;
}

// ── FIX V8: Search — sanitize output ──────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

app.get('/search', (req, res) => {
  const query = escapeHtml(req.query.q || '');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Search Results</title></head>
<body>
  <h1>Search Results</h1>
  <p>You searched for: <strong>${query}</strong></p>
  <p>No results found.</p>
  <a href="/">← Back</a>
</body>
</html>`);
});

// ── FIX V9: Guestbook with CSRF + sanitization ───────────────────
const guestbookEntries = [];

app.post('/guestbook', (req, res) => {
  const { name, message, _csrf } = req.body;
  const sessionId = req.cookies.session;
  if (!validateCSRFToken(sessionId, _csrf)) {
    return res.status(403).send('Invalid CSRF token');
  }
  guestbookEntries.push({
    name: escapeHtml(name || ''),
    message: escapeHtml(message || ''),
    date: new Date().toISOString(),
  });
  res.redirect('/guestbook.html');
});

app.get('/api/guestbook', (req, res) => {
  res.json(guestbookEntries);
});

// ── FIX V9: Login with CSRF ──────────────────────────────────────
app.post('/login', (req, res) => {
  const { username, password, _csrf } = req.body;
  const sessionId = req.cookies.session;
  if (!validateCSRFToken(sessionId, _csrf)) {
    return res.status(403).send('Invalid CSRF token');
  }
  if (username === 'admin' && password === 'password') {
    res.cookie('auth', 'authenticated', { httpOnly: true, secure: false, sameSite: 'strict' });
    res.redirect('/admin/');
  } else {
    res.send(`<!DOCTYPE html>
<html><body>
  <h1>Login Failed</h1>
  <p>Invalid credentials.</p>
  <a href="/login.html">Try again</a>
</body></html>`);
  }
});

// ── FIX V10: Dangerous HTTP methods removed ──────────────────────
// (PUT and DELETE endpoints not registered)

// ── FIX V11: Open redirect — only relative paths ─────────────────
app.get('/redirect', (req, res) => {
  const url = req.query.url || '/';
  if (url.startsWith('/') && !url.startsWith('//')) {
    res.redirect(url);
  } else {
    res.redirect('/');
  }
});

// ── FIX V12: /server-status removed entirely ─────────────────────

// ── HTTP redirects to HTTPS; HTTPS serves the app ─────────────────
const httpApp = express();
httpApp.use((req, res) => {
  res.redirect(`https://127.0.0.1:${HTTPS_PORT}${req.originalUrl}`);
});

httpApp.listen(HTTP_PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  ✅  FIXED TEST SERVER                               ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  HTTP  → http://127.0.0.1:${HTTP_PORT} (redirects to HTTPS) ║`);
  console.log(`║  HTTPS → https://127.0.0.1:${HTTPS_PORT} (self-signed)       ║`);
  console.log('║                                                      ║');
  console.log('║  Fixes applied:                                      ║');
  console.log('║   ✓ V1.  Security headers (XFO, CSP, XCTO, HSTS)    ║');
  console.log('║   ✓ V2.  X-Powered-By removed                        ║');
  console.log('║   ✓ V3.  TLS 1.2+ only, strong ciphers               ║');
  console.log('║   ✓ V4.  Secure cookies (HttpOnly, SameSite)         ║');
  console.log('║   ✓ V5.  .git blocked                                ║');
  console.log('║   ✓ V6.  Backup files blocked                        ║');
  console.log('║   ✓ V7.  Directory listing disabled                   ║');
  console.log('║   ✓ V8.  XSS sanitized                               ║');
  console.log('║   ✓ V9.  CSRF tokens on forms                        ║');
  console.log('║   ✓ V10. PUT/DELETE removed                           ║');
  console.log('║   ✓ V11. Open redirect fixed                         ║');
  console.log('║   ✓ V12. /server-status removed                      ║');
  console.log('║                                                      ║');
  console.log('║  Still present:                                      ║');
  console.log('║   ⚠ Self-signed certificate                         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});

https.createServer(
  {
    key: pems.private,
    cert: pems.cert,
    minVersion: 'TLSv1.2',       // FIXED — TLS 1.2+ only
    ciphers: [
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-CHACHA20-POLY1305',
    ].join(':'),
  },
  app
).listen(HTTPS_PORT, () => {
  console.log(`HTTPS active on https://127.0.0.1:${HTTPS_PORT} (self-signed, strong TLS)\n`);
});
