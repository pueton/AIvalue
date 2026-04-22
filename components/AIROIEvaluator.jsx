"use client";

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ═══════════════════════════════════════════════════════════════════════════
//   AI POC ROI EVALUATOR
// ═══════════════════════════════════════════════════════════════════════════
//
//   Based on: Gradwell (AI ROI Formula) · Laney (Adoption Function, Infonomics)
//             Agidee (DTRM: ITPM · ADD · DDC · Structural Optionality)
//   Reference: "The AI ROI Formula — Worked Example" (2026)
//
// ─── FILE STRUCTURE ───────────────────────────────────────────────────────
//
//   §1  DESIGN TOKENS                         — colour palette, typography
//   §2  DOMAIN DEFINITIONS
//       §2.1 ITI domains (5)                  — Infrastructure Trust Index
//       §2.2 EFI domains (7)                  — Exit Feasibility Index
//       §2.3 Band mapping helpers             — bandFromComposite, domainScore
//   §3  EVIDENCE BASE
//       §3.1 Realisation (pᵢ)                 — RAND, MIT, S&P, Gartner, BCG
//       §3.2 Attribution (αᵢ)                 — Peng, Cui, Brynjolfsson, BCG
//       §3.3 Decay (dᵢ)                       — Nature/NannyML, MLOps ranges
//       §3.4 Adoption (Aᵢ(t))                 — Copilot benchmarks, Bass, Rogers
//   §4  DEFAULTS                              — evidence-backed cross-industry
//   §5  CALCULATION ENGINE
//       §5.1 Monte Carlo utilities            — sampling, quantiles
//       §5.2 computeROIDistribution           — main Monte Carlo simulation
//       §5.3 Verdict functions                — deterministic + distribution
//   §6  PRESENTATION HELPERS                  — fmt, fmtPct, primitives
//   §7  MAIN COMPONENT                        — AIROIEvaluator
//   §8  VIEWS
//       §8.1 SetupView                        — inputs, hurdle rate, adoption
//       §8.2 FinanceView                      — P50/P90 distribution display
//       §8.3 InfraView                        — ITI + EFI domain scoring
//       §8.4 BoardView                        — verdict, three levers
//       §8.5 ScenarioView                     — target state comparison
//       §8.6 EvidenceView                     — pᵢ/αᵢ/dᵢ/Aᵢ evidence panels
//   §9  SHARED COMPONENTS                     — DomainScoringPanel, charts, etc.
//
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
//   §1  DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  paper: '#F2ECDF',
  paperDeep: '#E8DFCB',
  paperDark: '#D9CDAF',
  ink: '#1A1F2E',
  inkMid: '#4A5060',
  inkSoft: '#6F7384',
  rule: '#B8AB8C',
  ruleSoft: '#D4C9AF',
  // Traffic-light palette, tuned to sit well against warm paper
  green: '#1F7A3D',          // deeper, more saturated go-green
  greenSoft: '#8AB89A',
  amber: '#D99E16',          // true amber/yellow — readable on paper
  amberSoft: '#E9C470',
  red: '#B3232E',            // stop-light red, slightly warm
  redSoft: '#D28590',
  accent: '#7D1D2E',
  cream: '#FAF5E8',
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,400&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap');
.font-serif { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
.font-sans { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
.font-mono { font-family: 'IBM Plex Mono', 'Courier New', monospace; }
.tabular { font-variant-numeric: tabular-nums; }
.smcaps { font-variant-caps: all-small-caps; letter-spacing: 0.08em; }
.rule-double { border-top: 3px double currentColor; }
`;

// ─── DEFAULTS ─────────────────────────────────────────────────────────────
// Point estimates (medians) with uncertainty ranges [P10, P90] for each
// stochastic variable. Adoption is decomposed into three sub-curves.
// Ranges are wide by default — Monte Carlo outputs will be correspondingly
// wide, reflecting the honest uncertainty these business cases actually carry.
const DEFAULTS = {
  projectName: 'Example AI POC',
  orgName: 'Your Organisation',
  timeHorizon: 3,
  currency: 'GBP',

  // Benefit-side point estimates
  //
  // Vi: default set to £1m/year gross vendor claim. This reflects the target
  // client profile — organisations with meaningful AI ambitions, not dabbling.
  // At sub-£500k Vi, even a well-remediated Green-state deployment struggles
  // to clear a 15% CFO hurdle, which is structurally correct (small POCs
  // genuinely don't justify large infrastructure investments) but commercially
  // unhelpful for pitch purposes. See Finance tab's Vi Sensitivity panel for
  // how the verdict depends on this value.
  Vi: 1000000,
  pi: 0.65,
  pi_range: [0.55, 0.75],            // Vendor-delivered domain AI band
  // ITI domain scores. Sub-questioned domains use nested objects; scalar
  // domains would use a single number (none remaining on ITI side).
  iti_scores: {
    provenance: {
      provenance_coverage: 2.5,
      provenance_granularity: 2.0,
      provenance_queryable: 2.5,
      provenance_timeliness: 3.0,
      provenance_audit: 2.5,
    },
    semantic: {
      semantic_dictionary: 2.5,
      semantic_enforcement: 2.0,
      semantic_domain_coverage: 2.5,
      semantic_drift: 2.5,
      semantic_governance: 3.0,
    },
    determinism: {
      determinism_reliability: 3.5,
      determinism_idempotency: 3.0,
      determinism_contracts: 3.5,
      determinism_observability: 3.5,
      determinism_recovery: 4.0,
    },
    transparency: {
      transparency_visibility: 3.5,
      transparency_version: 3.5,
      transparency_business_logic: 3.0,
      transparency_testability: 4.0,
    },
    observability: {
      observability_detection: 4.0,
      observability_impact: 4.0,
      observability_contracts: 4.0,
      observability_simulation: 4.0,
    },
  },
  itiBand: 'amber',                  // derived — set from iti_scores
  fITI: 0.75,                        // derived
  fITI_range: [0.60, 0.89],          // derived band span
  alphaI: 0.60,
  alphaI_range: [0.50, 0.70],        // AI + targeted training band
  di: 0.08,
  di_range: [0.05, 0.12],            // Managed-MLOps band, asymmetric right tail

  // CFO hurdle rate — the minimum acceptable ROI threshold the project must
  // clear. Green projects that pass this hurdle become AI build engagements;
  // those that fail typically need either infrastructure remediation first
  // (the framework's diagnostic purpose) or the vendor claim challenged.
  hurdleRate: 15,                    // % ROI — typical mid-market corporate hurdle

  // Adoption — three sub-curves (exposure × utilisation × absorption)
  // Exposure: % of target population with access to the tool
  exposure:     [0.60, 0.85, 0.95, 0.97, 0.98],
  // Utilisation quality: of exposed users, % of potential benefit captured per use
  utilisation:  [0.55, 0.75, 0.85, 0.90, 0.92],
  // Organisational absorption: % of individual benefit that converts to org-level savings
  absorption:   [0.65, 0.80, 0.90, 0.93, 0.95],
  // Per-year spread (±) applied to each sub-curve in Monte Carlo
  adoption_spread: 0.10,

  // Cost-side point estimates
  // Scaled against £1m Vi — bigger POCs are more expensive but not 1:1
  // proportional to benefit claim. Ratios follow typical enterprise patterns.
  Cj: 200000,                        // Build: ~20% of annual Vi
  Cj_overrun_p90: 1.50,              // Flyvbjerg IT-overrun literature: P90 ≈ 1.5× median
  Cj_overrun_p10: 0.85,
  Rjt_annual: 100000,                // Run: ~10% of annual Vi
  Rjt_spread: 0.10,                  // Vendor-quoted — typically narrow
  Gjt_annual: 30000,                 // Governance: ~3% of annual Vi
  Gjt_spread_low: 0.80,              // Governance often underestimated
  Gjt_spread_high: 1.80,
  Mj: 50000,                         // Maintenance: ~5% of annual Vi
  Mj_spread: 0.15,
  delta: 0.10,
  delta_range: [0.07, 0.15],
  // EFI domain scores. For domains with sub-questions, `scores` is an object
  // keyed by sub-question id; each sub-question is 0–5, domain score is the mean.
  // For simpler domains, `scores` is a single number 0–5.
  efi_scores: {
    portability: 2.0,
    contractual: {
      contractual_clause: 2.5,
      contractual_transition: 2.0,
      contractual_data: 2.5,
      contractual_fees: 2.5,
      contractual_continuity: 3.0,
    },
    reversibility: {
      reversibility_coupling: 2.5,
      reversibility_api: 3.0,
      reversibility_abstraction: 2.0,
      reversibility_data_flow: 2.5,
      reversibility_effort: 2.5,
    },
    model_transparency: {
      model_explainability: 2.0,
      model_docs: 2.5,
      model_retraining: 1.5,
      model_versioning: 2.0,
      model_evaluation: 2.0,
    },
    proprietary: 3.0,
    skills: 3.5,
    regulatory: 3.5,
  },
  efiBand: 'amber',                  // derived
  PV_SO: 65000,                      // derived from EFI at runtime, initial reasonable for £1m Vi
  PV_SO_range: [32500, 117000],      // derived ±50–80%
};

// ─── ITI / EFI BAND LOOKUPS ───────────────────────────────────────────────
const ITI_BANDS = {
  green: { label: 'GREEN', score: '≥ 4.0', fITI: 0.95, delta: 0.05, desc: 'Infrastructure trust established', color: C.green },
  amber: { label: 'AMBER', score: '2.5 – 3.9', fITI: 0.75, delta: 0.10, desc: 'Partial trust — deficits require mitigation', color: C.amber },
  red:   { label: 'RED',   score: '< 2.5', fITI: 0.50, delta: 0.15, desc: 'Infrastructure trust deficit — remediation required', color: C.red },
};

const EFI_BANDS = {
  green: { label: 'GREEN', desc: 'High exit feasibility — portable, interoperable', factor: 0.02, color: C.green },
  amber: { label: 'AMBER', desc: 'Partial lock-in — negotiate exit terms before signing', factor: 0.08, color: C.amber },
  red:   { label: 'RED',   desc: 'Deep lock-in — proprietary data, contractual friction', factor: 0.20, color: C.red },
};

// ─── ITI DOMAIN RUBRIC ─────────────────────────────────────────────────────
// Five-domain assessment per the ITPM component paper. Each domain scored 0–5,
// composite = unweighted mean of sub-question means. Band thresholds unchanged:
// ≥4.0 Green, 2.5–3.9 Amber, <2.5 Red.
//
// Every domain is now decomposed into 4–5 sub-questions. Each sub-question is
// scoped to correspond to a potential remediation workstream, so that the
// assessment output maps directly to scope-of-work options.
const ITI_DOMAINS = [
  {
    id: 'provenance',
    label: 'Provenance reconstructability',
    question: 'Can any data element be traced back to its authoritative source with sufficient fidelity to support operational decisions?',
    subquestions: [
      {
        id: 'provenance_coverage',
        label: 'Coverage',
        question: 'What fraction of your data estate has documented lineage back to its authoritative source?',
        levels: [
          'Lineage is absent for essentially all data. Source systems poorly understood.',
          'Lineage exists for a minority of critical flows; rest is tribal knowledge.',
          'Lineage documented for core flows; gaps across secondary domains.',
          'Lineage covers most business-critical data with modest gaps.',
          'Comprehensive lineage across the estate; only edge cases missing.',
          'Full lineage captured automatically as a precondition of data landing anywhere.',
        ],
      },
      {
        id: 'provenance_granularity',
        label: 'Granularity',
        question: 'At what level of detail is lineage captured — system, table, field, record?',
        levels: [
          'No granularity — lineage is aspirational at best.',
          'System-level only. You know data came from System X, nothing else.',
          'Table-level lineage. You know which tables fed which, but not which fields.',
          'Field-level lineage for most flows. Transformations traceable at the column.',
          'Field- and record-level lineage; individual records traceable through transformations.',
          'Full field- and event-level lineage with timestamped audit trail.',
        ],
      },
      {
        id: 'provenance_queryable',
        label: 'Queryability',
        question: 'When you need to answer a lineage question, how quickly and reliably can you?',
        levels: [
          'Answering a lineage question requires reverse-engineering code, usually days.',
          'Answers exist in heads or scattered documents; hours to locate, often stale.',
          'Centralised but static documentation; answers within a working day.',
          'Interactive lineage tool for most critical data; answers in minutes.',
          'Full self-service lineage querying across the estate; answers in seconds.',
          'Lineage queryable programmatically, embedded in data workflows and monitoring.',
        ],
      },
      {
        id: 'provenance_timeliness',
        label: 'Timeliness',
        question: 'How current is your lineage relative to actual system state?',
        levels: [
          'Lineage, where it exists, is years out of date.',
          'Lineage refreshed sporadically, often behind actual state.',
          'Lineage refreshed on quarterly cadence; drift likely between refreshes.',
          'Lineage refreshed weekly or on change, rarely stale.',
          'Lineage captured in real time as systems change.',
          'Lineage is the system of record; it cannot be stale because it is the source.',
        ],
      },
      {
        id: 'provenance_audit',
        label: 'Audit-readiness',
        question: 'Is the lineage fit for external audit — regulatory, legal, or independent assurance?',
        levels: [
          'Nothing audit-grade. Lineage is informational at best.',
          'Lineage informally referenced in audits but not itself audit-evidence.',
          'Partial audit-readiness for specific domains (e.g. financial data).',
          'Lineage accepted as audit evidence for most critical domains.',
          'Lineage fully audit-grade, accepted by external assurers without qualification.',
          'Lineage is the primary audit artefact; point-in-time reconstruction supported.',
        ],
      },
    ],
  },
  {
    id: 'semantic',
    label: 'Semantic consistency',
    question: 'Does a given term (e.g. "active customer", "closed ticket") mean the same thing across systems, and is that meaning enforced at integration boundaries?',
    subquestions: [
      {
        id: 'semantic_dictionary',
        label: 'Shared vocabulary',
        question: 'Is there a maintained enterprise data dictionary for core business entities?',
        levels: [
          'No data dictionary exists. Each team defines core terms as needed.',
          'Informal glossaries per department; overlapping terms conflict.',
          'Draft enterprise dictionary exists but incomplete and rarely consulted.',
          'Maintained dictionary covers most critical entities; stewarded but not enforced.',
          'Authoritative dictionary covers the estate; new definitions follow a governed process.',
          'Dictionary is a first-class product with active stewardship, usage metrics, and API access.',
        ],
      },
      {
        id: 'semantic_enforcement',
        label: 'Boundary enforcement',
        question: 'At integration boundaries, is semantic consistency enforced or merely hoped for?',
        levels: [
          'No enforcement. Each system has its own interpretation and nobody reconciles them.',
          'Enforcement only where pain has already been felt; rest is ad-hoc.',
          'Some integration contracts include semantic checks; most don\'t.',
          'Integration contracts routinely include schema + semantic validation.',
          'Semantic consistency enforced programmatically at every integration boundary.',
          'Semantic contracts versioned, tested, and breaking changes rejected at pipeline level.',
        ],
      },
      {
        id: 'semantic_domain_coverage',
        label: 'Domain coverage',
        question: 'How many business domains have consistent semantics vs fragmented interpretation?',
        levels: [
          'Essentially none — every domain interprets core entities differently.',
          'One or two domains consistent (e.g. finance), rest fragmented.',
          'Core business-critical domains consistent; operational domains variable.',
          'Most domains consistent with a few stubborn holdouts.',
          'Near-universal consistency with only edge cases unaligned.',
          'All domains consistent, including indirect/integration data.',
        ],
      },
      {
        id: 'semantic_drift',
        label: 'Drift detection',
        question: 'When semantics drift (new system, renamed field, altered logic), do you detect it?',
        levels: [
          'Drift is discovered by users in production, usually after incidents.',
          'Occasional discovery through manual data quality reviews.',
          'Scheduled reviews catch drift within weeks or months.',
          'Automated monitoring catches drift within days.',
          'Real-time drift alerts at integration boundaries.',
          'Drift blocked at pipeline level before it propagates.',
        ],
      },
      {
        id: 'semantic_governance',
        label: 'Stewardship & governance',
        question: 'Who owns semantic definitions, and do they have authority to enforce them?',
        levels: [
          'Nobody owns it. Semantics emerge by default.',
          'Unofficial owners with no authority; definitions advisory.',
          'Stewards exist but authority contested; enforcement inconsistent.',
          'Clear stewardship with modest enforcement authority.',
          'Formal data governance function with authority over semantic definitions.',
          'Governance integrated into change management; no new integrations without semantic sign-off.',
        ],
      },
    ],
  },
  {
    id: 'determinism',
    label: 'Integration determinism',
    question: 'Do integrations produce predictable, reproducible results — or do they fail silently or return different answers on retry?',
    subquestions: [
      {
        id: 'determinism_reliability',
        label: 'Baseline reliability',
        question: 'What is the typical failure rate of business-critical integrations?',
        levels: [
          'Integration failures are frequent (>5% of runs); teams have learned to live with it.',
          'Failures common enough to require dedicated incident response (2–5%).',
          'Failures occasional but material (0.5–2%).',
          'Failures rare and recovery fast (<0.5%).',
          'Near-zero failures (<0.1%); failures are noteworthy events.',
          'Failures effectively eliminated by idempotent design; retries guaranteed correct.',
        ],
      },
      {
        id: 'determinism_idempotency',
        label: 'Idempotency',
        question: 'Can a failed integration be safely retried, or does retry risk duplication/corruption?',
        levels: [
          'Retries routinely cause duplicate writes or inconsistent state; manual cleanup required.',
          'Retry safety depends on integration; some safe, some not, requires deep knowledge.',
          'Retry safety documented but not enforced; drift possible.',
          'Retries safe for most integrations; exceptions documented and handled.',
          'Idempotent by design across the estate; retries always safe.',
          'Idempotency verified by automated testing; non-idempotent designs rejected at review.',
        ],
      },
      {
        id: 'determinism_contracts',
        label: 'Contract testing',
        question: 'Are integration contracts (schemas, behaviours) tested independently of the integrating systems?',
        levels: [
          'No contract testing. Breaking changes surface in production.',
          'Ad-hoc smoke tests on deploy; mostly useless for catching contract drift.',
          'Contract tests for a few high-risk integrations; rest uncovered.',
          'Contract tests cover most business-critical integrations.',
          'Comprehensive contract testing with automated breakage detection.',
          'Contract tests run continuously in CI; breaking changes cannot ship.',
        ],
      },
      {
        id: 'determinism_observability',
        label: 'Run-time observability',
        question: 'When an integration misbehaves, can you determine why without deep debugging?',
        levels: [
          'Integration internals opaque; debugging requires vendor support or code archaeology.',
          'Basic logging exists but insufficient for root-cause analysis.',
          'Reasonable logs and metrics for most integrations.',
          'Comprehensive observability with tracing across integration chains.',
          'Full distributed tracing; root cause typically identified within the hour.',
          'Self-diagnosing integrations with automated root-cause attribution.',
        ],
      },
      {
        id: 'determinism_recovery',
        label: 'Recovery mechanisms',
        question: 'When integrations fail, how reliable is the recovery process?',
        levels: [
          'Recovery is manual, slow, and sometimes impossible without data loss.',
          'Recovery documented but error-prone; requires senior engineers.',
          'Runbooks exist; recovery reliable but slow.',
          'Automated recovery for most failure modes; manual intervention rare.',
          'Self-healing integrations with circuit breakers and automatic retry.',
          'Zero-touch recovery; failures absorbed without operator awareness.',
        ],
      },
    ],
  },
  {
    id: 'transparency',
    label: 'Transformation transparency',
    question: 'Can you see — and audit — what happens to data as it flows between systems?',
    subquestions: [
      {
        id: 'transparency_visibility',
        label: 'Transformation visibility',
        question: 'Where does transformation logic live — in code, configuration, or undocumented black boxes?',
        levels: [
          'Logic buried in opaque stored procedures, scripts, or vendor-internal systems.',
          'Logic scattered across multiple codebases with no central index.',
          'Logic documented in some pipelines; rest requires code reading.',
          'Most logic externalised to declarative configuration or version-controlled code.',
          'All transformation logic declarative, queryable, and auditable.',
          'Logic presented as a first-class product surface for business and technical users.',
        ],
      },
      {
        id: 'transparency_version',
        label: 'Version control',
        question: 'Are transformations version-controlled, with changes traceable to authors and rationale?',
        levels: [
          'No version control. Changes happen directly in production.',
          'Version control exists but bypassed frequently; history unreliable.',
          'Version control for most transformations; discipline variable.',
          'Disciplined version control with review process for most changes.',
          'All transformations version-controlled with mandatory review.',
          'Full change provenance including business rationale, linked to tickets and approvals.',
        ],
      },
      {
        id: 'transparency_business_logic',
        label: 'Business-logic traceability',
        question: 'When a data value is queried, can you trace it to the business rule that produced it?',
        levels: [
          'Data values appear as if by magic; rule-to-value traceability is a research project.',
          'Some manual tracing possible for critical data; most values are black boxes.',
          'Partial traceability through documentation; requires expert interpretation.',
          'Most data traceable to business rules with modest effort.',
          'Full rule-to-value traceability accessible to non-technical users.',
          'Traceability embedded in the end-user experience; values show their derivation on demand.',
        ],
      },
      {
        id: 'transparency_testability',
        label: 'Testability',
        question: 'Are transformations tested — can you demonstrate they produce correct output for known inputs?',
        levels: [
          'No transformation tests. Correctness is assumed.',
          'A few unit tests for critical paths; coverage sporadic.',
          'Unit tests cover most transformations; integration testing weak.',
          'Unit and integration tests for most transformations.',
          'Comprehensive testing with known-good reference data sets.',
          'Property-based and reference testing; transformations formally specified.',
        ],
      },
    ],
  },
  {
    id: 'observability',
    label: 'Change observability',
    question: 'When infrastructure changes, can downstream consumers detect it — ideally before it breaks something?',
    subquestions: [
      {
        id: 'observability_detection',
        label: 'Change detection',
        question: 'When a system changes upstream, how quickly is the change detected?',
        levels: [
          'Changes detected only when something breaks, often days or weeks later.',
          'Detection is manual and reactive; no proactive monitoring.',
          'Scheduled checks catch changes within hours or days.',
          'Near-real-time change detection for most integrations.',
          'Immediate change detection across the estate.',
          'Changes broadcast before they land; downstream systems consulted or informed.',
        ],
      },
      {
        id: 'observability_impact',
        label: 'Impact analysis',
        question: 'When a change is detected, can you quickly determine what it affects?',
        levels: [
          'Impact analysis requires manual research; often incomplete.',
          'Documented impact maps exist but stale and unreliable.',
          'Partial impact analysis through lineage tools; gaps present.',
          'Good impact analysis for most change types.',
          'Comprehensive automated impact analysis.',
          'Impact analysis completed before change approval; changes blocked if impact unacceptable.',
        ],
      },
      {
        id: 'observability_contracts',
        label: 'Contract change management',
        question: 'When integration contracts (schemas, APIs) change, is the change process disciplined?',
        levels: [
          'Contracts change without warning, breaking downstream.',
          'Changes announced late in the process; downstream often surprised.',
          'Change process documented but inconsistently followed.',
          'Disciplined change process with advance notice.',
          'Formal change management with deprecation windows and migration paths.',
          'Contract evolution automated with mandatory compatibility verification.',
        ],
      },
      {
        id: 'observability_simulation',
        label: 'Pre-change simulation',
        question: 'Can you simulate the effect of a proposed change before implementing it?',
        levels: [
          'No simulation capability; changes tested in production.',
          'Informal simulation through careful reading; often wrong.',
          'Ad-hoc simulation for high-risk changes; limited coverage.',
          'Simulation environments exist for most critical changes.',
          'Comprehensive simulation before any production change.',
          'Continuous simulation of proposed changes against production-representative data.',
        ],
      },
    ],
  },
];

// ─── EFI DOMAIN RUBRIC ─────────────────────────────────────────────────────
// Seven-domain assessment per the Structural Optionality component paper.
// Each domain scored 0–5, composite = unweighted mean. A HIGH EFI score means
// HIGH exit feasibility (= Green = low lock-in). A LOW EFI score means deep
// lock-in (= Red = high PV(SO)).
//
// Domains with `subquestions` use the expanded assessment pattern: each
// sub-question is scored 0–5 independently, and the domain score is the mean.
// A warning flag is surfaced when any single sub-question scores below 2.0,
// preserving visibility on foundational gaps that would otherwise be masked
// by a tolerable average.
//
// Domains with only `levels` use the simpler single-question pattern — kept
// for brevity where a domain is genuinely one-dimensional.
const EFI_DOMAINS = [
  {
    id: 'portability',
    label: 'Data portability',
    question: 'Can you extract your operational and historical data in standard formats within a reasonable timeframe?',
    levels: [
      'No export capability. Data is trapped in vendor systems.',
      'Export possible only through vendor-assisted professional services, paid, slow.',
      'Export available but in proprietary formats requiring transformation.',
      'Self-service export in standard formats; some enrichment data missing.',
      'Full data export in open formats, self-service, timely.',
      'Continuous data mirroring to customer-controlled storage; zero-friction exit.',
    ],
  },
  {
    id: 'contractual',
    label: 'Contractual exit terms',
    question: 'Does the contract establish a viable, non-punitive exit pathway with defined obligations on both sides?',
    subquestions: [
      {
        id: 'contractual_clause',
        label: 'Termination right',
        question: 'What is your legal right to terminate the agreement?',
        levels: [
          'No termination clause. Exit is discretionary to the vendor.',
          'Termination for material breach only; no unilateral termination right.',
          'Termination for convenience with long notice period (> 180 days) or high trigger.',
          'Termination for convenience with standard notice (90–180 days).',
          'Termination for convenience with short notice (30–90 days) and minimal conditions.',
          'Immediate termination rights with cause categories pre-defined and customer-favourable.',
        ],
      },
      {
        id: 'contractual_transition',
        label: 'Transition support obligations',
        question: 'What must the vendor provide to support your migration out?',
        levels: [
          'None. Once terminated, vendor relationship ends completely.',
          'Vague "reasonable cooperation" language with no specified deliverables.',
          'Basic transition support defined (data return, access continuation) with discretionary quality.',
          'Transition package defined with specific deliverables but no SLAs on quality or timing.',
          'Transition support with contractual SLAs, named contacts, and defined deliverables.',
          'Pre-negotiated exit runbook with step-by-step vendor obligations and measurable performance standards.',
        ],
      },
      {
        id: 'contractual_data',
        label: 'Data return and destruction',
        question: 'What happens to your data on termination — return, retention, destruction?',
        levels: [
          'No data-return clause. Vendor retains data indefinitely with unclear rights.',
          'Data available on request during a short window; format unspecified; destruction unclear.',
          'Data return in vendor-proprietary format within a defined window; destruction on request.',
          'Data return in standard formats within a reasonable window; destruction with written confirmation.',
          'Data return in open formats within tight SLA; certified destruction; derived data explicitly covered.',
          'Continuous data mirroring + full deletion on termination, including backups and derived model artifacts.',
        ],
      },
      {
        id: 'contractual_fees',
        label: 'Exit economics',
        question: 'What will exit cost you beyond the operational migration effort?',
        levels: [
          'Punitive fees that make early termination economically infeasible (e.g. accelerated multi-year payment).',
          'Significant early-termination fee scaled to remaining contract term.',
          'Moderate fees: reasonable admin charges plus per-GB data-export fees or similar.',
          'Modest cost-recovery fees bounded to reasonable vendor effort.',
          'No termination fees. Migration assistance included in contract price.',
          'Vendor financially incentivised to smooth exit (e.g. partial refund on successful transition).',
        ],
      },
      {
        id: 'contractual_continuity',
        label: 'Service continuity during transition',
        question: 'Will the service keep running at operational quality while you migrate?',
        levels: [
          'Service may degrade or cease immediately on termination notice.',
          'Service continues but at reduced priority; SLAs no longer apply.',
          'Normal service maintained during short transition window (30–60 days).',
          'Normal service maintained for defined transition window (90–180 days) with standard SLAs.',
          'Extended transition window with full SLAs and optional extension on reasonable terms.',
          'Customer-controlled transition window with full SLAs; vendor financially bound to performance.',
        ],
      },
    ],
  },
  {
    id: 'reversibility',
    label: 'Integration reversibility',
    question: 'How difficult is it to rip out the integration points and replace them with an alternative?',
    subquestions: [
      {
        id: 'reversibility_coupling',
        label: 'Coupling depth',
        question: 'How deeply is the vendor\'s system entangled with your core workflows?',
        levels: [
          'Core business processes depend on vendor-specific behaviours and cannot function without them.',
          'Vendor logic embedded in critical workflows; replacement requires redesigning those workflows.',
          'Vendor touches many workflows but most are recoverable; some deep entanglement remains.',
          'Vendor contained to defined workflows with documented boundaries.',
          'Vendor operates behind an abstraction layer; workflows unaware of specific provider.',
          'Multi-provider architecture with vendor interchangeable at runtime.',
        ],
      },
      {
        id: 'reversibility_api',
        label: 'Interface standardisation',
        question: 'Are your integrations built on open standards or vendor-specific APIs?',
        levels: [
          'All integrations via proprietary APIs/SDKs with no standard alternative.',
          'Mostly proprietary with thin veneer of standard endpoints.',
          'Mixed: standard where cheap, proprietary where vendor-preferred.',
          'Predominantly standard APIs (REST/OpenAPI, OAuth, etc.); proprietary reserved for advanced features.',
          'Fully standard interfaces; proprietary features optional and documented.',
          'Architecture built on industry-standard interfaces only; no vendor-specific calls in codebase.',
        ],
      },
      {
        id: 'reversibility_abstraction',
        label: 'Abstraction layer',
        question: 'Does your code know about the specific vendor, or about a generic capability?',
        levels: [
          'Vendor SDK called directly from business logic throughout the codebase.',
          'Vendor calls scattered but centralised in a few modules.',
          'Vendor logic isolated to adapter modules; business code unaware.',
          'Clean adapter/port pattern; vendor is one implementation of a domain interface.',
          'Multiple vendor implementations already exist behind the interface; runtime switching possible.',
          'Active multi-vendor production deployment; switching is a configuration change.',
        ],
      },
      {
        id: 'reversibility_data_flow',
        label: 'Data flow reversibility',
        question: 'Can data flow through a different provider without upstream or downstream systems noticing?',
        levels: [
          'Data schemas vendor-specific; downstream systems parse vendor-specific output formats.',
          'Data passes through vendor with mostly standard fields plus vendor-specific enrichments.',
          'Data standardised at the output boundary; vendor quirks absorbed in a translation layer.',
          'Data schemas defined independently of vendor; translation layer is thin.',
          'Canonical internal schema; vendors conform to it, not the other way round.',
          'Data flow fully vendor-agnostic; replacement requires no downstream changes.',
        ],
      },
      {
        id: 'reversibility_effort',
        label: 'Realistic migration effort',
        question: 'If you had to migrate to an alternative, how long would it realistically take?',
        levels: [
          'Multi-year project with business disruption; migration likely to fail on first attempt.',
          '12–18 month programme with dedicated team and measurable business risk.',
          '6–12 month project with focused team; risk manageable but real.',
          '3–6 month project with standard engineering effort.',
          '1–3 month project; mostly configuration and testing.',
          'Days to weeks; architecture designed for provider substitution.',
        ],
      },
    ],
  },
  {
    id: 'model_transparency',
    label: 'Model transparency',
    question: 'Do you have visibility into how the AI model makes decisions, and control over its behaviour?',
    subquestions: [
      {
        id: 'model_explainability',
        label: 'Decision explainability',
        question: 'When the model makes a decision, can you explain why to a user, auditor, or regulator?',
        levels: [
          'Fully opaque. No mechanism to interrogate model reasoning.',
          'Vendor provides marketing-level explanations without technical substance.',
          'Model cards and general documentation; no per-decision explanation.',
          'Per-decision explanations available via API but of variable quality.',
          'High-quality per-decision explanations (feature importance, counterfactuals) available on-demand.',
          'Explainability is a first-class product surface with audit-grade outputs.',
        ],
      },
      {
        id: 'model_docs',
        label: 'Model documentation',
        question: 'What does the vendor publish about training data, evaluation, and known limitations?',
        levels: [
          'Nothing. Model is a sealed black box.',
          'Marketing claims only; no technical specifications.',
          'Basic model card: training data sources at high level, benchmark scores.',
          'Comprehensive model card with evaluation methodology, known failure modes.',
          'Full technical report including training data details, limitations, fairness analysis, update history.',
          'Open-weight or fully-documented model with reproducible training pipeline.',
        ],
      },
      {
        id: 'model_retraining',
        label: 'Retraining control',
        question: 'Who decides when the model is retrained and on what data?',
        levels: [
          'Vendor retrains at their discretion, on data they choose, with no customer input or notice.',
          'Vendor retrains with advance notice but no input on cadence or data.',
          'Vendor retrains on published schedule; customer has input on data scope.',
          'Joint retraining plan; customer can veto schedule changes and data additions.',
          'Customer controls retraining cadence and training data scope; vendor executes.',
          'Customer fine-tunes on their own data; vendor provides base model only.',
        ],
      },
      {
        id: 'model_versioning',
        label: 'Version control & regression testing',
        question: 'When the model changes behaviour, can you detect and evaluate the change before it goes live?',
        levels: [
          'Model changes arrive silently; behaviour drift discovered by users in production.',
          'Major versions announced but behavioural impact not characterised.',
          'Version notes describe changes; customer has brief window to test.',
          'New versions offered in parallel with old; customer can defer activation.',
          'Customer controls version activation; parallel evaluation environment provided.',
          'Full A/B infrastructure; customer-selected champion/challenger deployment model.',
        ],
      },
      {
        id: 'model_evaluation',
        label: 'Evaluation data access',
        question: 'Can you evaluate the model against your own test cases and production data?',
        levels: [
          'No evaluation access. Vendor benchmarks are the only signal.',
          'Customer can submit test cases but receives aggregate results only.',
          'Customer can run pre-defined evaluation suites and receive per-case results.',
          'Customer can define and run custom evaluations on held-out test sets.',
          'Full evaluation environment with customer test data, customer-defined metrics.',
          'Continuous evaluation pipeline with customer-owned test data, real-time quality monitoring.',
        ],
      },
    ],
  },
  {
    id: 'proprietary',
    label: 'Proprietary lock-in depth',
    question: 'How much proprietary formatting, tooling, or IP does the vendor layer on top of open standards?',
    levels: [
      'Everything proprietary — custom formats, closed tooling, vendor-only ecosystem.',
      'Proprietary core with minimal open-standard support at the edges.',
      'Mixed: open standards where convenient, proprietary where strategic.',
      'Mostly open standards; proprietary elements documented and replaceable.',
      'Open standards throughout; proprietary components minor and optional.',
      'Fully open stack; vendor adds service layer, not format lock-in.',
    ],
  },
  {
    id: 'skills',
    label: 'Skills dependency',
    question: 'How vendor-specific are the skills your team has invested in to operate this system?',
    levels: [
      'All team skills are vendor-specific; transferable to nothing else.',
      'Heavy vendor specialisation; limited portable skills.',
      'Mix of vendor-specific and transferable skills.',
      'Most skills transfer; vendor specialisation is thin layer.',
      'Skills built on open standards; vendor knowledge is minor.',
      'Team skills are entirely industry-standard; vendor is interchangeable.',
    ],
  },
  {
    id: 'regulatory',
    label: 'Regulatory handover',
    question: 'If you had to transfer to an alternative provider, could you preserve regulatory compliance during the transition?',
    levels: [
      'Compliance tightly bound to vendor\'s specific attestations; transition would break compliance.',
      'Compliance transferable but requires full re-attestation.',
      'Compliance portable for some domains, bound for others.',
      'Compliance evidence portable with documented handover process.',
      'Regulatory portability built into contract and architecture.',
      'Compliance fully portable; pre-approved alternative provider pathway.',
    ],
  },
];

// Derive band from composite score
function bandFromComposite(score) {
  if (score >= 4.0) return 'green';
  if (score >= 2.5) return 'amber';
  return 'red';
}

// Resolve a single domain's score. Handles both the simple scalar form
// (scores[domainId] = 3.5) and the expanded sub-question form
// (scores[domainId] = { subId1: 2.5, subId2: 3.0, ... }).
// For sub-questioned domains, also returns the minimum sub-score so callers
// can flag foundational gaps that the mean would otherwise hide.
function domainScore(domain, scores) {
  const raw = scores?.[domain.id];
  if (domain.subquestions && typeof raw === 'object' && raw !== null) {
    const values = domain.subquestions.map(sq => raw[sq.id] ?? 3);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    return { score: mean, min, isSubScored: true };
  }
  if (typeof raw === 'number') {
    return { score: raw, min: raw, isSubScored: false };
  }
  return { score: 3, min: 3, isSubScored: false };
}

// ─── EVIDENCE CATEGORIES FOR pᵢ CALIBRATION ───────────────────────────────
// General cross-industry use-case taxonomy. Ranges derived from RAND 2024,
// MIT 2019 & 2025, S&P Global 2025, Gartner 2024–2026, BCG Oct 2024.
// pᵢ represents *residual inherent uncertainty* after infrastructure (f(ITI))
// and adoption (Aᵢ(t)) are accounted for separately — not the gross failure rate.
const EVIDENCE_CATEGORIES = [
  {
    id: 'admin',
    label: 'Mature admin automation',
    desc: 'Document processing, transcription, summarisation, data entry, email triage, scheduling.',
    range: [0.70, 0.85],
    anchor: 'Widespread vendor-SaaS deployment with established productivity evidence.',
    examples: 'e.g. Copilot-style office assistants, OCR pipelines, form automation',
  },
  {
    id: 'copilots',
    label: 'Productivity copilots',
    desc: 'Code assistants, writing tools, research aids, internal enterprise search.',
    range: [0.60, 0.80],
    anchor: 'Wharton (2025): ~75% of leaders report positive GenAI returns in productivity categories.',
    examples: 'e.g. GitHub Copilot, Cursor, Notion AI, Glean',
  },
  {
    id: 'vendorSaaS',
    label: 'Vendor-delivered domain AI',
    desc: 'Specialised vertical SaaS solutions with proven workflow integration.',
    range: [0.55, 0.75],
    anchor: 'MIT (2025): vendor-purchased solutions succeed at ~2× the rate of internal builds.',
    examples: 'e.g. specialised billing, compliance, revenue-cycle, procurement SaaS',
  },
  {
    id: 'analytics',
    label: 'Established predictive analytics',
    desc: 'Forecasting, detection, risk scoring, classification on tabular data.',
    range: [0.40, 0.65],
    anchor: 'Mature ML with strong benchmarks but heavy workflow-integration dependency.',
    examples: 'e.g. demand forecasting, predictive maintenance, fraud detection',
  },
  {
    id: 'custom',
    label: 'Custom internal ML builds',
    desc: 'Bespoke models built in-house for a specific decision or workflow.',
    range: [0.25, 0.50],
    anchor: 'RAND (2024): data-quality & leadership misalignment drive ~80% overall failure rate.',
    examples: 'e.g. proprietary recommendation engines, internal decision-support models',
  },
  {
    id: 'agentic',
    label: 'Agentic & frontier AI',
    desc: 'Autonomous multi-step agents, auto-remediation, novel first-of-kind deployments.',
    range: [0.15, 0.35],
    anchor: 'Gartner (2026): ~40% of agentic AI projects forecast to be cancelled by 2027.',
    examples: 'e.g. agent orchestration platforms, autonomous IT ops, novel LLM workflows',
  },
];

const RESEARCH_ANCHORS = [
  { value: 0.05, label: 'MIT GenAI pilots', detail: '~95% fail to scale', source: 'MIT 2025' },
  { value: 0.20, label: 'RAND reach prod.', detail: '~80% fail to reach production', source: 'RAND 2024' },
  { value: 0.48, label: 'Gartner avg.', detail: '~48% reach production', source: 'Gartner' },
  { value: 0.54, label: 'S&P not abandoned', detail: '46% of POCs scrapped', source: 'S&P Global 2025' },
  { value: 0.75, label: 'Wharton pos. ROI', detail: '~75% report positive returns', source: 'Wharton 2025' },
];

const CITATIONS = [
  {
    id: 'rand2024',
    authors: 'Ryseff, De Bruhl, Newberry',
    year: '2024',
    title: 'The Root Causes of Failure for Artificial Intelligence Projects and How They Can Succeed',
    publisher: 'RAND Corporation',
    url: 'https://www.rand.org/pubs/research_reports/RRA2680-1.html',
    note: 'Based on 65 structured practitioner interviews. Finds >80% of AI projects fail. Five root causes: leadership miscommunication, data quality, infrastructure, technology-first framing, intractable problem selection.',
  },
  {
    id: 'mit2025',
    authors: 'MIT Media Lab / NANDA',
    year: '2025',
    title: 'The GenAI Divide: State of AI in Business 2025',
    publisher: 'MIT',
    note: '~95% of GenAI pilots fail to scale to production. Vendor-purchased solutions succeed at ~2× the rate of in-house builds. Extends 2019 MIT finding (~70% of AI efforts saw little to no impact).',
  },
  {
    id: 'sp2025',
    authors: 'S&P Global Market Intelligence',
    year: '2025',
    title: 'Enterprise AI Adoption Survey',
    publisher: 'S&P Global',
    note: '42% of companies abandoned most AI initiatives in 2025 (up from 17% in 2024). Average organisation scrapped 46% of proofs-of-concept before production.',
  },
  {
    id: 'gartner',
    authors: 'Gartner Research',
    year: '2024–2026',
    title: 'AI Infrastructure & Operations Surveys',
    publisher: 'Gartner',
    note: 'On average 48% of AI projects reach production. Median prototype-to-production: 8 months. ~30% of GenAI projects predicted to be abandoned after POC by end 2025. ~40% of agentic AI projects predicted cancelled by 2027.',
  },
  {
    id: 'bcg2024',
    authors: 'Boston Consulting Group',
    year: 'October 2024',
    title: 'Where\'s the Value in AI?',
    publisher: 'BCG',
    note: 'Survey of 1,000 executives across 59 countries. 26% have moved beyond proof-of-concept. Only 4% consistently generate significant value from AI.',
  },
  {
    id: 'wharton2025',
    authors: 'Wharton / Accenture',
    year: '2025',
    title: 'Accountable AI: Impact & ROI Report',
    publisher: 'University of Pennsylvania',
    note: '72% of enterprises formally measure GenAI ROI. ~75% of leaders report positive returns, concentrated in productivity and incremental profit categories.',
  },
];

// ─── ATTRIBUTION (αᵢ) CALIBRATION ─────────────────────────────────────────
// αᵢ is the fraction of observed improvement causally attributable to the
// AI itself — net of concurrent training, process redesign, Hawthorne effects,
// managerial attention, and selection bias.
// Ceiling is ≈1.0 in clean RCTs; real deployments typically leak 30–60%.
const ATTRIBUTION_CATEGORIES = [
  {
    id: 'isolated',
    label: 'Isolated AI deployment',
    desc: 'AI is the only change. No concurrent training, process redesign, or management push. Proper before/after baseline or staggered rollout.',
    range: [0.80, 0.95],
    anchor: 'Brynjolfsson et al. (2025, QJE) — staggered customer-service rollout, 14% productivity lift attributable to the tool.',
    examples: 'e.g. rare clean A/B rollouts of embedded vendor features',
  },
  {
    id: 'light_enablement',
    label: 'AI + light enablement',
    desc: 'AI plus basic user training and onboarding, no structural workflow change.',
    range: [0.60, 0.80],
    anchor: 'Cui et al. (2024) — Microsoft/Accenture Copilot field RCT, 26% task-completion lift net of training.',
    examples: 'e.g. Copilot-style rollouts with enablement sessions',
  },
  {
    id: 'training_bundle',
    label: 'AI + targeted training programme',
    desc: 'AI deployed alongside a structured skills or competency programme that would itself lift productivity.',
    range: [0.50, 0.70],
    anchor: 'Brynjolfsson, Rock, Syverson (2021) — AI gains require complementary investments; effects are co-produced.',
    examples: 'e.g. SaaS rollout with coder certification, new playbooks',
  },
  {
    id: 'process_redesign',
    label: 'AI + process/workflow redesign',
    desc: 'AI deployed as part of deliberate process reengineering — new workflows, new handoffs, new quality gates.',
    range: [0.35, 0.55],
    anchor: 'Classic IT-productivity literature: most gains come from complementary reorg, not the technology itself.',
    examples: 'e.g. RPA + process simplification, AI + operating-model change',
  },
  {
    id: 'transformation',
    label: 'AI inside broader transformation',
    desc: 'Multiple concurrent initiatives: AI is one lever among several (new systems, new org, new leadership).',
    range: [0.20, 0.40],
    anchor: 'Attribution to any single lever is statistically indefensible when interventions are bundled.',
    examples: 'e.g. digital transformation programmes, post-merger integrations',
  },
  {
    id: 'pilot_enthusiasm',
    label: 'Pilot with no control or baseline',
    desc: 'Short pilot with motivated early adopters, no proper baseline, strong management attention — Hawthorne territory.',
    range: [0.15, 0.35],
    anchor: 'Dell\'Acqua et al. (2023, HBS/BCG) — even in RCT, results vary widely by task position on the "jagged frontier".',
    examples: 'e.g. showcase pilots, innovation-team sandboxes',
  },
];

const ATTRIBUTION_ANCHORS = [
  { value: 0.14, label: 'Pilot lift', detail: 'Hawthorne + selection typically inflates early', source: 'HBS/BCG 2023' },
  { value: 0.40, label: 'Bundled change', detail: 'AI inside transformation', source: 'IT-prod. literature' },
  { value: 0.65, label: 'Typical field', detail: 'AI + training bundle', source: 'Cui et al. 2024' },
  { value: 0.85, label: 'Clean DiD', detail: 'Staggered rollout, isolated effect', source: 'Brynjolfsson 2025' },
  { value: 0.95, label: 'RCT ceiling', detail: 'Pure experimental AI effect', source: 'Peng 2023' },
];

const ATTRIBUTION_CITATIONS = [
  {
    id: 'peng2023',
    authors: 'Peng, Kalliamvakou, Cihon, Demirer',
    year: '2023',
    title: 'The Impact of AI on Developer Productivity: Evidence from GitHub Copilot',
    publisher: 'arXiv / GitHub',
    url: 'https://arxiv.org/abs/2302.06590',
    note: 'Randomised controlled trial, N=95 developers. Treated group completed HTTP-server task 55.8% faster (95% CI: 21–89%). Lab setting, narrow task — establishes the AI-in-isolation ceiling.',
  },
  {
    id: 'cui2024',
    authors: 'Cui, Demirer, Jaffe, Musolff, Peng, Salz',
    year: '2024',
    title: 'The Effects of Generative AI on High-Skilled Work: Evidence from Three Field Experiments',
    publisher: 'MIT / Microsoft Research',
    url: 'https://economics.mit.edu/sites/default/files/inline-files/draft_copilot_experiments.pdf',
    note: 'Field RCTs across Microsoft, Accenture, and a Fortune 100 firm, ~4,867 developers. IV estimate: 26.08% increase in weekly completed tasks (SE 10.3%). Real-world attribution holds up but smaller than lab.',
  },
  {
    id: 'brynjolfsson2025',
    authors: 'Brynjolfsson, Li, Raymond',
    year: '2023 / 2025',
    title: 'Generative AI at Work',
    publisher: 'NBER Working Paper 31161 / Quarterly Journal of Economics',
    url: 'https://www.nber.org/papers/w31161',
    note: 'Staggered rollout of GenAI assistant to 5,172 customer-service agents. +14% issues resolved per hour on average; +34% for novice workers. Cleanest "real deployment" attribution estimate in the literature.',
  },
  {
    id: 'dellacqua2023',
    authors: 'Dell\'Acqua, McFowland III, Mollick, Lifshitz-Assaf, Kellogg, et al.',
    year: '2023',
    title: 'Navigating the Jagged Technological Frontier',
    publisher: 'Harvard Business School / BCG',
    url: 'https://www.hbs.edu/ris/Publication%20Files/24-013_d9b45b68-9e74-42d6-a1c6-c72fb70c7282.pdf',
    note: 'Preregistered experiment, 758 BCG consultants. Within AI frontier: +12.2% tasks, 25.1% faster, higher quality. Outside frontier: AI can worsen performance. Attribution is task-specific, not blanket.',
  },
  {
    id: 'noy2023',
    authors: 'Noy, Zhang',
    year: '2023',
    title: 'Experimental Evidence on the Productivity Effects of Generative AI',
    publisher: 'Science (MIT)',
    note: 'RCT on 453 college-educated professionals for mid-level writing tasks. ChatGPT treatment reduced time by ~40% and raised quality ratings. Narrow task RCT — establishes writing-task ceiling.',
  },
  {
    id: 'brs2021',
    authors: 'Brynjolfsson, Rock, Syverson',
    year: '2021',
    title: 'The Productivity J-Curve: How Intangibles Complement General Purpose Technologies',
    publisher: 'American Economic Journal: Macroeconomics',
    note: 'Classic framing: AI productivity gains require complementary intangible investments — training, process, organisation. Measured AI effect is always co-produced with these. Attribution to AI alone systematically overstates in the short run and understates in the long run.',
  },
];

// ─── DECAY (dᵢ) CALIBRATION ───────────────────────────────────────────────
// dᵢ is the annual benefit decay rate — compound erosion from model drift,
// workflow evolution, user turnover, and competitive/regulatory change.
// Broader than "model drift" alone, which is only one contributing mechanism.
const DECAY_CATEGORIES = [
  {
    id: 'static',
    label: 'Static rule-based / deterministic',
    desc: 'Rules, heuristics, deterministic logic. No learned parameters. Decay comes from the world around it changing, not the system itself.',
    range: [0.01, 0.03],
    anchor: 'Deterministic systems do not drift. Benefit decay tracks workflow change alone — typically 1–3% p.a.',
    examples: 'e.g. rule-based ETL, RPA, deterministic classifiers',
  },
  {
    id: 'vendor_saas',
    label: 'Vendor-managed SaaS AI',
    desc: 'Foundation-model-backed SaaS with vendor-handled model updates. You inherit the vendor\'s retraining cadence.',
    range: [0.03, 0.07],
    anchor: 'Vendor absorbs model drift; your decay comes from workflow evolution and user turnover.',
    examples: 'e.g. Microsoft Copilot, vendor-delivered domain SaaS, Google Duet',
  },
  {
    id: 'managed_ml',
    label: 'Production ML with active MLOps',
    desc: 'Custom or vendor ML with systematic monitoring, drift detection, and scheduled retraining.',
    range: [0.05, 0.10],
    anchor: 'Well-governed ML systems retrain 2–4× per year and hold performance within a 5–10% annual envelope.',
    examples: 'e.g. monitored fraud detection, predictive maintenance with retraining pipeline',
  },
  {
    id: 'unmanaged_ml',
    label: 'Production ML without retraining',
    desc: 'Deployed once and left running. No active monitoring or retraining cadence. Common failure mode in practice.',
    range: [0.10, 0.20],
    anchor: 'Vela-Rincón et al. (Nature Sci. Reports, 2022): 91% of production ML models degrade; 35% error-rate jump after 6 months.',
    examples: 'e.g. early pilots that shipped to production without MLOps investment',
  },
  {
    id: 'agentic_llm',
    label: 'Novel LLM / agentic systems',
    desc: 'Vendor model changes, prompt fragility, behavioural drift. Regression testing discipline still immature industry-wide.',
    range: [0.10, 0.25],
    anchor: 'Vendor model upgrades can invert performance; prompt drift routine; evaluation frameworks still emerging.',
    examples: 'e.g. agentic workflows, LLM orchestration, chain-of-thought pipelines',
  },
  {
    id: 'volatile',
    label: 'High-volatility predictive systems',
    desc: 'Data patterns evolve rapidly. Systems require monthly or shorter retraining cadence to hold performance.',
    range: [0.15, 0.30],
    anchor: 'Industry practice in these domains requires continuous retraining; benefits erode within months if neglected.',
    examples: 'e.g. real-time fraud detection, recommendation engines, demand forecasting, ad targeting',
  },
];

const DECAY_ANCHORS = [
  { value: 0.02, label: 'Deterministic', detail: 'No model drift', source: 'Theoretical floor' },
  { value: 0.05, label: 'Vendor SaaS', detail: 'Vendor absorbs drift', source: 'Industry practice' },
  { value: 0.08, label: 'Managed ML', detail: 'Active MLOps retraining', source: 'MLOps norms' },
  { value: 0.15, label: 'Unmanaged ML', detail: '91% of models degrade', source: 'Nature 2022' },
  { value: 0.25, label: 'Volatile domain', detail: 'Fraud, recs, ads', source: 'Industry practice' },
];

const DECAY_CITATIONS = [
  {
    id: 'velarincon2022',
    authors: 'Vela-Rincón, Contreras, Castro-Espinoza, Villegas, et al.',
    year: '2022',
    title: 'Temporal quality degradation in AI models',
    publisher: 'Nature Scientific Reports 12, 11654',
    url: 'https://doi.org/10.1038/s41598-022-15245-z',
    note: 'Framework applied to 32 datasets across 4 industries using 4 standard ML architectures (Linear Regression, Random Forest, XGBoost, MLP). 91% of models exhibit temporal degradation. Some models show gradual predictable decline, others "explosive degradation" (long stable period followed by sudden collapse).',
  },
  {
    id: 'nannyml_field',
    authors: 'NannyML team (field analysis)',
    year: '2022–2024',
    title: 'Temporal degradation in production ML — field observations',
    publisher: 'NannyML / MLOps community',
    note: 'Field analysis across customer deployments corroborates the 91% figure. Key finding: drift ≠ degradation. Low-importance features can drift with zero performance impact; high-importance features can be stable while the task itself shifts underneath.',
  },
  {
    id: 'brs_jcurve',
    authors: 'Brynjolfsson, Rock, Syverson',
    year: '2021',
    title: 'The Productivity J-Curve',
    publisher: 'American Economic Journal: Macroeconomics',
    note: 'Counterpoint to naive decay assumptions: long-run benefit can increase, not decrease, as complementary intangible investments mature. Short-run decay often reflects novelty fade; long-run trajectory depends on the organisation\'s learning rate.',
  },
  {
    id: 'mlops_industry',
    authors: 'Industry MLOps literature',
    year: '2023–2026',
    title: 'Model monitoring and retraining cadence benchmarks',
    publisher: 'IBM, AWS, Google Vertex AI, Azure ML',
    note: 'Cross-vendor guidance: low-volatility domains tolerate quarterly or annual retraining (5–10% decay envelope); high-volatility domains require monthly or continuous retraining (>15% decay if neglected).',
  },
];

// ─── ADOPTION (Aᵢ(t)) CALIBRATION ─────────────────────────────────────────
// Aᵢ(t) is a per-year adoption profile, not a scalar. These profiles are
// derived from Microsoft Copilot benchmarks, ERP literature, and Bass/Rogers
// diffusion theory. Each is a 5-year trajectory (pad with last value if T<5).
const ADOPTION_PROFILES = [
  {
    id: 'big_bang',
    label: 'Big-bang, unstructured',
    desc: 'Licences issued without structured enablement. No champions, no role-specific training, no usage measurement or intervention.',
    curve: [0.20, 0.40, 0.55, 0.65, 0.70],
    anchor: 'Microsoft Copilot benchmarks (2025–26): big-bang rollouts average 12–22% DAU at 90 days, typically plateau below 70%.',
  },
  {
    id: 'vendor_basic',
    label: 'Vendor SaaS with basic enablement',
    desc: 'Vendor-delivered training, basic onboarding, light management push. No deep process integration.',
    curve: [0.40, 0.65, 0.80, 0.85, 0.88],
    anchor: 'Generic SaaS benchmark: 60–70% active use within 6 months for tools of moderate complexity.',
  },
  {
    id: 'structured',
    label: 'Structured rollout with champions',
    desc: 'Phased deployment, role-specific training, internal champions network, ongoing usage measurement and intervention.',
    curve: [0.60, 0.80, 0.90, 0.93, 0.95],
    anchor: 'Microsoft Copilot: structured rollouts achieve 65–78% DAU at 90 days (Copilot Consulting 2026 benchmarks, n=40 enterprises).',
  },
  {
    id: 'phased_pilot',
    label: 'Phased pilot → scaled rollout',
    desc: 'Small validated pilot in Year 1, broader rollout in Year 2, organisation-wide in Year 3.',
    curve: [0.30, 0.70, 0.90, 0.92, 0.94],
    anchor: 'Worked-example default. Aligns with NHS-style 18–24 month deployment cadence for large enterprises.',
  },
  {
    id: 'mandatory',
    label: 'Mandatory (regulated / compliance)',
    desc: 'Usage is required by policy, regulation, or workflow gating. Non-use is tracked and managed.',
    curve: [0.70, 0.90, 0.95, 0.97, 0.97],
    anchor: 'Mandated systems (time-logging, compliance, regulated clinical workflows) typically reach 90%+ within 12 months.',
  },
  {
    id: 'organic',
    label: 'Organic, bottom-up',
    desc: 'No top-down mandate. Users adopt if they find value. Shadow IT possible. Relies on word-of-mouth diffusion.',
    curve: [0.15, 0.40, 0.60, 0.70, 0.75],
    anchor: 'Bass/Rogers diffusion: innovators (2.5%) + early adopters (13.5%) dominate Year 1; early majority enters Year 2.',
  },
];

const ADOPTION_CITATIONS = [
  {
    id: 'copilot_benchmarks',
    authors: 'Copilot Consulting (Errin O\'Connor) / Stackmatix',
    year: '2026',
    title: 'Microsoft Copilot Adoption Rates: Enterprise Benchmarks',
    publisher: 'Cross-practice analysis, n=40+ enterprises',
    note: 'Headline: 34% average DAU at 90 days across enterprises. Structured rollouts 65–78%. Big-bang 12–22%. Organisations with 1,000+ employees average 42% activation within 6 months.',
  },
  {
    id: 'morgan_stanley',
    authors: 'Morgan Stanley / RSM',
    year: 'July 2025',
    title: 'AI Adopter Survey',
    publisher: 'Morgan Stanley Research',
    note: '79% of enterprises report deploying Microsoft Copilot; half have moved past pilot. Large enterprises see ~55% weekly active usage as a realistic steady-state.',
  },
  {
    id: 'rogers',
    authors: 'Everett M. Rogers',
    year: '1962 (5th ed. 2003)',
    title: 'Diffusion of Innovations',
    publisher: 'Free Press',
    note: 'Canonical adopter taxonomy: innovators (2.5%), early adopters (13.5%), early majority (34%), late majority (34%), laggards (16%). Cumulative adoption follows S-curve; speed varies by perceived relative advantage, compatibility, complexity, trialability, observability.',
  },
  {
    id: 'bass',
    authors: 'Frank M. Bass',
    year: '1969',
    title: 'A New Product Growth Model for Consumer Durables',
    publisher: 'Management Science 15(5)',
    note: 'Parameterised diffusion model still used for enterprise technology forecasting. Captures innovation coefficient (p, external influence) and imitation coefficient (q, word-of-mouth). p typically ≈0.03, q typically ≈0.3–0.5 for enterprise tech.',
  },
  {
    id: 'erp_fail',
    authors: 'Gartner (ERP failure literature)',
    year: 'Ongoing',
    title: 'ERP Implementation Success Rates',
    publisher: 'Gartner Research',
    note: '55–75% of ERP implementations fail to meet intended objectives — largest cause is insufficient change management and user adoption, not technical failure. Relevant analogue for AI adoption where process redesign is bundled.',
  },
  {
    id: 'whatfix',
    authors: 'Whatfix / Ten Six / industry practice',
    year: '2025–2026',
    title: 'Enterprise Software Adoption Benchmarks',
    publisher: 'Vendor and practitioner guidance',
    note: 'Cross-vendor rules of thumb: "successful" adoption = 60–80% active users within 6 months. Top performers: 80–90%. 3–6 months is the canonical adoption horizon for typical enterprise software; AI tools follow similar curves when enablement is done well.',
  },
];

// ─── MONTE CARLO UTILITIES ────────────────────────────────────────────────
const N_SAMPLES = 3000;

// Triangular distribution sampler: simple, transparent, controllable
function sampleTriangular(min, mode, max) {
  if (min === max) return min;
  if (min > mode || mode > max) { // sanity
    const sorted = [min, mode, max].sort((a, b) => a - b);
    min = sorted[0]; mode = sorted[1]; max = sorted[2];
  }
  const u = Math.random();
  const f = (mode - min) / (max - min);
  if (u < f) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

// Log-normal via median + P90 ratio (useful for cost overruns)
function sampleLogNormalFromMedianAndRatio(median, p10Ratio, p90Ratio) {
  // Use log-space triangular as a pragmatic proxy for log-normal;
  // keeps the sampler simple and the math transparent.
  const logMin = Math.log(median * p10Ratio);
  const logMode = Math.log(median);
  const logMax = Math.log(median * p90Ratio);
  return Math.exp(sampleTriangular(logMin, logMode, logMax));
}

function quantile(sortedArr, q) {
  if (sortedArr.length === 0) return 0;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (base + 1 < sortedArr.length) {
    return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
  }
  return sortedArr[base];
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Derived helper: effective adoption from the three sub-curves
function effectiveAdoption(s, t) {
  const i = t - 1;
  const e = s.exposure[i] ?? 1;
  const u = s.utilisation[i] ?? 1;
  const a = s.absorption[i] ?? 1;
  return e * u * a;
}

// ─── MAIN CALCULATION — Monte Carlo distribution ──────────────────────────
function computeROIDistribution(s) {
  const T = s.timeHorizon;

  // ─── Point-estimate computation (for year-by-year tables) ──────────────
  const yearlyBenefits = [];
  for (let t = 1; t <= T; t++) {
    const adoption = effectiveAdoption(s, t);
    const combinedFactor = s.pi * s.fITI * s.alphaI;
    const decayFactor = Math.pow(1 - s.di, t);
    const b = s.Vi * combinedFactor * decayFactor * adoption;
    yearlyBenefits.push({ year: t, value: b, adoption, combinedFactor, decayFactor });
  }
  const totalBenefit = yearlyBenefits.reduce((a, b) => a + b.value, 0);

  const yearlyCosts = [];
  for (let t = 1; t <= T; t++) {
    yearlyCosts.push({
      year: t,
      run: s.Rjt_annual,
      gov: s.Gjt_annual,
      maint: s.Mj * Math.pow(1 + s.delta, t - 1),
      build: t === 1 ? s.Cj : 0,
      optionality: t === 1 ? s.PV_SO : 0,
    });
  }
  const buildCost = s.Cj;
  const runCost = s.Rjt_annual * T;
  const govCost = s.Gjt_annual * T;
  const maintCost = yearlyCosts.reduce((a, c) => a + c.maint, 0);
  const totalCost = buildCost + runCost + govCost + maintCost + s.PV_SO;
  const roiV1_point = totalCost > 0 ? ((totalBenefit - totalCost) / totalCost) * 100 : 0;

  // Naive case (vendor claim × T vs build + basic licence only)
  const naiveBenefit = s.Vi * T;
  const naiveCost = s.Cj + s.Rjt_annual * T;
  const roiNaive = naiveCost > 0 ? ((naiveBenefit - naiveCost) / naiveCost) * 100 : 0;

  // ─── Monte Carlo simulation ────────────────────────────────────────────
  const roiSamples = new Array(N_SAMPLES);
  const benefitSamples = new Array(N_SAMPLES);
  const costSamples = new Array(N_SAMPLES);

  for (let i = 0; i < N_SAMPLES; i++) {
    // Sample benefit-side variables
    const pi_s = sampleTriangular(s.pi_range[0], s.pi, s.pi_range[1]);
    const alphaI_s = sampleTriangular(s.alphaI_range[0], s.alphaI, s.alphaI_range[1]);
    const fITI_s = sampleTriangular(s.fITI_range[0], s.fITI, s.fITI_range[1]);
    const di_s = sampleTriangular(s.di_range[0], s.di, s.di_range[1]);

    // Sample per-year adoption sub-curves
    let benefit = 0;
    for (let t = 1; t <= T; t++) {
      const idx = t - 1;
      const sp = s.adoption_spread;
      const e_s = clamp(sampleTriangular(
        clamp((s.exposure[idx] ?? 1) - sp, 0.01, 1),
        s.exposure[idx] ?? 1,
        clamp((s.exposure[idx] ?? 1) + sp, 0.01, 1)
      ), 0, 1);
      const u_s = clamp(sampleTriangular(
        clamp((s.utilisation[idx] ?? 1) - sp, 0.01, 1),
        s.utilisation[idx] ?? 1,
        clamp((s.utilisation[idx] ?? 1) + sp, 0.01, 1)
      ), 0, 1);
      const a_s = clamp(sampleTriangular(
        clamp((s.absorption[idx] ?? 1) - sp, 0.01, 1),
        s.absorption[idx] ?? 1,
        clamp((s.absorption[idx] ?? 1) + sp, 0.01, 1)
      ), 0, 1);
      const adoption_s = e_s * u_s * a_s;
      const decay = Math.pow(1 - di_s, t);
      benefit += s.Vi * pi_s * fITI_s * alphaI_s * decay * adoption_s;
    }

    // Sample cost-side variables
    const Cj_s = sampleLogNormalFromMedianAndRatio(s.Cj, s.Cj_overrun_p10, s.Cj_overrun_p90);
    const Rj_total = sampleTriangular(
      s.Rjt_annual * (1 - s.Rjt_spread),
      s.Rjt_annual,
      s.Rjt_annual * (1 + s.Rjt_spread)
    ) * T;
    const Gj_total = sampleTriangular(
      s.Gjt_annual * s.Gjt_spread_low,
      s.Gjt_annual,
      s.Gjt_annual * s.Gjt_spread_high
    ) * T;
    const Mj_s = sampleTriangular(
      s.Mj * (1 - s.Mj_spread),
      s.Mj,
      s.Mj * (1 + s.Mj_spread)
    );
    const delta_s = sampleTriangular(s.delta_range[0], s.delta, s.delta_range[1]);
    let maint = 0;
    for (let t = 1; t <= T; t++) {
      maint += Mj_s * Math.pow(1 + delta_s, t - 1);
    }
    const PV_SO_s = sampleTriangular(s.PV_SO_range[0], s.PV_SO, s.PV_SO_range[1]);

    const totalCost_s = Cj_s + Rj_total + Gj_total + maint + PV_SO_s;
    const roi_s = totalCost_s > 0 ? ((benefit - totalCost_s) / totalCost_s) * 100 : 0;

    roiSamples[i] = roi_s;
    benefitSamples[i] = benefit;
    costSamples[i] = totalCost_s;
  }

  const sortedRoi = [...roiSamples].sort((a, b) => a - b);
  const sortedBenefit = [...benefitSamples].sort((a, b) => a - b);
  const sortedCost = [...costSamples].sort((a, b) => a - b);
  const meanRoi = roiSamples.reduce((a, b) => a + b, 0) / N_SAMPLES;

  return {
    // Point-estimate fields (for year-by-year tables)
    yearlyBenefits, totalBenefit,
    yearlyCosts, buildCost, runCost, govCost, maintCost, totalCost,
    roiV1_point, roiNaive, netV1: totalBenefit - totalCost,
    naiveBenefit, naiveCost, netNaive: naiveBenefit - naiveCost,

    // Distribution statistics (headline)
    roi: {
      p10: quantile(sortedRoi, 0.10),
      p50: quantile(sortedRoi, 0.50),
      p90: quantile(sortedRoi, 0.90),
      mean: meanRoi,
      samples: sortedRoi,
      probPositive: roiSamples.filter(r => r > 0).length / N_SAMPLES,
      probExceeds: (threshold) => roiSamples.filter(r => r > threshold).length / N_SAMPLES,
    },
    benefit: {
      p10: quantile(sortedBenefit, 0.10),
      p50: quantile(sortedBenefit, 0.50),
      p90: quantile(sortedBenefit, 0.90),
    },
    cost: {
      p10: quantile(sortedCost, 0.10),
      p50: quantile(sortedCost, 0.50),
      p90: quantile(sortedCost, 0.90),
    },

    // Alias for backward compatibility with existing views (= distribution median)
    roiV1: quantile(sortedRoi, 0.50),
  };
}

function verdict(roi) {
  if (roi >= 25) return { label: 'PROCEED', tone: C.green, blurb: 'ROI target achieved. Standard governance sufficient.' };
  if (roi >= 0)  return { label: 'MARGINAL', tone: C.amber, blurb: 'Positive ROI but thin. Pull levers before contract.' };
  if (roi >= -25) return { label: 'CONDITIONAL', tone: C.amber, blurb: 'Only defensible with lever movement. Do not sign yet.' };
  return { label: 'DO NOT PROCEED', tone: C.red, blurb: 'Structural value destruction. Remediate fundamentals first.' };
}

// Distribution-aware verdict: combines central tendency (P50) with certainty
// (probPositive). A P50 of +5% with only 51% probability of positive ROI is
// a materially different recommendation than +5% with 90% certainty.
// Distribution-aware verdict combining central tendency (P50), certainty
// (probPositive), and CFO hurdle rate. A Green project under this framework is
// one the CFO can actually approve — which means clearing hurdle with adequate
// confidence. An AI engagement follows. Red/Amber projects open the prior
// conversation: infrastructure remediation before AI investment.
function boardVerdict(roi, hurdleRate) {
  const p50 = roi.p50;
  const pp = roi.probPositive;
  const probHurdle = roi.probExceeds(hurdleRate);
  const h = hurdleRate;

  if (p50 >= h && probHurdle >= 0.75) {
    return { label: 'PROCEED', tone: C.green,
      blurb: `P50 ROI of ${p50.toFixed(0)}% clears the ${h}% hurdle with ${(probHurdle * 100).toFixed(0)}% confidence. Approvable on current assumptions.` };
  }
  if (p50 >= h && probHurdle >= 0.55) {
    return { label: 'PROCEED WITH CAUTION', tone: C.green,
      blurb: `P50 clears hurdle but only ${(probHurdle * 100).toFixed(0)}% of outcomes do. Distribution width is the risk — narrow it or stage the commitment.` };
  }
  if (p50 >= 0 && probHurdle >= 0.35) {
    return { label: 'MARGINAL', tone: C.amber,
      blurb: `P50 positive but only ${(probHurdle * 100).toFixed(0)}% of outcomes clear the ${h}% hurdle. CFO-acceptable only with structural improvements.` };
  }
  if (p50 >= -25 && pp >= 0.25) {
    return { label: 'CONDITIONAL', tone: C.amber,
      blurb: `Central estimate below hurdle. Structural preconditions (ITI, EFI, adoption) must be remediated before this becomes an investable AI project.` };
  }
  return { label: 'DO NOT PROCEED', tone: C.red,
    blurb: `Central estimate negative, only ${(pp * 100).toFixed(0)}% probability of any positive return. Infrastructure remediation is the precondition for this conversation to resume.` };
}

// ─── CURRENCY FORMATTING ─────────────────────────────────────────────────
function fmt(n, currency = 'GBP', opts = {}) {
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  const val = Math.round(n);
  const formatted = Math.abs(val).toLocaleString('en-GB');
  const sign = val < 0 ? '−' : '';
  return sign + sym + (opts.noSpace ? '' : '\u202F') + formatted;
}
function fmtPct(n, digits = 1) {
  const sign = n >= 0 ? '+' : '−';
  return sign + Math.abs(n).toFixed(digits) + '\u202F%';
}

// ─── UI PRIMITIVES ───────────────────────────────────────────────────────
const Label = ({ children, hint }) => (
  <div className="flex items-baseline justify-between mb-1">
    <span className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>{children}</span>
    {hint && <span className="text-xs font-mono" style={{ color: C.inkSoft }}>{hint}</span>}
  </div>
);

const Input = ({ value, onChange, type = 'number', step = '1', ...rest }) => (
  <input
    type={type}
    step={step}
    value={value}
    onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
    className="w-full font-mono px-3 py-2 text-right tabular border-0 border-b-2 bg-transparent outline-none focus:border-opacity-100 transition-colors"
    style={{ color: C.ink, borderColor: C.rule, fontSize: '15px' }}
    onFocus={(e) => e.target.style.borderColor = C.ink}
    onBlur={(e) => e.target.style.borderColor = C.rule}
    {...rest}
  />
);

const Slider = ({ value, onChange, min, max, step, display }) => (
  <div>
    <div className="flex items-baseline justify-between mb-2">
      <span className="font-mono text-sm tabular" style={{ color: C.ink }}>{display ?? value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full"
      style={{ accentColor: C.ink }}
    />
  </div>
);

const Band = ({ band, onSelect, bands }) => (
  <div className="grid grid-cols-3 gap-0 border" style={{ borderColor: C.rule }}>
    {Object.entries(bands).map(([k, v]) => (
      <button key={k} onClick={() => onSelect(k)}
        className="px-3 py-3 text-left transition-all"
        style={{
          background: band === k ? v.color : C.cream,
          color: band === k ? C.cream : C.ink,
          borderRight: k !== 'red' ? `1px solid ${C.rule}` : 'none',
        }}
      >
        <div className="font-serif text-lg font-semibold leading-none">{v.label}</div>
        {v.score && <div className="text-xs font-mono mt-1 opacity-80">{v.score}</div>}
      </button>
    ))}
  </div>
);

const ROIBadge = ({ roi, label, size = 'md' }) => {
  const v = verdict(roi);
  const sizeCls = size === 'lg' ? 'text-6xl' : size === 'md' ? 'text-4xl' : 'text-2xl';
  return (
    <div>
      {label && <div className="smcaps text-xs font-sans mb-1" style={{ color: C.inkMid }}>{label}</div>}
      <div className={`font-serif ${sizeCls} font-semibold tabular leading-none`} style={{ color: v.tone }}>
        {fmtPct(roi, 1)}
      </div>
    </div>
  );
};

const Rule = ({ double, style }) => (
  <div className={double ? 'rule-double' : ''}
    style={{
      borderTop: double ? undefined : `1px solid ${C.rule}`,
      color: C.rule,
      ...style,
    }} />
);

const SectionHeader = ({ num, title, kicker }) => (
  <div className="mb-6">
    {kicker && <div className="smcaps text-xs font-sans mb-2" style={{ color: C.accent, fontWeight: 600 }}>{kicker}</div>}
    <div className="flex items-baseline gap-4">
      {num && <div className="font-serif text-2xl" style={{ color: C.inkSoft }}>§{num}</div>}
      <h2 className="font-serif text-3xl font-semibold" style={{ color: C.ink }}>{title}</h2>
    </div>
    <Rule style={{ marginTop: '12px' }} />
  </div>
);

// ─── TAB BUTTONS ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'howto', label: 'How to Use', num: 'I', sub: 'Start here' },
  { id: 'setup', label: 'Setup', num: 'II', sub: 'Inputs & parameters' },
  { id: 'evidence', label: 'Evidence', num: 'III', sub: 'Calibrate pᵢ · research' },
  { id: 'finance', label: 'Finance', num: 'IV', sub: 'CFO · numbers & ROI' },
  { id: 'infra', label: 'Infrastructure', num: 'V', sub: 'CIO · DTRM levers' },
  { id: 'board', label: 'Board', num: 'VI', sub: 'Executive summary' },
  { id: 'scenario', label: 'Scenario', num: 'VII', sub: 'What-if analysis' },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────
export default function AIROIEvaluator() {
  const [s_raw, setS] = useState(DEFAULTS);
  const [tab, setTab] = useState('howto');

  // Derive an effective adoption array from the three sub-curves and inject
  // it into the state object so views can continue to read `s.adoption`.
  // Also derive ITI band, f(ITI), δ, EFI band and PV(SO) from domain scores,
  // so the traffic-light output is a *consequence* of the sub-scores.
  const s = useMemo(() => {
    // ─── ITI derivation ──────────────────────────────────────────────────
    const itiScoreValues = ITI_DOMAINS.map(d => domainScore(d, s_raw.iti_scores).score);
    const itiComposite = itiScoreValues.reduce((a, b) => a + b, 0) / itiScoreValues.length;
    const itiBand = bandFromComposite(itiComposite);
    // Piecewise-linear f(ITI): Red [0, 0.60], Amber [0.60, 0.89], Green [0.90, 1.00]
    let fITI;
    if (itiComposite >= 4.0) {
      fITI = 0.90 + 0.10 * ((itiComposite - 4.0) / 1.0);
    } else if (itiComposite >= 2.5) {
      fITI = 0.60 + 0.29 * ((itiComposite - 2.5) / 1.5);
    } else {
      fITI = 0.60 * (itiComposite / 2.5);
    }
    fITI = Math.max(0, Math.min(1, fITI));
    // f(ITI) uncertainty range: ±0.10 around point, clamped to [0,1]
    const fITI_range = [
      Math.max(0, fITI - 0.10),
      Math.min(1, fITI + 0.10),
    ];
    // δ follows band: Green 0.05, Amber 0.10, Red 0.15
    const delta = itiBand === 'green' ? 0.05 : itiBand === 'amber' ? 0.10 : 0.15;
    const delta_range = itiBand === 'green' ? [0.03, 0.08]
                       : itiBand === 'amber' ? [0.07, 0.15]
                       : [0.12, 0.20];

    // ─── EFI derivation ──────────────────────────────────────────────────
    const efiScoreValues = EFI_DOMAINS.map(d => domainScore(d, s_raw.efi_scores).score);
    const efiComposite = efiScoreValues.reduce((a, b) => a + b, 0) / efiScoreValues.length;
    const efiBand = bandFromComposite(efiComposite);
    // PV(SO) factor: EFI Red (deep lock-in) → 0.20, Amber → 0.08, Green → 0.02
    // Linear within bands for a continuous response to score changes
    let efiFactor;
    if (efiComposite >= 4.0) {
      efiFactor = 0.02 + (0.06 - 0.02) * ((5.0 - efiComposite) / 1.0);
    } else if (efiComposite >= 2.5) {
      efiFactor = 0.06 + (0.14 - 0.06) * ((4.0 - efiComposite) / 1.5);
    } else {
      efiFactor = 0.14 + (0.20 - 0.14) * ((2.5 - efiComposite) / 2.5);
    }
    const base_for_pvso = s_raw.Cj + (s_raw.Rjt_annual * s_raw.timeHorizon);
    const PV_SO = Math.round(base_for_pvso * efiFactor / 1000) * 1000;
    const PV_SO_range = [
      Math.round(PV_SO * 0.5 / 1000) * 1000,
      Math.round(PV_SO * 1.8 / 1000) * 1000,
    ];

    return {
      ...s_raw,
      itiBand,
      fITI,
      fITI_range,
      delta,
      delta_range,
      itiComposite,
      efiBand,
      PV_SO,
      PV_SO_range,
      efiComposite,
      adoption: (s_raw.exposure ?? []).map((e, i) =>
        (e ?? 1) * ((s_raw.utilisation?.[i]) ?? 1) * ((s_raw.absorption?.[i]) ?? 1)
      ),
    };
  }, [s_raw]);

  const calc = useMemo(() => computeROIDistribution(s), [s]);
  const update = (patch) => setS(prev => ({ ...prev, ...patch }));
  const f = (n) => fmt(n, s.currency);

  // Keep the three adoption sub-curves aligned with time horizon
  useMemo(() => {
    const pad = (arr, len, fill = 1) =>
      arr.length >= len ? arr : [...arr, ...Array(len - arr.length).fill(fill)];
    const T = s_raw.timeHorizon;
    if ((s_raw.exposure ?? []).length < T ||
        (s_raw.utilisation ?? []).length < T ||
        (s_raw.absorption ?? []).length < T) {
      update({
        exposure: pad(s_raw.exposure ?? [], T),
        utilisation: pad(s_raw.utilisation ?? [], T),
        absorption: pad(s_raw.absorption ?? [], T),
      });
    }
  }, [s_raw.timeHorizon]);

  return (
    <div className="min-h-screen" style={{ background: C.paper, color: C.ink }}>
      <style>{FONTS}</style>

      {/* ─── MASTHEAD ─────────────────────────────────────────────────── */}
      <header className="border-b-4" style={{ borderColor: C.ink, background: C.paperDeep }}>
        <div className="max-w-7xl mx-auto px-8 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="smcaps text-xs mb-1 font-sans" style={{ color: C.accent, fontWeight: 700 }}>
                AI Deployment Assessment · Est. 2026
              </div>
              <h1 className="font-serif font-semibold leading-none" style={{ fontSize: '56px', color: C.ink, letterSpacing: '-0.02em' }}>
                The ROI <em className="italic" style={{ fontWeight: 400 }}>Formula</em>
              </h1>
              <div className="font-serif italic mt-2" style={{ color: C.inkMid, fontSize: '17px' }}>
                An honest evaluation tool for AI Proofs-of-Concept
              </div>
            </div>
            <div className="text-right font-sans text-xs" style={{ color: C.inkMid }}>
              <div className="smcaps font-semibold">Foundation</div>
              <div>Stephanie Gradwell</div>
              <div className="smcaps font-semibold mt-2">Adoption Function</div>
              <div>Douglas Laney</div>
              <div className="smcaps font-semibold mt-2">DTRM Extensions</div>
              <div>Rowland Agidee</div>
            </div>
          </div>
          <Rule style={{ marginTop: '20px', marginBottom: '0' }} />
          <div className="flex items-center justify-between pt-3 text-xs font-mono" style={{ color: C.inkSoft }}>
            <div>ITPM · ADD · DDC · Structural Optionality</div>
            <div className="flex items-center gap-4">
              <select value={s.currency} onChange={(e) => update({ currency: e.target.value })}
                className="font-mono text-xs bg-transparent border px-2 py-1 outline-none"
                style={{ borderColor: C.rule, color: C.ink }}>
                <option value="GBP">GBP £</option>
                <option value="EUR">EUR €</option>
                <option value="USD">USD $</option>
              </select>
              <button onClick={() => setS(DEFAULTS)}
                className="smcaps font-sans px-3 py-1 border transition-colors hover:bg-opacity-100"
                style={{ borderColor: C.rule, color: C.ink, fontWeight: 600 }}>
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── TABS ─────────────────────────────────────────────────────── */}
      <nav className="border-b sticky top-0 z-10" style={{ borderColor: C.ink, background: C.paper }}>
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-4 py-4 border-r text-left transition-all"
                style={{
                  borderColor: C.rule,
                  background: tab === t.id ? C.ink : 'transparent',
                  color: tab === t.id ? C.cream : C.ink,
                  flex: 1,
                }}>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-lg italic" style={{ opacity: 0.6 }}>{t.num}</span>
                  <span className="font-serif text-lg font-semibold">{t.label}</span>
                </div>
                <div className="smcaps text-xs font-sans mt-1" style={{ opacity: 0.75 }}>{t.sub}</div>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ─── BODY ─────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-8 py-10">
        {tab === 'howto' && <HowToView setTab={setTab} s={s} />}
        {tab === 'setup' && <SetupView s={s} update={update} f={f} />}
        {tab === 'evidence' && <EvidenceView s={s} update={update} f={f} />}
        {tab === 'finance' && <FinanceView s={s} calc={calc} f={f} />}
        {tab === 'infra' && <InfraView s={s} calc={calc} update={update} f={f} />}
        {tab === 'board' && <BoardView s={s} calc={calc} f={f} />}
        {tab === 'scenario' && <ScenarioView s={s} update={update} calc={calc} f={f} />}
      </main>

      {/* ─── FOOTER ───────────────────────────────────────────────────── */}
      <footer className="border-t mt-16 py-6" style={{ borderColor: C.ink, background: C.paperDeep }}>
        <div className="max-w-7xl mx-auto px-8 text-xs font-sans" style={{ color: C.inkMid }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              Formula foundation: Gradwell. Adoption function: Laney (Infonomics). DTRM — ITPM, ADD, DDC,
              Structural Optionality: Agidee. This tool implements the AI ROI formula from the "Worked Example" (2026).
              All default values are illustrative.
            </div>
            <div className="smcaps" style={{ fontWeight: 600 }}>
              CC BY-ND 2026 · Framework by R. Agidee
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── SETUP VIEW ───────────────────────────────────────────────────────────
function SetupView({ s, update, f }) {
  return (
    <div className="space-y-12">
      <div>
        <SectionHeader num="1" title="Project" kicker="Context" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-5">
            <Label>Project name</Label>
            <Input type="text" value={s.projectName} onChange={(v) => update({ projectName: v })} />
          </div>
          <div className="col-span-3">
            <Label>Organisation</Label>
            <Input type="text" value={s.orgName} onChange={(v) => update({ orgName: v })} />
          </div>
          <div className="col-span-2">
            <Label>Time horizon</Label>
            <Input value={s.timeHorizon} min={1} max={5} step="1"
              onChange={(v) => update({ timeHorizon: Math.max(1, Math.min(5, v)) })} />
          </div>
          <div className="col-span-2">
            <Label hint="CFO hurdle">Hurdle rate</Label>
            <div className="flex items-center gap-2">
              <Input value={s.hurdleRate} min={0} max={100} step="1"
                onChange={(v) => update({ hurdleRate: Math.max(0, Math.min(100, v)) })} />
              <span className="font-mono text-sm" style={{ color: C.inkMid }}>%</span>
            </div>
            <p className="text-xs font-sans mt-2 italic" style={{ color: C.inkSoft }}>
              Minimum ROI the CFO needs. Typical: 10–25%.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Benefit side ─────────────────────────────────────────── */}
      <div>
        <SectionHeader num="2" title="Benefit Side" kicker="Σᵢ ( Vᵢ · pᵢ · f(ITI) · αᵢ · (1−dᵢ)ᵗ · Aᵢ(t) )" />
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-4">
            <Label hint="Vᵢ">Vendor claim (annual gross)</Label>
            <Input value={s.Vi} step="1000" onChange={(v) => update({ Vi: v })} />
            <p className="text-xs font-sans mt-2 italic" style={{ color: C.inkSoft }}>
              The gross value the vendor promises before any discount is applied.
            </p>
          </div>

          <div className="col-span-4">
            <Label hint="pᵢ ∈ [0,1]">Realisation probability</Label>
            <Slider value={s.pi} min={0} max={1} step={0.05}
              onChange={(v) => update({ pi: v })} display={`${(s.pi * 100).toFixed(0)} %`} />
            <p className="text-xs font-sans mt-2 italic" style={{ color: C.inkSoft }}>
              Residual inherent uncertainty, after infrastructure and adoption are handled separately.
              See <strong>Evidence</strong> tab for calibration against research.
            </p>
          </div>

          <div className="col-span-4">
            <Label hint="αᵢ ∈ [0,1]">Attribution factor</Label>
            <Slider value={s.alphaI} min={0} max={1} step={0.05}
              onChange={(v) => update({ alphaI: v })} display={`${(s.alphaI * 100).toFixed(0)} %`} />
            <p className="text-xs font-sans mt-2 italic" style={{ color: C.inkSoft }}>
              What share of the improvement is causally due to the AI alone, vs concurrent training or process change?
              See <strong>Evidence</strong> tab for RCT-anchored ranges.
            </p>
          </div>

          <div className="col-span-4">
            <Label hint="dᵢ p.a.">Annual benefit decay</Label>
            <Slider value={s.di} min={0} max={0.3} step={0.01}
              onChange={(v) => update({ di: v })} display={`${(s.di * 100).toFixed(1)} %`} />
            <p className="text-xs font-sans mt-2 italic" style={{ color: C.inkSoft }}>
              Compound erosion: model drift, workflow change, user turnover, novelty fade.
              See <strong>Evidence</strong> tab for Nature-backed ranges by system type.
            </p>
          </div>

          <div className="col-span-8">
            <Label hint="f(ITI) — derived from five ITI domain scores">Infrastructure Trust Index (ITI)</Label>
            <div className="grid grid-cols-3 gap-0 border" style={{ borderColor: C.rule }}>
              {Object.entries(ITI_BANDS).map(([k, v]) => (
                <div key={k}
                  className="px-3 py-3 text-left"
                  style={{
                    background: s.itiBand === k ? v.color : C.cream,
                    color: s.itiBand === k ? C.cream : C.ink,
                    borderRight: k !== 'red' ? `1px solid ${C.rule}` : 'none',
                    opacity: s.itiBand === k ? 1 : 0.55,
                  }}>
                  <div className="font-serif text-lg font-semibold leading-none">{v.label}</div>
                  {v.score && <div className="text-xs font-mono mt-1 opacity-80">{v.score}</div>}
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4 text-xs font-mono" style={{ color: C.inkMid }}>
              <div>
                <div className="smcaps" style={{ fontWeight: 600 }}>Composite</div>
                <div className="font-serif text-xl tabular" style={{ color: C.ink, marginTop: 2 }}>
                  {s.itiComposite.toFixed(1)} / 5.0
                </div>
              </div>
              <div>
                <div className="smcaps" style={{ fontWeight: 600 }}>f(ITI)</div>
                <div className="font-serif text-xl tabular" style={{ color: C.ink, marginTop: 2 }}>
                  {s.fITI.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="smcaps" style={{ fontWeight: 600 }}>δ compounding</div>
                <div className="font-serif text-xl tabular" style={{ color: C.ink, marginTop: 2 }}>
                  {(s.delta * 100).toFixed(0)}% p.a.
                </div>
              </div>
            </div>
            <p className="text-xs font-sans mt-3 italic" style={{ color: C.inkSoft }}>
              Band derived from five domain scores. Set scores in the <strong>Infrastructure</strong> tab.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <Label hint="Aᵢ(t) = Exposure × Utilisation × Absorption">Adoption ramp (decomposed)</Label>
          <div className="p-4 border" style={{ borderColor: C.rule, background: C.cream }}>
            <div className="grid gap-1 mb-3" style={{ gridTemplateColumns: `170px repeat(${s.timeHorizon}, minmax(0, 1fr))` }}>
              <div />
              {Array.from({ length: s.timeHorizon }).map((_, i) => (
                <div key={i} className="smcaps text-xs font-sans text-center" style={{ color: C.inkMid, fontWeight: 600 }}>
                  Year {i + 1}
                </div>
              ))}
            </div>
            <AdoptionRow
              label="Exposure"
              sublabel="access to tool"
              values={s.exposure}
              T={s.timeHorizon}
              onChange={(v) => update({ exposure: v })}
            />
            <AdoptionRow
              label="Utilisation"
              sublabel="benefit captured per user"
              values={s.utilisation}
              T={s.timeHorizon}
              onChange={(v) => update({ utilisation: v })}
            />
            <AdoptionRow
              label="Absorption"
              sublabel="indiv. → org savings"
              values={s.absorption}
              T={s.timeHorizon}
              onChange={(v) => update({ absorption: v })}
            />
            <div className="grid gap-1 mt-3 pt-3 border-t" style={{ gridTemplateColumns: `170px repeat(${s.timeHorizon}, minmax(0, 1fr))`, borderColor: C.ink }}>
              <div>
                <div className="smcaps text-xs font-sans font-semibold" style={{ color: C.accent }}>= Effective Aᵢ(t)</div>
                <div className="font-mono text-xs italic" style={{ color: C.inkSoft }}>derived product</div>
              </div>
              {Array.from({ length: s.timeHorizon }).map((_, i) => {
                const eff = (s.exposure[i] ?? 1) * (s.utilisation[i] ?? 1) * (s.absorption[i] ?? 1);
                return (
                  <div key={i} className="text-center">
                    <div className="font-serif text-xl font-semibold tabular" style={{ color: C.accent }}>
                      {(eff * 100).toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs font-sans mt-3 italic" style={{ color: C.inkSoft }}>
            Aᵢ(t) decomposed: <strong>Exposure</strong> (who has access) ×
            <strong> Utilisation</strong> (how well they use it) ×
            <strong> Absorption</strong> (how efficiently individual benefit converts to organisational savings).
            The single-curve approach conflates these three and systematically understates the adoption cost.
            See <strong>Evidence</strong> tab for profile curves.
          </p>
        </div>
      </div>

      {/* ─── Cost side ─────────────────────────────────────────── */}
      <div>
        <SectionHeader num="3" title="Cost Side" kicker="Σⱼ ( Cⱼ + Rⱼt + Gⱼt + Mⱼ·(1+δ)ᵗ ) + PV(SO)" />
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-3">
            <Label hint="Cⱼ one-time">Build & integration</Label>
            <Input value={s.Cj} step="1000" onChange={(v) => update({ Cj: v })} />
          </div>
          <div className="col-span-3">
            <Label hint="Rⱼ annual">Run & licensing</Label>
            <Input value={s.Rjt_annual} step="1000" onChange={(v) => update({ Rjt_annual: v })} />
          </div>
          <div className="col-span-3">
            <Label hint="Gⱼ annual">Governance & risk</Label>
            <Input value={s.Gjt_annual} step="1000" onChange={(v) => update({ Gjt_annual: v })} />
          </div>
          <div className="col-span-3">
            <Label hint="Mⱼ base annual">Maintenance (base)</Label>
            <Input value={s.Mj} step="1000" onChange={(v) => update({ Mj: v })} />
          </div>

          <div className="col-span-6">
            <Label hint="δ — Design Debt Cascade">Maintenance compounding rate (derived)</Label>
            <div className="p-4 border" style={{ borderColor: C.rule, background: C.cream }}>
              <div className="flex items-baseline justify-between">
                <div className="font-serif text-3xl font-semibold tabular" style={{ color: C.ink }}>
                  {(s.delta * 100).toFixed(1)}<span style={{ fontSize: '18px', color: C.inkSoft }}>% p.a.</span>
                </div>
                <div className="text-right">
                  <div className="smcaps text-xs" style={{ color: C.inkMid, fontWeight: 600 }}>from ITI band</div>
                  <div className="font-mono text-xs tabular" style={{ color: ITI_BANDS[s.itiBand].color }}>
                    {ITI_BANDS[s.itiBand].label}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs font-sans mt-2 italic" style={{ color: C.inkSoft }}>
              Derived from ITI composite. Green 5%, Amber 10%, Red 15% p.a. Compounds annually
              through accumulated Application Design Debt.
            </p>
          </div>

          <div className="col-span-6">
            <Label hint="EFI → PV(SO) — derived from seven EFI domain scores">Exit Feasibility Index (EFI)</Label>
            <div className="grid grid-cols-3 gap-0 border" style={{ borderColor: C.rule }}>
              {Object.entries(EFI_BANDS).map(([k, v]) => (
                <div key={k}
                  className="px-3 py-3 text-left"
                  style={{
                    background: s.efiBand === k ? v.color : C.cream,
                    color: s.efiBand === k ? C.cream : C.ink,
                    borderRight: k !== 'red' ? `1px solid ${C.rule}` : 'none',
                    opacity: s.efiBand === k ? 1 : 0.55,
                  }}>
                  <div className="font-serif text-lg font-semibold leading-none">{v.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 text-xs font-mono" style={{ color: C.inkMid }}>
              <div>
                <div className="smcaps" style={{ fontWeight: 600 }}>Composite</div>
                <div className="font-serif text-xl tabular" style={{ color: C.ink, marginTop: 2 }}>
                  {s.efiComposite.toFixed(1)} / 5.0
                </div>
              </div>
              <div>
                <div className="smcaps" style={{ fontWeight: 600 }}>PV(SO)</div>
                <div className="font-serif text-xl tabular" style={{ color: C.ink, marginTop: 2 }}>
                  {f(s.PV_SO)}
                </div>
              </div>
            </div>
            <p className="text-xs font-sans mt-2 italic" style={{ color: C.inkSoft }}>
              Band derived from seven domain scores. Set scores in the <strong>Infrastructure</strong> tab.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADOPTION ROW (for decomposed 3-curve input in Setup) ────────────────
function AdoptionRow({ label, sublabel, values, T, onChange }) {
  const setAt = (i, v) => {
    const clamped = Math.max(0, Math.min(1, v));
    const next = [...values];
    next[i] = clamped;
    onChange(next);
  };
  return (
    <div className="grid gap-1 py-2 items-center" style={{ gridTemplateColumns: `170px repeat(${T}, minmax(0, 1fr))` }}>
      <div>
        <div className="font-serif font-semibold" style={{ color: C.ink, fontSize: '14px' }}>{label}</div>
        <div className="font-mono text-xs italic" style={{ color: C.inkSoft, fontSize: '10px' }}>{sublabel}</div>
      </div>
      {Array.from({ length: T }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <input type="range" min={0.05} max={1} step={0.05}
            value={values[i] ?? 1}
            onChange={(e) => setAt(i, parseFloat(e.target.value))}
            style={{ accentColor: C.ink, width: '100%' }} />
          <div className="font-mono text-xs tabular" style={{ color: C.ink }}>
            {((values[i] ?? 1) * 100).toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── FINANCE VIEW ─────────────────────────────────────────────────────────
function FinanceView({ s, calc, f }) {
  const chartData = calc.yearlyBenefits.map((b, i) => ({
    year: `Year ${b.year}`,
    Benefit: Math.round(b.value),
    Cost: Math.round(
      (calc.yearlyCosts[i]?.build || 0) +
      calc.yearlyCosts[i].run +
      calc.yearlyCosts[i].gov +
      calc.yearlyCosts[i].maint +
      (calc.yearlyCosts[i]?.optionality || 0)
    ),
  }));

  return (
    <div className="space-y-12">
      <div>
        <SectionHeader num="I" title="The Bottom Line" kicker="For the CFO · P10 / P50 / P90" />

        {/* Headline: Naive vs Distribution */}
        <div className="grid grid-cols-12 gap-8 mb-8">
          <div className="col-span-4 p-6 border" style={{ borderColor: C.rule, background: C.cream }}>
            <div className="smcaps text-xs font-sans mb-2" style={{ color: C.inkMid }}>Vendor Narrative</div>
            <div className="font-serif text-xs italic mb-3" style={{ color: C.inkSoft }}>
              Deterministic. Claim × duration vs build + licence.
            </div>
            <ROIBadge roi={calc.roiNaive} size="md" />
            <div className="font-mono text-xs mt-3 tabular" style={{ color: C.inkMid }}>
              {f(calc.naiveBenefit)} − {f(calc.naiveCost)} = {f(calc.netNaive)}
            </div>
          </div>

          <div className="col-span-8 p-6 border-2" style={{ borderColor: C.ink, background: C.paperDeep }}>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div className="smcaps text-xs font-sans" style={{ color: C.accent, fontWeight: 700 }}>Honest Formula — P50 ROI</div>
                <div className="font-serif text-xs italic" style={{ color: C.inkSoft }}>
                  Monte Carlo, {N_SAMPLES.toLocaleString()} samples · all variables stochastic
                </div>
              </div>
              <div className="text-right">
                <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>Prob. &gt; hurdle ({s.hurdleRate}%)</div>
                <div className="font-serif text-3xl font-semibold tabular" style={{
                  color: calc.roi.probExceeds(s.hurdleRate) >= 0.5 ? C.green : calc.roi.probExceeds(s.hurdleRate) >= 0.25 ? C.amber : C.red,
                }}>
                  {(calc.roi.probExceeds(s.hurdleRate) * 100).toFixed(0)}%
                </div>
              </div>
            </div>
            <ROIBadge roi={calc.roi.p50} size="lg" />
            <div className="mt-4 grid grid-cols-3 gap-6 pt-4 border-t" style={{ borderColor: C.rule }}>
              <PercentileBox label="P10" value={calc.roi.p10} subtitle="Pessimistic — 10%" />
              <PercentileBox label="P50" value={calc.roi.p50} subtitle="Median expectation" emphasis />
              <PercentileBox label="P90" value={calc.roi.p90} subtitle="Optimistic — 90%" />
            </div>
          </div>
        </div>

        {/* ROI Distribution histogram */}
        <div className="p-6 border" style={{ borderColor: C.rule, background: C.cream }}>
          <div className="smcaps text-xs font-sans mb-1" style={{ color: C.inkMid, fontWeight: 700 }}>
            ROI Distribution · {N_SAMPLES.toLocaleString()} Monte Carlo samples
          </div>
          <div className="font-serif italic mb-4" style={{ color: C.inkSoft, fontSize: '13px' }}>
            Each sample draws all stochastic variables from their calibrated distributions. Colour bands:
            red &lt; 0% (negative return) · amber 0–{s.hurdleRate}% (positive but below CFO hurdle) · green &gt; {s.hurdleRate}% (hurdle cleared).
          </div>
          <DistributionChart samples={calc.roi.samples}
            p10={calc.roi.p10} p50={calc.roi.p50} p90={calc.roi.p90}
            hurdle={s.hurdleRate} />
          <div className="grid grid-cols-3 gap-8 mt-4 pt-4 border-t" style={{ borderColor: C.rule }}>
            <div>
              <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>Prob. ROI &gt; 0%</div>
              <div className="font-mono text-2xl tabular mt-1" style={{ color: calc.roi.probPositive >= 0.5 ? C.green : C.red }}>
                {(calc.roi.probPositive * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>Prob. ROI &gt; hurdle ({s.hurdleRate}%)</div>
              <div className="font-mono text-2xl tabular mt-1" style={{ color: calc.roi.probExceeds(s.hurdleRate) >= 0.5 ? C.green : calc.roi.probExceeds(s.hurdleRate) >= 0.25 ? C.amber : C.inkMid }}>
                {(calc.roi.probExceeds(s.hurdleRate) * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>80% CI width</div>
              <div className="font-mono text-2xl tabular mt-1" style={{ color: C.inkMid }}>
                {(calc.roi.p90 - calc.roi.p10).toFixed(0)} pp
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 p-6 border-l-4 font-serif italic" style={{ borderColor: C.accent, background: C.cream, color: C.ink, fontSize: '17px', lineHeight: '1.6' }}>
          "The formula does not say 'do not proceed.' It identifies the precise structural conditions
          that must improve before this deployment creates value." Distribution outputs extend this: the
          80% confidence interval shows the <em>range</em> of outcomes consistent with the inputs — a single
          ROI number is always a point on that distribution, not a prediction.
        </div>
      </div>

      {/* Vi Sensitivity — how does verdict change with vendor claim size? */}
      <div>
        <SectionHeader num="II" title="Vi Sensitivity" kicker="How the verdict depends on vendor claim" />
        <p className="font-serif italic mb-6" style={{ color: C.inkMid, fontSize: '16px' }}>
          The ROI is not fixed by the structural variables alone — it depends on the scale of the vendor's
          value claim (Vᵢ). Small POCs struggle to clear the CFO hurdle even under Green infrastructure
          conditions, because costs scale linearly while benefits are multiplied by the structural discount chain.
          This panel shows where your project sits on that curve — and what Vᵢ would need to be to pass hurdle.
        </p>
        <ViSensitivityPanel s={s} f={f} />
      </div>

      {/* Year-by-year */}
      <div>
        <SectionHeader num="III" title="Year by Year" kicker="Benefit decomposition" />
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm tabular">
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.ink}` }}>
                <th className="text-left py-3 font-sans smcaps text-xs" style={{ color: C.inkMid, fontWeight: 700 }}>Component</th>
                {calc.yearlyBenefits.map((b) => (
                  <th key={b.year} className="text-right py-3 font-sans smcaps text-xs" style={{ color: C.inkMid, fontWeight: 700 }}>Year {b.year}</th>
                ))}
                <th className="text-right py-3 font-sans smcaps text-xs" style={{ color: C.ink, fontWeight: 700, borderLeft: `2px solid ${C.ink}`, paddingLeft: '16px' }}>Σ</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: `1px solid ${C.ruleSoft}` }}>
                <td className="py-2">Vᵢ (vendor claim, gross)</td>
                {calc.yearlyBenefits.map((b) => <td key={b.year} className="text-right">{f(s.Vi)}</td>)}
                <td className="text-right" style={{ borderLeft: `2px solid ${C.ink}`, paddingLeft: '16px' }}>{f(s.Vi * s.timeHorizon)}</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${C.ruleSoft}`, color: C.inkSoft }}>
                <td className="py-2 italic">× pᵢ · f(ITI) · αᵢ</td>
                {calc.yearlyBenefits.map((b) => <td key={b.year} className="text-right">× {b.combinedFactor.toFixed(3)}</td>)}
                <td className="text-right" style={{ borderLeft: `2px solid ${C.ink}`, paddingLeft: '16px' }}>—</td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${C.ruleSoft}`, color: C.inkSoft }}>
                <td className="py-2 italic">× (1−dᵢ)ᵗ decay</td>
                {calc.yearlyBenefits.map((b) => <td key={b.year} className="text-right">× {b.decayFactor.toFixed(3)}</td>)}
                <td className="text-right" style={{ borderLeft: `2px solid ${C.ink}`, paddingLeft: '16px' }}>—</td>
              </tr>
              <tr style={{ borderBottom: `2px solid ${C.ink}`, color: C.inkSoft }}>
                <td className="py-2 italic">× Aᵢ(t) adoption</td>
                {calc.yearlyBenefits.map((b) => <td key={b.year} className="text-right">× {b.adoption.toFixed(2)}</td>)}
                <td className="text-right" style={{ borderLeft: `2px solid ${C.ink}`, paddingLeft: '16px' }}>—</td>
              </tr>
              <tr style={{ borderBottom: `3px double ${C.ink}` }}>
                <td className="py-3 font-semibold" style={{ color: C.ink }}>= Adjusted benefit</td>
                {calc.yearlyBenefits.map((b) => (
                  <td key={b.year} className="text-right font-semibold" style={{ color: C.green }}>{f(b.value)}</td>
                ))}
                <td className="text-right font-semibold" style={{ color: C.green, borderLeft: `2px solid ${C.ink}`, paddingLeft: '16px' }}>{f(calc.totalBenefit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost table */}
      <div>
        <SectionHeader num="IV" title="Cost Structure" kicker="Cost decomposition" />
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm tabular">
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.ink}` }}>
                <th className="text-left py-3 font-sans smcaps text-xs" style={{ color: C.inkMid, fontWeight: 700 }}>Item</th>
                {calc.yearlyCosts.map((c) => (
                  <th key={c.year} className="text-right py-3 font-sans smcaps text-xs" style={{ color: C.inkMid, fontWeight: 700 }}>Year {c.year}</th>
                ))}
                <th className="text-right py-3 font-sans smcaps text-xs" style={{ color: C.ink, fontWeight: 700, borderLeft: `2px solid ${C.ink}`, paddingLeft: '16px' }}>Σ</th>
              </tr>
            </thead>
            <tbody>
              <CostRow label="Cⱼ · Build & integration" row="build" calc={calc} f={f} total={calc.buildCost} />
              <CostRow label="Rⱼt · Run & licensing" row="run" calc={calc} f={f} total={calc.runCost} />
              <CostRow label="Gⱼt · Governance & risk" row="gov" calc={calc} f={f} total={calc.govCost} />
              <CostRow label={`Mⱼ·(1+δ)ᵗ · Maintenance (δ = ${(s.delta * 100).toFixed(1)}%)`} row="maint" calc={calc} f={f} total={calc.maintCost} highlight />
              <CostRow label="PV(SO) · Optionality erosion" row="optionality" calc={calc} f={f} total={s.PV_SO} />
              <tr style={{ borderTop: `3px double ${C.ink}` }}>
                <td className="py-3 font-semibold" style={{ color: C.ink }}>Σ Total cost</td>
                {calc.yearlyCosts.map((c) => {
                  const total = (c.build || 0) + c.run + c.gov + c.maint + (c.optionality || 0);
                  return <td key={c.year} className="text-right font-semibold" style={{ color: C.red }}>{f(total)}</td>;
                })}
                <td className="text-right font-semibold" style={{ color: C.red, borderLeft: `2px solid ${C.ink}`, paddingLeft: '16px' }}>{f(calc.totalCost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart: Benefit vs Cost */}
      <div>
        <SectionHeader num="IV" title="Flow Over Time" kicker="Benefit vs cost per year" />
        <div style={{ height: 340, background: C.cream, padding: '24px', border: `1px solid ${C.rule}` }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.ruleSoft} vertical={false} />
              <XAxis dataKey="year" tick={{ fill: C.ink, fontFamily: 'IBM Plex Mono', fontSize: 12 }} axisLine={{ stroke: C.ink }} />
              <YAxis tick={{ fill: C.ink, fontFamily: 'IBM Plex Mono', fontSize: 11 }} axisLine={{ stroke: C.ink }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={{ background: C.cream, border: `1px solid ${C.ink}`, fontFamily: 'IBM Plex Mono', fontSize: 12 }}
                formatter={(v) => f(v)} />
              <Bar dataKey="Benefit" fill={C.green} />
              <Bar dataKey="Cost" fill={C.red} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function CostRow({ label, row, calc, f, total, highlight }) {
  return (
    <tr style={{ borderBottom: `1px solid ${C.ruleSoft}`, background: highlight ? C.paperDeep : 'transparent' }}>
      <td className="py-2">{label}</td>
      {calc.yearlyCosts.map((c) => (
        <td key={c.year} className="text-right">{c[row] ? f(c[row]) : '—'}</td>
      ))}
      <td className="text-right font-semibold" style={{ borderLeft: `2px solid ${C.ink}`, paddingLeft: '16px' }}>{f(total)}</td>
    </tr>
  );
}

// ─── INFRASTRUCTURE VIEW ──────────────────────────────────────────────────
function InfraView({ s, calc, update, f }) {
  const iti = ITI_BANDS[s.itiBand];
  const efi = EFI_BANDS[s.efiBand];

  // How much benefit is being lost to infrastructure
  const idealBenefit = s.Vi * s.pi * s.alphaI * s.timeHorizon;
  const fITIPenalty = idealBenefit - (idealBenefit * s.fITI);
  const compoundingPenalty = calc.maintCost - (s.Mj * s.timeHorizon);

  const updateItiScore = (id, v) => {
    update({ iti_scores: { ...s.iti_scores, [id]: v } });
  };
  const updateEfiScore = (id, v) => {
    update({ efi_scores: { ...s.efi_scores, [id]: v } });
  };

  return (
    <div className="space-y-12">
      {/* ─── ITI DOMAIN SCORING ───────────────────────────────────────── */}
      <div>
        <SectionHeader num="I" title="Score Your Infrastructure" kicker="ITI — five domains · traffic-light output is derived" />
        <p className="font-serif italic mb-6" style={{ color: C.inkMid, fontSize: '16px' }}>
          Score each domain on a 0–5 scale. The band (GREEN / AMBER / RED) and the f(ITI) discount
          are <em>derived</em> from the composite mean — the output is a consequence of the scores, not a guess.
        </p>
        <DomainScoringPanel
          domains={ITI_DOMAINS}
          scores={s.iti_scores}
          onChange={updateItiScore}
          composite={s.itiComposite}
          band={s.itiBand}
          bands={ITI_BANDS}
          derivedLabel="f(ITI)"
          derivedValue={s.fITI.toFixed(2)}
          derivedSecondary={`δ = ${(s.delta * 100).toFixed(0)}% p.a.`}
        />
      </div>

      {/* ─── EFI DOMAIN SCORING ───────────────────────────────────────── */}
      <div>
        <SectionHeader num="II" title="Score Your Exit Feasibility" kicker="EFI — seven domains · PV(SO) is derived" />
        <p className="font-serif italic mb-6" style={{ color: C.inkMid, fontSize: '16px' }}>
          Score each domain on a 0–5 scale. Higher scores = higher exit feasibility = lower structural
          optionality erosion. PV(SO) is derived from the composite and the scale of Build + Run costs.
        </p>
        <DomainScoringPanel
          domains={EFI_DOMAINS}
          scores={s.efi_scores}
          onChange={updateEfiScore}
          composite={s.efiComposite}
          band={s.efiBand}
          bands={EFI_BANDS}
          derivedLabel="PV(SO)"
          derivedValue={f(s.PV_SO)}
          derivedSecondary={`${((s.PV_SO / (s.Cj + s.Rjt_annual * s.timeHorizon)) * 100).toFixed(1)}% of Build+Run`}
        />
      </div>

      <div>
        <SectionHeader num="III" title="DTRM Dashboard" kicker="Digital Transformation Resilience Model" />
        <p className="font-serif italic mb-6" style={{ color: C.inkMid, fontSize: '16px' }}>
          Three formula variables — f(ITI), δ, PV(SO) — are derived from the scoring above.
          They show precisely <em>where</em> the organisation must act before deployment.
        </p>

        <div className="grid grid-cols-2 gap-6">
          {/* ITI Panel */}
          <div className="border-2 p-6" style={{ borderColor: iti.color, background: C.cream }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 700 }}>Infrastructure Trust Index</div>
                <div className="font-serif text-2xl font-semibold" style={{ color: C.ink }}>ITI → f(ITI)</div>
              </div>
              <div className="text-right">
                <div className="font-serif text-5xl font-semibold tabular" style={{ color: iti.color }}>{iti.label}</div>
                <div className="font-mono text-xs mt-1" style={{ color: C.inkMid }}>Score {iti.score}</div>
              </div>
            </div>
            <p className="font-serif italic mb-4" style={{ color: C.inkMid, fontSize: '15px' }}>{iti.desc}</p>
            <div className="grid grid-cols-2 gap-4 font-mono text-sm">
              <div>
                <div className="smcaps text-xs" style={{ color: C.inkMid }}>Benefit discount</div>
                <div className="text-2xl tabular mt-1" style={{ color: C.ink }}>× {s.fITI.toFixed(2)}</div>
              </div>
              <div>
                <div className="smcaps text-xs" style={{ color: C.inkMid }}>Benefit loss / horizon</div>
                <div className="text-2xl tabular mt-1" style={{ color: C.red }}>{f(fITIPenalty)}</div>
              </div>
            </div>
            <Rule style={{ margin: '16px 0' }} />
            <div className="smcaps text-xs font-sans mb-2" style={{ color: C.inkMid, fontWeight: 600 }}>ITI dimensions (5)</div>
            <ul className="font-sans text-sm space-y-1" style={{ color: C.ink }}>
              <li>· Provenance reconstructability</li>
              <li>· Semantic consistency</li>
              <li>· Integration determinism</li>
              <li>· Transformation transparency</li>
              <li>· Change observability</li>
            </ul>
          </div>

          {/* EFI Panel */}
          <div className="border-2 p-6" style={{ borderColor: efi.color, background: C.cream }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 700 }}>Exit Feasibility Index</div>
                <div className="font-serif text-2xl font-semibold" style={{ color: C.ink }}>EFI → PV(SO)</div>
              </div>
              <div className="text-right">
                <div className="font-serif text-5xl font-semibold tabular" style={{ color: efi.color }}>{efi.label}</div>
              </div>
            </div>
            <p className="font-serif italic mb-4" style={{ color: C.inkMid, fontSize: '15px' }}>{efi.desc}</p>
            <div className="font-mono text-sm">
              <div className="smcaps text-xs" style={{ color: C.inkMid }}>Structural optionality erosion</div>
              <div className="text-3xl tabular mt-1" style={{ color: C.red }}>{f(s.PV_SO)}</div>
            </div>
            <Rule style={{ margin: '16px 0' }} />
            <div className="smcaps text-xs font-sans mb-2" style={{ color: C.inkMid, fontWeight: 600 }}>EFI dimensions (7)</div>
            <ul className="font-sans text-sm space-y-1" style={{ color: C.ink }}>
              <li>· Data portability</li>
              <li>· Contractual exit terms</li>
              <li>· Integration reversibility</li>
              <li>· Model transparency</li>
              <li>· Proprietary lock-in depth</li>
              <li>· Skills dependency</li>
              <li>· Regulatory handover</li>
            </ul>
          </div>
        </div>
      </div>

      {/* DDC Panel */}
      <div>
        <SectionHeader num="IV" title="Design Debt Cascade" kicker="δ · Maintenance compounding" />
        <div className="p-6 border" style={{ borderColor: C.rule, background: C.cream }}>
          <p className="font-serif italic mb-6" style={{ color: C.inkMid, fontSize: '16px' }}>
            Maintenance costs do not stay flat. Where Application Design Debt (ADD) exists —
            typically from decisions that prioritised delivery speed over architectural integrity — they compound year on year.
          </p>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${s.timeHorizon}, minmax(0, 1fr))` }}>
            {calc.yearlyCosts.map((c) => (
              <div key={c.year} className="p-4 border text-center" style={{ borderColor: C.rule, background: C.paper }}>
                <div className="smcaps text-xs" style={{ color: C.inkMid }}>Year {c.year}</div>
                <div className="font-serif text-2xl font-semibold mt-2 tabular" style={{ color: C.ink }}>{f(c.maint)}</div>
                {c.year > 1 && (
                  <div className="font-mono text-xs mt-1" style={{ color: C.red }}>
                    +{fmtPct(((c.maint / s.Mj) - 1) * 100, 1)} vs base
                  </div>
                )}
              </div>
            ))}
          </div>
          <Rule style={{ margin: '24px 0 16px' }} />
          <div className="flex items-baseline justify-between font-mono text-sm">
            <span className="smcaps font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>Hidden cost through δ</span>
            <span className="tabular" style={{ color: C.red, fontSize: '18px' }}>{f(compoundingPenalty)}</span>
          </div>
          <p className="text-xs font-sans mt-2 italic" style={{ color: C.inkSoft }}>
            What a naive business case with flat maintenance assumption misses.
          </p>
        </div>
      </div>

      {/* Infrastructure checklist */}
      <div>
        <SectionHeader num="V" title="Pre-Deployment Checklist" kicker="Actions before contract signature" />
        <div className="space-y-3">
          {[
            { cond: s.itiBand !== 'green', text: 'Raise ITI to GREEN band. Invest in provenance reconstructability & semantic governance.', severity: s.itiBand === 'red' ? 'red' : 'amber' },
            { cond: s.efiBand !== 'green', text: 'Negotiate exit clauses and interoperability standards before contract signature.', severity: s.efiBand === 'red' ? 'red' : 'amber' },
            { cond: (s.adoption[0] ?? 1) < 0.35, text: 'Increase change management budget. Target: ≥ 35% Year-1 effective adoption (decomposed model).', severity: (s.adoption[0] ?? 1) < 0.20 ? 'red' : 'amber' },
            { cond: s.delta > 0.1, text: 'Maintenance compounding rate (δ > 10%) indicates structural ADD. Architecture review recommended.', severity: s.delta > 0.15 ? 'red' : 'amber' },
            { cond: s.pi > 0.8, text: 'Realisation probability > 80%. Sanity check: does this match industry benchmarks?', severity: 'amber' },
          ].filter(r => r.cond).map((r, i) => (
            <div key={i} className="flex items-start gap-4 p-4 border-l-4" style={{
              borderColor: r.severity === 'red' ? C.red : C.amber,
              background: C.cream,
            }}>
              <div className="smcaps text-xs font-sans font-bold" style={{ color: r.severity === 'red' ? C.red : C.amber, minWidth: 56 }}>
                {r.severity.toUpperCase()}
              </div>
              <div className="font-serif" style={{ color: C.ink, fontSize: '15px' }}>{r.text}</div>
            </div>
          ))}
          {[s.itiBand === 'green', s.efiBand === 'green', (s.adoption[0] ?? 1) >= 0.35].every(Boolean) && (
            <div className="flex items-start gap-4 p-4 border-l-4" style={{ borderColor: C.green, background: C.cream }}>
              <div className="smcaps text-xs font-sans font-bold" style={{ color: C.green, minWidth: 56 }}>GREEN</div>
              <div className="font-serif" style={{ color: C.ink, fontSize: '15px' }}>
                All structural preconditions met. Deployment can proceed with standard governance.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DOMAIN SCORING PANEL ─────────────────────────────────────────────────
// Reusable panel that renders one row per domain (question + 0–5 slider +
// rubric description) plus a footer summarising composite, band, and derived
// formula value. Used for both ITI (5 domains) and EFI (7 domains).
//
// Domains with `subquestions` render as expandable rows with one sub-row per
// sub-question. The domain's displayed score is the mean of its sub-scores.
// A foundational-gap warning surfaces when any individual sub-score is < 2.0,
// preserving visibility of weak spots that the mean would otherwise mask.
function DomainScoringPanel({ domains, scores, onChange, composite, band, bands, derivedLabel, derivedValue, derivedSecondary }) {
  const bandInfo = bands[band];
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  return (
    <div className="border-2" style={{ borderColor: bandInfo.color, background: C.cream }}>
      <div>
        {domains.map((d, i) => {
          const { score, min, isSubScored } = domainScore(d, scores);
          const levelIdx = Math.min(5, Math.max(0, Math.round(score)));
          const scoreBand = bandFromComposite(score);
          const scoreColor = bands[scoreBand]?.color ?? C.inkMid;
          const hasGap = isSubScored && min < 2.0;
          const isExpanded = expanded[d.id] ?? false;

          return (
            <div key={d.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.ruleSoft}` }}>
              {/* Header row: domain label + current score + expand toggle for sub-questioned */}
              <div className="grid gap-6 px-6 py-5 items-start"
                style={{ gridTemplateColumns: '1fr 320px' }}>
                <div>
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="font-serif font-semibold" style={{ color: C.ink, fontSize: '16px' }}>
                      {d.label}
                    </span>
                    <span className="smcaps text-xs font-sans" style={{ color: C.inkSoft }}>
                      domain {i + 1}
                    </span>
                    {isSubScored && (
                      <span className="smcaps text-xs font-sans px-2 py-0.5 border"
                        style={{ color: C.accent, borderColor: C.accent, fontWeight: 600, fontSize: '10px' }}>
                        {d.subquestions.length} sub-questions
                      </span>
                    )}
                    {hasGap && (
                      <span className="smcaps text-xs font-sans px-2 py-0.5"
                        style={{ color: C.cream, background: C.red, fontWeight: 700, fontSize: '10px' }}>
                        Foundational gap
                      </span>
                    )}
                  </div>
                  <div className="font-serif italic" style={{ color: C.inkMid, fontSize: '13px', lineHeight: '1.5', marginBottom: '8px' }}>
                    {d.question}
                  </div>

                  {/* For scalar domains: show the current rubric level inline.
                      For sub-questioned domains: show a one-line summary + expand affordance. */}
                  {!isSubScored ? (
                    <div className="p-3 border-l-2 font-sans"
                      style={{ borderColor: scoreColor, background: C.paper, color: C.ink, fontSize: '13px', lineHeight: '1.5' }}>
                      <span className="smcaps text-xs font-semibold" style={{ color: scoreColor }}>
                        Level {levelIdx}
                      </span>
                      <span> — {d.levels[levelIdx]}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => toggle(d.id)}
                      className="font-sans text-sm px-3 py-2 border transition-colors text-left"
                      style={{
                        borderColor: C.rule,
                        background: isExpanded ? C.paperDeep : C.paper,
                        color: C.ink,
                        cursor: 'pointer',
                        width: '100%',
                      }}>
                      <span className="smcaps text-xs font-semibold" style={{ color: C.accent }}>
                        {isExpanded ? '▼ Collapse' : '▶ Expand'}
                      </span>
                      <span> — score each of the {d.subquestions.length} sub-questions individually</span>
                    </button>
                  )}
                </div>

                {/* Right: composite score display + mini band ladder */}
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>
                      {isSubScored ? 'Domain score (mean)' : 'Score'}
                    </span>
                    <div className="flex items-baseline gap-3">
                      <span className="font-serif text-3xl font-semibold tabular" style={{ color: scoreColor }}>
                        {score.toFixed(1)}
                      </span>
                      <span className="font-mono text-xs" style={{ color: C.inkSoft }}>/ 5.0</span>
                    </div>
                  </div>

                  {/* Scalar domains: editable slider. Sub-scored domains: read-only bar. */}
                  {!isSubScored ? (
                    <>
                      <input type="range" min="0" max="5" step="0.5"
                        value={score}
                        onChange={(e) => onChange(d.id, parseFloat(e.target.value))}
                        style={{ accentColor: scoreColor, width: '100%' }} />
                      <div className="flex justify-between font-mono text-xs mt-1" style={{ color: C.inkSoft }}>
                        <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full border" style={{ borderColor: C.rule, height: 10, background: C.paper, position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${(score / 5) * 100}%`,
                        background: scoreColor,
                      }} />
                    </div>
                  )}

                  {/* Mini band ladder */}
                  <div className="flex mt-3 gap-0 border" style={{ borderColor: C.rule, height: 8 }}>
                    <div style={{ flex: '0 0 50%', background: scoreBand === 'red' ? C.red : C.redSoft, opacity: scoreBand === 'red' ? 1 : 0.25 }} />
                    <div style={{ flex: '0 0 30%', background: scoreBand === 'amber' ? C.amber : C.amberSoft, opacity: scoreBand === 'amber' ? 1 : 0.25 }} />
                    <div style={{ flex: '0 0 20%', background: scoreBand === 'green' ? C.green : C.greenSoft, opacity: scoreBand === 'green' ? 1 : 0.25 }} />
                  </div>

                  {hasGap && (
                    <div className="mt-2 font-mono text-xs italic" style={{ color: C.red }}>
                      ⚠ lowest sub-score: {min.toFixed(1)} — average may hide weakness
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-question rows (expanded) */}
              {isSubScored && isExpanded && (
                <div style={{ background: C.paper, borderTop: `1px solid ${C.ruleSoft}` }}>
                  {d.subquestions.map((sq, j) => {
                    const subVal = scores?.[d.id]?.[sq.id] ?? 3;
                    const subLevelIdx = Math.min(5, Math.max(0, Math.round(subVal)));
                    const subBand = bandFromComposite(subVal);
                    const subColor = bands[subBand]?.color ?? C.inkMid;
                    return (
                      <div key={sq.id}
                        className="grid gap-6 px-10 py-4 items-start"
                        style={{
                          gridTemplateColumns: '1fr 320px',
                          borderTop: j === 0 ? 'none' : `1px dotted ${C.ruleSoft}`,
                        }}>
                        <div>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="smcaps text-xs font-sans" style={{ color: C.inkSoft, fontWeight: 600 }}>
                              {d.id.toUpperCase()}·{j + 1}
                            </span>
                            <span className="font-serif font-semibold" style={{ color: C.ink, fontSize: '14px' }}>
                              {sq.label}
                            </span>
                          </div>
                          <div className="font-serif italic" style={{ color: C.inkMid, fontSize: '12px', lineHeight: '1.5', marginBottom: '6px' }}>
                            {sq.question}
                          </div>
                          <div className="p-2 border-l-2 font-sans"
                            style={{ borderColor: subColor, background: C.cream, color: C.ink, fontSize: '12px', lineHeight: '1.5' }}>
                            <span className="smcaps text-xs font-semibold" style={{ color: subColor }}>
                              Level {subLevelIdx}
                            </span>
                            <span> — {sq.levels[subLevelIdx]}</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-baseline justify-between mb-2">
                            <span className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>
                              Score
                            </span>
                            <div className="flex items-baseline gap-2">
                              <span className="font-serif text-2xl font-semibold tabular" style={{ color: subColor }}>
                                {subVal.toFixed(1)}
                              </span>
                              <span className="font-mono text-xs" style={{ color: C.inkSoft }}>/ 5.0</span>
                            </div>
                          </div>
                          <input type="range" min="0" max="5" step="0.5"
                            value={subVal}
                            onChange={(e) => {
                              const newVal = parseFloat(e.target.value);
                              const currentDomainScores = scores?.[d.id];
                              const updatedDomain = typeof currentDomainScores === 'object' && currentDomainScores !== null
                                ? { ...currentDomainScores, [sq.id]: newVal }
                                : { [sq.id]: newVal };
                              onChange(d.id, updatedDomain);
                            }}
                            style={{ accentColor: subColor, width: '100%' }} />
                          <div className="flex justify-between font-mono text-xs mt-1" style={{ color: C.inkSoft }}>
                            <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: composite + band + derived value */}
      <div className="grid gap-6 px-6 py-5 items-center"
        style={{
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          background: C.paperDeep,
          borderTop: `3px double ${C.ink}`,
        }}>
        <div>
          <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 700 }}>Composite score</div>
          <div className="font-serif text-3xl font-semibold tabular mt-1" style={{ color: C.ink }}>
            {composite.toFixed(2)}<span style={{ fontSize: '16px', color: C.inkSoft }}> / 5.0</span>
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: C.inkSoft }}>
            unweighted mean of domain scores
          </div>
        </div>
        <div>
          <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 700 }}>Band (derived)</div>
          <div className="font-serif text-3xl font-semibold tabular mt-1" style={{ color: bandInfo.color }}>
            {bandInfo.label}
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: C.inkSoft }}>
            {band === 'green' ? '≥ 4.0' : band === 'amber' ? '2.5 – 3.9' : '< 2.5'}
          </div>
        </div>
        <div>
          <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 700 }}>{derivedLabel} (derived)</div>
          <div className="font-serif text-3xl font-semibold tabular mt-1" style={{ color: C.ink }}>
            {derivedValue}
          </div>
          {derivedSecondary && (
            <div className="font-mono text-xs mt-1" style={{ color: C.inkSoft }}>
              {derivedSecondary}
            </div>
          )}
        </div>
        <div>
          <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 700 }}>What this means</div>
          <div className="font-serif italic mt-1" style={{ color: C.inkMid, fontSize: '13px', lineHeight: '1.45' }}>
            {bandInfo.desc}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BOARD VIEW ───────────────────────────────────────────────────────────
