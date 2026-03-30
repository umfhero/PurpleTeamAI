/**
 * VULNERABLE TEST SERVER
 *
 * Intentionally insecure — for PurpleTeam scanner evaluation only.
 * DO NOT deploy in production.
 *
 * Vulnerability inventory (nmap-detectable):
 *   V1.  No security headers (X-Frame-Options, CSP, X-Content-Type-Options, HSTS)
 *   V2.  Server version disclosure (X-Powered-By: Express)
 *   V3.  Self-signed HTTPS with weak TLS ciphers (port 8443)
 *   V4.  Insecure cookies (no HttpOnly, no Secure, no SameSite)
 *   V5.  Exposed .git directory (/.git/HEAD readable)
 *   V6.  Backup file exposure (config.bak)
 *   V7.  Directory listing on /uploads
 *   V8.  Reflected XSS on /search?q=
 *   V9.  No CSRF tokens on POST forms
 *   V10. Dangerous HTTP methods (PUT, DELETE on /api/data)
 *   V11. Open redirect on /redirect?url=
 *   V12. Information disclosure on /server-status
 *   V13. Permissive robots.txt revealing admin & .git paths
 */

const express = require('express');
const https = require('https');
const cookieParser = require('cookie-parser');
const serveIndex = require('serve-index');
const selfsigned = require('selfsigned');
const path = require('path');

const app = express();
const HTTP_PORT = 8080;
const HTTPS_PORT = 8443;

// ── Self-signed cert with weak TLS config ─────────────────────────
// ssl-enum-ciphers will flag: self-signed, weak ciphers, old TLS
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

// ── V1: NO security headers ──────────────────────────────────────
// Intentionally omitted: X-Frame-Options, CSP, X-Content-Type-Options, HSTS
// nmap http-headers script will flag every missing header.

// ── V2: Server version exposed ────────────────────────────────────
// Express sends "X-Powered-By: Express" by default — NOT disabling it.

// ── V4: Insecure session cookies ──────────────────────────────────
app.use((req, res, next) => {
  if (!req.cookies.session) {
    res.cookie('session', 'abc123token', {
      httpOnly: false,   // VULN — JS can read cookie
      secure: false,     // VULN — sent over cleartext HTTP
      maxAge: 86400000,
    });
  }
  if (!req.cookies.tracking) {
    res.cookie('tracking', 'user-track-xyz', {
      httpOnly: false,   // VULN — second insecure cookie
      secure: false,
    });
  }
  next();
});

// ── V5: Serve dotfiles — exposes .git/ ────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'allow',     // VULN — .git/HEAD is accessible
  extensions: ['html'],
  index: 'index.html',
}));

// ── V7: Directory listing on /uploads ─────────────────────────────
app.use('/uploads',
  express.static(path.join(__dirname, 'public', 'uploads')),
  serveIndex(path.join(__dirname, 'public', 'uploads'), { icons: true })
);

// ── V8: Reflected XSS via /search ─────────────────────────────────
app.get('/search', (req, res) => {
  const query = req.query.q || '';
  // VULN — user input reflected directly into HTML, no escaping
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

// ── V9: Guestbook — no CSRF, no sanitization ─────────────────────
const guestbookEntries = [];

app.post('/guestbook', (req, res) => {
  const { name, message } = req.body;
  // VULN — no CSRF token, no input sanitization
  guestbookEntries.push({ name, message, date: new Date().toISOString() });
  res.redirect('/guestbook.html');
});

app.get('/api/guestbook', (req, res) => {
  res.json(guestbookEntries);
});

// ── V9: Login — no CSRF, reflects username in error ───────────────
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password') {
    res.cookie('auth', 'authenticated', { httpOnly: false, secure: false });
    res.redirect('/admin/');
  } else {
    // VULN — username reflected in HTML response (secondary XSS vector)
    res.send(`<!DOCTYPE html>
<html><body>
  <h1>Login Failed</h1>
  <p>Invalid credentials for user: ${username}</p>
  <a href="/login.html">Try again</a>
</body></html>`);
  }
});

// ── V10: Dangerous HTTP methods ───────────────────────────────────
app.put('/api/data', (req, res) => {
  res.json({ status: 'updated' });
});

app.delete('/api/data', (req, res) => {
  res.json({ status: 'deleted' });
});

// ── V11: Open redirect ───────────────────────────────────────────
app.get('/redirect', (req, res) => {
  const url = req.query.url || '/';
  // VULN — no validation, redirects to any external URL
  res.redirect(url);
});

// ── V12: Server information disclosure ────────────────────────────
app.get('/server-status', (req, res) => {
  res.json({
    server: 'VulnTest Corp',
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
  });
});

// ── Start HTTP + HTTPS ────────────────────────────────────────────
app.listen(HTTP_PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  ⚠  VULNERABLE TEST SERVER — DO NOT USE IN PROD     ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  HTTP  → http://127.0.0.1:${HTTP_PORT}                    ║`);
  console.log(`║  HTTPS → https://127.0.0.1:${HTTPS_PORT} (self-signed)     ║`);
  console.log('║                                                      ║');
  console.log('║  Vulnerabilities present:                            ║');
  console.log('║   V1.  No security headers (XFO, CSP, XCTO, HSTS)   ║');
  console.log('║   V2.  Server version disclosure (X-Powered-By)      ║');
  console.log('║   V3.  Self-signed HTTPS + weak TLS ciphers          ║');
  console.log('║   V4.  Insecure cookies (no HttpOnly/Secure)         ║');
  console.log('║   V5.  Exposed .git directory                        ║');
  console.log('║   V6.  Backup file exposure (config.bak)             ║');
  console.log('║   V7.  Directory listing on /uploads                 ║');
  console.log('║   V8.  Reflected XSS on /search?q=                   ║');
  console.log('║   V9.  No CSRF tokens on forms                       ║');
  console.log('║   V10. Dangerous HTTP methods (PUT/DELETE)            ║');
  console.log('║   V11. Open redirect on /redirect?url=               ║');
  console.log('║   V12. Info disclosure on /server-status              ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});

https.createServer(
  {
    key: pems.private,
    cert: pems.cert,
    minVersion: 'TLSv1',          // VULN — allow old TLS 1.0
    ciphers: [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'AES128-SHA',                // Weak — no forward secrecy
      'AES256-SHA',                // Weak — no forward secrecy
      'DES-CBC3-SHA',              // Weak — 3DES
    ].join(':'),
  },
  app
).listen(HTTPS_PORT, () => {
  console.log(`HTTPS active on https://127.0.0.1:${HTTPS_PORT} (self-signed, weak TLS)\n`);
});
