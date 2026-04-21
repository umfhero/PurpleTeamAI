# Dissertation Checklist — Claude Code Prompt

## Context

You are editing a LaTeX dissertation for a BSc Cyber Security final-year project at Middlesex University (module CST3590). The dissertation is titled "Automating the Purple Team Lifecycle: An Integrated Deterministic AI Framework for Vulnerability Discovery, Prioritisation, and Remediation Guidance" by Majid (student ID M01031005), supervised by David Neilson.

## Critical constraints — read before touching any file

1. **Voice preservation is non-negotiable.** Only make the specific changes listed in the checklist below. Do NOT rewrite, rephrase, restructure, or "improve" any prose that is not explicitly flagged for change. Majid's voice is characterised by: UK English, long cumulative sentences with clause-chaining, no em-dashes (use commas or full stops), no AI vocabulary (no "delve", "nuanced", "robust", "leverage", "landscape", "foster", "bolster", "cornerstone", "meticulous", "navigate challenges", "unpack"), connectors like "Additionally,", "Furthermore,", "Consequently,", "Taken together,", and frequent use of "this" as a forward-referencing pronoun. If you are uncertain whether a change is in scope, do not make it.

2. **LaTeX integrity.** The dissertation uses a modular structure with `\input{}` files. The preamble defines a shared colour palette (`headerblue`, `headertext`, `rowlight`, `rowwhite`). Packages in use include `booktabs`, `tabularx`, `xcolor[table]`, `tikz`, `hyperref`, `graphicx`, `longtable`. Bibliography uses IEEEtranS style (alphabetically sorted) with Mendeley-exported `.bib`. Images are stored in `product/` folder. Do NOT add new packages, do NOT change the preamble, do NOT modify any table formatting, figure placement, or `\label`/`\ref` commands unless explicitly instructed. After every edit, verify the file still compiles by checking bracket matching and command integrity.

3. **Scope discipline.** Work ONLY on the specific checklist item you are asked to address. Do not make opportunistic fixes, do not tidy adjacent text, do not reformat nearby tables. Each checklist item is self-contained. When you finish an item, stop and report what you changed, quoting the old text and new text with line numbers.

4. **Backup before editing.** Before making any change to a `.tex` file, copy it to a timestamped backup (e.g. `chapter1.tex.bak-YYYYMMDD-HHMM`).

---

## LaTeX file structure (verify against your actual repo before starting)

The dissertation likely uses one of these structures:

- A single `dissertation.tex` with all content inline, OR
- A root `dissertation.tex` that uses `\input{chapter1}`, `\input{chapter2}`, etc.

Before starting ANY checklist item, run:

```bash
grep -n "\\\\input\|\\\\include" dissertation.tex
```

to discover the modular structure, then identify which file contains the section you need to edit. Also run:

```bash
grep -rn "\\\\section\|\\\\subsection\|\\\\chapter" *.tex | head -60
```

to map out the chapter/section structure across files.

---

## The checklist

Items are grouped by chapter. Work through them in the order presented. Each item has an ID, severity, and precise instructions.

---

### CHAPTER 1 — Introduction

**[1.1] HIGH — Replace Research Questions in §1.2**

Find the three research questions in Section 1.2. Replace them with:

> **I.** To what extent can a deterministic-first, AI-assisted purple-team framework integrate vulnerability discovery, prioritisation, and structured remediation guidance within a single reproducible pipeline?
>
> **II.** How consistently can a hybrid deterministic and LLM-assisted classification mechanism map identified vulnerabilities to OWASP Top 10 categories across heterogeneous authorised test targets?
>
> **III.** Can structured hallucination mitigation through deterministic cross-validation measurably constrain AI-generated classification inconsistencies and fabricated vulnerability references within an automated vulnerability assessment pipeline?

Do NOT change any surrounding prose. Only replace the three RQ texts themselves.

---

**[1.2] HIGH — Replace Objectives in §1.3.1**

Find the seven objectives (A through G) in Section 1.3.1. Replace them with:

