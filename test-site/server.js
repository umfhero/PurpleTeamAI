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
const cookieParser = require('cookie-parser');
const serveIndex = require('serve-index');
const path = require('path');

const app = express();
const PORT = 8080;

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// ── Intentionally NO security headers ──────────────────────────────
// No X-Frame-Options        → Clickjacking
// No Content-Security-Policy → XSS / data injection
// No X-Content-Type-Options  → MIME sniffing
// No Strict-Transport-Security → No HSTS

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

// ── Start server (HTTP only — no HTTPS) ───────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  ⚠  VULNERABLE TEST SERVER — DO NOT USE IN PROD ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Running on http://localhost:${PORT}              ║`);
  console.log('║                                                  ║');
  console.log('║  Vulnerabilities:                                ║');
  console.log('║   • Missing security headers (XFO, CSP, XCTO)   ║');
  console.log('║   • No HTTPS                                    ║');
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
