The following list details the vulnerabilities found on the site, organised by category:

Injection Vulnerabilities
These are the most prominent issues on the site, where user-supplied data is processed as code or queries.

SQL Injection (SQLi): Multiple entry points across the site (e.g., artists.php?artist=, listproducts.php?cat=) allow for:

Error-based SQLi: Extracting database information through detailed error messages.

Union-based SQLi: Joining malicious queries to legitimate ones to dump entire tables.

Boolean-based (Blind) SQLi: Inferring data by observing true/false application responses.

Cross-Site Scripting (XSS):

Reflected XSS: Found in the search bar and various URL parameters (e.g., listproducts.php?cat=), allowing attackers to execute JavaScript in a victim's browser.

Stored XSS: Found in the guestbook section, where malicious scripts are saved to the server and executed for every visiting user.

Broken Access Control
Issues related to how the application restricts access to sections and files.

Local File Inclusion (LFI): Specifically on showimage.php?file=, which can be manipulated to read sensitive system files (e.g., /etc/passwd).

Insecure Direct Object Reference (IDOR): Found in user profile sections where changing an ID in the URL allows access to other users' private data.

Directory Traversal: Ability to navigate the server's file structure via unvalidated input.

Identification and Authentication Failures
Weaknesses in the login and user management systems.

Brute-Force Vulnerability: The login page (login.php) lacks rate limiting or account lockout, allowing automated credential guessing.

Weak Password Policy: The system allows simple, easily guessable passwords (e.g., the default test/test).

Sensitive Information Disclosure: Credentials and sensitive files (like credentials.txt or pictures/) are accessible via direct URL navigation without authentication.

Cryptographic Failures
Issues involving the protection of data in transit.

Unencrypted Communications: The site uses HTTP rather than HTTPS, meaning all data (including passwords and session cookies) is transmitted in cleartext.

Password Transmission over HTTP: Login credentials are sent via POST/GET requests without any transport layer security.

Other Vulnerabilities
Cross-Site Request Forgery (CSRF): Found in the guestbook and login forms, potentially allowing attackers to perform actions on behalf of a logged-in user.

Clickjacking: The application does not use X-Frame-Options or Content Security Policy (CSP) headers, making it possible to overlay the site in an iframe.

HTTP Parameter Pollution (HPP): Demonstrated on specific pages (e.g., /hpp/) to show how multiple parameters can confuse backend logic.

Email Address Disclosure: Internal or user email addresses are visible within the page source or public-facing profiles.