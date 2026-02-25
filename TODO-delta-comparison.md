# Scan Delta Comparison — Implementation TODO

> Feature: Group scans by URL on Results/Reports pages, show sequential scan comparisons, generate delta "Summary Reports" for pairs that differ.
> Ref: [scan delta comparison.md](./scan%20delta%20comparison.md) for full spec.

---

## Phase 1 — Backend: Delta Computation Engine

- [x] Create `frontend/electron/analysis/delta-types.ts` — `VulnerabilityFingerprint`, `ScanDelta`, `OWASPDeltaEntry`, `ScanDeltaChain`, `TargetGroup`
- [x] Create `frontend/electron/analysis/delta-comparison.ts` — `fingerprintVulnerability()`, `compareScanPair()`, `computeAllDeltas()`, `groupScansByTarget()`

## Phase 2 — Backend: Delta Report Generator

- [x] Create `frontend/electron/reports/delta-report-generator.ts` — `generateDeltaReportHTML()`, `generateDeltaReport()`, `exportDeltaReport()`
- [x] Skip generation entirely when `delta.hasChanges === false`

## Phase 3 — Backend: IPC Wiring

- [x] Add `scanner:get-grouped-history` handler in `electron/main.ts`
- [x] Add `scanner:get-deltas` handler in `electron/main.ts`
- [x] Add `report:generate-delta` handler in `electron/main.ts`
- [x] Update `electron/preload.ts` to expose new IPC methods
- [x] Update `frontend/src/types/electron.d.ts` with new API declarations

## Phase 4 — Frontend: Shared Types

- [x] Create `frontend/src/types/delta.ts` — frontend-side mirror of delta types

## Phase 5 — Frontend: Shared Components

- [x] Create `frontend/src/components/NotificationBadge.tsx` — compact scan-count badge
- [-] Create `frontend/src/components/ScanGroupSidebar.tsx` — skipped, logic built directly into each page

## Phase 6 — Frontend: Results Page (Dashboard.tsx) Rework

- [x] Replace flat scan list sidebar with grouped-by-URL accordion sidebar
- [x] Show notification badge (scan count) on each group card
- [x] Expanding a group shows individual scans newest-first
- [x] Add "Scan Progression" panel in main content when viewing a grouped target
- [x] Each sequential pair shows score delta, resolved/new counts; no-change pairs show muted "No changes"

## Phase 7 — Frontend: Reports Page (Reports.tsx) Rework

- [x] Replace flat scan list sidebar with grouped-by-URL accordion sidebar
- [x] Individual scan entries → "Full Report" (existing pentest PDF flow)
- [x] Comparison entries between sequential pairs → "Summary Report" (delta PDF flow)
- [x] No-change pairs show muted "No changes" label (no clickable link, no PDF)
- [x] Update main content header to reflect full vs. comparison report context
- [x] Download button calls correct export function based on current view type

---

## Status Key

- `[ ]` Not started
- `[x]` Done
- `[-]` Skipped / N/A
