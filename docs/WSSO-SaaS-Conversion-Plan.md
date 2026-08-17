# WSSO → SaaS Conversion Plan  
## Schedule for 1 developer · 8 hours/day · Mon–Fri (Sat & Sun OFF)

**Document type:** Internal delivery plan  
**Version:** 1.0  
**Date:** August 2026  
**Assumption:** One full-stack engineer, focused on this work only  

---

## Work calendar rules

| Rule | Value |
|---|---|
| Work day | **8 hours** |
| Work week | **Monday – Friday** |
| Weekend | **Saturday & Sunday = OFF** |
| Hours per week | **40 hours** |
| Buffer | ~10% for bugs / meetings (built into estimates) |

**How to read dates:** Week 1 starts on the **first Monday** you begin this project.  
Example: if you start **Mon 17 Aug 2026**, Week 1 = Aug 17–21, weekend Aug 22–23 OFF.

---

## Choose your track first

| Track | What you ship | Calendar time | When to use |
|---|---|---|---|
| **Track A — Dedicated “SaaS-like”** | Per-client Vercel + Supabase, sell subscription | **2 weeks** (10 work days) | Need to sell soon |
| **Track B — Real multi-tenant SaaS** | One app, many orgs, signup + Stripe | **12 weeks** (60 work days) | Want self-serve shared product |

**Recommended sequence:** Finish **Track A** first (sell), then run **Track B** (scale).  
If you only want true SaaS, skip to Track B (still ~12 weeks).

---

# Track A — Dedicated instance packaging  
## 2 weeks · 10 work days · 80 hours

**Goal:** Deploy a clean WSSO copy for Client #1 with branding env vars + bootstrap checklist. Charge monthly/annual (Model B in sales guide).

### Week 1 — Make it client-ready (Mon–Fri)

| Day | Focus (8h) | Done when |
|---|---|---|
| **Mon** | Inventory env vars; remove TLB hardcoding from emails / defaults | Branding comes from env only |
| **Tue** | Write `.env.client.example` + deploy notes (Supabase + Vercel) | New person can follow steps |
| **Wed** | Bootstrap script/checklist: create first admin, seed minimal company | New project boots in &lt;1 hour |
| **Thu** | Per-client domain, auth redirect URLs, smoke test auth + invite | Login + invite works on new project |
| **Fri** | Buffer: fix deploy issues; document client handoff | Handoff doc ready |

**Weekend:** OFF

### Week 2 — Sellable ops (Mon–Fri)

| Day | Focus (8h) | Done when |
|---|---|---|
| **Mon** | Stripe (or invoice) for “Dedicated plan” — Customer + Subscription | Can charge $499/mo (or your price) |
| **Tue** | Webhook: mark instance active / suspended (even if manual suspend OK v1) | Paid → active documented |
| **Wed** | Onboarding SOW template + quote sheet from sales guide | Sales can send quote same day |
| **Thu** | Dry-run: spin second empty project as “fake client” | Second instance works |
| **Fri** | Polish README / internal runbook; freeze Track A v1 | Ready to take first paying client |

**Track A exit:** You can sell dedicated WSSO on subscription without multi-tenant code.

---

# Track B — Real multi-tenant SaaS  
## 12 weeks · 60 work days · ~480 hours

**Goal:** Shared WSSO where each paying customer is an **organization** with isolated data, self-serve (or assisted) signup, seat limits, and Stripe billing.

### Phase overview

| Phase | Weeks | Work days | Hours | Outcome |
|---|---|---|---|---|
| **1. Tenant foundation** | 1–3 | 15 | 120 | `organizations` + org_id on data |
| **2. RLS & security** | 4–6 | 15 | 120 | Tenant A cannot read Tenant B |
| **3. Signup & onboarding** | 7–8 | 10 | 80 | Create org + first admin |
| **4. Billing & seats** | 9–10 | 10 | 80 | Stripe plans + seat enforce |
| **5. Platform + launch** | 11–12 | 10 | 80 | Admin console, tests, soft launch |

---

## Phase 1 — Tenant foundation  
### Weeks 1–3 (Mon–Fri only)

### Week 1 — Design + org table

| Day | Focus (8h) |
|---|---|
| **Mon** | Decide model: shared DB + RLS (locked). Sketch `organizations` fields (id, slug, name, plan, status, stripe ids) |
| **Tue** | Migration: create `organizations`; create first org for current TLB data |
| **Wed** | Add `organization_id` to `profiles`; backfill; update types |
| **Thu** | Map every business table → needs `organization_id`? Write checklist from schema |
| **Fri** | Start adding `organization_id` to highest-traffic tables (companies, teams, clients, projects) |

