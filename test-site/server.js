/**
 * VULNERABLE TEST SERVER
 * 
 * Intentionally insecure — for PurpleTeam scanner testing only.
 * 
 * Known vulnerabilities:
 *   1. Missing security headers (X-Frame-Options, CSP, X-Content-Type-Options, HSTS)
 *   2. No HTTPS (HTTP only on port 8080)
 *   3. CSRF — forms have no anti-CSRF tokens
 *   4. Reflected XSS — /search echoes user input unescaped
 *   5. Insecure cookies — session cookie lacks HttpOnly & Secure flags
 *   6. Exposed .git directory
 *   7. Exposed backup files (config.bak)
 *   8. Directory listing on /uploads
 *   9. Dangerous HTTP methods allowed (PUT, DELETE)
 */

const express = require('express');
const https = require('https');
const cookieParser = require('cookie-parser');
const serveIndex = require('serve-index');
const selfsigned = require('selfsigned');
const path = require('path');

const app = express();
const PORT = 8080;
const HTTPS_PORT = 443;

// Generate a local self-signed cert so HTTPS is available for scanner validation.
const certAttrs = [{ name: 'commonName', value: 'localhost' }];
const certOptions = {
  days: 365,
  keySize: 2048,
  algorithm: 'sha256',
  extensions: [
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' }
      ]
    }
  ]
};
const pems = selfsigned.generate(certAttrs, certOptions);

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// FIX 2: Add core security headers that scanner checks via http-headers script.
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// FIX 3: Mitigate byterange DoS checks by denying multi/partial range requests.
// This removes the attack primitive used by CVE-2011-3192 style probes.
app.use((req, res, next) => {
  res.setHeader('Accept-Ranges', 'none');
  if (req.headers.range) {
    return res.status(416).send('Range requests are not supported');
  }
  return next();
});

// FIX 1: Redirect HTTP to HTTPS to remove cleartext transport.
app.use((req, res, next) => {
  if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://localhost${req.originalUrl}`);
  }
  return next();
});

// ── Security headers fixed for positive scan delta ─────────────────

// ── FIX 1: Secure session cookie (HttpOnly + SameSite) ─────────────
app.use((req, res, next) => {
  if (!req.cookies.session) {
    res.cookie('session', 'abc123token', {
      httpOnly: true,      // FIXED — JS cannot read cookie
      secure: false,       // still false (no HTTPS)
      sameSite: 'strict',  // FIXED — no cross-site requests
      maxAge: 86400000
    });
  }
  next();
});

// ── FIX 2: Block dotfiles (.git) ──────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'deny',       // FIXED — blocks .git/ access
  extensions: ['html'],
  index: 'index.html'
}));

// ── Directory listing on /uploads ─────────────────────────────────
app.use('/uploads',
  express.static(path.join(__dirname, 'public', 'uploads')),
  serveIndex(path.join(__dirname, 'public', 'uploads'), { icons: true })
);

// ── Reflected XSS via /search ─────────────────────────────────────
app.get('/search', (req, res) => {
  const query = req.query.q || '';
  // Intentionally unsanitized — reflects user input directly into HTML
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

// ── Guestbook POST — stores & reflects input (no sanitization) ────
const guestbookEntries = [];

app.post('/guestbook', (req, res) => {
  const { name, message } = req.body;
  // Intentionally no CSRF validation, no input sanitization
  guestbookEntries.push({ name, message, date: new Date().toISOString() });
  res.redirect('/guestbook.html');
});

app.get('/api/guestbook', (req, res) => {
  // Returns raw unsanitized entries — XSS when rendered
  res.json(guestbookEntries);
});

// ── Login POST — no CSRF token ────────────────────────────────────
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // Intentionally no CSRF token check
  if (username === 'admin' && password === 'password') {
    res.cookie('auth', 'authenticated', { httpOnly: false, secure: false });
    res.redirect('/admin/');
  } else {
    res.send(`<!DOCTYPE html>
<html><body>
  <h1>Login Failed</h1>
  <p>Invalid credentials for user: ${username}</p>
  <a href="/login.html">Try again</a>
</body></html>`);
  }
});

// ── Allow dangerous HTTP methods (PUT / DELETE) ───────────────────
app.put('/api/data', (req, res) => {
  res.json({ status: 'updated' });
});

app.delete('/api/data', (req, res) => {
  res.json({ status: 'deleted' });
});

// ── Open redirect ─────────────────────────────────────────────────
app.get('/redirect', (req, res) => {
  const url = req.query.url || '/';
  // Intentionally no validation — allows redirect to any external URL
  res.redirect(url);
});

// ── Start server (HTTP + HTTPS for transport security) ───────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  ⚠  VULNERABLE TEST SERVER — DO NOT USE IN PROD ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Running on http://localhost:${PORT} (redirects)  ║`);
  console.log(`║  Running on https://localhost:${HTTPS_PORT}         ║`);
  console.log('║                                                  ║');
  console.log('║  Vulnerabilities:                                ║');
  console.log('║   • (FIXED) Security headers now set             ║');
  console.log('║   • (FIXED) HTTPS is now enabled                 ║');
  console.log('║   • CSRF on all forms                            ║');
  console.log('║   • Reflected XSS on /search?q=                  ║');
  console.log('║   • Insecure cookies                             ║');
  console.log('║   • Exposed .git/ directory                      ║');
  console.log('║   • Directory listing on /uploads                ║');
  console.log('║   • Open redirect on /redirect?url=              ║');
  console.log('║   • Dangerous HTTP methods (PUT, DELETE)         ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});

https.createServer({ key: pems.private, cert: pems.cert }, app).listen(HTTPS_PORT, () => {
  console.log(`HTTPS endpoint active on https://localhost:${HTTPS_PORT}`);
});
