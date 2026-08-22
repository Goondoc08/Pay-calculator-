# Fire Operations Pay Plan — reference data

Source: official department pay plan documents (city council pay scale), not
personal data — safe to version alongside the rest of the project. Two documents
so far:

- **FY26**, effective 10/1/2025 (current, adopted)
- **FY27 proposed** — subject to change pending a possible COLA and City Council
  approval; not yet adopted

The app's `2912` rows are the ones that matter — that's the Fire Ops 14-day/106-hr
FLSA work period basis. The `2080` rows are the standard 40-hr week basis (used
elsewhere in the city) and should never feed the shift-pay engine. Worth an
importer guardrail: if a rate the app is about to use matches a `2080` figure
better than the corresponding `2912` figure, something upstream picked the wrong
column.

## FY26 pay plan (effective 10/1/2025)

| Classification | Grade | Step 0 | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 | Step 6 | Step 7 | Step 8 |
|---|---|---|---|---|---|---|---|---|---|---|
| Fire Fighter | F1 (2912) | 25.2779 | 26.0362 | 26.8173 | 27.6218 | 28.4505 | 29.3040 | 30.1831 | 31.0886 | 32.0213 |
| Driver Operator | F2 (2912) | 33.3021 | 34.3012 | 35.3302 | 36.3901 | | | | | |
| Fire Lieutenant | F3 (2912) | 37.8458 | 38.9811 | 40.1506 | 41.3551 | | | | | |
| Fire Captain | F4 (2912) | 43.0093 | 44.2996 | 45.6285 | 46.9974 | | | | | |
| Battalion Chief | F5 (2912) | 48.8773 | 50.3436 | 51.8539 | 53.4095 | | | | | |

(2080-hour equivalents also published per grade; omitted here — not used by this app.)

### Certification / education / assignment pay (2912-hour basis)

| Category | Level | $/hr |
|---|---|---|
| TCFP | Intermediate | 0.2061 |
| TCFP | Advanced | 0.4121 |
| TCFP | Master | 0.6181 |
| Education | Associate | 0.4121 |
| Education | Bachelor's | 0.6181 |
| Education | Master's | 0.8242 |
| Education | Doctorate | 1.0302 |
| EMT | Advanced | 0.6250 |
| EMT | Paramedic | 2.0604 |
| Bilingual | — | 0.3091 |
| Assignment | Inspector/Investigator | 0.2232 |
| Assignment | QA/QI Review | 1.1000 |

Matches the workbooks' Incentives tabs exactly.

### Step-up / ride-up pay — the actual rule

**Confirmed: riding up pays Step 0 of the rank you're covering, regardless of
your own current step.** Verified to the cent against both workbooks' Step-up
tables (FY27's `F2/F3/F4` step-up rates are exactly FY27's official Step 0 for
those grades):

- FF riding up as DO → Step 0 of F2
- FF riding up as FTO → Step 0 of F2 (same rate as DO, different role)
- DO riding up as LT → Step 0 of F3
- LT riding up as CP → Step 0 of F4
- CP riding up as BC → Step 0 of F5

This also resolves the `FD — Fire Ride Up Driver Diff` pay code seen on a real
check: it's the same mechanism as "step-up," just the payroll system's label for
riding up specifically into Driver/Operator (F2).

**Promotions** use the same Step 0 landing rule, permanently rather than for a
shift: FF→DO, DO→LT, LT→CP, and CP→BC promotions all land at Step 0 of the new
grade.

### Longevity

**"$4 a month for each year of service."** This is the underlying accrual rule
behind the `Last Longevity` figure the sheets ask for — but **longevity is paid
out on its own separate check, not blended into regular biweekly pay.** Same
scope call as top-out bonus below: out of scope for this app. The workbooks'
FLSA-premium longevity term (`+ longevity/2912 × OT × 0.5`) doesn't reflect how
this is actually paid and should be dropped from the engine, not ported. The
Setup screen doesn't need a longevity input at all.

### Top-out bonus

**Confirmed to still exist, but — like longevity — paid out on its own separate
check.** Resolves the earlier open question (it isn't a formula bug so much as a
field that was never going to be reachable from the regular-check math in the
first place). Out of scope for this app; no engine work needed.

### FLSA & overtime