> **A.** To design a modular, reproducible vulnerability scanning pipeline.
>
> **B.** To implement deterministic OWASP Top 10 classification logic.
>
> **C.** To integrate a structured LLM-assisted analysis component with enforced JSON schema validation and output constraints.
>
> **D.** To implement a hallucination detection and trust scoring mechanism that cross-validates AI output against deterministic scan evidence.
>
> **E.** To evaluate classification consistency, remediation quality, and OWASP coverage across a heterogeneous set of authorised test targets.
>
> **F.** To implement structured scan delta comparison supporting iterative reassessment.
>
> **G.** To introduce exploitability-aware contextual weighting into the security scoring model.

Do NOT change any prose before or after the objectives list. Only replace the objective texts themselves.

---

**[1.3] MEDIUM — Propagate Objective E wording to Table 3.1**

Find Table 3.1 (Requirements traceability matrix) in Chapter 3. In the row for Objective E, find the text in the "Requirement" column. It currently reads something like "Evaluate classification accuracy, remediation quality and OWASP coverage". Replace with: "Evaluate classification consistency, remediation quality and OWASP coverage across a heterogeneous set of authorised test targets". Also check Objective C row — if it says "LLM fortification", change to "LLM-assisted analysis". Check Objective D row — if it does not mention cross-validation, update to match the new wording.

---

**[1.4] LOW — Hyphenation consistency for "purple team"**

Run:

```bash
grep -n "purple.team" chapter1*.tex dissertation.tex
```

Decide on one form: either "purple-team" (hyphenated as compound adjective before a noun, e.g. "purple-team framework") or "purple team" (unhyphenated as a standalone noun, e.g. "the purple team"). The convention should be: hyphenate when used as a compound modifier before a noun ("purple-team lifecycle", "purple-team framework"), no hyphen when used as a noun ("the purple team"). Apply consistently across Chapter 1 only for now — the editorial sweep will catch other chapters.

---

### CHAPTER 2 — Literature Review

**[2.1] MEDIUM — Trim ~460 words**

Current count: ~2,963 words. Target: ~2,500. Best candidates for trimming (in order of least damage):

1. **§2.7 (Purple Team Lifecycle Integration Gaps)** — The third paragraph beginning with "What this body of work establishes..." largely restates what §2.8 Summary will cover. Reduce to 1-2 sentences that state the gap and point forward. Estimated saving: ~120 words.

2. **§2.8 (Summary and Transition to Methodology)** — The final paragraph beginning "PurpleTeam Suite is a modular, Electron-based desktop application..." is a system description that belongs in Chapter 3, not the literature review. Delete it entirely — Chapter 3 opens with this content anyway. Estimated saving: ~120 words.

3. **§2.3 (Risk Scoring Models)** — The paragraph on Lei et al. (attack graph modelling) and the follow-up "practical constraint" paragraph can be compressed into 2 sentences since you explicitly note this approach is inapplicable to your black-box context. Estimated saving: ~80 words.

4. **§2.2 (Detection Maturity)** — The closing paragraph ("What the detection literature establishes...") is a mini-summary. Tighten to 2 sentences. Estimated saving: ~60 words.

5. **General:** Look for sentences that begin with author names and repeat information already stated in the previous sentence. Merge where possible. Estimated saving: ~80 words.

**Rules for trimming:**

- Do NOT rewrite remaining sentences. Only delete or merge.
- Do NOT remove any citation — every `\cite{}` that exists must survive.
- When merging two sentences, use the phrasing from one of the originals, not new language.
- After trimming, verify all `\cite{}` commands still have valid references and no orphaned cross-references exist.

---

**[2.2] LOW — Citation formatting in §2.2 and §2.5**

Run:

```bash
grep -n "\\\\cite" chapter2*.tex | head -40
```

Look for places where the same `\cite{key}` appears in two consecutive sentences referring to the same author's single work. In IEEE style, cite at the first mention, then refer by author name (e.g. "Singh et al." or "they") until a new source is introduced. This is a minor style improvement — only fix clear cases, do not restructure paragraphs.

---

### CHAPTER 3 — Methodology

**[3.1] CRITICAL — Cut ~1,130 words. Current: ~2,633, Target: ~1,500.**

This is the largest structural change. Execute in this order:

**Step 3.1a — Move §3.2.7 Implementation Environment prose to Appendix**

