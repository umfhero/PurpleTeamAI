Scan Delta Comparison (Lifecycle Iteration)

Goal: Compare current scan with most recent previous scan for same target.

Implementation tasks:

On new scan completion:

Load latest previous JSON scan for same target

Compare:

Vulnerability IDs / titles

CVEs

Severity levels

Open ports

Categorise:

resolved

persisting

new

Compute:

Score delta (old vs new)

OWASP coverage delta

Generate structured ChangeSummary object

Display summary:

In Dashboard

In generated reports

Output example:

Resolved: 2
New: 1 (High)
Persisting: 3
Score: 62 → 78 (+16)
OWASP Categories: 5 → 3