Stated directly, not just inferred from formulas: **"Fire Ops 2912 Personnel are
assigned to a 14/106 FLSA work period."** Confirms the 106-hr threshold at the
source rather than by reverse-engineering the workbook. Also: comp time may
accumulate up to **120 hours**. (Out of scope for this app per the "we don't
track bank balances" decision, but worth knowing the cap exists if a future check
shows comp time being forced to cash out.)

### Step progression — changing under civil service

The FY26 plan text says step progression "occurs at the beginning of fiscal year
for employees in good standing." **That's changing.** Moving to civil service:
step progression now lands on each member's own **hire date or promotion date**,
not a single fiscal-year event — so it varies per person going forward.
**Market adjustments** (COLA-type, whole-table shifts) still land at fiscal year
start, October 1.

This means two structurally different kinds of rate change, not one:

1. **Step progression** — per-person, triggered by hire/promotion anniversary,
   moves you to the next step within your current grade's table.
2. **Market adjustment** — department-wide, triggered at FY start, shifts the
   whole pay table (this is why FY26 and FY27's tables differ even within the
   same step).

The FY27 workbook's anniversary-based raise mechanic wasn't a guess or an
over-engineering — it was anticipating exactly this. The workbook's flat "+3%"
approximates a one-step jump reasonably well (FY26's own step-to-step deltas run
almost exactly 3%), but the more correct implementation is a table lookup
(next step's rate in the same grade), not a percentage multiplier, now that the
official step tables are in the repo.

**Scope call for v1:** don't build automatic rank/step/date tracking yet. Keep
asking for the member's current rate directly in Setup, same as today — when a
step lands or a market adjustment hits, the member updates it manually, the same
moment they'd notice it on a real check. Capturing the official tables now means
a v2 "track my step automatically" feature is a data lookup away, without
redesigning anything.

**Mid-period proration — resolved: pay periods can carry split rates.**
Confirmed directly: "the step change will occur on the date so your pay period
could have split pay rates." Not whole-period, not deferred to the next period —
a period spanning a step date pays part at the old rate and part at the new one.
This is now a near-universal case under civil service (personal hire/promotion
dates), not a rare shared-date edge case, so getting the split right matters for
a lot of checks.

This is a real engine requirement, not just a data question: `computePeriod`
can't treat a period's rate as one constant — it needs to split the period's
hours at the step-date boundary and price each side separately. The `raise`
field in the year file (or its v2 replacement) needs to carry an effective date
precise enough to do that split, and a period-level test with a mid-period step
change belongs in the Phase 02 test suite as a first-class case, not an edge
case.

## FY27 proposed pay plan

**Not yet adopted** — pending a possible COLA and City Council approval. Treat as
provisional; don't ship as the live FY27 year file until confirmed.

| Classification | Grade | Step 0 | Step 1 | Step 2 | Step 3 | Step 4 |
|---|---|---|---|---|---|---|
| Fire Fighter | F1 (2912) | 26.8173 | 27.6218 | 28.4505 | 29.3040 | 30.1831 |
| Driver Operator | F2 (2912) | 35.3302 | 36.3901 | 37.4818 | 38.6063 | 39.7644 |
| (merged officer rank — name TBD) | F3 (2912) | 41.7566 | 43.0093 | 44.2996 | 45.6286 | 46.9974 |
| Battalion Chief | F4 (2912) | 48.8773 | 50.3436 | 51.8539 | 53.4095 | |

(F1 table also extends to Step 8; only the lower steps shown above for brevity —
full table matches FY26's F1 Step 2–8 shifted down two steps, plus two new
top steps.)

### The officer-rank merger

**FY27 combines Lieutenant (F3) and Captain (F4) into a single officer rank —
official name not yet decided, likely "Captain."** This is why FY27 has one
fewer grade than FY26 (F1–F4 instead of F1–F5; the old F5/Battalion Chief becomes
the new F4).

The new merged grade's Step 0 ($41.7566) sits between the old F3/Lieutenant
Step 0 ($37.8458) and the old F4/Captain Step 0 ($43.0093) — a genuinely new pay
point, not a renaming of an existing one. Its higher steps (1–4) match the old
Captain's steps 0–3 exactly. Consistent with "merging two ranks into one":
the combined scale gets a new entry point below the old Captain floor, and
preserves the old Captain's progression above it.

**Action item once council votes and the rank is named:** update the FY27 year
file's grade list and step-up destinations (nothing currently reads "LT" or "CP"
as a promotion target in the engine, so this is a data change, not a code
change).