function BoardView({ s, calc, f }) {
  // Verdict now considers both central tendency AND certainty:
  // - P50 anchors the central recommendation
  // - Prob-positive qualifies it (a P50 of +5% with only 52% prob-positive is not the same as +5% with 90%)
  const v = boardVerdict(calc.roi, s.hurdleRate);
  const iti = ITI_BANDS[s.itiBand];
  const efi = EFI_BANDS[s.efiBand];

  return (
    <div className="space-y-12">
      {/* Verdict */}
      <div className="border-4 p-10" style={{ borderColor: v.tone, background: C.cream }}>
        <div className="smcaps text-xs font-sans mb-4" style={{ color: C.inkMid, fontWeight: 700 }}>Board Recommendation</div>
        <div className="font-serif font-semibold leading-none" style={{ color: v.tone, fontSize: '88px', letterSpacing: '-0.03em' }}>
          {v.label}
        </div>
        <div className="font-serif italic mt-6 max-w-3xl" style={{ color: C.ink, fontSize: '22px', lineHeight: '1.4' }}>
          {v.blurb}
        </div>
        <Rule style={{ margin: '32px 0 24px' }} />
        <div className="grid grid-cols-5 gap-6">
          <div>
            <div className="smcaps text-xs" style={{ color: C.inkMid }}>Project</div>
            <div className="font-serif text-base mt-1" style={{ color: C.ink }}>{s.projectName}</div>
          </div>
          <div>
            <div className="smcaps text-xs" style={{ color: C.inkMid }}>Horizon</div>
            <div className="font-serif text-base mt-1 tabular" style={{ color: C.ink }}>{s.timeHorizon} years</div>
          </div>
          <div>
            <div className="smcaps text-xs" style={{ color: C.inkMid }}>P50 ROI</div>
            <div className="font-serif text-base mt-1 tabular" style={{ color: v.tone }}>{fmtPct(calc.roi.p50, 1)}</div>
          </div>
          <div>
            <div className="smcaps text-xs" style={{ color: C.inkMid }}>80% CI</div>
            <div className="font-mono text-sm mt-1 tabular" style={{ color: C.inkMid }}>
              {fmtPct(calc.roi.p10, 0)} → {fmtPct(calc.roi.p90, 0)}
            </div>
          </div>
          <div>
            <div className="smcaps text-xs" style={{ color: C.inkMid }}>Prob. &gt; {s.hurdleRate}%</div>
            <div className="font-serif text-base mt-1 tabular" style={{
              color: calc.roi.probExceeds(s.hurdleRate) >= 0.5 ? C.green : calc.roi.probExceeds(s.hurdleRate) >= 0.25 ? C.amber : C.red,
            }}>
              {(calc.roi.probExceeds(s.hurdleRate) * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Three levers */}
      <div>
        <SectionHeader num="I" title="The Three Levers" kicker="In the organisation's control before contract signature" />
        <div className="space-y-5">
          <Lever
            num="1"
            title="Infrastructure quality"
            instrument="ITI → f(ITI)"
            current={`${iti.label} · f(ITI) = ${s.fITI.toFixed(2)}`}
            currentColor={iti.color}
            target="GREEN · f(ITI) ≥ 0.90"
            action="Invest in provenance, semantic governance, transformation transparency before deployment."
          />
          <Lever
            num="2"
            title="Vendor lock-in"
            instrument="EFI → PV(SO)"
            current={`${efi.label} · ${f(s.PV_SO)} erosion`}
            currentColor={efi.color}
            target="GREEN · interoperability & exit clauses fixed contractually"
            action="Negotiate before signature: data portability, model transparency, exit clauses."
          />
          <Lever
            num="3"
            title="Adoption speed"
            instrument="Aᵢ(t) · Laney function"
            current={`${((s.adoption[0] ?? 1) * 100).toFixed(0)} % Year 1 / ${((s.adoption[1] ?? 1) * 100).toFixed(0)} % Year 2 (effective)`}
            currentColor={(s.adoption[0] ?? 1) >= 0.35 ? C.green : (s.adoption[0] ?? 1) >= 0.20 ? C.amber : C.red}
            target="≥ 50% Y1 effective — lifting all three sub-curves (exposure, utilisation, absorption)"
            action="Decomposed as exposure × utilisation × absorption. Lift all three with enablement budget, workflow integration, and organisational restructuring — each has its own lever and time constant."
          />
        </div>
      </div>

      {/* Board narrative */}
      <div>
        <SectionHeader num="II" title="The Board Narrative" kicker="What this distribution really tells the board" />
        <div className="grid grid-cols-2 gap-10">
          <div className="font-serif" style={{ color: C.ink, fontSize: '17px', lineHeight: '1.7' }}>
            <p className="mb-4">
              <span className="font-serif float-left text-6xl leading-none mr-2 mt-1" style={{ color: C.accent }}>T</span>
              his business case tells two stories. The vendor story is deterministic and promises
              <strong style={{ color: C.green }}> {fmtPct(calc.roiNaive, 0)}</strong> —
              raw claim × duration against minimally counted costs.
            </p>
            <p>
              The honest story runs {N_SAMPLES.toLocaleString()} Monte Carlo simulations across all stochastic
              variables and yields a <em>distribution</em>. The central estimate is
              <strong style={{ color: v.tone }}> {fmtPct(calc.roi.p50, 1)}</strong>, with 80% of outcomes
              falling between <strong className="tabular">{fmtPct(calc.roi.p10, 0)}</strong> and
              <strong className="tabular"> {fmtPct(calc.roi.p90, 0)}</strong>.
            </p>
          </div>
          <div className="font-serif" style={{ color: C.ink, fontSize: '17px', lineHeight: '1.7' }}>
            <p className="mb-4">
              The probability of any positive ROI is <strong className="tabular">{(calc.roi.probPositive * 100).toFixed(0)}%</strong>.
              The probability of clearing the CFO's {s.hurdleRate}% hurdle rate is
              <strong className="tabular"> {(calc.roi.probExceeds(s.hurdleRate) * 100).toFixed(0)}%</strong>.
            </p>
            <p>
              The formula does not recommend cancellation. It identifies the structural conditions that must
              improve before value is created — and quantifies how wide the range of outcomes is given today's
              assumptions. Narrowing that range is as important as raising the median. A Green verdict
              here means the project is investable and an AI build engagement can follow; Amber or Red means
              the infrastructure preconditions need remediation first.
            </p>
          </div>
        </div>
      </div>

      {/* Next Steps brief */}
      <NextStepsBrief s={s} calc={calc} verdict={v} f={f} />
    </div>
  );
}

function Lever({ num, title, instrument, current, currentColor, target, action }) {
  return (
    <div className="grid grid-cols-12 gap-6 p-6 border" style={{ borderColor: C.rule, background: C.cream }}>
      <div className="col-span-1">
        <div className="font-serif text-5xl font-semibold" style={{ color: C.accent }}>{num}</div>
      </div>
      <div className="col-span-3">
        <div className="font-serif text-lg font-semibold" style={{ color: C.ink }}>{title}</div>
        <div className="smcaps text-xs font-sans mt-1" style={{ color: C.inkMid }}>{instrument}</div>
      </div>
      <div className="col-span-4">
        <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>Current</div>
        <div className="font-mono text-sm mt-1 tabular" style={{ color: currentColor }}>{current}</div>
        <div className="smcaps text-xs font-sans mt-3" style={{ color: C.inkMid, fontWeight: 600 }}>Target</div>
        <div className="font-mono text-sm mt-1 tabular" style={{ color: C.green }}>{target}</div>
      </div>
      <div className="col-span-4">
        <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>Action</div>
        <div className="font-serif italic mt-1" style={{ color: C.ink, fontSize: '14px', lineHeight: '1.5' }}>{action}</div>
      </div>
    </div>
  );
}

// ─── SCENARIO VIEW ────────────────────────────────────────────────────────
function ScenarioView({ s, update, calc, f }) {
  // Compute a "target" scenario where all three structural levers are pulled.
  // In the decomposed model, "raising Year-1 adoption" means lifting each of
  // exposure / utilisation / absorption toward the well-run benchmark.
  const targetExposure = s.exposure.map((e, i) => Math.max(e, [0.85, 0.95, 0.98, 0.99, 0.99][i] ?? 0.99));
  const targetUtilisation = s.utilisation.map((u, i) => Math.max(u, [0.75, 0.88, 0.93, 0.95, 0.95][i] ?? 0.95));
  const targetAbsorption = s.absorption.map((a, i) => Math.max(a, [0.80, 0.90, 0.95, 0.97, 0.97][i] ?? 0.97));

  // Target ITI: all five domains at 4.5 (mid-Green). Target EFI: all seven at 4.5.
  const targetItiScores = Object.fromEntries(ITI_DOMAINS.map(d => {
    if (d.subquestions) {
      return [d.id, Object.fromEntries(d.subquestions.map(sq => [sq.id, 4.5]))];
    }
    return [d.id, 4.5];
  }));
  const targetEfiScores = Object.fromEntries(EFI_DOMAINS.map(d => {
    if (d.subquestions) {
      return [d.id, Object.fromEntries(d.subquestions.map(sq => [sq.id, 4.5]))];
    }
    return [d.id, 4.5];
  }));
  const targetItiComposite = 4.5;
  const targetEfiComposite = 4.5;
  // Derive f(ITI), δ, PV(SO) the same way the main useMemo does
  const targetFITI = 0.90 + 0.10 * ((targetItiComposite - 4.0) / 1.0);
  const targetDelta = 0.05;
  const targetEfiFactor = 0.02 + (0.06 - 0.02) * ((5.0 - targetEfiComposite) / 1.0);
  const targetPVSO = Math.round((s.Cj + s.Rjt_annual * s.timeHorizon) * targetEfiFactor / 1000) * 1000;

  const targetState = {
    ...s,
    iti_scores: targetItiScores,
    itiBand: 'green',
    itiComposite: targetItiComposite,
    fITI: targetFITI,
    fITI_range: [Math.max(0, targetFITI - 0.05), Math.min(1, targetFITI + 0.05)],
    delta: targetDelta,
    delta_range: [0.03, 0.08],
    efi_scores: targetEfiScores,
    efiBand: 'green',
    efiComposite: targetEfiComposite,
    PV_SO: targetPVSO,
    PV_SO_range: [Math.round(targetPVSO * 0.5 / 1000) * 1000, Math.round(targetPVSO * 1.8 / 1000) * 1000],
    exposure: targetExposure,
    utilisation: targetUtilisation,
    absorption: targetAbsorption,
    adoption: targetExposure.map((e, i) => e * targetUtilisation[i] * targetAbsorption[i]),
  };
  const targetCalc = computeROIDistribution(targetState);

  return (
    <div className="space-y-12">
      <div>
        <SectionHeader num="I" title="All Three Levers Pulled" kicker="The honest target" />
        <p className="font-serif italic mb-6" style={{ color: C.inkMid, fontSize: '16px' }}>
          What happens if your organisation moves all three levers before deployment —
          ITI to Green, EFI-driven PV(SO) reduced by ~75%, Year 1 adoption raised to 80%?
        </p>

        <div className="grid grid-cols-3 gap-6">
          <div className="p-6 border" style={{ borderColor: C.rule, background: C.cream }}>
            <div className="smcaps text-xs font-sans mb-3" style={{ color: C.inkMid, fontWeight: 700 }}>Current</div>
            <div className="smcaps text-xs font-sans" style={{ color: C.inkMid }}>P50 ROI</div>
            <ROIBadge roi={calc.roi.p50} size="md" />
            <div className="font-mono text-xs mt-3 tabular" style={{ color: C.inkMid }}>
              80% CI: {fmtPct(calc.roi.p10, 0)} → {fmtPct(calc.roi.p90, 0)}
            </div>
            <div className="font-mono text-xs tabular mt-1" style={{ color: C.inkMid }}>
              Prob. &gt; {s.hurdleRate}%: <span style={{ color: calc.roi.probExceeds(s.hurdleRate) >= 0.5 ? C.green : calc.roi.probExceeds(s.hurdleRate) >= 0.25 ? C.amber : C.red }}>
                {(calc.roi.probExceeds(s.hurdleRate) * 100).toFixed(0)}%
              </span>
            </div>
            <Rule style={{ margin: '16px 0 12px' }} />
            <Indicator label="ITI" val={ITI_BANDS[s.itiBand].label} color={ITI_BANDS[s.itiBand].color} />
            <Indicator label="EFI" val={EFI_BANDS[s.efiBand].label} color={EFI_BANDS[s.efiBand].color} />
            <Indicator label="Year-1 adoption" val={`${((s.adoption[0] ?? 1) * 100).toFixed(0)}%`}
              color={(s.adoption[0] ?? 1) >= 0.50 ? C.green : (s.adoption[0] ?? 1) >= 0.30 ? C.amber : C.red} />
          </div>

          <div className="p-6 flex items-center justify-center" style={{ background: C.paper }}>
            <div className="text-center">
              <div className="font-serif text-6xl" style={{ color: C.accent }}>→</div>
              <div className="smcaps text-xs font-sans mt-2" style={{ color: C.inkMid, fontWeight: 700 }}>
                All three levers
              </div>
              <div className="font-serif italic" style={{ color: C.inkMid, fontSize: '13px' }}>
                before contract signature
              </div>
              <div className="mt-4 font-mono text-xs tabular" style={{ color: C.accent }}>
                P50 shift:<br />
                <span style={{ fontSize: '18px' }}>{fmtPct(targetCalc.roi.p50 - calc.roi.p50, 1)}</span>
              </div>
            </div>
          </div>

          <div className="p-6 border-2" style={{ borderColor: C.green, background: C.cream }}>
            <div className="smcaps text-xs font-sans mb-3" style={{ color: C.green, fontWeight: 700 }}>Target state</div>
            <div className="smcaps text-xs font-sans" style={{ color: C.inkMid }}>P50 ROI</div>
            <ROIBadge roi={targetCalc.roi.p50} size="md" />
            <div className="font-mono text-xs mt-3 tabular" style={{ color: C.inkMid }}>
              80% CI: {fmtPct(targetCalc.roi.p10, 0)} → {fmtPct(targetCalc.roi.p90, 0)}
            </div>
            <div className="font-mono text-xs tabular mt-1" style={{ color: C.inkMid }}>
              Prob. &gt; {s.hurdleRate}%: <span style={{ color: targetCalc.roi.probExceeds(s.hurdleRate) >= 0.5 ? C.green : targetCalc.roi.probExceeds(s.hurdleRate) >= 0.25 ? C.amber : C.red }}>
                {(targetCalc.roi.probExceeds(s.hurdleRate) * 100).toFixed(0)}%
              </span>
            </div>
            <Rule style={{ margin: '16px 0 12px' }} />
            <Indicator label="ITI" val="GREEN" color={C.green} />
            <Indicator label="EFI" val="GREEN" color={C.green} />
            <Indicator label="Year-1 adoption" val={`${((targetExposure[0] * targetUtilisation[0] * targetAbsorption[0]) * 100).toFixed(0)}%`} color={C.green} />
          </div>
        </div>

        <div className="mt-6 p-5 border-l-4" style={{ borderColor: C.accent, background: C.paperDeep }}>
          <div className="font-serif italic" style={{ color: C.ink, fontSize: '16px', lineHeight: '1.6' }}>
            <strong>P50 shift:</strong> <span className="tabular">{fmtPct(targetCalc.roi.p50 - calc.roi.p50, 1)}</span> ·
            <strong> Prob. &gt; hurdle shift:</strong> <span className="tabular">+{((targetCalc.roi.probExceeds(s.hurdleRate) - calc.roi.probExceeds(s.hurdleRate)) * 100).toFixed(0)}pp</span> ·
            <strong> 80% CI width change:</strong> <span className="tabular">{(((targetCalc.roi.p90 - targetCalc.roi.p10) - (calc.roi.p90 - calc.roi.p10))).toFixed(0)}pp</span>.
            The delta between current and target state is the commercial opportunity — whether that becomes
            an infrastructure engagement or an AI build engagement depends on whether the target state clears
            the CFO's {s.hurdleRate}% hurdle with adequate probability.
          </div>
        </div>
      </div>

      {/* Live sliders */}
      <div>
        <SectionHeader num="II" title="Live Levers" kicker="Move the three levers in real time" />
        <div className="grid grid-cols-3 gap-6">
          <div className="p-6 border" style={{ borderColor: C.rule, background: C.cream }}>
            <div className="smcaps text-xs font-sans mb-3" style={{ color: C.inkMid, fontWeight: 700 }}>
              Lever 1 — ITI composite
            </div>
            <Slider value={s.itiComposite} min={0} max={5} step={0.1}
              onChange={(v) => {
                // Lift all ITI domain scores uniformly, respecting sub-question structure
                const next = Object.fromEntries(ITI_DOMAINS.map(d => {
                  if (d.subquestions) {
                    return [d.id, Object.fromEntries(d.subquestions.map(sq => [sq.id, v]))];
                  }
                  return [d.id, v];
                }));
                update({ iti_scores: next });
              }}
              display={`Composite = ${s.itiComposite.toFixed(1)} / 5.0 · f(ITI) = ${s.fITI.toFixed(2)}`} />
            <div className="font-serif italic mt-3" style={{ color: C.inkMid, fontSize: '13px' }}>
              Lifts all five ITI domain scores uniformly. Tune individually in the Infrastructure tab.
            </div>
          </div>

          <div className="p-6 border" style={{ borderColor: C.rule, background: C.cream }}>
            <div className="smcaps text-xs font-sans mb-3" style={{ color: C.inkMid, fontWeight: 700 }}>
              Lever 2 — EFI composite
            </div>
            <Slider value={s.efiComposite} min={0} max={5} step={0.1}
              onChange={(v) => {
                const next = Object.fromEntries(EFI_DOMAINS.map(d => {
                  if (d.subquestions) {
                    return [d.id, Object.fromEntries(d.subquestions.map(sq => [sq.id, v]))];
                  }
                  return [d.id, v];
                }));
                update({ efi_scores: next });
              }}
              display={`Composite = ${s.efiComposite.toFixed(1)} / 5.0 · PV(SO) = ${f(s.PV_SO)}`} />
            <div className="font-serif italic mt-3" style={{ color: C.inkMid, fontSize: '13px' }}>
              Lifts all seven EFI domain scores uniformly. Tune individually in the Infrastructure tab.
            </div>
          </div>

          <div className="p-6 border" style={{ borderColor: C.rule, background: C.cream }}>
            <div className="smcaps text-xs font-sans mb-3" style={{ color: C.inkMid, fontWeight: 700 }}>Lever 3 — Aᵢ(Year 1)</div>
            <Slider value={s.adoption[0] ?? 0.5} min={0.05} max={1.0} step={0.05}
              onChange={(v) => {
                // Distribute the Y1 target evenly across the three sub-curves
                // (cube root), so the effective product equals v.
                const cube = Math.pow(v, 1 / 3);
                const e = [...s.exposure]; e[0] = cube;
                const u = [...s.utilisation]; u[0] = cube;
                const a = [...s.absorption]; a[0] = cube;
                update({ exposure: e, utilisation: u, absorption: a });
              }} display={`${((s.adoption[0] ?? 0.5) * 100).toFixed(0)} %`} />
            <div className="font-serif italic mt-3" style={{ color: C.inkMid, fontSize: '13px' }}>
              Slider applies to all three adoption sub-curves uniformly.
            </div>
          </div>
        </div>

        <div className="mt-8 p-6 border-2 text-center" style={{ borderColor: C.ink, background: C.paperDeep }}>
          <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 700 }}>
            Live P50 ROI · Monte Carlo
          </div>
          <div className="mt-2">
            <ROIBadge roi={calc.roi.p50} size="lg" />
          </div>
          <div className="grid grid-cols-3 gap-8 mt-6 pt-4 border-t max-w-3xl mx-auto" style={{ borderColor: C.rule }}>
            <div>
              <div className="smcaps text-xs font-sans" style={{ color: C.inkMid }}>80% CI</div>
              <div className="font-mono text-sm mt-1 tabular" style={{ color: C.inkMid }}>
                {fmtPct(calc.roi.p10, 0)} → {fmtPct(calc.roi.p90, 0)}
              </div>
            </div>
            <div>
              <div className="smcaps text-xs font-sans" style={{ color: C.inkMid }}>Prob. &gt; {s.hurdleRate}%</div>
              <div className="font-mono text-sm mt-1 tabular" style={{
                color: calc.roi.probExceeds(s.hurdleRate) >= 0.5 ? C.green : calc.roi.probExceeds(s.hurdleRate) >= 0.25 ? C.amber : C.red,
              }}>
                {(calc.roi.probExceeds(s.hurdleRate) * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="smcaps text-xs font-sans" style={{ color: C.inkMid }}>CI width</div>
              <div className="font-mono text-sm mt-1 tabular" style={{ color: C.inkMid }}>
                {(calc.roi.p90 - calc.roi.p10).toFixed(0)} pp
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Indicator({ label, val, color }) {
  return (
    <div className="flex items-baseline justify-between py-1 font-mono text-xs">
      <span className="smcaps font-sans" style={{ color: C.inkMid }}>{label}</span>
      <span className="tabular font-semibold" style={{ color }}>{val}</span>
    </div>
  );
}

// ─── EVIDENCE VIEW ────────────────────────────────────────────────────────
function EvidenceView({ s, update, f }) {
  const [panel, setPanel] = useState('pi');

  // Sub-nav: four compact pill buttons
  const panels = [
    { id: 'pi', label: 'pᵢ', name: 'Realisation', value: s.pi, format: (v) => `${(v * 100).toFixed(0)}%` },
    { id: 'alpha', label: 'αᵢ', name: 'Attribution', value: s.alphaI, format: (v) => `${(v * 100).toFixed(0)}%` },
    { id: 'decay', label: 'dᵢ', name: 'Decay', value: s.di, format: (v) => `${(v * 100).toFixed(1)}%` },
    { id: 'adoption', label: 'Aᵢ(t)', name: 'Adoption', value: s.adoption, format: (v) => `${(v[0] * 100).toFixed(0)} → ${(v[v.length - 1] * 100).toFixed(0)}%` },
  ];

  return (
    <div className="space-y-12">
      {/* Four-panel sub-navigation */}
      <div className="grid grid-cols-4 gap-0 border" style={{ borderColor: C.ink }}>
        {panels.map((p, i) => (
          <button key={p.id} onClick={() => setPanel(p.id)}
            className="px-4 py-4 text-left transition-all"
            style={{
              background: panel === p.id ? C.ink : 'transparent',
              color: panel === p.id ? C.cream : C.ink,
              borderRight: i < panels.length - 1 ? `1px solid ${C.ink}` : 'none',
            }}>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-xl font-semibold">{p.label}</span>
              <span className="smcaps text-xs" style={{ fontWeight: 600, opacity: 0.75 }}>{p.name}</span>
            </div>
            <div className="font-mono text-xs mt-1 tabular" style={{ opacity: 0.75 }}>
              Current: {p.format(p.value)}
            </div>
          </button>
        ))}
      </div>

      {panel === 'pi' && <ScalarEvidencePanel
        varLabel="pᵢ"
        varName="realisation probability"
        currentValue={s.pi}
        updateKey="pi"
        categories={EVIDENCE_CATEGORIES}
        anchors={RESEARCH_ANCHORS}
        citations={CITATIONS}
        update={update}
        intro1="The realisation probability pᵢ represents the residual inherent uncertainty that the claimed benefit mechanism actually works — after infrastructure (f(ITI)), adoption (Aᵢ(t)), attribution (αᵢ) and decay (dᵢ) have been accounted for separately."
        intro2="This is not the gross project failure rate. Published failure rates (80%+ across industries) bundle infrastructure, adoption and leadership failures that this formula handles elsewhere. Using them directly for pᵢ would double-count risk."
        methodologyTitle="Methodological note"
        methodologyBody='Most published "AI failure rate" statistics (RAND ~80%, MIT ~95%, S&P 46% abandonment) measure gross binary outcomes. The AI-ROI formula decomposes that binary into five multiplicative components. So pᵢ should represent only the portion not attributable to infrastructure, adoption, attribution, or decay — i.e. the chance that the underlying causal mechanism was correctly specified to begin with.'
        anchorNote="Anchors are gross success rates from the cited studies. Your pᵢ should normally lie above these anchors because it excludes infrastructure and adoption risk already handled elsewhere."
        categoryTitle="Use-Case Taxonomy"
        scaleMax={1}
      />}

      {panel === 'alpha' && <><ScalarEvidencePanel
        varLabel="αᵢ"
        varName="attribution factor"
        currentValue={s.alphaI}
        updateKey="alphaI"
        categories={ATTRIBUTION_CATEGORIES}
        anchors={ATTRIBUTION_ANCHORS}
        citations={ATTRIBUTION_CITATIONS}
        update={update}
        intro1="The attribution factor αᵢ is the fraction of observed improvement that is causally attributable to the AI itself — net of concurrent training, process redesign, Hawthorne effects, managerial attention, and selection bias."
        intro2="Randomised controlled trials give αᵢ ≈ 1.0 by design. But virtually no enterprise deployment runs one. Real-world attribution is typically 30–60% lower than observed improvement, because AI is almost always deployed alongside other changes."
        methodologyTitle="Why attribution leaks"
        methodologyBody="AI benefits are co-produced with complementary investments — training, workflow redesign, new management attention. The classic IT-productivity literature (Brynjolfsson, Rock, Syverson 2021) shows that technology effects cannot cleanly be separated from the intangible organisational investments that accompany them. Short-run attribution tends to be overstated (Hawthorne, novelty, selection effects); long-run attribution tends to be understated (learning curves, network effects)."
        anchorNote="Anchors span from RCT ceiling (pure AI effect, ~0.95) down to pilot with no control (Hawthorne territory, ~0.15). Real deployments almost always sit in the middle band."
        categoryTitle="Deployment Bundle Taxonomy"
        scaleMax={1}
        extraSection={<AttributionDiagnostic s={s} update={update} />}
      /></>}

      {panel === 'decay' && <ScalarEvidencePanel
        varLabel="dᵢ"
        varName="annual benefit decay"
        currentValue={s.di}
        updateKey="di"
        categories={DECAY_CATEGORIES}
        anchors={DECAY_ANCHORS}
        citations={DECAY_CITATIONS}
        update={update}
        intro1="The annual benefit decay dᵢ is the compound erosion rate of delivered value year-on-year. It captures more than model drift alone: workflow evolution, user turnover, competitive and regulatory change, and novelty fade all contribute."
        intro2="The foundational empirical finding — 91% of production ML models degrade over time (Vela-Rincón et al., Nature 2022) — establishes the floor: some decay is always present. The question is only how fast, and whether your MLOps cadence keeps it bounded."
        methodologyTitle="What dᵢ actually captures"
        methodologyBody="dᵢ is a benefit-side concept, not a purely technical one. A vendor SaaS product with flawless model performance can still show benefit decay if users stop engaging, workflows shift, or the use-case commoditises. Conversely, a drifting model can still deliver stable business value if the metric it optimises is loosely coupled to model accuracy. Calibrate dᵢ against the system type that is closest to yours, then adjust up or down based on retraining cadence and workflow stability."
        anchorNote="Anchors span deterministic systems (1–3% p.a.) through unmanaged ML (91% degrade, per Nature 2022) to high-volatility domains that require continuous retraining (15–30% p.a.)."
        categoryTitle="System-Type Taxonomy"
        scaleMax={0.3}
        scaleUnit="% p.a."
      />}

      {panel === 'adoption' && <AdoptionEvidencePanel s={s} update={update} />}
    </div>
  );
}

// ─── REUSABLE SCALAR PANEL (pᵢ, αᵢ, dᵢ) ────────────────────────────────
function ScalarEvidencePanel({
  varLabel, varName, currentValue, updateKey, categories, anchors, citations, update,
  intro1, intro2, methodologyTitle, methodologyBody, anchorNote, categoryTitle,
  scaleMax = 1, scaleUnit = '%', extraSection = null,
}) {
  const [selected, setSelected] = useState(null);
  const selectedCat = categories.find(c => c.id === selected);
  const cv = currentValue;

  const formatValue = (v) => scaleUnit === '% p.a.' ? `${(v * 100).toFixed(1)}% p.a.` : `${(v * 100).toFixed(0)}%`;

  const valueVerdict = (() => {
    if (!selectedCat) return null;
    const [lo, hi] = selectedCat.range;
    const tolerance = scaleMax * 0.05;
    if (cv < lo - tolerance) return { tone: C.amber, text: `Below the evidence range — conservative choice for ${varName}.` };
    if (cv > hi + tolerance) return { tone: C.red, text: `Above the evidence range — optimistic, hard to defend in a CFO challenge.` };
    if (cv >= lo && cv <= hi) return { tone: C.green, text: 'Within the evidence-backed range for this category.' };
    return { tone: C.amber, text: 'Just outside the central evidence range.' };
  })();

  return (
    <div className="space-y-12">
      <div>
        <SectionHeader num="I" title={`Calibrating ${varLabel}`} kicker={`${varName} · evidence-backed ranges`} />
        <p className="font-serif italic mb-2" style={{ color: C.inkMid, fontSize: '16px' }}>{intro1}</p>
        <p className="font-serif italic mb-6" style={{ color: C.inkMid, fontSize: '16px' }}>{intro2}</p>
      </div>

      <div>
        <SectionHeader num="II" title="Current Setting" kicker={`Your ${varLabel} = ${formatValue(cv)}`} />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 p-6 border-2" style={{ borderColor: C.ink, background: C.paperDeep }}>
            <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 700 }}>Current {varLabel}</div>
            <div className="font-serif text-6xl font-semibold tabular mt-2" style={{ color: C.ink }}>
              {scaleUnit === '% p.a.' ? (cv * 100).toFixed(1) : (cv * 100).toFixed(0)}
              <span style={{ fontSize: '28px', color: C.inkSoft }}>%</span>
            </div>
            {scaleUnit === '% p.a.' && <div className="font-mono text-xs" style={{ color: C.inkSoft, marginTop: 4 }}>per annum</div>}
            <Rule style={{ margin: '16px 0 12px' }} />
            {selectedCat && valueVerdict ? (
              <>
                <div className="smcaps text-xs" style={{ color: C.inkMid, fontWeight: 600 }}>Verdict</div>
                <div className="font-serif italic mt-2" style={{ color: valueVerdict.tone, fontSize: '14px', lineHeight: '1.5' }}>
                  {valueVerdict.text}
                </div>
              </>
            ) : (
              <div className="font-serif italic" style={{ color: C.inkSoft, fontSize: '14px' }}>
                Select a category below to see how your value compares to the evidence.
              </div>
            )}
          </div>

          <div className="col-span-8 p-6 border" style={{ borderColor: C.rule, background: C.cream }}>
            <div className="smcaps text-xs font-sans mb-4" style={{ color: C.inkMid, fontWeight: 700 }}>
              Evidence scale — {varLabel} from 0 to {scaleMax === 1 ? '1' : (scaleMax * 100).toFixed(0) + '%'}
            </div>
            <EvidenceScale value={cv} selected={selectedCat} anchors={anchors} varLabel={varLabel} scaleMax={scaleMax} />
            <p className="text-xs font-sans mt-6 italic" style={{ color: C.inkSoft }}>{anchorNote}</p>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader num="III" title={categoryTitle} kicker={`Click a category to anchor your ${varLabel}`} />
        <div className="grid grid-cols-3 gap-4">
          {categories.map(cat => {
            const isSelected = selected === cat.id;
            const midpoint = (cat.range[0] + cat.range[1]) / 2;
            return (
              <button key={cat.id}
                onClick={() => setSelected(cat.id)}
                className="p-5 border-2 text-left transition-all"
                style={{
                  borderColor: isSelected ? C.ink : C.rule,
                  background: isSelected ? C.paperDeep : C.cream,
                  cursor: 'pointer',
                }}>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="font-serif text-lg font-semibold" style={{ color: C.ink }}>{cat.label}</div>
                  <div className="font-mono text-xs tabular" style={{ color: C.accent }}>
                    {scaleUnit === '% p.a.' ? `${(cat.range[0] * 100).toFixed(1)}–${(cat.range[1] * 100).toFixed(1)}%` : `${(cat.range[0] * 100).toFixed(0)}–${(cat.range[1] * 100).toFixed(0)}%`}
                  </div>
                </div>
                <div className="font-sans text-xs mb-2" style={{ color: C.inkMid, lineHeight: '1.5' }}>
                  {cat.desc}
                </div>
                <div className="font-mono text-xs italic" style={{ color: C.inkSoft, fontSize: '11px' }}>
                  {cat.examples}
                </div>
                {isSelected && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: C.rule }}>
                    <div className="font-serif italic text-xs mb-3" style={{ color: C.ink, lineHeight: '1.5' }}>
                      {cat.anchor}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); update({ [updateKey]: midpoint }); }}
                      className="smcaps font-sans text-xs px-3 py-1 border transition-colors"
                      style={{ borderColor: C.ink, color: C.ink, fontWeight: 600, background: C.cream }}>
                      Apply midpoint · {scaleUnit === '% p.a.' ? (midpoint * 100).toFixed(1) : (midpoint * 100).toFixed(0)}%
                    </button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6 border-l-4" style={{ borderColor: C.accent, background: C.cream }}>
        <div className="smcaps text-xs font-sans mb-2" style={{ color: C.accent, fontWeight: 700 }}>
          {methodologyTitle}
        </div>
        <div className="font-serif italic" style={{ color: C.ink, fontSize: '15px', lineHeight: '1.6' }}>
          {methodologyBody}
        </div>
      </div>

      {extraSection}

      <div>
        <SectionHeader num="IV" title="Research Base" kicker="Primary sources" />
        <div className="space-y-4">
          {citations.map(cit => (
            <div key={cit.id} className="p-5 border" style={{ borderColor: C.rule, background: C.cream }}>
              <div className="flex items-baseline justify-between mb-2">
                <div className="font-serif text-lg font-semibold" style={{ color: C.ink }}>
                  {cit.title}
                </div>
                <div className="font-mono text-xs" style={{ color: C.inkSoft }}>{cit.year}</div>
              </div>
              <div className="smcaps text-xs font-sans mb-3" style={{ color: C.inkMid, fontWeight: 600 }}>
                {cit.authors} · {cit.publisher}
              </div>
              <div className="font-sans text-sm" style={{ color: C.ink, lineHeight: '1.6' }}>
                {cit.note}
              </div>
              {cit.url && (
                <a href={cit.url} target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-3 font-mono text-xs underline"
                  style={{ color: C.accent }}>
                  {cit.url.replace(/^https?:\/\//, '').slice(0, 60)}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ADOPTION CURVE PANEL ─────────────────────────────────────────────────
function AdoptionEvidencePanel({ s, update }) {
  const [selected, setSelected] = useState(null);
  const selectedProfile = ADOPTION_PROFILES.find(p => p.id === selected);

  const applyProfile = (profile) => {
    const T = s.timeHorizon;
    const len = Math.max(T, 5);
    const curve = Array.from({ length: len }).map((_, i) =>
      profile.curve[Math.min(i, profile.curve.length - 1)]
    );
    // Decompose the effective curve into three equal sub-curves via cube-root,
    // so that exposure × utilisation × absorption = curve.
    const sub = curve.map(c => Math.pow(c, 1 / 3));
    update({
      exposure: [...sub],
      utilisation: [...sub],
      absorption: [...sub],
    });
  };

  return (
    <div className="space-y-12">
      <div>
        <SectionHeader num="I" title="Calibrating Aᵢ(t)" kicker="Adoption ramp · year-by-year profile" />
        <p className="font-serif italic mb-2" style={{ color: C.inkMid, fontSize: '16px' }}>
          Laney's addition to the formula. Aᵢ(t) is a profile, not a scalar — it represents the fraction of
          potential users actively generating benefit in each year. Without it, the formula assumes Day-1
          full realisation, which is a near-universal business-case error.
        </p>
        <p className="font-serif italic mb-6" style={{ color: C.inkMid, fontSize: '16px' }}>
          Real enterprise rollouts follow an S-curve. The shape of that curve depends less on the technology
          than on the enablement programme around it.
        </p>
      </div>

      <div>
        <SectionHeader num="II" title="Your Current Curve vs Evidence" kicker="Your adoption plan against benchmarks" />
        <div className="p-6 border" style={{ borderColor: C.rule, background: C.cream }}>
          <AdoptionCurveChart
            userCurve={s.adoption.slice(0, s.timeHorizon)}
            selectedProfile={selectedProfile}
            timeHorizon={s.timeHorizon}
          />
          <p className="text-xs font-sans mt-4 italic" style={{ color: C.inkSoft }}>
            Grey curve: your current plan. Accent line with fill: the selected profile (click a profile below to compare).
            The gap between them is what your change-management budget needs to buy.
          </p>
        </div>
      </div>

      <div>
        <SectionHeader num="III" title="Rollout Profile Taxonomy" kicker="Click a profile to apply it to your adoption ramp" />
        <div className="grid grid-cols-3 gap-4">
          {ADOPTION_PROFILES.map(profile => {
            const isSelected = selected === profile.id;
            return (
              <button key={profile.id}
                onClick={() => setSelected(profile.id)}
                className="p-5 border-2 text-left transition-all"
                style={{
                  borderColor: isSelected ? C.ink : C.rule,
                  background: isSelected ? C.paperDeep : C.cream,
                  cursor: 'pointer',
                }}>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="font-serif text-lg font-semibold" style={{ color: C.ink }}>{profile.label}</div>
                </div>
                <div className="font-mono text-xs mb-3 tabular" style={{ color: C.accent }}>
                  Y1 {(profile.curve[0] * 100).toFixed(0)}% · Y2 {(profile.curve[1] * 100).toFixed(0)}% · Y3 {(profile.curve[2] * 100).toFixed(0)}%
                </div>
                <MiniSparkline curve={profile.curve} />
                <div className="font-sans text-xs mt-3" style={{ color: C.inkMid, lineHeight: '1.5' }}>
                  {profile.desc}
                </div>
                {isSelected && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: C.rule }}>
                    <div className="font-serif italic text-xs mb-3" style={{ color: C.ink, lineHeight: '1.5' }}>
                      {profile.anchor}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); applyProfile(profile); }}
                      className="smcaps font-sans text-xs px-3 py-1 border transition-colors"
                      style={{ borderColor: C.ink, color: C.ink, fontWeight: 600, background: C.cream }}>
                      Apply this profile
                    </button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6 border-l-4" style={{ borderColor: C.accent, background: C.cream }}>
        <div className="smcaps text-xs font-sans mb-2" style={{ color: C.accent, fontWeight: 700 }}>
          The adoption trap
        </div>
        <div className="font-serif italic" style={{ color: C.ink, fontSize: '15px', lineHeight: '1.6' }}>
          Most AI business cases model Year 1 benefit at 100% adoption. The Copilot benchmark data shows the
          average enterprise sits at 34% DAU after 90 days — a more than 3× optimism gap on the single most
          impactful variable. Laney's contribution is to make this visible and plannable. If you cannot
          budget the change-management investment required for your chosen curve, you do not have that curve.
          Pick the curve that matches your actual enablement plan, not your aspiration.
        </div>
      </div>

      <div>
        <SectionHeader num="IV" title="Research Base" kicker="Primary sources" />
        <div className="space-y-4">
          {ADOPTION_CITATIONS.map(cit => (
            <div key={cit.id} className="p-5 border" style={{ borderColor: C.rule, background: C.cream }}>
              <div className="flex items-baseline justify-between mb-2">
                <div className="font-serif text-lg font-semibold" style={{ color: C.ink }}>
                  {cit.title}
                </div>
                <div className="font-mono text-xs" style={{ color: C.inkSoft }}>{cit.year}</div>
              </div>
              <div className="smcaps text-xs font-sans mb-3" style={{ color: C.inkMid, fontWeight: 600 }}>
                {cit.authors} · {cit.publisher}
              </div>
              <div className="font-sans text-sm" style={{ color: C.ink, lineHeight: '1.6' }}>
                {cit.note}
              </div>
              {cit.url && (
                <a href={cit.url} target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-3 font-mono text-xs underline"
                  style={{ color: C.accent }}>
                  {cit.url.replace(/^https?:\/\//, '').slice(0, 60)}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MINI SPARKLINE (for profile cards) ──────────────────────────────────
function MiniSparkline({ curve }) {
  const w = 160, h = 36;
  const n = curve.length;
  const points = curve.map((v, i) => `${(i / (n - 1)) * w},${h - v * h}`).join(' ');
  const area = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={area} fill={C.amberSoft} fillOpacity={0.35} stroke="none" />
      <polyline points={points} fill="none" stroke={C.ink} strokeWidth={1.5} />
      {curve.map((v, i) => (
        <circle key={i} cx={(i / (n - 1)) * w} cy={h - v * h} r={2} fill={C.ink} />
      ))}
    </svg>
  );
}

// ─── ADOPTION CURVE CHART (large, for panel) ─────────────────────────────
function AdoptionCurveChart({ userCurve, selectedProfile, timeHorizon }) {
  const w = 700, h = 240;
  const pad = { top: 16, right: 20, bottom: 40, left: 48 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const n = Math.max(timeHorizon, 3);
  const xStep = chartW / (n - 1);
  const y = (v) => pad.top + chartH - v * chartH;

  const userPoints = userCurve.slice(0, n).map((v, i) => `${pad.left + i * xStep},${y(v ?? 1)}`).join(' ');
  const profileCurve = selectedProfile ? selectedProfile.curve.slice(0, n) : null;
  const profilePoints = profileCurve ? profileCurve.map((v, i) => `${pad.left + i * xStep},${y(v)}`).join(' ') : null;
  const profileArea = profilePoints
    ? `${pad.left},${pad.top + chartH} ${profilePoints} ${pad.left + (n - 1) * xStep},${pad.top + chartH}`
    : null;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {/* Y-axis gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(v => (
        <g key={v}>
          <line x1={pad.left} x2={pad.left + chartW} y1={y(v)} y2={y(v)}
            stroke={C.ruleSoft} strokeDasharray="2 4" strokeWidth="1" />
          <text x={pad.left - 8} y={y(v) + 4} textAnchor="end"
            style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fill: C.inkMid }}>
            {(v * 100).toFixed(0)}%
          </text>
        </g>
      ))}

      {/* X-axis years */}
      {Array.from({ length: n }).map((_, i) => (
        <g key={i}>
          <line x1={pad.left + i * xStep} x2={pad.left + i * xStep}
            y1={pad.top + chartH} y2={pad.top + chartH + 4} stroke={C.ink} />
          <text x={pad.left + i * xStep} y={pad.top + chartH + 20} textAnchor="middle"
            style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fill: C.ink }}>
            Year {i + 1}
          </text>
        </g>
      ))}

      {/* Axis lines */}
      <line x1={pad.left} x2={pad.left + chartW} y1={pad.top + chartH} y2={pad.top + chartH} stroke={C.ink} strokeWidth="1.5" />
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + chartH} stroke={C.ink} strokeWidth="1.5" />

      {/* Selected profile (filled area) */}
      {profileArea && (
        <>
          <polyline points={profileArea} fill={C.accent} fillOpacity={0.15} stroke="none" />
          <polyline points={profilePoints} fill="none" stroke={C.accent} strokeWidth="2.5" />
          {profileCurve.map((v, i) => (
            <circle key={i} cx={pad.left + i * xStep} cy={y(v)} r={4} fill={C.accent} />
          ))}
        </>
      )}

      {/* User curve */}
      <polyline points={userPoints} fill="none" stroke={C.inkMid} strokeWidth="2" strokeDasharray="5 4" />
      {userCurve.slice(0, n).map((v, i) => (
        <circle key={i} cx={pad.left + i * xStep} cy={y(v ?? 1)} r={4} fill={C.paper} stroke={C.inkMid} strokeWidth="2" />
      ))}

      {/* Legend */}
      <g transform={`translate(${pad.left + 8}, ${pad.top + 8})`}>
        <rect x={0} y={0} width={200} height={44} fill={C.paper} stroke={C.rule} strokeWidth="1" />
        <line x1={10} x2={30} y1={14} y2={14} stroke={C.inkMid} strokeWidth="2" strokeDasharray="5 4" />
        <text x={36} y={18} style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: C.ink }}>Your current curve</text>
        <line x1={10} x2={30} y1={32} y2={32} stroke={C.accent} strokeWidth="2.5" />
        <text x={36} y={36} style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: C.ink }}>
          {selectedProfile ? selectedProfile.label : 'Select a profile below'}
        </text>
      </g>
    </svg>
  );
}

// ─── ATTRIBUTION DIAGNOSTIC ───────────────────────────────────────────────
function AttributionDiagnostic({ s, update }) {
  const [checks, setChecks] = useState({
    concurrent_training: false,
    process_redesign: false,
    management_push: false,
    no_baseline: false,
    no_control: false,
    novelty: false,
    selection: false,
  });

  const items = [
    { key: 'concurrent_training', label: 'Concurrent training or certification programme', penalty: 0.10 },
    { key: 'process_redesign', label: 'Workflow or process is being redesigned at the same time', penalty: 0.15 },
    { key: 'management_push', label: 'Strong managerial attention / executive-sponsored initiative', penalty: 0.05 },
    { key: 'no_baseline', label: 'No properly adjusted pre-deployment baseline (seasonality, mix, volume)', penalty: 0.10 },
    { key: 'no_control', label: 'No control group or staggered rollout', penalty: 0.10 },
    { key: 'novelty', label: 'Pilot < 6 months — novelty & Hawthorne effects likely still active', penalty: 0.05 },
    { key: 'selection', label: 'Early adopters self-selected — more motivated or skilled than average', penalty: 0.05 },
  ];

  const totalPenalty = items.reduce((sum, i) => sum + (checks[i.key] ? i.penalty : 0), 0);
  const suggested = Math.max(0.1, Math.min(1.0, 0.95 - totalPenalty));

  return (
    <div>
      <SectionHeader num="IIIa" title="Attribution Diagnostic" kicker="Check all that apply to your deployment" />
      <div className="p-6 border" style={{ borderColor: C.rule, background: C.cream }}>
        <p className="font-serif italic mb-4" style={{ color: C.inkMid, fontSize: '15px' }}>
          Each factor below leaks attribution away from the AI itself. Start at the RCT ceiling (~0.95) and
          subtract the flagged penalties to derive a defensible αᵢ.
        </p>
        <div className="space-y-2">
          {items.map(item => (
            <label key={item.key} className="flex items-center gap-3 p-3 cursor-pointer transition-colors"
              style={{ background: checks[item.key] ? C.paperDeep : 'transparent' }}>
              <input type="checkbox"
                checked={checks[item.key]}
                onChange={(e) => setChecks({ ...checks, [item.key]: e.target.checked })}
                style={{ accentColor: C.ink }} />
              <span className="font-sans text-sm flex-1" style={{ color: C.ink }}>{item.label}</span>
              <span className="font-mono text-xs tabular" style={{ color: checks[item.key] ? C.red : C.inkSoft }}>
                −{(item.penalty * 100).toFixed(0)}%
              </span>
            </label>
          ))}
        </div>
        <Rule style={{ margin: '20px 0 16px' }} />
        <div className="grid grid-cols-3 gap-6 items-baseline">
          <div>
            <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>RCT ceiling</div>
            <div className="font-mono text-2xl tabular mt-1" style={{ color: C.ink }}>95%</div>
          </div>
          <div>
            <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>Total leakage</div>
            <div className="font-mono text-2xl tabular mt-1" style={{ color: C.red }}>−{(totalPenalty * 100).toFixed(0)}%</div>
          </div>
          <div>
            <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>Suggested αᵢ</div>
            <div className="flex items-baseline gap-3 mt-1">
              <div className="font-mono text-2xl tabular" style={{ color: C.green }}>{(suggested * 100).toFixed(0)}%</div>
              <button onClick={() => update({ alphaI: suggested })}
                className="smcaps font-sans text-xs px-3 py-1 border"
                style={{ borderColor: C.ink, color: C.ink, fontWeight: 600, background: C.cream }}>
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EVIDENCE SCALE VISUALISATION ─────────────────────────────────────────
function EvidenceScale({ value, selected, anchors, varLabel, scaleMax = 1 }) {
  // Normalise position to 0-100 based on scaleMax
  const pos = (v) => Math.min(100, Math.max(0, (v / scaleMax) * 100));
  const fmtPct = (v) => scaleMax <= 0.3 ? `${(v * 100).toFixed(1)}%` : `${(v * 100).toFixed(0)}%`;

  return (
    <div className="relative" style={{ height: 140 }}>
      {/* Track */}
      <div className="absolute left-0 right-0" style={{ top: 70, height: 4, background: C.ruleSoft }} />

      {/* Gradient zones */}
      <div className="absolute" style={{
        top: 68, left: 0, width: '33%', height: 8,
        background: `linear-gradient(to right, ${C.red}, ${C.amberSoft})`, opacity: 0.35,
      }} />
      <div className="absolute" style={{
        top: 68, left: '33%', width: '33%', height: 8,
        background: C.amberSoft, opacity: 0.35,
      }} />
      <div className="absolute" style={{
        top: 68, left: '66%', width: '34%', height: 8,
        background: `linear-gradient(to right, ${C.amberSoft}, ${C.green})`, opacity: 0.35,
      }} />

      {/* Selected category range highlight */}
      {selected && (
        <div className="absolute" style={{
          top: 64,
          left: `${pos(selected.range[0])}%`,
          width: `${pos(selected.range[1]) - pos(selected.range[0])}%`,
          height: 16,
          background: C.ink,
          opacity: 0.85,
          borderRadius: 2,
        }}>
          <div className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-xs"
            style={{ top: -22, color: C.ink, fontWeight: 600 }}>
            {selected.label} range
          </div>
        </div>
      )}

      {/* Research anchor markers below the line */}
      {anchors.map((a, i) => (
        <div key={i} className="absolute"
          style={{ left: `${pos(a.value)}%`, top: 82, transform: 'translateX(-50%)' }}>
          <div style={{
            width: 1, height: 10, background: C.inkSoft, margin: '0 auto',
          }} />
          <div className="font-mono whitespace-nowrap"
            style={{ fontSize: '10px', color: C.inkSoft, marginTop: 4, textAlign: 'center' }}>
            {a.label}
          </div>
          <div className="font-mono tabular whitespace-nowrap"
            style={{ fontSize: '9px', color: C.inkSoft, textAlign: 'center' }}>
            {fmtPct(a.value)}
          </div>
        </div>
      ))}

      {/* Current value marker above the line */}
      <div className="absolute" style={{
        left: `${pos(value)}%`, top: 40, transform: 'translateX(-50%)',
      }}>
        <div className="font-mono tabular whitespace-nowrap text-center"
          style={{ fontSize: '11px', color: C.accent, fontWeight: 700, marginBottom: 2 }}>
          Your {varLabel} · {fmtPct(value)}
        </div>
        <div style={{
          width: 0, height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: `10px solid ${C.accent}`,
          margin: '0 auto',
        }} />
      </div>

      {/* Scale labels: 0, mid, max */}
      <div className="absolute font-mono text-xs" style={{ left: 0, top: 120, color: C.inkMid }}>0%</div>
      <div className="absolute font-mono text-xs" style={{ left: '50%', top: 120, transform: 'translateX(-50%)', color: C.inkMid }}>
        {fmtPct(scaleMax / 2)}
      </div>
      <div className="absolute font-mono text-xs" style={{ right: 0, top: 120, color: C.inkMid }}>
        {fmtPct(scaleMax)}
      </div>
    </div>
  );
}

// ─── PERCENTILE BOX (compact P10/P50/P90 display) ────────────────────────
function PercentileBox({ label, value, subtitle, emphasis }) {
  const v = verdict(value);
  return (
    <div className="text-center">
      <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: emphasis ? 700 : 600 }}>
        {label}
      </div>
      <div className="font-serif font-semibold tabular"
        style={{ color: v.tone, fontSize: emphasis ? '28px' : '22px', lineHeight: '1.1', marginTop: 4 }}>
        {fmtPct(value, 0)}
      </div>
      <div className="font-mono" style={{ color: C.inkSoft, fontSize: '10px', marginTop: 2 }}>{subtitle}</div>
    </div>
  );
}

// ─── DISTRIBUTION CHART (histogram with P10/P50/P90 lines) ────────────────
function DistributionChart({ samples, p10, p50, p90, hurdle = 0 }) {
  if (!samples || samples.length === 0) return null;
  const w = 800, h = 200;
  const pad = { top: 16, right: 20, bottom: 40, left: 48 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  // Determine range with a small buffer; clamp extreme tails for readable buckets
  const lo = Math.max(samples[0], quantile(samples, 0.01));
  const hi = Math.min(samples[samples.length - 1], quantile(samples, 0.99));
  const span = Math.max(1, hi - lo);
  const padded_lo = lo - span * 0.05;
  const padded_hi = hi + span * 0.05;
  const range = padded_hi - padded_lo;

  const nBins = 40;
  const bins = new Array(nBins).fill(0);
  const binWidth = range / nBins;
  samples.forEach(v => {
    const idx = Math.max(0, Math.min(nBins - 1, Math.floor((v - padded_lo) / binWidth)));
    bins[idx]++;
  });
  const maxBin = Math.max(...bins, 1);

  const x = (v) => pad.left + ((v - padded_lo) / range) * chartW;
  const y = (c) => pad.top + chartH - (c / maxBin) * chartH;

  // Bin color reflects position relative to hurdle: below 0 is red, between
  // 0 and hurdle is amber (positive but sub-hurdle), above hurdle is green.
  const binColor = (binCenterROI) => {
    if (binCenterROI < 0) return C.red;
    if (binCenterROI < hurdle) return C.amber;
    return C.green;
  };

  // Generate tick marks every ~5 bars
  const tickValues = [];
  const tickStep = range / 6;
  for (let i = 0; i <= 6; i++) tickValues.push(padded_lo + i * tickStep);

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {/* Axis */}
      <line x1={pad.left} x2={pad.left + chartW} y1={pad.top + chartH} y2={pad.top + chartH}
        stroke={C.ink} strokeWidth="1.5" />

      {/* Zero-ROI line if in range */}
      {padded_lo < 0 && padded_hi > 0 && (
        <line x1={x(0)} x2={x(0)} y1={pad.top} y2={pad.top + chartH}
          stroke={C.ink} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
      )}

      {/* Hurdle-rate reference line */}
      {hurdle > 0 && padded_lo < hurdle && padded_hi > hurdle && (
        <g>
          <line x1={x(hurdle)} x2={x(hurdle)} y1={pad.top} y2={pad.top + chartH}
            stroke={C.accent} strokeWidth="1.5" strokeDasharray="5 3" opacity="0.85" />
          <text x={x(hurdle)} y={pad.top + chartH + 32} textAnchor="middle"
            style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: C.accent, fontWeight: 700 }}>
            hurdle {hurdle}%
          </text>
        </g>
      )}

      {/* Histogram bars */}
      {bins.map((count, i) => {
        const binLeft = padded_lo + i * binWidth;
        const binCentre = binLeft + binWidth / 2;
        const barX = x(binLeft);
        const barY = y(count);
        const barW = Math.max(1, chartW / nBins - 1);
        const barH = (pad.top + chartH) - barY;
        return (
          <rect key={i} x={barX} y={barY} width={barW} height={barH}
            fill={binColor(binCentre)} opacity="0.75" />
        );
      })}

      {/* P10 / P50 / P90 vertical lines */}
      {[{ v: p10, label: 'P10', dash: '3 3' },
        { v: p50, label: 'P50', dash: null },
        { v: p90, label: 'P90', dash: '3 3' }].map(({ v, label, dash }, i) => (
        v >= padded_lo && v <= padded_hi && (
          <g key={i}>
            <line x1={x(v)} x2={x(v)} y1={pad.top - 4} y2={pad.top + chartH}
              stroke={C.ink} strokeWidth={label === 'P50' ? 2 : 1}
              strokeDasharray={dash || undefined} />
            <text x={x(v)} y={pad.top - 6} textAnchor="middle"
              style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fill: C.ink, fontWeight: 600 }}>
              {label}
            </text>
          </g>
        )
      ))}

      {/* X-axis tick labels */}
      {tickValues.map((v, i) => (
        <g key={i}>
          <line x1={x(v)} x2={x(v)} y1={pad.top + chartH} y2={pad.top + chartH + 4}
            stroke={C.ink} strokeWidth="1" />
          <text x={x(v)} y={pad.top + chartH + 18} textAnchor="middle"
            style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fill: C.ink }}>
            {v >= 0 ? '+' : ''}{v.toFixed(0)}%
          </text>
        </g>
      ))}

      {/* Y-axis label */}
      <text x={pad.left - 8} y={pad.top + 8} textAnchor="end"
        style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: C.inkSoft }}>
        frequency
      </text>

      {/* X-axis label */}
      <text x={pad.left + chartW / 2} y={h - 4} textAnchor="middle"
        style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fill: C.ink, fontWeight: 600 }}>
        ROI (%)
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//   Vi SENSITIVITY PANEL
// ═══════════════════════════════════════════════════════════════════════════
//
// Sweeps Vi across a range (0.25× to 3× current) and plots the point-estimate
// P50 ROI for each value, with hurdle rate and break-even lines marked.
// Also identifies the Vi threshold at which the project would pass hurdle.
//
// Uses point-estimate calculation (not full Monte Carlo) for responsiveness.
// The point estimate tracks the median of the distribution within ~5pp, which
// is accurate enough for this diagnostic purpose.
//
function ViSensitivityPanel({ s, f }) {
  // Compute ROI sweep using point-estimate formula (fast enough for live sweep)
  const sweep = useMemo(() => {
    const T = s.timeHorizon;
    const viPoints = [];
    const minVi = s.Vi * 0.25;
    const maxVi = s.Vi * 3.0;
    const steps = 50;

    // Hold costs fixed across the sweep. This reflects the real procurement
    // scenario: the vendor has quoted a price, and Vᵢ is the claimed benefit
    // against that fixed cost base. Asking "what Vᵢ would justify this cost?"
    // is the commercially meaningful question.
    //
    // (If we scaled costs proportionally with Vᵢ, ROI would become Vᵢ-invariant
    // and the panel would show a flat line — mathematically correct but
    // diagnostically useless.)
    const fixedCj = s.Cj;
    const fixedRj = s.Rjt_annual * T;
    const fixedGj = s.Gjt_annual * T;
    const fixedPVSO = s.PV_SO;
    let fixedMaint = 0;
    for (let t = 1; t <= T; t++) {
      fixedMaint += s.Mj * Math.pow(1 + s.delta, t - 1);
    }
    const fixedTotalCost = fixedCj + fixedRj + fixedGj + fixedMaint + fixedPVSO;

    for (let i = 0; i <= steps; i++) {
      const vi = minVi + (maxVi - minVi) * (i / steps);

      // Benefit scales with Vi; cost held fixed
      let benefit = 0;
      for (let t = 1; t <= T; t++) {
        const idx = t - 1;
        const adoption = (s.exposure[idx] ?? 1) * (s.utilisation[idx] ?? 1) * (s.absorption[idx] ?? 1);
        benefit += vi * s.pi * s.fITI * s.alphaI * Math.pow(1 - s.di, t) * adoption;
      }

      const roi = fixedTotalCost > 0 ? ((benefit - fixedTotalCost) / fixedTotalCost) * 100 : 0;
      viPoints.push({ vi, roi });
    }

    // Find hurdle-crossing Vi
    let hurdleVi = null;
    for (let i = 0; i < viPoints.length - 1; i++) {
      if (viPoints[i].roi < s.hurdleRate && viPoints[i + 1].roi >= s.hurdleRate) {
        // Linear interpolation
        const frac = (s.hurdleRate - viPoints[i].roi) / (viPoints[i + 1].roi - viPoints[i].roi);
        hurdleVi = viPoints[i].vi + frac * (viPoints[i + 1].vi - viPoints[i].vi);
        break;
      }
    }
    // Find break-even Vi
    let breakevenVi = null;
    for (let i = 0; i < viPoints.length - 1; i++) {
      if (viPoints[i].roi < 0 && viPoints[i + 1].roi >= 0) {
        const frac = (0 - viPoints[i].roi) / (viPoints[i + 1].roi - viPoints[i].roi);
        breakevenVi = viPoints[i].vi + frac * (viPoints[i + 1].vi - viPoints[i].vi);
        break;
      }
    }

    return { viPoints, hurdleVi, breakevenVi, minVi, maxVi };
  }, [s]);

  const { viPoints, hurdleVi, breakevenVi, minVi, maxVi } = sweep;
  const currentRoi = viPoints.find(p => p.vi >= s.Vi)?.roi ?? 0;

  return (
    <div className="p-6 border" style={{ borderColor: C.rule, background: C.cream }}>
      <ViSensitivityChart
        points={viPoints}
        currentVi={s.Vi}
        hurdleRate={s.hurdleRate}
        hurdleVi={hurdleVi}
        breakevenVi={breakevenVi}
        minVi={minVi}
        maxVi={maxVi}
        f={f}
      />

      <div className="grid grid-cols-3 gap-8 mt-6 pt-4 border-t" style={{ borderColor: C.rule }}>
        <div>
          <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 700 }}>
            Your current Vᵢ
          </div>
          <div className="font-serif text-2xl font-semibold tabular mt-1" style={{ color: C.ink }}>
            {f(s.Vi)}
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: currentRoi >= s.hurdleRate ? C.green : currentRoi >= 0 ? C.amber : C.red }}>
            Produces P50 ROI ≈ {currentRoi.toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 700 }}>
            Break-even Vᵢ
          </div>
          <div className="font-serif text-2xl font-semibold tabular mt-1" style={{ color: breakevenVi ? C.amber : C.inkSoft }}>
            {breakevenVi ? f(breakevenVi) : 'out of range'}
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: C.inkSoft }}>
            where ROI = 0%
          </div>
        </div>
        <div>
          <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 700 }}>
            Hurdle-clearing Vᵢ
          </div>
          <div className="font-serif text-2xl font-semibold tabular mt-1" style={{ color: hurdleVi ? C.green : C.inkSoft }}>
            {hurdleVi ? f(hurdleVi) : 'out of range'}
          </div>
          <div className="font-mono text-xs mt-1" style={{ color: C.inkSoft }}>
            where ROI = hurdle ({s.hurdleRate}%)
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 border-l-2 font-serif italic" style={{ borderColor: C.accent, background: C.paper, color: C.ink, fontSize: '14px', lineHeight: '1.6' }}>
        {!breakevenVi
          ? `Even at 3× your current vendor claim, this project cannot break even under current structural conditions. This is not a Vᵢ problem — it is an infrastructure problem. Remediation is the only path to a positive outcome.`
          : !hurdleVi
          ? `The project reaches break-even at ${f(breakevenVi)} but cannot clear the ${s.hurdleRate}% CFO hurdle within the examined range. Vᵢ alone will not make this approvable — infrastructure lift is needed to multiply the benefit side.`
          : hurdleVi <= s.Vi
          ? `Your Vᵢ of ${f(s.Vi)} exceeds the hurdle-clearing threshold of ${f(hurdleVi)}. The project is approvable on current structural conditions — proceed to AI build engagement.`
          : `Your Vᵢ of ${f(s.Vi)} is below the ${f(hurdleVi)} needed to clear the ${s.hurdleRate}% hurdle. Options: (1) challenge the vendor to justify a larger Vᵢ, (2) remediate infrastructure to lift f(ITI), or (3) renegotiate PV(SO) by strengthening exit provisions. The gap to close is ${f(hurdleVi - s.Vi)}.`}
      </div>
    </div>
  );
}

