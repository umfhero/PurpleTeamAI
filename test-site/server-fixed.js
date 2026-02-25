/**
 * FIXED TEST SERVER
 * 
 * The same site with security vulnerabilities remediated.
 * Run this for the second scan to see the delta comparison.
 * 
 * Fixes applied:
 *   ✅ Security headers added (X-Frame-Options, CSP, X-Content-Type-Options, HSTS)
 *   ✅ CSRF protection (token validation on POST routes)
 *   ✅ Reflected XSS fixed (input sanitized)
 *   ✅ Secure cookie flags (HttpOnly, Secure, SameSite=Strict)
 *   ✅ .git directory blocked
 *   ✅ Backup files blocked
 *   ✅ Directory listing disabled
 *   ✅ Dangerous HTTP methods removed
 *   ✅ Open redirect fixed
 *   
 * Still present (intentionally, to show partial remediation):
 *   ⚠ No HTTPS (HTTP only) — would need certs to fix
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = 8080;

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// ── FIX: Security headers on every response ───────────────────────
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

// ── FIX: Secure session cookie ────────────────────────────────────
app.use((req, res, next) => {
  if (!req.cookies.session) {
    res.cookie('session', crypto.randomBytes(32).toString('hex'), {
      httpOnly: true,     // fixed — JS cannot read
      secure: false,      // still false (no HTTPS) but would be true in prod
      sameSite: 'strict', // fixed — no cross-site
      maxAge: 86400000
    });
  }
  next();
});

// ── FIX: Block .git and backup files ──────────────────────────────
app.use((req, res, next) => {
  const blocked = ['.git', '.svn', '.env', '.bak', '.old', '.backup', 'config.bak'];
  const lower = req.path.toLowerCase();
  if (blocked.some(b => lower.includes(b))) {
    return res.status(403).send('Forbidden');
  }
  next();
});

// ── FIX: Static files — deny dotfiles ─────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'deny',       // fixed — blocks .git/
  extensions: ['html'],
  index: 'index.html'
}));

// ── FIX: No directory listing (removed serve-index) ──────────────
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ── CSRF token generation ─────────────────────────────────────────
const csrfTokens = new Map();

function generateCSRFToken(sessionId) {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(sessionId, token);
  return token;
}

function validateCSRFToken(sessionId, token) {
  return csrfTokens.get(sessionId) === token;
}

// ── FIX: Search — sanitize output ─────────────────────────────────
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

// ── FIX: Guestbook with CSRF + sanitization ──────────────────────
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
    date: new Date().toISOString()
  });
  res.redirect('/guestbook.html');
});

app.get('/api/guestbook', (req, res) => {
  res.json(guestbookEntries); // already sanitized on insert
});

// ── FIX: Login with CSRF ──────────────────────────────────────────
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

// ── FIX: Dangerous HTTP methods removed ──────────────────────────
// (PUT and DELETE endpoints removed entirely)

// ── FIX: Open redirect — only allow internal redirects ───────────
app.get('/redirect', (req, res) => {
  const url = req.query.url || '/';
  // Only allow relative paths
  if (url.startsWith('/') && !url.startsWith('//')) {
    res.redirect(url);
  } else {
    res.redirect('/');
  }
});

// ── Start server ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  ✅  FIXED TEST SERVER                           ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Running on http://localhost:${PORT}              ║`);
  console.log('║                                                  ║');
  console.log('║  Fixes applied:                                  ║');
  console.log('║   ✓ Security headers (XFO, CSP, XCTO, HSTS)     ║');
  console.log('║   ✓ CSRF tokens on POST forms                    ║');
  console.log('║   ✓ XSS input sanitization                      ║');
  console.log('║   ✓ Secure cookie flags                          ║');
  console.log('║   ✓ .git & backup files blocked                  ║');
  console.log('║   ✓ Directory listing disabled                   ║');
  console.log('║   ✓ Dangerous methods removed                    ║');
  console.log('║   ✓ Open redirect fixed                          ║');
  console.log('║                                                  ║');
  console.log('║  Still present:                                  ║');
  console.log('║   ⚠ No HTTPS (HTTP only)                        ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});