Find the subsection "Implementation Environment" (§3.2.7). It contains two tables (Table 3.2 and Table 3.3) and surrounding prose paragraphs.

- The **tables themselves stay in Chapter 3** — they occupy page space but don't count toward word count.
- Move the **prose paragraphs** around them to a new appendix section (e.g. Appendix C: Implementation Environment Details). This includes:
  - The opening paragraph about technology stack selection criteria
  - The "Two architectural decisions" justification paragraphs
  - The development/testing environment paragraph
  - The Kali Linux build verification paragraph
- In Chapter 3, replace the removed prose with one sentence: "Table~\ref{tab:tech-stack} and Table~\ref{tab:dependencies} summarise the technology stack and key dependencies; selection rationale and architectural justification are provided in Appendix~C."
- Estimated saving: **~400 words**

**Step 3.1b — Compress §3.2.3 through §3.2.6**

Each of these subsections currently has an introductory paragraph explaining the module's purpose, followed by a figure-referencing paragraph that restates the same information. For each:

- Merge the introductory paragraph and the figure-referencing paragraph into a single paragraph.
- Delete sentences that merely describe what the figure shows when the figure is self-explanatory.
- Do NOT delete any sentence that contains a `\cite{}` command.
- Estimated saving: **~300 words**

**Step 3.1c — Shorten §3.3 Evaluation Framework opening**

The opening paragraph of §3.3 lists all five targets with full addresses and descriptions in prose. This duplicates Table 4.1 in Chapter 4. Replace with: "The evaluation is structured across five phases, each producing quantitative data against defined metrics. All testing is conducted on five authorised targets described in Table~\ref{tab:eval-targets} (Section~4.1), which collectively represent a range of technology stacks, deployment models and vulnerability profiles."

Then delete the rest of the multi-paragraph target description. Keep the phase descriptions (Phase 1 through Phase 5) and Table 3.4.

- Estimated saving: **~150 words**

**Step 3.1d — Tighten §3.4 Limitations**

Remove sentences that restate constraints already established in the Literature Review (e.g. "OWASP ZAP or Burp Suite" comparison — already covered in §2.2). Keep only limitations unique to this project's implementation.

- Estimated saving: **~100 words**

**Step 3.1e — Shorten §3.5 Summary**

Reduce to 3-4 sentences maximum. The summary should state: (1) what the chapter established, (2) that the system is feature-complete, (3) that results follow in Chapter 4. Delete any sentence that re-lists pipeline components already described in §3.2.

- Estimated saving: **~150 words**

After all five steps, verify the chapter compiles and recount words (excluding tables, captions, headings, and figure labels).

---

**[3.2] HIGH — Trust score range clarification in §3.2.5**

Find the paragraph in §3.2.5 (AI Integration and Hallucination Control) that describes the trust score formula. Add one sentence after the formula description: "Trust scores are clamped to the 0--100 range, with a score of zero indicating near-total disagreement between AI and deterministic classifications."

---

**[3.3] MEDIUM — Remediation bonus definition**

Find §3.2.4 (Classification and Scoring). At the end of the scoring description, add one sentence: "A flat +10 remediation bonus is applied to the security score when AI analysis completes successfully, reflecting full pipeline execution."

If this was already mentioned, verify it matches. If not, add it.

---

**[3.4] MEDIUM — Testbed description accuracy**

Find the description of the controlled testbed in §3.3 (or wherever it appears in Chapter 3). If it says "12 intentional vulnerabilities across six OWASP categories", change "six OWASP categories" to "multiple OWASP categories". This is because the network-layer scanner surfaces only 4 of the 6 intended categories, and the "six" figure creates a discrepancy with Chapter 4's Table 4.3 results.

---

**[3.5] HIGH — Figure 3.5(b) caption clarification**

Find the caption for Figure 3.5. It currently has two sub-captions for panels (a) and (b). Add to the end of the (b) sub-caption: "; this screenshot predates the definitive lifecycle evaluation reported in Section~4.5."

---

### CHAPTER 4 — Analysis and Results

**[4.1] CRITICAL — Cut ~2,550 words. Current: ~3,557. Target: ~1,000.**

This is your single biggest task. Execute in this order:

