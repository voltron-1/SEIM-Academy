# Phase 0 — External cross-check: job market & certification objectives

**Scope.** The last Phase 0 item: cross-check the 20-module curriculum in
[`curriculum-map.md`](../curriculum-map.md) against (a) current Tier 1 / Tier 2 SOC
analyst hiring requirements and (b) CompTIA Security+ SY0-701 and GIAC GCIH exam
objectives. Audited 2026-09-06.

**Evidence limitation, stated up front.** Individual raw postings on Indeed / LinkedIn /
Glassdoor are not machine-fetchable (403 / auth-walled). What was used instead: nine
2026-dated role guides and career analyses that synthesize postings, several of which
quote posting language directly, plus the primary-source GIAC objectives page. Where a
requirement is named by **four or more independent sources**, it is treated as a real
market signal; single-source claims are marked as such. Cert objectives are firmer:
GCIH's 15 objectives are verbatim from giac.org (primary); the Security+ 28 objectives
are a secondary transcription of CompTIA's official PDF, which is behind a form.

---

## Findings, most consequential first

### 1. SEIM-Academy is not Security+ prep and should never be described as such

Mapping the 20 modules onto the five SY0-701 domains:

| Domain | Weight | Curriculum coverage |
|---|---|---|
| 1 — General Security Concepts | 12% | **None.** No module teaches CIA, control types, change management, or cryptography. |
| 2 — Threats, Vulnerabilities & Mitigations | 22% | **Partial.** Obj. 2.4 (analyze indicators of malicious activity) is covered well by T1-3/4/5a/5b and 2.5 by T2-9. Obj. 2.1/2.2/2.3 are untouched. |
| 3 — Security Architecture | 18% | **None.** |
| 4 — Security Operations | 28% | **Strong.** Obj. 4.4, 4.7, 4.8, 4.9 are directly taught; 4.2 and 4.6 partially. |
| 5 — Security Program Mgmt & Oversight | 20% | **Marginal.** Only T2-10 (Detection & Compliance Matrix) touches it. |

Weighted coverage lands near **35–40% of exam scope**, concentrated in the single
largest domain. The honest positioning: *SEIM-Academy teaches the Security Operations
domain deeply; it is a complement to Security+ study, not a substitute.* README and any
future landing copy must say that, because Security+ is the most-requested certification
in SOC postings and an implied-prep claim is the kind of thing learners test and resent.

### 2. GCIH is a worse fit than assumed — it is an offense-weighted exam

The 15 official GCIH objectives (giac.org, primary source) break down as:

| GCIH objective | Curriculum coverage |
|---|---|
| 9 — Network and Log Investigations | **Covered** — T1-2, T1-3, T1-9, T2-8 |
| 2 — Detecting Evasive and Post-Exploitation Techniques | **Covered** — T1-5a/5b, T1-3, T2-8 |
| 6 — Incident Response and Cyber Investigation (PICERL / DAIR) | **Partial** — T1-8 teaches escalation only; see finding 4 |
| 3 — Detecting Exploitation and Covert Communications Tools | **Partial** — appears in `Tactics/*.md` but no module targets it |
| 1, 13 — Attacking / Understanding Passwords | Thin — T2-4 password-spraying playbook only |
| 4 — Endpoint Attack and Pivoting | None |
| 5, 14, 15 — Web app references, API attacks, injection attacks | **None** (3 of 15 objectives) |
| 7 — Integrating LLMs with Offensive Operations | None |
| 8 — Malware and AI-Assisted Investigations | None |
| 10 — Scanning and Mapping | None |
| 11 — Securing Credentials and Data in the Cloud | None |
| 12 — SMB Security | None |

Roughly **2.5 of 15 objectives** are genuinely covered. GCIH tests hacker tradecraft;
SEIM-Academy teaches telemetry and detection. These are complementary disciplines, not
overlapping ones. **Recommendation: drop GCIH as an alignment target entirely** and
substitute **CompTIA CySA+**, which four of the nine sources name as the Tier 2 landing
certification and which is analytics/detection-shaped — the same shape as this
curriculum. GCIH stays relevant as a *career-next* pointer, not an alignment claim.

### 3. Six Tier 1 job requirements have no module, ranked by how consistently they appear

