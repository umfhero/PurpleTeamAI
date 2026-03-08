# Extension 4: Exploitability-Aware Risk Weighting — Implementation Prompt

## Context

You are working on **PurpleTeam Suite**, an Electron + React + TypeScript desktop application that runs an automated vulnerability assessment pipeline. The app scans targets with Nmap, parses results into structured JSON, maps findings to OWASP Top 10 categories, calculates a security score, enriches findings with AI analysis via Google Gemini, validates the AI output for hallucinations, and generates PDF reports.

The security scoring engine lives in `frontend/electron/analysis/security-scorer.ts`. It currently uses a **flat severity-based deduction model**:

- Starts at 100
- Deducts per vulnerability by severity: critical −20, high −10, medium −5, low −2, info −1
- Applies an OWASP breadth penalty: −5 per OWASP category hit
- Adds a remediation bonus: +10 if LLM analysis exists
- Calculates a separate scan confidence rating (high/medium/low)
- Floors the score at 0, caps at 100
- Maps the score to a letter grade (A+ through F)

The vulnerability data structure (`VulnerabilityResult` from `frontend/electron/scanner/types.ts`) includes fields such as: `id`, `title`, `severity`, `port`, `service`, `description`, `cve`, `cvss`, `output`, and `evidence`.

The scan data structure (`NmapScanData`) includes a `ports` array where each port has: `port` (number), `protocol`, `state`, `service` (name string), `version`, and `vulnerabilities` array.

---

## What to Implement

Add an **exploitability-aware risk weighting layer** to the security scorer. This layer applies contextual multipliers to each vulnerability's base severity deduction *before* summing them. The multipliers reflect how exploitable each vulnerability is given its deployment context — not just its raw severity.

### The Four Contextual Multipliers

Each multiplier is applied independently and they stack multiplicatively on the base severity deduction for each vulnerability.

#### 1. Public-Facing Port Exposure Weighting

Vulnerabilities on commonly targeted ports carry more real-world risk than those on obscure internal ports.

| Port Category | Ports | Multiplier |
|---|---|---|
| High-exposure web | 80, 443, 8080, 8443 | ×1.5 |
| High-exposure services | 21 (FTP), 22 (SSH), 23 (Telnet), 25 (SMTP), 3389 (RDP) | ×1.3 |
| Standard services | All other known ports | ×1.0 (no change) |