**Step 4.1a — Delete §4.8 Discussion subsections and fold key points back**

The entire §4.8 Discussion section (subsections 4.8.1 through 4.8.7) currently runs ~1,342 words and largely duplicates observations already made in §4.2 through §4.6. Delete the following subsections entirely:

- §4.8.1 Scoring Determinism — the observation is already stated in §4.2.
- §4.8.2 Contextual Weighting Validity — already stated in §4.3.
- §4.8.3 Feature Contribution — already stated in §4.4.
- §4.8.4 Lifecycle Tracking Accuracy — already stated in §4.5.

For the remaining subsections, fold their unique content into existing sections:

- §4.8.5 AI Reliability — Move the key observation (3/5 targets below threshold, zero fabricated CVEs) into a closing paragraph of §4.6. **Add one sentence acknowledging that the original 70-point trust score target was not met on three of five targets before explaining why this is diagnostically informative.**
- §4.8.6 OWASP Coverage Analysis — Move to a closing paragraph of §4.2 (it follows naturally from the baseline OWASP distribution results).
- §4.8.7 Limitations — Move to a brief closing paragraph at the end of §4.6 or make it a standalone §4.7 (replacing the current tool comparison position).

Delete the `\section{Discussion}` and all its `\subsection{}` commands.

- Estimated saving: **~800-1,000 words** (after folding unique content back)

**Step 4.1b — Compress §4.2 (Phase 1)**

Currently ~378 words. Target: ~200 words. Delete sentences that describe what the tables and figures show when the data is self-evident from the table. Keep: the score range observation, the OWASP coverage finding (4/10), and the justification for using Mutillidae as the primary ablation target.

**Step 4.1c — Compress §4.3 (Phase 2)**

Currently ~314 words. Target: ~200 words. The key finding (69.2% amplification, only port exposure activated) can be stated in fewer sentences. Delete the paragraph explaining which multiplier channels didn't activate — this is visible from Figure 4.5.

**Step 4.1d — Compress §4.6 (Phase 5)**

Currently ~443 words. Target: ~250 words. Tighten the three interpretive paragraphs to two. The demo.testfire.net technology stack explanation is detailed but can be shortened to one sentence.

**Step 4.1e — Compress §4.7 Tool Capability Comparison**

Currently ~268 words. Target: ~150 words. The caveats about Nmap limitations are already stated in §3.4. Keep the table and one paragraph of contextualisation.

**Step 4.1f — Shorten §4.1 opening and §4.9 summary**