| # | Requirement | Source count | Status | Notes |
|---|---|---|---|---|
| 1 | **Networking fundamentals** — TCP/IP, DNS, HTTP/HTTPS, TLS, normal-vs-abnormal traffic | 6 of 9 | **Gap** | Most consistently named prerequisite in the entire corpus; one guide states you "cannot spot attacks if you do not understand how networks work." Source repo has no primer — only `Tactics/Network-*.md` (7 files, 1.2–3.0 KB) and `hardening/network.md` (2.9 KB), all of which *assume* the fundamentals. |
| 2 | **EDR/XDR investigation** — process trees, alert investigation, live response (CrowdStrike / SentinelOne / Defender) | 5 of 9 | **Gap** | Curriculum is entirely SIEM/log-centric. Source repo has zero EDR content (`find` for edr/xdr → no hits). |
| 3 | **Phishing / email triage** | 3 of 9 | **Gap** | Named less often than 1–2 but is in practice the highest-volume Tier 1 alert class. Source has `Tactics/Email-Traffic.md` (1.5 KB) and `hardening/email-security.md` (356 B) — both too thin to generate a module from. |
| 4 | **Identity** — AD / Entra ID, SSO, OAuth/OIDC, IAM roles | 4 of 9 | **Partial** | Also Security+ obj. 4.6, a full objective. Currently reached only obliquely via T1-9 (`WindowsUserProfile.md`) and account-management Event IDs in T1-3. |
| 5 | **Cloud telemetry** — CloudTrail, Azure Activity, GCP audit logs | 4 of 9 | **Gap** | Source repo has `sigma/pipelines/cloudtrail.yml`, `Lookups/o365-principalappid.csv`, and two `hardening/microsoft-365-*.md` files — enough for one module, not for a strand. |
| 6 | **Scripting** — PowerShell or Python | 4 of 9 | **Gap, out of scope** | Real requirement, but teaching a language is a different product. Recommend an explicit non-goal in the README rather than a module. |

Two of these are also cert-reinforced: networking maps to Security+ 3.2/2.2, identity to
4.6. Both are worth acting on. The others are worth *disclosing* rather than building —
see recommendations.

### 4. `Incident-Response-Policy.md` is 52 KB and the curriculum uses a sliver of it

Tier 1 Module 8 is scoped to "Escalation basics & documentation." The source file carries
the **complete PICERL lifecycle** — verified headings at
`Documentation-Templates/Incident-Response-Policy.md`: `Preparation` (L131),
`Identification` (L18), `Containment` (L21), `Eradication` (L22), `Recovery` (L23),
`Lessons Learned` (L26) — plus an ATT&CK-in-investigation section (L254) and a
centralized-logging/NTP rationale section (L260) that would strengthen T1-2.

This matters because **containment actions** ("isolate host, disable accounts") are named
by 4 of 9 sources as a Tier 2 requirement, and PICERL is GCIH objective 6 — the one
GCIH objective genuinely in this curriculum's lane. The content is already licensed,
already in the repo, and already verified. **No new authoring is required to close it.**

### 5. `Lab/Generate-Suspicious-Activity*.ps1` is unmapped and is the missing exercise-data source

Three PowerShell generators (10.7 KB / 249 lines, 16.5 KB / 322 lines, 1.9 KB) emit the
exact Windows Security Event IDs that Module 3 — the confirmed Phase 1 pilot — teaches.
They are **self-labeling**: each block is commented with the Event ID it produces
(`# Create Local User (Security 4720)`, `# Add to Domain Admins (Security 4728 add, 4729
remove on DC)`, `# Reset User Password (4724)`, `# Create a Service (Security 4697)`,
`# Create Scheduled Task (Security 4698)`, …), and the set includes a LOLBins variant.

That gives a ready-made, ground-truth-labeled mapping from *action taken* → *event
produced*, which is precisely the artifact needed for Capstone 1's three-alert triage sim
and for Module 3's drag-to-classify exercises. Currently absent from `curriculum-map.md`
and from `execution.md`. This is the single highest-leverage unmapped asset in the source
repo.

*Caveat:* these are live telemetry generators intended for a lab domain. They must be
treated as **read-only parsing input** for the content pipeline. Nothing in SEIM-Academy
should execute them, and the build script must not shell out to PowerShell.

### 6. Confirmations — no change needed

- **Windows Event ID triage as the Phase 1 pilot is validated by the market.** One guide
  names "Windows Event IDs, registry, process model" as essential; another names
  4624/4625/4688 explicitly. Decision 4 stands, and stands on evidence now.
- **Threat hunting (T2-8) is correctly placed at Tier 2** and is described by two sources
  as one of the fastest-rising things employers ask about.