If the vulnerability has no associated port (e.g. missing header checks added by the parser's post-processing), apply ×1.0.

#### 2. Database/Service Exposure Amplification

Vulnerabilities affecting database or administrative services are disproportionately dangerous because compromise grants direct data access.

| Service Pattern (match against `service` field, case-insensitive) | Multiplier |
|---|---|
| mysql, postgres, mssql, oracle, mongodb, redis, memcached, elasticsearch | ×1.5 |
| ftp, telnet, vnc, rdp, smb | ×1.3 |
| All other services | ×1.0 |

#### 3. TLS Absence Penalty

If the scan data shows HTTP services (port 80, 8080, or any port where service contains "http" but NOT "https") with no corresponding HTTPS equivalent detected on the same target, apply a flat additional deduction of **−8 points** to the total score (applied once, not per-vulnerability). This reflects the systemic risk of unencrypted transport.

Detection logic: check if any port in the scan has service matching "https" or "ssl/http" or port 443 is open. If none found but HTTP ports exist, apply the penalty.

#### 4. Authentication Weakness Multiplier

Vulnerabilities whose title, description, or output suggest authentication weaknesses are more exploitable.

| Pattern (regex match against title + description + output, case-insensitive) | Multiplier |
|---|---|
| `default.?cred`, `default.?password`, `anonymous.?login`, `no.?auth`, `weak.?password`, `brute.?force`, `login.?bypass` | ×1.8 |
| `basic.?auth`, `cleartext.?password`, `plain.?text.?auth`, `unencrypted.?login` | ×1.4 |
| No match | ×1.0 |

### How the Multipliers Combine

For each vulnerability:

```
adjustedDeduction = baseDeduction × portMultiplier × serviceMultiplier × authMultiplier
```

Then sum all adjusted deductions, apply the TLS absence penalty if triggered, apply the existing OWASP breadth penalty and remediation bonus, and clamp to 0–100.

### Transparency Requirements

The score breakdown (already returned by the scorer) must be extended to include:

- A new field showing each applied contextual factor per vulnerability (e.g. `contextualFactors: { portExposure: 1.5, serviceExposure: 1.0, authWeakness: 1.0, combined: 1.5 }`)
- A summary field on the overall score result showing whether the TLS absence penalty was applied and the total contextual adjustment magnitude (e.g. `contextualWeighting: { tlsPenaltyApplied: boolean, totalAdjustedDeductions: number, totalBaseDeductions: number }`)
- All multipliers are deterministic and traceable — no randomness, no LLM involvement

### What NOT to Change

- Do not modify the hallucination guard, OWASP mapper, LLM module, or delta comparison system
- Do not change the existing base severity deduction values (critical −20, high −10, etc.)
- Do not change the letter grade thresholds
- Do not change the scan confidence calculation
- The multipliers should be defined as constants (not hardcoded inline) so they can be tuned later

---

## File Changes Expected

| File | Change |
|---|---|
| `frontend/electron/analysis/security-scorer.ts` | Add multiplier logic, extend score calculation, extend return types |
| `frontend/electron/analysis/index.ts` | Export any new types if created |
| Type definitions (wherever `SecurityScore` or equivalent is defined) | Add `contextualFactors` and `contextualWeighting` fields |
| `frontend/src/components/SecurityScoreCard.tsx` | Display the contextual weighting summary (optional but recommended — at minimum show "Contextual weighting applied" indicator) |

---

## How to Test

### Test 1: Localhost Testbed (Controlled Environment)

The project includes a controlled test site at `test-site/` with 12 known intentional vulnerabilities.

1. Run a scan against `localhost` (the testbed must be running)
2. Record the security score **before** this change (run a scan on a clean branch first, note the score)
3. Apply the Extension 4 changes
4. Run the same scan again against `localhost`
5. **Expected**: The score should be **lower** than before (because the contextual multipliers amplify deductions for exposed ports and services). The exact delta depends on which ports/services the testbed exposes, but any web-facing vulns on port 80/8080 should now carry heavier penalties.
6. Check the score breakdown includes the new `contextualWeighting` summary

### Test 2: testphp.vulnweb.com (External Target)

1. Run a scan against `testphp.vulnweb.com`
2. Compare the new score against a pre-change scan of the same target
3. **Expected**: Score decreases because this target serves HTTP on port 80 (high-exposure web ×1.5) and likely triggers the TLS absence penalty (−8). Any authentication-related findings should also show amplified deductions.

### Test 3: Verify Multiplier Transparency

1. After any scan, inspect the score result object (via console log or by checking the scan JSON saved to `data/scans/`)
2. Verify that each vulnerability has a `contextualFactors` object showing which multipliers were applied
3. Verify the overall `contextualWeighting` summary shows `tlsPenaltyApplied: true/false` and the deduction totals
4. Confirm that vulnerabilities with no special context show all multipliers at 1.0

### Test 4: Delta Comparison Validity

1. If you have a previous scan of `localhost` saved, generate a delta comparison report after the new scan
2. The delta should reflect the score change caused by the new weighting
3. This confirms the extension integrates cleanly with the existing delta comparison system without breaking it

### Test 5: No Regression on Hallucination Metrics

1. After scanning, check `data/hallucination-metrics.json`
2. Trust scores, OWASP disagreement rates, and fabricated CVE counts should be **unchanged** — this extension only touches the scorer, not the hallucination guard
3. **Expected**: Identical hallucination metrics to pre-change scans

---

## Acceptance Criteria

- [ ] Scores are lower than before for targets with exposed web ports, database services, or authentication weaknesses
- [ ] TLS absence penalty applies exactly once when HTTP is present without HTTPS
- [ ] All multipliers are defined as named constants, not inline magic numbers
- [ ] Score breakdown includes per-vulnerability `contextualFactors`
- [ ] Score result includes `contextualWeighting` summary
- [ ] Existing tests (if any) still pass
- [ ] Hallucination guard and delta comparison are unaffected
- [ ] Score still clamps to 0–100
- [ ] Letter grade mapping is unchanged