- §4.1: Remove the five-target prose list (it's in Table 4.1). Keep one sentence pointing to the table and one sentence establishing the phase structure.
- §4.9: Reduce to one paragraph of 4-5 sentences stating key findings and pointing to Chapter 5.
- Estimated saving: **~180 words combined**

After all steps, verify the chapter compiles and recount words.

---

**[4.2] HIGH — Phase 3 scope correction in §4.1**

Find the sentence in §4.1 that reads "Phase 3 (ablation) was conducted on Mutillidae and the controlled testbed". Change to "Phase 3 (ablation) was conducted on Mutillidae". The ablation was only run on Mutillidae.

---

**[4.3] MEDIUM — Remediation bonus reference in §4.4**

If you added the +10 bonus definition to §3.2.4 (item 3.3 above), no change needed here. If you chose not to add it to Chapter 3, then find the sentence in §4.4 that mentions "the +10 remediation bonus" and delete the parenthetical. The zero-delta observation stands without it.

---

**[4.4] HIGH — Trust score acknowledgement**

After folding §4.8.5 content into §4.6 (as part of step 4.1a), ensure the folded text includes one sentence like: "The 70-point trust score target defined during implementation was not met on three of the five evaluation targets, an outcome that reflects genuine AI classification inconsistencies rather than a systematic deficiency in the guard itself."

This sentence should appear BEFORE the diagnostic reframing, not after it.

---

### APPENDICES

**[7.1] MEDIUM — Expand Appendix A with repository statistics**

Add a brief statistics block after the GitHub URL paragraph:

```latex
\begin{table}[htbp]
\centering
\caption{Repository statistics at time of submission.}
\begin{tabular}{ll}
\toprule
Metric & Value \\
\midrule
Total source files & [CHECK: run \texttt{find . -name "*.ts" -o -name "*.tsx" | wc -l}] \\
Lines of TypeScript & [CHECK: run \texttt{find . -name "*.ts" -o -name "*.tsx" | xargs wc -l | tail -1}] \\
Pipeline modules & 10 (scanner, parser, OWASP mapper, scorer, LLM, hallucination guard, delta, reports, feature toggles, metrics) \\
Evaluation scans saved & [CHECK: count JSON files in data/scans/] \\
\bottomrule
\end{tabular}
\end{table}
```

Fill in the actual values by running the commands against the repository. If you don't have access to the repo from the LaTeX environment, leave `[TODO]` placeholders and note them for Majid to fill in manually.

---

**[7.2] MEDIUM — Figure B.1 caption update**

Find the caption for Figure B.1 (Gantt chart). If it contains a footnote or caption text about testphp.vulnweb.com, update it to read: "testphp.vulnweb.com was parked during testing after becoming unavailable (see Section~3.3); the evaluation target set was reconfigured to the five authorised targets described in Section~3.3. DVWA was retained as a contingency but was not required."

If the text is embedded in the image itself (SVG or PNG), note this for Majid — the image file will need regeneration, and you should NOT attempt to modify image files.

---

### EDITORIAL SWEEP (do last, after all above items are complete)

**[8.1] LOW — Verify Nmap version**

Find the sentence in §4.1 that says "Nmap 7.98". Flag it for Majid to verify against his actual install: `nmap --version`.

**[8.2] LOW — Purple-team hyphenation sweep**

Run across all chapter files:

```bash
grep -rn "purple.team" *.tex
```

Apply the rule from item 1.4: hyphenate as compound modifier ("purple-team framework"), no hyphen as noun ("the purple team").

**[8.3] LOW — OWASP category name consistency**

Run:

```bash
grep -rn "A01\|A02\|A03\|A04\|A05\|A06\|A07\|A08\|A09\|A10" *.tex | grep -i "broken\|crypto\|injection\|insecure\|misconfig\|vulnerable\|identification\|integrity\|logging\|forgery"
```

Verify each OWASP code is always followed by the same category name.

**[8.4] HIGH — Cross-reference integrity**

After all content changes are complete, run:

```bash
grep -rn "\\\\ref{" *.tex | sed 's/.*\\ref{\([^}]*\)}.*/\1/' | sort | uniq > refs-used.txt
grep -rn "\\\\label{" *.tex | sed 's/.*\\label{\([^}]*\)}.*/\1/' | sort | uniq > refs-defined.txt
diff refs-used.txt refs-defined.txt
```

Any `\ref{}` that points to a `\label{}` that no longer exists after restructuring must be fixed. Report all broken references.

---

## Working order

Execute items in this sequence:

1. Items 1.1 and 1.2 (RQ/Objective updates)
2. Item 1.3 (Table 3.1 propagation)
3. Item 4.1 (Chapter 4 cuts — biggest word count saving)
4. Item 4.2, 4.3, 4.4 (Chapter 4 targeted fixes)
5. Item 3.1 (Chapter 3 cuts)
6. Items 3.2, 3.3, 3.4, 3.5 (Chapter 3 targeted fixes)
7. Item 2.1 (Chapter 2 trim)
8. Item 2.2 (Chapter 2 citation formatting)
9. Items 7.1, 7.2 (Appendices)
10. Items 1.4, 8.1, 8.2, 8.3, 8.4 (Editorial sweep)

After EACH item, report: item ID, what was changed (old text → new text with line numbers), and confirmation that the file still compiles (bracket matching check at minimum).

---

## What NOT to do

- Do NOT write Chapter 5 (Conclusions) or the Abstract. These will be written separately.
- Do NOT add new figures, tables, or diagrams.
- Do NOT change any figure image files (.png, .svg, .pdf in product/ folder).
- Do NOT modify the bibliography (.bib file) or add/remove references.
- Do NOT change the preamble or document class.
- Do NOT rewrite any prose that is not explicitly flagged in this checklist.
- Do NOT make "while I'm here" opportunistic fixes to adjacent text.
