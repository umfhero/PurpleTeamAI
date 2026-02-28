// OWASP Top 10 2021 types and constants

export enum OWASPCategory {
  A01_BROKEN_ACCESS_CONTROL = 'A01',
  A02_CRYPTOGRAPHIC_FAILURES = 'A02',
  A03_INJECTION = 'A03',
  A04_INSECURE_DESIGN = 'A04',
  A05_SECURITY_MISCONFIGURATION = 'A05',
  A06_VULNERABLE_COMPONENTS = 'A06',
  A07_AUTH_FAILURES = 'A07',
  A08_DATA_INTEGRITY_FAILURES = 'A08',
  A09_LOGGING_FAILURES = 'A09',
  A10_SSRF = 'A10'
}

export interface OWASPCategoryInfo {
  id: OWASPCategory
  name: string
  description: string
  keywords: string[]
  cvePatterns: string[]
}

export const OWASP_TOP_10: Record<OWASPCategory, OWASPCategoryInfo> = {
  [OWASPCategory.A01_BROKEN_ACCESS_CONTROL]: {
    id: OWASPCategory.A01_BROKEN_ACCESS_CONTROL,
    name: 'Broken Access Control',
    description: 'Restrictions on what authenticated users can do are not properly enforced',
    keywords: [
      'access control', 'authorization', 'privilege escalation', 'vertical privilege',
      'horizontal privilege', 'path traversal', 'directory traversal', 'forceful browsing',
      'insecure direct object reference', 'idor', 'missing authorization',
      'csrf', 'cross-site request forgery', 'anti-forgery',
      'information disclosure', 'file inclusion', 'lfi', 'rfi',
      'forced browsing', 'missing function level', 'access bypass',
      'unauthorized access', 'privilege', 'insecure direct object'
    ],
    cvePatterns: ['CVE-*-*'] // Generic - requires context
  },
  [OWASPCategory.A02_CRYPTOGRAPHIC_FAILURES]: {
    id: OWASPCategory.A02_CRYPTOGRAPHIC_FAILURES,
    name: 'Cryptographic Failures',
    description: 'Failures related to cryptography which often lead to exposure of sensitive data',
    keywords: [
      'encryption', 'weak cipher', 'ssl', 'tls', 'https', 'certificate',
      'weak hash', 'md5', 'sha1', 'cleartext', 'plaintext password',
      'insecure protocol', 'weak encryption', 'crypto',
      'sslv2', 'sslv3', 'tls 1.0', 'tls 1.1', 'rc4', 'des', '3des',
      'diffie-hellman', 'dh key', 'sweet32', 'poodle', 'beast',
      'heartbleed', 'drown', 'logjam', 'freak',
      'cleartext transmission', 'unencrypted', 'plain text'
    ],
    cvePatterns: ['CVE-*-*'] // SSL/TLS specific CVEs would match here
  },
  [OWASPCategory.A03_INJECTION]: {
    id: OWASPCategory.A03_INJECTION,
    name: 'Injection',
    description: 'User-supplied data is not validated, filtered, or sanitized',
    keywords: [
      'sql injection', 'sqli', 'xss', 'cross-site scripting', 'command injection',
      'ldap injection', 'xpath injection', 'xml injection', 'code injection',
      'os command', 'shell injection', 'script injection', 'nosql injection',
      'template injection', 'ssti', 'crlf injection', 'header injection',
      'expression language', 'ognl', 'log4j', 'log4shell',
      'remote code execution', 'rce', 'eval injection'
    ],
    cvePatterns: ['CVE-*-*'] // Many injection CVEs
  },
  [OWASPCategory.A04_INSECURE_DESIGN]: {
    id: OWASPCategory.A04_INSECURE_DESIGN,
    name: 'Insecure Design',
    description: 'Missing or ineffective control design',
    keywords: [
      'threat modeling', 'secure design', 'design flaw', 'architecture',
      'insecure design pattern', 'missing security control'
    ],
    cvePatterns: []
  },
  [OWASPCategory.A05_SECURITY_MISCONFIGURATION]: {
    id: OWASPCategory.A05_SECURITY_MISCONFIGURATION,
    name: 'Security Misconfiguration',
    description: 'Missing appropriate security hardening or improperly configured permissions',
    keywords: [
      'default credentials', 'default password', 'misconfiguration', 'verbose error',
      'stack trace', 'directory listing', 'unnecessary features', 'unused pages',
      'unpatched', 'insecure default', 'admin interface', 'debug mode',
      'clickjacking', 'x-frame-options', 'content-type-options', 'x-content-type',
      'hsts', 'strict-transport', 'missing header', 'security header',
      'cookie flag', 'secure flag', 'httponly', 'samesite',
      'cors', 'server header', 'x-powered-by', 'version disclosure',
      'information leak', 'http method', 'options method', 'trace method',
      'directory indexing', 'banner grabbing', 'server banner',
      'error message', 'error page', 'default page'
    ],
    cvePatterns: ['CVE-*-*']
  },
  [OWASPCategory.A06_VULNERABLE_COMPONENTS]: {
    id: OWASPCategory.A06_VULNERABLE_COMPONENTS,
    name: 'Vulnerable and Outdated Components',
    description: 'Using components with known vulnerabilities',
    keywords: [
      'outdated', 'vulnerable library', 'known vulnerability', 'component',
      'dependency', 'third-party', 'old version', 'unsupported version',
      'end of life', 'eol',
      'outdated software', 'outdated version', 'deprecated',
      'vulnerable component', 'known cve', 'patch available',
      'version behind', 'obsolete', 'legacy version'
    ],
    cvePatterns: ['CVE-*-*'] // Most CVEs fall here
  },
  [OWASPCategory.A07_AUTH_FAILURES]: {
    id: OWASPCategory.A07_AUTH_FAILURES,
    name: 'Identification and Authentication Failures',
    description: 'Confirmation of user identity, authentication, and session management',
    keywords: [
      'authentication', 'session', 'credential stuffing', 'brute force',
      'weak password', 'session fixation', 'session hijacking', 'auth bypass',
      'broken authentication', 'password', 'login',
      'multi-factor', 'mfa', '2fa', 'otp', 'default login',
      'password policy', 'account lockout', 'credential reuse',
      'session timeout', 'session management', 'token expiry'
    ],
    cvePatterns: ['CVE-*-*']
  },
  [OWASPCategory.A08_DATA_INTEGRITY_FAILURES]: {
    id: OWASPCategory.A08_DATA_INTEGRITY_FAILURES,
    name: 'Software and Data Integrity Failures',
    description: 'Code and infrastructure that does not protect against integrity violations',
    keywords: [
      'insecure deserialization', 'deserialization', 'unsigned update',
      'ci/cd pipeline', 'auto-update', 'integrity check', 'tampering'
    ],
    cvePatterns: ['CVE-*-*']
  },
  [OWASPCategory.A09_LOGGING_FAILURES]: {
    id: OWASPCategory.A09_LOGGING_FAILURES,
    name: 'Security Logging and Monitoring Failures',
    description: 'Insufficient logging and monitoring',
    keywords: [
      'logging', 'monitoring', 'audit', 'log', 'insufficient logging',
      'no monitoring', 'alerting', 'incident response'
    ],
    cvePatterns: []
  },
  [OWASPCategory.A10_SSRF]: {
    id: OWASPCategory.A10_SSRF,
    name: 'Server-Side Request Forgery (SSRF)',
    description: 'Web application fetching a remote resource without validating the user-supplied URL',
    keywords: [
      'ssrf', 'server-side request forgery', 'url redirect', 'open redirect',
      'unsafe url', 'fetch', 'remote resource'
    ],
    cvePatterns: ['CVE-*-*']
  }
}

export interface OWASPMapping {
  category: OWASPCategory
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

export interface VulnerabilityWithMapping {
  vulnerabilityId: string
  owaspMappings: OWASPMapping[]
}