**Weekend:** OFF  
**Week 1 checkpoint:** Org exists; profiles belong to an org.

### Week 2 — Propagate org_id

| Day | Focus (8h) |
|---|---|
| **Mon** | Migrate tactics / documents / time / leave / activity tables |
| **Tue** | Migrate worksheets, announcements, notifications |
| **Wed** | Migrate CRM leads + training tables (decide: org-owned vs platform catalog) |
| **Thu** | Fix unique codes → unique per org `(organization_id, code)` |
| **Fri** | App compile + fix TypeScript / queries that break after schema change |

**Weekend:** OFF  
**Week 2 checkpoint:** All critical rows have `organization_id`.

### Week 3 — App wiring (pre-RLS)

| Day | Focus (8h) |
|---|---|
| **Mon** | `get_my_org_id()` helper (SQL + TS); session includes org |
| **Tue** | Server actions: always filter by org on reads/writes (companies, teams, users) |
| **Wed** | Same for tactics, leave, time, worksheets |
| **Thu** | Same for CRM, training, announcements, MCP tool queries |
| **Fri** | Manual smoke: app still works for current single org |

**Weekend:** OFF  
**Phase 1 exit:** App runs on org-aware schema (isolation not yet proven via RLS).

---

## Phase 2 — RLS rewrite & service-role cleanup  
### Weeks 4–6

### Week 4 — Core RLS

| Day | Focus (8h) |
|---|---|
| **Mon** | Rewrite `profiles` + `companies` + `teams` policies → same org only |
| **Tue** | Clients, projects, employee_companies policies |
| **Wed** | Tactics family + documents policies |
| **Thu** | Time logs, leave, activity, notifications |
| **Fri** | Worksheet + announcement policies; fix breaks |

**Weekend:** OFF

### Week 5 — Remaining RLS + storage

| Day | Focus (8h) |
|---|---|
| **Mon** | Leads / training policies (org-scoped) |
| **Tue** | Storage paths `org/{org_id}/…` + storage policies |
| **Wed** | Audit every `supabaseAdmin` usage; add mandatory org filter |
| **Thu** | Continue admin-client audit (users invite, cron, MCP) |
| **Fri** | Write cross-tenant test cases (manual checklist first) |

**Weekend:** OFF

### Week 6 — Prove isolation

| Day | Focus (8h) |
|---|---|
| **Mon** | Create Org B test users; attempt reads of Org A (must fail) |
| **Tue** | Fix any leaks found (expect 1–2 days of fixes) |
| **Wed** | Continue leak fixes; manager/director must not see other orgs |
| **Thu** | MCP: confirm token only sees own org data |
| **Fri** | Document security model; freeze Phase 2 |

**Weekend:** OFF  
**Phase 2 exit:** Documented proof: Tenant A ̸̸ Tenant B.

---

## Phase 3 — Signup & org onboarding  
### Weeks 7–8

### Week 7 — Self-serve create workspace

| Day | Focus (8h) |
|---|---|
| **Mon** | `/signup` UI: company name, admin email/password |
| **Tue** | API: create auth user + org + profile (admin) in one flow |
| **Wed** | Slug uniqueness, validation, error states |
| **Thu** | Invite flow scoped to caller’s org (not global admin) |
| **Fri** | Allow org admin to invite director/manager/employee |

**Weekend:** OFF

### Week 8 — Polish onboarding

| Day | Focus (8h) |
|---|---|
| **Mon** | Post-signup checklist (create first company/team optional) |
| **Tue** | Remove TLB-only branding; platform default + optional org name in emails |
| **Wed** | Middleware: org context on every authenticated request |
| **Thu** | Suspended org → block login / show billing message (stub OK) |
| **Fri** | E2E happy path: signup → invite → login as employee |

**Weekend:** OFF  
**Phase 3 exit:** New customer can create a workspace without you touching Supabase manually.

---

## Phase 4 — Billing & seats  
### Weeks 9–10

### Week 9 — Stripe core

| Day | Focus (8h) |
|---|---|
| **Mon** | Stripe products: Starter / Growth / Business (from sales guide) |
| **Tue** | Checkout session for new or existing org |
| **Wed** | Webhooks: `checkout.session.completed`, `customer.subscription.updated/deleted` |
| **Thu** | Persist plan + seat limit on `organizations` |
| **Fri** | Customer portal link (update payment method / cancel) |