// ─── Vi SENSITIVITY CHART ────────────────────────────────────────────────
function ViSensitivityChart({ points, currentVi, hurdleRate, hurdleVi, breakevenVi, minVi, maxVi, f }) {
  const w = 800, h = 220;
  const pad = { top: 16, right: 20, bottom: 50, left: 70 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const roiMin = Math.min(...points.map(p => p.roi), -10);
  const roiMax = Math.max(...points.map(p => p.roi), hurdleRate + 20);
  const roiRange = roiMax - roiMin;

  const x = (vi) => pad.left + ((vi - minVi) / (maxVi - minVi)) * chartW;
  const y = (roi) => pad.top + chartH - ((roi - roiMin) / roiRange) * chartH;

  // ROI curve path
  const pathD = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${x(p.vi).toFixed(1)},${y(p.roi).toFixed(1)}`
  ).join(' ');

  // Zero line
  const zeroY = y(0);
  // Hurdle line
  const hurdleY = y(hurdleRate);

  // Vi tick values
  const viTicks = [];
  for (let i = 0; i <= 5; i++) {
    viTicks.push(minVi + (maxVi - minVi) * (i / 5));
  }
  // ROI tick values
  const roiTicks = [];
  const roiStep = Math.ceil(roiRange / 6 / 25) * 25;
  for (let v = Math.floor(roiMin / roiStep) * roiStep; v <= roiMax; v += roiStep) {
    roiTicks.push(v);
  }

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {/* ROI gridlines */}
      {roiTicks.map((v, i) => (
        <g key={i}>
          <line x1={pad.left} x2={pad.left + chartW} y1={y(v)} y2={y(v)}
            stroke={C.ruleSoft} strokeDasharray="2 4" strokeWidth="0.5" />
          <text x={pad.left - 8} y={y(v) + 4} textAnchor="end"
            style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: C.inkMid }}>
            {v >= 0 ? '+' : ''}{v.toFixed(0)}%
          </text>
        </g>
      ))}

      {/* Shaded regions: below 0 (red), 0 to hurdle (amber), above hurdle (green) */}
      <rect x={pad.left} y={pad.top} width={chartW} height={Math.max(0, hurdleY - pad.top)}
        fill={C.green} opacity="0.06" />
      <rect x={pad.left} y={hurdleY} width={chartW} height={Math.max(0, zeroY - hurdleY)}
        fill={C.amber} opacity="0.06" />
      <rect x={pad.left} y={zeroY} width={chartW} height={Math.max(0, pad.top + chartH - zeroY)}
        fill={C.red} opacity="0.06" />

      {/* Axis */}
      <line x1={pad.left} x2={pad.left + chartW} y1={pad.top + chartH} y2={pad.top + chartH}
        stroke={C.ink} strokeWidth="1.5" />
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + chartH}
        stroke={C.ink} strokeWidth="1.5" />

      {/* Zero line */}
      <line x1={pad.left} x2={pad.left + chartW} y1={zeroY} y2={zeroY}
        stroke={C.ink} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      <text x={pad.left + chartW - 4} y={zeroY - 4} textAnchor="end"
        style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: C.ink, fontWeight: 600 }}>
        break-even
      </text>

      {/* Hurdle line */}
      <line x1={pad.left} x2={pad.left + chartW} y1={hurdleY} y2={hurdleY}
        stroke={C.accent} strokeWidth="1.5" strokeDasharray="5 3" />
      <text x={pad.left + chartW - 4} y={hurdleY - 4} textAnchor="end"
        style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: C.accent, fontWeight: 700 }}>
        hurdle {hurdleRate}%
      </text>

      {/* ROI curve */}
      <path d={pathD} fill="none" stroke={C.ink} strokeWidth="2.5" />

      {/* Current Vi marker */}
      <line x1={x(currentVi)} x2={x(currentVi)} y1={pad.top} y2={pad.top + chartH}
        stroke={C.ink} strokeWidth="1" opacity="0.5" />
      <circle cx={x(currentVi)} cy={y(points.find(p => p.vi >= currentVi)?.roi ?? 0)}
        r="6" fill={C.accent} stroke={C.cream} strokeWidth="2" />
      <text x={x(currentVi)} y={pad.top + chartH + 32} textAnchor="middle"
        style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: C.accent, fontWeight: 700 }}>
        your Vᵢ
      </text>

      {/* Hurdle-clearing Vi marker */}
      {hurdleVi && (
        <g>
          <line x1={x(hurdleVi)} x2={x(hurdleVi)} y1={hurdleY} y2={pad.top + chartH}
            stroke={C.green} strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
          <circle cx={x(hurdleVi)} cy={hurdleY} r="4" fill={C.green} />
        </g>
      )}

      {/* Vi tick labels */}
      {viTicks.map((v, i) => (
        <g key={i}>
          <line x1={x(v)} x2={x(v)} y1={pad.top + chartH} y2={pad.top + chartH + 4}
            stroke={C.ink} />
          <text x={x(v)} y={pad.top + chartH + 18} textAnchor="middle"
            style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fill: C.ink }}>
            {f(v)}
          </text>
        </g>
      ))}

      {/* Axis labels */}
      <text x={pad.left + chartW / 2} y={h - 4} textAnchor="middle"
        style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fill: C.ink, fontWeight: 600 }}>
        Vendor claim Vᵢ (annual)
      </text>
      <text x={pad.left - 55} y={pad.top + chartH / 2} textAnchor="middle"
        transform={`rotate(-90, ${pad.left - 55}, ${pad.top + chartH / 2})`}
        style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fill: C.ink, fontWeight: 600 }}>
        P50 ROI
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//   §8.0  HOW-TO VIEW — First-contact orientation
// ═══════════════════════════════════════════════════════════════════════════
//
// Five-section editorial orientation for first-time users:
//   1. What this is — one paragraph, plain language
//   2. What you get out — the three possible outcomes
//   3. How to use it — the workflow in order
//   4. What it needs from you — inputs overview
//   5. Reading the output — verdict interpretation
//
// Designed to be readable in under two minutes by a CIO or CFO with no
// prior exposure to the framework. Assumes domain literacy but not framework
// literacy. Users can jump to any tab via the "take me to..." shortcuts.

function HowToView({ setTab, s }) {
  return (
    <div className="space-y-16">

      {/* ─── Opening statement ────────────────────────────────────────── */}
      <div className="p-10 border-4" style={{ borderColor: C.ink, background: C.cream }}>
        <div className="smcaps text-xs font-sans mb-4" style={{ color: C.inkMid, fontWeight: 700 }}>
          A two-minute orientation
        </div>
        <div className="font-serif font-semibold leading-tight" style={{ color: C.ink, fontSize: '42px', letterSpacing: '-0.02em' }}>
          This tool tells you whether an AI POC is worth building —
          <span style={{ color: C.accent }}> and if not, what would make it worthwhile.</span>
        </div>
        <div className="font-serif italic mt-6 max-w-3xl" style={{ color: C.inkMid, fontSize: '19px', lineHeight: '1.5' }}>
          It replaces vendor optimism with structured honesty, using evidence-backed parameters and Monte Carlo
          simulation to produce a distribution of possible ROI outcomes rather than a single hopeful number.
          The output is board-grade: a verdict, a confidence interval, and a diagnosis of what to change if
          the verdict is unfavourable.
        </div>
      </div>

      {/* ─── §1 What this is ───────────────────────────────────────────── */}
      <div>
        <SectionHeader num="1" title="What this is" kicker="In one paragraph" />
        <div className="font-serif" style={{ color: C.ink, fontSize: '17px', lineHeight: '1.75' }}>
          <p className="mb-4">
            <span className="font-serif float-left text-6xl leading-none mr-2 mt-1" style={{ color: C.accent }}>A</span>
            structured decision instrument for evaluating whether a proposed AI project will deliver the ROI
            its vendor promises. It takes the vendor's annual value claim (Vᵢ) and applies a chain of
            evidence-backed discounts — realisation probability, infrastructure trust, attribution, decay,
            and adoption ramp — then simulates thousands of possible outcomes to produce a distribution of
            realistic ROI rather than a single optimistic number.
          </p>
          <p>
            It is built on the formula from Gradwell's AI ROI work, Laney's adoption function from Infonomics,
            and Agidee's Digital Transformation Resilience Model (DTRM). The evidence base covers RAND, MIT,
            BCG, Brynjolfsson-Rock-Syverson, Microsoft Copilot deployment benchmarks, and the Nature
            Scientific Reports paper on ML model degradation. Every default has a citation.
          </p>
        </div>
      </div>

      {/* ─── §2 Three possible outcomes ───────────────────────────────── */}
      <div>
        <SectionHeader num="2" title="What you get out" kicker="Three possible verdicts, three commercial paths" />
        <div className="grid grid-cols-3 gap-6">
          <div className="p-6 border-2" style={{ borderColor: C.green, background: C.cream }}>
            <div className="smcaps text-xs font-sans mb-3" style={{ color: C.green, fontWeight: 700 }}>Green verdict</div>
            <div className="font-serif text-2xl font-semibold mb-3" style={{ color: C.ink }}>PROCEED</div>
            <div className="font-serif italic" style={{ color: C.inkMid, fontSize: '14px', lineHeight: '1.55' }}>
              The project clears the CFO hurdle with adequate confidence. Infrastructure and exit feasibility
              are both adequate. The path forward is the AI build engagement itself.
            </div>
          </div>
          <div className="p-6 border-2" style={{ borderColor: C.amber, background: C.cream }}>
            <div className="smcaps text-xs font-sans mb-3" style={{ color: C.amber, fontWeight: 700 }}>Amber verdict</div>
            <div className="font-serif text-2xl font-semibold mb-3" style={{ color: C.ink }}>CONDITIONAL</div>
            <div className="font-serif italic" style={{ color: C.inkMid, fontSize: '14px', lineHeight: '1.55' }}>
              The project could be approvable if specific structural preconditions are remediated. The
              Infrastructure tab identifies exactly which sub-questions need to move. Infrastructure
              remediation is the engagement.
            </div>
          </div>
          <div className="p-6 border-2" style={{ borderColor: C.red, background: C.cream }}>
            <div className="smcaps text-xs font-sans mb-3" style={{ color: C.red, fontWeight: 700 }}>Red verdict</div>
            <div className="font-serif text-2xl font-semibold mb-3" style={{ color: C.ink }}>DO NOT PROCEED</div>
            <div className="font-serif italic" style={{ color: C.inkMid, fontSize: '14px', lineHeight: '1.55' }}>
              Central estimate negative with low probability of any positive return. The vendor's Vᵢ is
              structurally too small relative to cost, or infrastructure is too weak. Either the claim
              must rise or the infrastructure must be rebuilt first.
            </div>
          </div>
        </div>
        <p className="font-serif italic mt-6" style={{ color: C.inkMid, fontSize: '15px', lineHeight: '1.6' }}>
          Notice that all three outcomes are commercially meaningful. Green opens an AI build conversation.
          Amber opens an infrastructure remediation conversation. Red opens both: challenge the vendor's
          claim or rebuild the infrastructure first. There is no outcome that wastes the assessment.
        </p>
      </div>

      {/* ─── §3 How to use it ─────────────────────────────────────────── */}
      <div>
        <SectionHeader num="3" title="How to use it" kicker="The suggested workflow, in order" />
        <div className="space-y-4">

          <WorkflowStep num="1" label="Setup" tabId="setup" setTab={setTab}
            time="~5 minutes"
            purpose="Tell the tool what you're evaluating."
            detail="Enter the project name, the vendor's annual value claim (Vᵢ), the time horizon you're evaluating over, and your CFO's hurdle rate. Set the benefit-side parameters (pᵢ, αᵢ, dᵢ) — the defaults are evidence-backed cross-industry averages, so you can leave them alone on first pass. Set the adoption ramp across three sub-curves: Exposure, Utilisation, and Absorption." />

          <WorkflowStep num="2" label="Infrastructure" tabId="infra" setTab={setTab}
            time="~20 minutes"
            purpose="Score your organisation's readiness honestly."
            detail="This is the most important tab. Work through the five ITI domains (infrastructure trust) and seven EFI domains (exit feasibility), each with 4–5 sub-questions. Score each sub-question 0–5 using the rubric text that appears next to the slider. Most organisations score themselves at Amber (2.5–3.9). The band is derived — you cannot cheat the output by clicking a band." />

          <WorkflowStep num="3" label="Evidence" tabId="evidence" setTab={setTab}
            time="~10 minutes, optional"
            purpose="Understand and adjust the evidence-backed defaults."
            detail="Each of the four benefit-side variables (pᵢ, αᵢ, dᵢ, Aᵢ(t)) has its own evidence panel with research citations, industry benchmarks, and calibration guidance. Use this tab if your context materially differs from the defaults — for instance, if your AI model has well-documented drift behaviour you'd like to reflect in dᵢ." />

          <WorkflowStep num="4" label="Finance" tabId="finance" setTab={setTab}
            time="~5 minutes to read"
            purpose="See the ROI distribution and sensitivity."
            detail="The headline output. Shows P10, P50, P90 ROI as a distribution from 3,000 Monte Carlo samples. The Vᵢ Sensitivity panel shows how the verdict depends on the size of the vendor's claim — the critical commercial diagnostic. Year-by-year and Cost Structure breakdowns follow." />

          <WorkflowStep num="5" label="Board" tabId="board" setTab={setTab}
            time="~3 minutes to read"
            purpose="The executive summary."
            detail="The verdict (PROCEED / CONDITIONAL / DO NOT PROCEED), the probability of clearing the CFO hurdle, and the three structural levers that can change the outcome: ITI, EFI, adoption. Formatted as board-grade output suitable for a signed recommendation." />

          <WorkflowStep num="6" label="Scenario" tabId="scenario" setTab={setTab}
            time="~5 minutes"
            purpose="See what it would take."
            detail="The 'all three levers pulled' comparison shows what the ROI distribution would look like if ITI and EFI were at Green, adoption were lifted to structured-rollout benchmarks, and the hurdle rate were your current setting. The delta between current and target is the commercial opportunity — expressed as ROI points, probability shift, and narrowing of the confidence interval." />

        </div>
      </div>

      {/* ─── §4 What it needs from you ────────────────────────────────── */}
      <div>
        <SectionHeader num="4" title="What it needs from you" kicker="The inputs, in order of importance" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-5 p-5 border-2" style={{ borderColor: C.accent, background: C.cream }}>
            <div className="smcaps text-xs font-sans mb-2" style={{ color: C.accent, fontWeight: 700 }}>Critical inputs</div>
            <div className="space-y-3 font-serif" style={{ color: C.ink, fontSize: '14px', lineHeight: '1.6' }}>
              <div>
                <strong>Vᵢ — Vendor's annual value claim.</strong> The single most consequential number in
                the framework. Where did it come from? A client-measured baseline? A vendor calculator?
                Adjust skepticism accordingly.
              </div>
              <div>
                <strong>ITI sub-question scores.</strong> Five domains × 4–5 sub-questions. These drive
                f(ITI) and δ. Most of the framework's commercial output depends on these being honest.
              </div>
              <div>
                <strong>EFI sub-question scores.</strong> Seven domains × 4–5 sub-questions. These drive
                PV(SO). The three expanded domains — contractual terms, reversibility, model transparency —
                are the most consequential.
              </div>
              <div>
                <strong>Hurdle rate.</strong> The CFO's minimum acceptable ROI. Typically 10–25%.
              </div>
            </div>
          </div>
          <div className="col-span-4 p-5 border" style={{ borderColor: C.rule, background: C.cream }}>
            <div className="smcaps text-xs font-sans mb-2" style={{ color: C.inkMid, fontWeight: 700 }}>Important inputs</div>
            <div className="space-y-3 font-serif" style={{ color: C.ink, fontSize: '14px', lineHeight: '1.6' }}>
              <div>
                <strong>Adoption sub-curves.</strong> Exposure × Utilisation × Absorption per year.
                Most business cases assume 100% day-one; reality is 20–40%.
              </div>
              <div>
                <strong>Cost structure.</strong> Build, run, governance, maintenance. Often under-stated
                by vendor quotes by 20–50%.
              </div>
              <div>
                <strong>Time horizon.</strong> Typically 3 years for ROI evaluation.
              </div>
            </div>
          </div>
          <div className="col-span-3 p-5 border" style={{ borderColor: C.ruleSoft, background: C.paper }}>
            <div className="smcaps text-xs font-sans mb-2" style={{ color: C.inkSoft, fontWeight: 700 }}>Defaults</div>
            <div className="font-serif italic" style={{ color: C.inkMid, fontSize: '13px', lineHeight: '1.6' }}>
              The benefit-side variables pᵢ, αᵢ, dᵢ are pre-set to evidence-backed cross-industry averages.
              The Evidence tab documents every citation. Adjust only if your context materially differs.
            </div>
          </div>
        </div>
      </div>

      {/* ─── §5 Reading the output ────────────────────────────────────── */}
      <div>
        <SectionHeader num="5" title="Reading the output" kicker="What the numbers actually mean" />
        <div className="grid grid-cols-2 gap-8">
          <div className="font-serif" style={{ color: C.ink, fontSize: '16px', lineHeight: '1.65' }}>
            <h3 className="font-serif text-xl font-semibold mb-3" style={{ color: C.ink }}>
              P50 ROI — the central estimate
            </h3>
            <p className="mb-6">
              The median of 3,000 Monte Carlo simulations. Half of outcomes consistent with your inputs are
              above this, half below. Not a prediction — a median of defensible possibilities. If this is
              positive, the project is more likely than not to create value. If negative, vice versa.
            </p>
            <h3 className="font-serif text-xl font-semibold mb-3" style={{ color: C.ink }}>
              80% confidence interval (P10 → P90)
            </h3>
            <p>
              The range within which 80% of simulated outcomes fall. Width matters as much as centre.
              A P50 of +20% with CI of −5% to +45% is a different investment proposition than +20% with
              CI of +15% to +25%. Narrow distributions mean predictable outcomes; wide distributions mean
              the project could go badly.
            </p>
          </div>
          <div className="font-serif" style={{ color: C.ink, fontSize: '16px', lineHeight: '1.65' }}>
            <h3 className="font-serif text-xl font-semibold mb-3" style={{ color: C.ink }}>
              Probability of clearing hurdle
            </h3>
            <p className="mb-6">
              The fraction of simulated outcomes that exceed your CFO's hurdle rate. The most commercially
              consequential number in the output. A P50 above hurdle with only 55% probability of clearing
              hurdle tells you the project is marginal — CFO-approvable technically, but the distribution
              is wide enough that half of outcomes disappoint.
            </p>
            <h3 className="font-serif text-xl font-semibold mb-3" style={{ color: C.ink }}>
              Vᵢ sensitivity
            </h3>
            <p>
              The curve showing how ROI changes as Vᵢ varies from 0.25× to 3× current value. Identifies
              the break-even Vᵢ (where ROI = 0) and the hurdle-clearing Vᵢ (where ROI = hurdle rate). The
              gap between your current Vᵢ and the hurdle-clearing Vᵢ is the diagnostic bridge to a commercial
              conversation: either the vendor's claim needs to rise, or the infrastructure needs to lift.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Pitfalls ────────────────────────────────────────────────── */}
      <div>
        <SectionHeader num="6" title="Common pitfalls" kicker="What first-time users get wrong" />
        <div className="space-y-3">
          <Pitfall
            title="Over-scoring the domains"
            body="IT leaders routinely overestimate their own infrastructure maturity. Provenance reconstructability at 4.0 means you can trace every data element across the entire estate in real time. If you cannot, your score is lower. When in doubt, score one level below your first instinct." />
          <Pitfall
            title="Treating Vᵢ as fixed"
            body="The vendor's claim is an input to the framework, not an output. If the framework says your project fails, one possibility is that the vendor's Vᵢ is optimistic. Use the Vᵢ Sensitivity panel to see what the claim would need to be for the project to work." />
          <Pitfall
            title="Reading P50 as a prediction"
            body="P50 is the median of simulated outcomes, not a forecast of what will happen. The real output is the distribution. A P50 of +20% means the project is more likely positive than negative; it does not mean the project will definitely return +20%." />
          <Pitfall
            title="Ignoring the width"
            body="Two projects with identical P50 can have very different risk profiles. A narrow distribution means predictable outcomes; a wide one means the project could disappoint even if the central estimate is good. CFOs increasingly ask about CI width, not just point estimate." />
          <Pitfall
            title="Scoring without evidence"
            body="If you're scoring a sub-question 4.0 based on what you think should be true rather than on documented assessment, the output is speculation dressed up in precision. Either lower your score, or commission the actual assessment." />
        </div>
      </div>

      {/* ─── CTA ─────────────────────────────────────────────────────── */}
      <div className="p-8 border-4" style={{ borderColor: C.accent, background: C.cream }}>
        <div className="smcaps text-xs font-sans mb-3" style={{ color: C.accent, fontWeight: 700 }}>Ready?</div>
        <div className="font-serif font-semibold mb-4" style={{ color: C.ink, fontSize: '28px', lineHeight: '1.2' }}>
          Start with Setup. Then score your Infrastructure honestly. Everything else follows.
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setTab('setup')}
            className="smcaps font-sans px-5 py-3 border-2 transition-colors"
            style={{ borderColor: C.ink, color: C.cream, background: C.ink, fontWeight: 700 }}>
            → Go to Setup
          </button>
          <button onClick={() => setTab('infra')}
            className="smcaps font-sans px-5 py-3 border-2 transition-colors"
            style={{ borderColor: C.ink, color: C.ink, background: C.cream, fontWeight: 700 }}>
            → Jump to Infrastructure scoring
          </button>
        </div>
      </div>

    </div>
  );
}

// ─── Workflow step card ────────────────────────────────────────────────────
function WorkflowStep({ num, label, tabId, setTab, time, purpose, detail }) {
  return (
    <div className="grid grid-cols-12 gap-6 p-5 border" style={{ borderColor: C.rule, background: C.cream }}>
      <div className="col-span-1 text-center">
        <div className="font-serif text-5xl font-semibold" style={{ color: C.accent, lineHeight: '1' }}>
          {num}
        </div>
      </div>
      <div className="col-span-8">
        <div className="flex items-baseline gap-3 mb-2">
          <span className="font-serif text-xl font-semibold" style={{ color: C.ink }}>
            {label}
          </span>
          <span className="smcaps text-xs font-sans" style={{ color: C.inkSoft, fontWeight: 600 }}>
            {time}
          </span>
        </div>
        <div className="font-serif italic mb-2" style={{ color: C.inkMid, fontSize: '14px' }}>
          {purpose}
        </div>
        <div className="font-sans" style={{ color: C.ink, fontSize: '13px', lineHeight: '1.6' }}>
          {detail}
        </div>
      </div>
      <div className="col-span-3 flex items-center justify-end">
        <button onClick={() => setTab(tabId)}
          className="smcaps font-sans text-xs px-3 py-2 border transition-colors"
          style={{ borderColor: C.ink, color: C.ink, fontWeight: 600, background: C.paper }}>
          Go to {label} →
        </button>
      </div>
    </div>
  );
}

// ─── Pitfall card ──────────────────────────────────────────────────────────
function Pitfall({ title, body }) {
  return (
    <div className="p-4 border-l-4" style={{ borderColor: C.amber, background: C.cream }}>
      <div className="font-serif font-semibold mb-1" style={{ color: C.ink, fontSize: '15px' }}>
        ⚠ {title}
      </div>
      <div className="font-serif italic" style={{ color: C.inkMid, fontSize: '14px', lineHeight: '1.55' }}>
        {body}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//   NEXT STEPS BRIEF — Dynamic remediation roadmap
// ═══════════════════════════════════════════════════════════════════════════
//
// Given the user's actual sub-question scores and the verdict, produces a
// structured remediation brief:
//   1. Headline recommendation matched to verdict archetype
//   2. Specific diagnosis grounded in lowest-scoring sub-questions
//   3. Top three priorities ranked by remediation leverage
//   4. Sequencing guidance
//   5. Projected outcome if priorities are lifted to Green
//
// Every brief is unique to the user's inputs — no generic bullets.

// ─── Remediation pattern library ──────────────────────────────────────────
// Maps each sub-question id to indicative remediation guidance. Cost/time
// ranges are order-of-magnitude estimates for a mid-market (500–5000 FTE)
// organisation. Use as discussion anchors, not quotes.
const REMEDIATION_PATTERNS = {
  // ITI — Provenance
  provenance_coverage:    { effort: 'high', time: '6–12 months', cost: '£200k–800k', workstream: 'Data lineage platform rollout — deploy a lineage capture tool (Collibra / Alation / open-source Marquez) and instrument critical pipelines. Start with the top 5 business-critical data flows.' },
  provenance_granularity: { effort: 'medium', time: '3–6 months', cost: '£150k–400k', workstream: 'Field-level lineage instrumentation — upgrade existing lineage from table-level to field/column-level for priority domains. Requires transformation logic externalisation.' },
  provenance_queryable:   { effort: 'low', time: '1–3 months', cost: '£50k–150k', workstream: 'Lineage query layer — build a searchable frontend over existing lineage metadata. Self-service access reduces dependency on tribal knowledge.' },
  provenance_timeliness:  { effort: 'medium', time: '3–6 months', cost: '£100k–300k', workstream: 'Real-time lineage pipeline — move from batch lineage refresh to event-driven capture integrated with CI/CD and data pipelines.' },
  provenance_audit:       { effort: 'high', time: '6–9 months', cost: '£200k–500k', workstream: 'Audit-grade lineage programme — formalise lineage as audit evidence with immutable logs, point-in-time reconstruction, and regulator-acceptable formats.' },
  // ITI — Semantic consistency
  semantic_dictionary:    { effort: 'medium', time: '4–8 months', cost: '£150k–500k', workstream: 'Enterprise data dictionary build — charter a governed programme with domain stewards. Most time spent on reaching consensus on definitions, not tooling.' },
  semantic_enforcement:   { effort: 'high', time: '6–12 months', cost: '£300k–800k', workstream: 'Semantic contracts at integration boundaries — retrofit schema and semantic validation into integration layers, with automated rejection of non-conforming data.' },
  semantic_domain_coverage: { effort: 'high', time: '9–18 months', cost: '£500k–1.5m', workstream: 'Cross-domain semantic alignment — iterative programme to bring each business domain into the canonical model. Slowest and most political work in any data programme.' },
  semantic_drift:         { effort: 'low', time: '2–4 months', cost: '£75k–200k', workstream: 'Drift detection automation — deploy pipeline-level monitoring for semantic changes with alerting and regression testing.' },
  semantic_governance:    { effort: 'medium', time: '3–6 months', cost: '£100k–300k', workstream: 'Data governance function — establish stewardship authority with executive sponsorship, formal change process, and integration into architecture review.' },
  // ITI — Integration determinism
  determinism_reliability: { effort: 'medium', time: '3–6 months', cost: '£150k–500k', workstream: 'Integration hardening programme — targeted intervention on top-10 failure-prone integrations. Usually mix of retry logic, monitoring, and architectural refactor.' },
  determinism_idempotency: { effort: 'high', time: '6–12 months', cost: '£300k–800k', workstream: 'Idempotent-by-design retrofit — redesign non-idempotent integrations to support safe retries. Deep architectural work, often coupled with event-sourcing adoption.' },
  determinism_contracts:  { effort: 'medium', time: '3–6 months', cost: '£200k–500k', workstream: 'Contract testing infrastructure — Pact / OpenAPI / similar, integrated into CI. Prevents breaking changes from reaching production.' },
  determinism_observability: { effort: 'low', time: '2–4 months', cost: '£100k–250k', workstream: 'Distributed tracing rollout — OpenTelemetry or equivalent. Accelerates root-cause analysis and reduces MTTR for integration issues.' },
  determinism_recovery:   { effort: 'medium', time: '3–6 months', cost: '£150k–400k', workstream: 'Automated recovery mechanisms — circuit breakers, dead-letter queues, auto-retry with backoff, runbook automation.' },
  // ITI — Transparency
  transparency_visibility: { effort: 'medium', time: '4–8 months', cost: '£200k–600k', workstream: 'Transformation logic externalisation — move embedded logic from stored procedures and scripts into declarative, queryable form (dbt / SQLMesh / similar).' },
  transparency_version:   { effort: 'low', time: '1–3 months', cost: '£50k–150k', workstream: 'Version control discipline programme — enforce review process, deprecate direct production changes, audit trail integration.' },
  transparency_business_logic: { effort: 'high', time: '6–12 months', cost: '£300k–1m', workstream: 'End-to-end business-logic traceability — requires both lineage and transformation metadata to be linked back to documented rules.' },
  transparency_testability: { effort: 'medium', time: '3–6 months', cost: '£150k–400k', workstream: 'Transformation testing infrastructure — reference datasets, unit/integration tests for pipelines, property-based testing for critical transformations.' },
  // ITI — Change observability
  observability_detection: { effort: 'medium', time: '3–6 months', cost: '£150k–400k', workstream: 'Change detection monitoring — schema watchers, API monitoring, real-time alerting on upstream modifications.' },
  observability_impact:   { effort: 'medium', time: '3–6 months', cost: '£200k–500k', workstream: 'Automated impact analysis — combine lineage with change metadata to produce impact reports before changes land.' },
  observability_contracts: { effort: 'medium', time: '4–8 months', cost: '£200k–600k', workstream: 'Formal change management programme — deprecation windows, compatibility requirements, version negotiation between producers and consumers.' },
  observability_simulation: { effort: 'high', time: '6–12 months', cost: '£300k–800k', workstream: 'Pre-production simulation environment — production-representative data, simulation tooling, approval gate integration.' },
  // EFI — Data portability
  portability:            { effort: 'medium', time: '2–6 months', cost: '£100k–400k', workstream: 'Data exit pathway — negotiate continuous data mirroring to customer-controlled storage. Often achievable at contract level without vendor engineering work.' },
  // EFI — Contractual (sub-questioned)
  contractual_clause:     { effort: 'low', time: '1–2 months', cost: '£20k–80k', workstream: 'Termination right renegotiation — legal engagement to secure unilateral termination-for-convenience with reasonable notice period.' },
  contractual_transition: { effort: 'low', time: '1–2 months', cost: '£30k–100k', workstream: 'Transition support SLAs — negotiate specific deliverables, timelines, named contacts, and performance standards into contract.' },
  contractual_data:       { effort: 'low', time: '1–2 months', cost: '£20k–80k', workstream: 'Data return and destruction clauses — open formats, certified destruction, derived data coverage, tight SLAs.' },
  contractual_fees:       { effort: 'low', time: '1–2 months', cost: '£20k–60k', workstream: 'Exit economics renegotiation — cap or eliminate termination fees and per-GB data export charges. Usually achievable in negotiation.' },
  contractual_continuity: { effort: 'low', time: '1–2 months', cost: '£20k–80k', workstream: 'Service continuity clauses — full SLAs during transition window, bounded extension options, financial remedies for degradation.' },
  // EFI — Reversibility (sub-questioned)
  reversibility_coupling: { effort: 'high', time: '6–12 months', cost: '£300k–1m', workstream: 'Decoupling programme — architectural refactor to isolate vendor-specific behaviours from business workflows. Often the largest infrastructure investment in the remediation portfolio.' },
  reversibility_api:      { effort: 'medium', time: '3–6 months', cost: '£150k–500k', workstream: 'Standards migration — replace proprietary API calls with open-standard equivalents (REST/OpenAPI, OAuth). Incremental, pipeline by pipeline.' },
  reversibility_abstraction: { effort: 'medium', time: '4–8 months', cost: '£200k–600k', workstream: 'Adapter pattern rollout — introduce abstraction layer between application code and vendor SDK. Enables future vendor swaps with minimal change.' },
  reversibility_data_flow: { effort: 'medium', time: '3–6 months', cost: '£150k–500k', workstream: 'Canonical schema enforcement — define internal data contract independent of vendor, implement translation layer at vendor boundary.' },
  reversibility_effort:   { effort: 'high', time: '9–18 months', cost: '£500k–1.5m', workstream: 'Multi-vendor architecture — build and validate an alternative vendor path end-to-end, even if not used. Reduces migration risk from multi-year to multi-month.' },
  // EFI — Model transparency (sub-questioned)
  model_explainability:   { effort: 'medium', time: '3–6 months', cost: '£100k–300k', workstream: 'Explainability tooling deployment — SHAP/LIME or vendor-provided explanation APIs, integrated into user-facing surfaces.' },
  model_docs:             { effort: 'low', time: '1–3 months', cost: '£30k–100k', workstream: 'Model card programme — document training data, evaluation methodology, known failure modes, update history. Often a contractual ask rather than technical work.' },
  model_retraining:       { effort: 'medium', time: '3–6 months', cost: '£100k–300k', workstream: 'Retraining governance — contractual control over retraining cadence, data scope, and customer input. Technical work minimal; legal and commercial work substantial.' },
  model_versioning:       { effort: 'medium', time: '2–4 months', cost: '£75k–200k', workstream: 'Version control infrastructure — parallel deployment environments, A/B testing infrastructure, customer-controlled version activation.' },
  model_evaluation:       { effort: 'medium', time: '3–6 months', cost: '£100k–300k', workstream: 'Customer evaluation environment — test data pipelines, custom evaluation metrics, continuous quality monitoring against held-out test sets.' },
  // EFI — simpler domains
  proprietary:            { effort: 'high', time: '9–18 months', cost: '£400k–1.5m', workstream: 'Open-standards migration programme — systematic replacement of proprietary formats with open equivalents. Longest-running item on any remediation roadmap.' },
  skills:                 { effort: 'medium', time: '6–12 months', cost: '£150k–400k', workstream: 'Skills portability programme — reframe team training around industry-standard tools, reduce vendor-specific certification investments, build portable expertise.' },
  regulatory:             { effort: 'medium', time: '4–8 months', cost: '£150k–500k', workstream: 'Regulatory portability — document compliance architecture independent of vendor, pre-qualify alternative providers for regulated workloads.' },
};

// Flatten all scored sub-questions into a single list with context
function collectSubScores(s) {
  const items = [];
  for (const d of ITI_DOMAINS) {
    if (d.subquestions) {
      for (const sq of d.subquestions) {
        const score = s.iti_scores?.[d.id]?.[sq.id];
        if (typeof score === 'number') {
          items.push({
            side: 'ITI', domain: d.label, subLabel: sq.label,
            subId: sq.id, score,
            pattern: REMEDIATION_PATTERNS[sq.id],
          });
        }
      }
    } else {
      const score = s.iti_scores?.[d.id];
      if (typeof score === 'number') {
        items.push({ side: 'ITI', domain: d.label, subLabel: null, subId: d.id, score, pattern: REMEDIATION_PATTERNS[d.id] });
      }
    }
  }
  for (const d of EFI_DOMAINS) {
    if (d.subquestions) {
      for (const sq of d.subquestions) {
        const score = s.efi_scores?.[d.id]?.[sq.id];
        if (typeof score === 'number') {
          items.push({
            side: 'EFI', domain: d.label, subLabel: sq.label,
            subId: sq.id, score,
            pattern: REMEDIATION_PATTERNS[sq.id],
          });
        }
      }
    } else {
      const score = s.efi_scores?.[d.id];
      if (typeof score === 'number') {
        items.push({ side: 'EFI', domain: d.label, subLabel: null, subId: d.id, score, pattern: REMEDIATION_PATTERNS[d.id] });
      }
    }
  }
  return items;
}

// ─── The brief component ──────────────────────────────────────────────────
function NextStepsBrief({ s, calc, verdict, f }) {
  // Collect all sub-scores and identify the three lowest (= highest remediation priority)
  const allScores = useMemo(() => collectSubScores(s), [s]);
  const weakest = useMemo(() => {
    return [...allScores]
      .filter(item => item.pattern) // only include ones we have patterns for
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
  }, [allScores]);

  // Compute projected outcome if those three priorities lift to 4.5 (mid-Green)
  const projectedCalc = useMemo(() => {
    const projectedState = JSON.parse(JSON.stringify(s));
    for (const w of weakest) {
      if (w.side === 'ITI') {
        const domain = ITI_DOMAINS.find(d => d.label === w.domain);
        if (domain?.subquestions) {
          if (!projectedState.iti_scores[domain.id] || typeof projectedState.iti_scores[domain.id] !== 'object') {
            projectedState.iti_scores[domain.id] = {};
          }
          projectedState.iti_scores[domain.id][w.subId] = 4.5;
        } else {
          projectedState.iti_scores[domain.id] = 4.5;
        }
      } else {
        const domain = EFI_DOMAINS.find(d => d.label === w.domain);
        if (domain?.subquestions) {
          if (!projectedState.efi_scores[domain.id] || typeof projectedState.efi_scores[domain.id] !== 'object') {
            projectedState.efi_scores[domain.id] = {};
          }
          projectedState.efi_scores[domain.id][w.subId] = 4.5;
        } else {
          projectedState.efi_scores[domain.id] = 4.5;
        }
      }
    }

    // Re-derive f(ITI), delta, PV_SO under the projected scores
    const itiVals = ITI_DOMAINS.map(d => domainScore(d, projectedState.iti_scores).score);
    const itiComp = itiVals.reduce((a,b) => a+b, 0) / itiVals.length;
    let fITI_p;
    if (itiComp >= 4.0) fITI_p = 0.90 + 0.10 * ((itiComp - 4.0) / 1.0);
    else if (itiComp >= 2.5) fITI_p = 0.60 + 0.29 * ((itiComp - 2.5) / 1.5);
    else fITI_p = 0.60 * (itiComp / 2.5);
    fITI_p = Math.max(0, Math.min(1, fITI_p));
    const delta_p = itiComp >= 4 ? 0.05 : itiComp >= 2.5 ? 0.10 : 0.15;

    const efiVals = EFI_DOMAINS.map(d => domainScore(d, projectedState.efi_scores).score);
    const efiComp = efiVals.reduce((a,b) => a+b, 0) / efiVals.length;
    let efiFactor_p;
    if (efiComp >= 4.0) efiFactor_p = 0.02 + (0.06 - 0.02) * ((5.0 - efiComp) / 1.0);
    else if (efiComp >= 2.5) efiFactor_p = 0.06 + (0.14 - 0.06) * ((4.0 - efiComp) / 1.5);
    else efiFactor_p = 0.14 + (0.20 - 0.14) * ((2.5 - efiComp) / 2.5);
    const base_for_pvso = s.Cj + (s.Rjt_annual * s.timeHorizon);
    const PV_SO_p = Math.round(base_for_pvso * efiFactor_p / 1000) * 1000;

    projectedState.fITI = fITI_p;
    projectedState.fITI_range = [Math.max(0, fITI_p - 0.10), Math.min(1, fITI_p + 0.10)];
    projectedState.delta = delta_p;
    projectedState.delta_range = delta_p === 0.05 ? [0.03, 0.08] : delta_p === 0.10 ? [0.07, 0.15] : [0.12, 0.20];
    projectedState.PV_SO = PV_SO_p;
    projectedState.PV_SO_range = [Math.round(PV_SO_p * 0.5 / 1000) * 1000, Math.round(PV_SO_p * 1.8 / 1000) * 1000];
    projectedState.adoption = (projectedState.exposure ?? []).map((e, i) =>
      (e ?? 1) * ((projectedState.utilisation?.[i]) ?? 1) * ((projectedState.absorption?.[i]) ?? 1)
    );

    return computeROIDistribution(projectedState);
  }, [s, weakest]);

  // Cost/time aggregation across the three priorities
  const aggregateCost = useMemo(() => {
    const costRanges = weakest.map(w => {
      const m = w.pattern.cost.match(/£([\d.]+)k–([\d.]+)(?:k|m)/);
      if (!m) return [0, 0];
      const lo = parseFloat(m[1]) * 1000;
      const hi = parseFloat(m[2]) * (w.pattern.cost.includes('m') ? 1000000 : 1000);
      return [lo, hi];
    });
    const totalLo = costRanges.reduce((a, [l]) => a + l, 0);
    const totalHi = costRanges.reduce((a, [,h]) => a + h, 0);
    return [totalLo, totalHi];
  }, [weakest]);

  // Determine verdict archetype (controls framing)
  const archetype = verdict.label === 'PROCEED' ? 'green'
                   : verdict.label === 'PROCEED WITH CAUTION' ? 'green-caution'
                   : verdict.label === 'MARGINAL' ? 'marginal'
                   : verdict.label === 'CONDITIONAL' ? 'conditional'
                   : 'red';

  const headline = {
    'green':          'Proceed to AI build engagement. Standard governance applies.',
    'green-caution':  'Proceed carefully. Narrow the distribution before committing fully.',
    'marginal':       'The project is approvable technically. Close specific gaps before contract signature.',
    'conditional':    'Do the infrastructure homework first. Then this becomes investable.',
    'red':            'Do not proceed like this. Remediate the infrastructure preconditions first — then revisit.',
  }[archetype];

  const diagnosis = {
    'green':          `ITI composite ${s.itiComposite.toFixed(1)} and EFI composite ${s.efiComposite.toFixed(1)} clear the thresholds for a Green deployment. P50 ROI of ${calc.roi.p50.toFixed(0)}% with ${(calc.roi.probExceeds(s.hurdleRate) * 100).toFixed(0)}% probability of clearing your ${s.hurdleRate}% hurdle means this project is investable on current evidence.`,
    'green-caution':  `Central estimate is positive but the 80% confidence interval (${calc.roi.p10.toFixed(0)}% → ${calc.roi.p90.toFixed(0)}%) is wide enough that the project could still disappoint. The weakest sub-scores below are the largest sources of distribution width.`,
    'marginal':       `P50 ROI of ${calc.roi.p50.toFixed(0)}% clears the ${s.hurdleRate}% hurdle on median but only ${(calc.roi.probExceeds(s.hurdleRate) * 100).toFixed(0)}% of simulated outcomes do. The sub-questions below are where the downside risk concentrates.`,
    'conditional':    `Your infrastructure assessment (ITI ${s.itiComposite.toFixed(1)}, EFI ${s.efiComposite.toFixed(1)}) indicates structural preconditions are not yet in place. P50 of ${calc.roi.p50.toFixed(0)}% reflects that gap. Remediating the three weakest sub-scores would lift expected outcomes materially.`,
    'red':            `P50 ROI of ${calc.roi.p50.toFixed(0)}% with only ${(calc.roi.probPositive * 100).toFixed(0)}% probability of positive return means this is not a tuning problem — it is a structural problem. The three weakest sub-scores below are where the expected value is being destroyed.`,
  }[archetype];

  const sequenceGuidance = {
    'green':          'No remediation sequence required. Convert to AI build engagement with standard project governance, monitoring plan, and success metrics baked into the contract.',
    'green-caution':  'Address the three priorities in parallel with AI build. None are blockers; all will narrow the distribution and increase confidence in the realised outcome.',
    'marginal':       'Complete the three priorities before contract signature. Target a 4–6 month remediation window; AI build follows immediately after.',
    'conditional':    'Sequence: (1) lowest-scoring priority first — foundational gap that blocks the others from delivering value; (2) next-lowest in parallel with late stages of (1); (3) third priority begins as (1) completes. Full sequence approximately 9–15 months.',
    'red':            'Full-stop: the AI project cannot create value under current conditions. Deliver the three priorities as a distinct remediation programme — not bundled with AI investment. Re-run this assessment after 12–18 months of remediation work. If scores improve to Amber-high or Green, the AI engagement restarts.',
  }[archetype];

  const priorityIntroText = {
    'green':          'Watch-items during delivery (not blockers):',
    'green-caution':  'Priorities to close in parallel with AI build:',
    'marginal':       'Specific gaps to close before contract signature:',
    'conditional':    'Structural preconditions — in priority order:',
    'red':            'These three areas are where the value is being destroyed. Your homework, in priority order:',
  }[archetype];

  return (
    <div>
      <SectionHeader num="III" title="Next Steps Brief" kicker="Specific, derived from your scores, commercially actionable" />

      {/* Headline + diagnosis */}
      <div className="p-8 border-2 mb-6" style={{ borderColor: verdict.tone, background: C.cream }}>
        <div className="smcaps text-xs font-sans mb-3" style={{ color: verdict.tone, fontWeight: 700 }}>
          Recommended posture
        </div>
        <div className="font-serif font-semibold mb-4" style={{ color: C.ink, fontSize: '28px', lineHeight: '1.25' }}>
          {headline}
        </div>
        <div className="font-serif italic" style={{ color: C.inkMid, fontSize: '16px', lineHeight: '1.65' }}>
          {diagnosis}
        </div>
      </div>

      {/* Top three priorities */}
      <div className="mb-6">
        <div className="font-serif font-semibold mb-4" style={{ color: C.ink, fontSize: '18px' }}>
          {priorityIntroText}
        </div>
        <div className="space-y-3">
          {weakest.map((w, i) => (
            <PriorityCard key={i} rank={i + 1} item={w} />
          ))}
        </div>
      </div>

      {/* Sequencing + aggregate scope */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-8 p-6 border" style={{ borderColor: C.rule, background: C.cream }}>
          <div className="smcaps text-xs font-sans mb-3" style={{ color: C.inkMid, fontWeight: 700 }}>
            Sequencing
          </div>
          <div className="font-serif italic" style={{ color: C.ink, fontSize: '15px', lineHeight: '1.65' }}>
            {sequenceGuidance}
          </div>
        </div>
        <div className="col-span-4 p-6 border" style={{ borderColor: C.accent, background: C.cream }}>
          <div className="smcaps text-xs font-sans mb-3" style={{ color: C.accent, fontWeight: 700 }}>
            Aggregate indicative scope
          </div>
          <div>
            <div className="smcaps text-xs font-sans" style={{ color: C.inkMid }}>Total cost range</div>
            <div className="font-serif text-xl font-semibold tabular mt-1" style={{ color: C.ink }}>
              {f(aggregateCost[0])} – {f(aggregateCost[1])}
            </div>
          </div>
          <div className="mt-4">
            <div className="smcaps text-xs font-sans" style={{ color: C.inkMid }}>Duration</div>
            <div className="font-mono text-sm mt-1" style={{ color: C.ink }}>
              longest path: {Math.max(...weakest.map(w => parseInt(w.pattern.time.match(/(\d+)–/)?.[1] ?? 3)))} – {Math.max(...weakest.map(w => parseInt(w.pattern.time.match(/–(\d+)/)?.[1] ?? 12)))} months
            </div>
          </div>
          <div className="mt-4 font-mono text-xs italic" style={{ color: C.inkSoft }}>
            Order-of-magnitude estimates for a mid-market organisation. Refine through scoping workshop.
          </div>
        </div>
      </div>

      {/* Projected outcome after remediation */}
      <div className="p-6 border-2" style={{ borderColor: C.green, background: C.cream }}>
        <div className="smcaps text-xs font-sans mb-3" style={{ color: C.green, fontWeight: 700 }}>
          Projected outcome if the three priorities are remediated to mid-Green (score 4.5)
        </div>
        <div className="grid grid-cols-3 gap-6 mt-4">
          <div>
            <div className="smcaps text-xs font-sans" style={{ color: C.inkMid }}>Current P50 ROI</div>
            <div className="font-serif text-2xl font-semibold tabular mt-1" style={{ color: verdict.tone }}>
              {fmtPct(calc.roi.p50, 0)}
            </div>
          </div>
          <div className="text-center self-center">
            <div className="font-serif text-3xl" style={{ color: C.accent }}>→</div>
          </div>
          <div>
            <div className="smcaps text-xs font-sans" style={{ color: C.inkMid }}>Projected P50 ROI</div>
            <div className="font-serif text-2xl font-semibold tabular mt-1" style={{ color: projectedCalc.roi.p50 >= s.hurdleRate ? C.green : projectedCalc.roi.p50 >= 0 ? C.amber : C.red }}>
              {fmtPct(projectedCalc.roi.p50, 0)}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6 mt-4 pt-4 border-t" style={{ borderColor: C.rule }}>
          <div>
            <div className="smcaps text-xs font-sans" style={{ color: C.inkMid }}>Prob. &gt; hurdle</div>
            <div className="font-mono text-base tabular mt-1" style={{ color: C.inkMid }}>
              {(calc.roi.probExceeds(s.hurdleRate) * 100).toFixed(0)}% → <span style={{
                color: projectedCalc.roi.probExceeds(s.hurdleRate) >= 0.5 ? C.green : C.amber,
                fontWeight: 600,
              }}>{(projectedCalc.roi.probExceeds(s.hurdleRate) * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div>
            <div className="smcaps text-xs font-sans" style={{ color: C.inkMid }}>P10 shift</div>
            <div className="font-mono text-base tabular mt-1" style={{ color: C.inkMid }}>
              {fmtPct(calc.roi.p10, 0)} → {fmtPct(projectedCalc.roi.p10, 0)}
            </div>
          </div>
          <div>
            <div className="smcaps text-xs font-sans" style={{ color: C.inkMid }}>80% CI width</div>
            <div className="font-mono text-base tabular mt-1" style={{ color: C.inkMid }}>
              {(calc.roi.p90 - calc.roi.p10).toFixed(0)}pp → {(projectedCalc.roi.p90 - projectedCalc.roi.p10).toFixed(0)}pp
            </div>
          </div>
        </div>
        <div className="mt-4 font-serif italic" style={{ color: C.inkMid, fontSize: '14px', lineHeight: '1.6' }}>
          Projected figures assume the three priorities above lift to mid-Green (score 4.5) and other scores
          remain unchanged. This is a conservative projection — a full remediation programme would typically
          lift more than three sub-questions. Use this as the floor of the post-remediation outcome, not the ceiling.
        </div>
      </div>
    </div>
  );
}

// ─── Priority card ────────────────────────────────────────────────────────
function PriorityCard({ rank, item }) {
  const sideColor = item.side === 'ITI' ? C.accent : C.ink;
  return (
    <div className="grid grid-cols-12 gap-4 p-5 border" style={{ borderColor: C.rule, background: C.cream }}>
      <div className="col-span-1 text-center">
        <div className="font-serif font-semibold" style={{ color: C.accent, fontSize: '44px', lineHeight: '1' }}>
          {rank}
        </div>
      </div>
      <div className="col-span-6">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="smcaps text-xs font-sans px-2 py-0.5 border" style={{ color: sideColor, borderColor: sideColor, fontWeight: 700, fontSize: '10px' }}>
            {item.side}
          </span>
          <span className="font-serif font-semibold" style={{ color: C.ink, fontSize: '16px' }}>
            {item.domain}{item.subLabel ? ` — ${item.subLabel}` : ''}
          </span>
          <span className="font-mono text-xs tabular" style={{ color: C.red, fontWeight: 700 }}>
            scored {item.score.toFixed(1)} / 5.0
          </span>
        </div>
        <div className="font-sans" style={{ color: C.ink, fontSize: '13px', lineHeight: '1.6' }}>
          {item.pattern.workstream}
        </div>
      </div>
      <div className="col-span-2">
        <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>Duration</div>
        <div className="font-mono text-sm tabular mt-1" style={{ color: C.ink }}>{item.pattern.time}</div>
      </div>
      <div className="col-span-3">
        <div className="smcaps text-xs font-sans" style={{ color: C.inkMid, fontWeight: 600 }}>Indicative cost</div>
        <div className="font-mono text-sm tabular mt-1" style={{ color: C.ink }}>{item.pattern.cost}</div>
        <div className="smcaps text-xs font-sans mt-1" style={{ color: item.pattern.effort === 'high' ? C.red : item.pattern.effort === 'medium' ? C.amber : C.green, fontWeight: 700, fontSize: '10px' }}>
          {item.pattern.effort} effort
        </div>
      </div>
    </div>
  );
}