- **Sigma authoring (T2-5) matches posting language** ("write custom detection rules in
  Sigma and YARA"). YARA is the only miss and is a minor one.
- **MITRE ATT&CK literacy (T1-6) is explicitly named** in Tier 1 requirements, including
  Cloud ATT&CK. Keep it in Tier 1, not Tier 2.
- **Documentation and case-management discipline (T1-7, T1-8) is real work**, not filler —
  ServiceNow/Jira case notes and handoff quality are named repeatedly.

---

## Recommendations

Proposals only — none applied to `curriculum-map.md` or `execution.md` pending approval.

**Build (closes a market gap with content already in the repo):**

1. **Expand T1-8 to the full PICERL lifecycle**, renaming it *Incident lifecycle:
   identify → contain → eradicate → recover → learn*, sourced from the unused 90% of
   `Incident-Response-Policy.md`. Escalation becomes one beat inside it. Closes finding 4;
   picks up Security+ 4.8 and GCIH 6 outright. Cost: re-scoping one module, no new source.
2. **Map `Lab/Generate-Suspicious-Activity*.ps1` into Module 3 and Capstone 1** as
   labeled exercise-data input. Closes finding 5. Cost: one parser branch in
   `build-content`, which Phase 1 is about to be written anyway — cheapest possible time
   to absorb it.
3. **Add a Tier 1 module: cloud & identity telemetry**, from `sigma/pipelines/cloudtrail.yml`,
   `Lookups/o365-principalappid.csv`, `hardening/microsoft-365-azure-ad.md`,
   `hardening/microsoft-365-sharepoint-and-onedrive.md`. Closes findings 3.4 and 3.5
   partially, and Security+ 4.6. This is the only genuinely new module proposed.

**Disclose rather than build** — the source repo cannot support these honestly, and
faking them is worse than a stated boundary. Put them in the README as named non-goals
with a pointer to where to learn them:

4. Networking fundamentals (finding 3.1) — declare it a **prerequisite**, not a gap.
5. EDR/XDR hands-on (3.2) and phishing triage (3.3) — no licensed source; a v2 candidate.
6. Scripting (3.6) — explicit non-goal.

**Reposition:**

7. **Replace GCIH with CySA+** as the Tier 2 alignment target (finding 2).
8. **State Security+ coverage precisely** — "Security Operations domain, ~28% of the
   exam, taught deeply" — rather than implying whole-exam prep (finding 1).

---

## Phase 0 exit check

| Exit criterion | Status |
|---|---|
| Curriculum map committed | ✅ `curriculum-map.md` @ `ec00a21` |
| Every source path verified | ✅ 31 specs → 177 files, 0 missing, 0 empty ([audit](20260904-phase0-content-audit.md)) |
| Modules cross-checked vs. job market | ✅ this document |
| Modules cross-checked vs. cert objectives | ✅ this document |

**Phase 0 is met.** Recommendations 1, 2, 7 and 8 are cheap and should land before Phase 1
writes the schema, because 1 and 2 change what `app-data-schema.md` must represent.
Recommendation 3 can follow Phase 1 without rework.

---

## Sources

Primary:
- [GIAC — GCIH exam certification objectives](https://www.giac.org/certifications/certified-incident-handler-gcih)

Secondary (Security+ objective transcription):
- [SecPlus Mastery — SY0-701 objectives](https://secplusmastery.com/security-plus-objectives)
- [CrucialExams — SY0-701 (V7) objectives](https://crucialexams.com/exams/comptia/security/sy0-701/p/comptia-security-sy0-701-v7-exam-objectives)
- [DestCert — Security+ 701 objectives](https://destcert.com/resources/security-plus-701-objectives/)

Role requirements (synthesized from postings):
- [Wiz — Tier 1 SOC analyst](https://www.wiz.io/academy/cloud-careers/soc-analyst-tier-1)
- [Cybersecurity Jobs List — SOC analyst career guide](https://cybersecurityjobslist.com/blog/soc-analyst-career-guide)
- [Exabeam — SOC analyst job description & responsibilities](https://www.exabeam.com/blog/security-operations-center/soc-analyst-job-description-skills-and-5-key-responsibilities/)
- [Vectra AI — SOC analyst roles, skills, career guide](https://www.vectra.ai/topics/soc-analyst)
- [CyberDefenders — how to become a SOC analyst](https://cyberdefenders.org/blog/start-your-career-as-a-soc-analyst/)
- [CyberDefenders — how to get your SOC analyst job](https://cyberdefenders.org/blog/soc-analyst-job/)
- [Prophet Security — SOC tiers explained](https://www.prophetsecurity.ai/blog/soc-tiers-are-out-how-ai-is-flattening-soc-tier-1-2-3)
- [KORE1 — how to hire a SOC analyst, 2026](https://www.kore1.com/how-to-hire-soc-analyst-2026/)
- [Riskitera — SOC analyst tiers explained](https://blog.riskitera.com/en/posts/2026/04/soc-analyst-roles-tiers-explained/)