**Weekend:** OFF

### Week 10 — Entitlements

| Day | Focus (8h) |
|---|---|
| **Mon** | Enforce seat limit on invite API |
| **Tue** | Annual vs monthly price IDs; test both |
| **Wed** | Trial (14 days) or paid pilot flag |
| **Thu** | Billing UI page (plan, seats used, upgrade CTA) |
| **Fri** | Failure modes: past_due, canceled → read-only or lock |

**Weekend:** OFF  
**Phase 4 exit:** Money → seats → access works end-to-end in test mode.

---

## Phase 5 — Platform admin & soft launch  
### Weeks 11–12

### Week 11 — Platform layer

| Day | Focus (8h) |
|---|---|
| **Mon** | `platform_admin` role (separate from org admin) |
| **Tue** | Internal console: list orgs, plan, status, seat count |
| **Wed** | Suspend / reactivate org |
| **Thu** | Data export basics (org dump) — sales guide promise |
| **Fri** | Cron / jobs tenant-safe |

**Weekend:** OFF

### Week 12 — Soft launch

| Day | Focus (8h) |
|---|---|
| **Mon** | Full regression: auth, roles, modules, MCP |
| **Tue** | Cross-tenant retest; fix last leaks |
| **Wed** | Production Stripe live keys + runbook |
| **Thu** | Onboard **1 design-partner client** (paid or discounted) |
| **Fri** | Retrospective notes; v1.0 SaaS freeze; backlog for v1.1 |

**Weekend:** OFF  
**Phase 5 exit:** Soft-launched multi-tenant SaaS with one real (or pilot) customer.

---

## 12-week calendar at a glance

```text
WEEK    MON–FRI THEME                         WEEKEND
────    ─────────────────────────────────     ───────
 1      Org table + profiles                  OFF
 2      org_id on all tables + codes          OFF
 3      App queries org-aware                 OFF
 4      Core RLS rewrite                      OFF
 5      Storage + admin-client audit          OFF
 6      Cross-tenant proof                    OFF
 7      Signup + org invites                  OFF
 8      Onboarding polish                     OFF
 9      Stripe checkout + webhooks            OFF
10      Seats + billing UI                    OFF
11      Platform admin + export               OFF
12      Soft launch                           OFF
```

**Total:** 12 weeks × 5 days × 8 hours = **480 hours**  
**Calendar span:** ~3 months of weekdays (weekends free)

---

## If you only have evenings / slip weeks

| Slip type | What to cut first (keep isolation) |
|---|---|
| Need MVP 2 weeks sooner | Drop platform console polish; do Stripe test-mode only; assisted signup (you create org) instead of fancy UI |
| Need MVP 4 weeks sooner | **Do Track A only**; defer Track B |
| Behind in Phase 2 | **Do not** start Stripe until isolation tests pass |

**Non-negotiable before any paying SaaS tenant on shared DB:** Phase 2 complete (no cross-tenant reads).

---

## Daily rhythm (suggested)

| Block | Hours | Use |
|---|---|---|
| Deep build | 5–6h | Schema, RLS, features |
| Integration / test | 1.5–2h | Run app, invite flows, tenant tests |
| Notes | 0.5h | Update this plan: Done / Blocked / Next Mon |

Friday of each week = **checkpoint day** (see “Done when” / phase exits).  
If Friday checkpoint fails, use next Mon–Tue to recover before starting new phase work.

---

## Combined recommendation (sell + build)

| When | What |
|---|---|
| **Weeks 1–2** | **Track A** — start selling dedicated |
| **Weeks 3–14** | **Track B** — build real SaaS (12 weeks) while dedicated clients pay |
| **After Week 14** | Migrate willing dedicated clients onto shared SaaS (optional project) |

If you run Track A then Track B back-to-back: **~14 weeks** calendar (weekdays only), weekends still yours.

---

## Progress checklist (copy into Notion / sheet)

### Track A
- [ ] Week 1 packaging done  
- [ ] Week 2 billing + second instance dry-run done  
- [ ] First paid dedicated client possible  

### Track B
- [ ] Week 1–3 tenant foundation done  
- [ ] Week 4–6 RLS isolation proven  
- [ ] Week 7–8 signup works  
- [ ] Week 9–10 Stripe + seats work  
- [ ] Week 11–12 soft launch done  

---

## Revision log

| Version | Date | Notes |
|---|---|---|
| 1.0 | Aug 2026 | 8h/day Mon–Fri plan for Track A (2w) + Track B (12w) |
