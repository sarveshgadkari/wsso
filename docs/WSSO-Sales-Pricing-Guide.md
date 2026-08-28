# WSSO Sales & Pricing Guide  
## How we sell to clients (US market)

**Document type:** Internal commercial / pricing playbook  
**Version:** 1.0  
**Date:** August 2026  
**Prepared for:** WSSO sales & founders  
**Prepared by:** WSSO team  

**Currency:** All prices in **USD ($)**  
**Market:** United States (SMB / mid-market workforce teams)

---

## 1. What we are selling

**WSSO** is a workforce / employee operations platform (Next.js + Supabase) with optional **MCP** access so AI agents can use company workforce data under the same permissions as a signed-in user.

Clients can buy WSSO in **three commercial shapes**:

| Model | What the client gets | Who hosts | Best for |
|---|---|---|---|
| **A. SaaS (multi-tenant)** | Login to our shared app | We host (one Vercel + one Supabase) | Most clients; recurring revenue |
| **B. Dedicated instance** | Their own WSSO copy + their own DB | We provision Vercel + Supabase **per client** | Compliance, isolation, “our own stack” |
| **C. Product license (one-time)** | Source / deployable product | Client hosts (or we host for a fee) | Buy-once buyers; agencies; long-term ownership |

Maintenance, support, and custom features are **add-ons** on top of any model.

---

## 2. Hosting reality (why costs differ)

Today we run roughly:

| Service | Typical starter cost (US) | Role |
|---|---|---|
| Supabase | ~**$25/mo** (Pro) | Auth, DB, RLS, storage |
| Vercel | ~**$20/mo** (Pro) | Next.js app + MCP API routes |
| **Infra floor** | ~**$45/mo** | Before our profit / support |

### Option A — SaaS (recommended default)

- **One** Supabase project + **one** Vercel project for many clients (tenants).
- Client pays **subscription only** (no separate “$25 + $20” line item).
- We absorb infra and grow capacity as usage grows.
- Best margin once you have several paying orgs.

### Option B — Dedicated per client

- Duplicate stack: **their** Supabase + **their** Vercel (or same Vercel team with separate project).
- Infra passes through at ~**$45/mo** (or we include it in a higher plan).
- Plus **our platform / management fee**.
- Use when client demands data isolation, custom domain only on their cloud, or enterprise procurement.

### Option C — License (client owns the product)

- Client pays a **one-time license**.
- They can self-host (their cloud bill) **or** pay us monthly/yearly for hosting + maintenance.
- Custom work is always separate.

> **Rule of thumb:** Sell **SaaS first**. Offer dedicated only when isolation or procurement requires it. Offer one-time license when the buyer will not accept subscription.

---

## 3. Pricing philosophy (US)

1. **Price the outcome** (workforce ops + AI/MCP), not the raw Supabase/Vercel bill.
2. Prefer **per-organization + seats** so revenue scales with company size.
3. Always offer **monthly and annual** (annual = ~2 months free).
4. Keep **one-time**, **recurring**, and **custom** as separate line items so deals stay clear.
5. Never sell infra at cost without a management fee — support is where time goes.

---

## 4. Model A — SaaS subscription (our hosted product)

### 4.1 Who it is for

Companies that want WSSO live quickly, without managing Supabase/Vercel.

### 4.2 Seat-based plans (suggested US list)

| Plan | Seats included | Monthly | Annual (paid yearly) | Notes |
|---|---|---|---|---|
| **Starter** | Up to **10** users | **$99 / mo** | **$990 / yr** (~$82.50/mo) | Small teams, pilot |
| **Growth** | Up to **50** users | **$299 / mo** | **$2,990 / yr** (~$249/mo) | Typical SMB sweet spot |
| **Business** | Up to **150** users | **$699 / mo** | **$6,990 / yr** (~$582.50/mo) | Larger orgs, priority support |
| **Enterprise** | Custom | Custom | Custom | SSO, SLA, dedicated options, volume seats |

**Extra seats** (over plan limit):

| Plan | Extra seat |
|---|---|
| Starter / Growth | **$8 / user / mo** |
| Business | **$6 / user / mo** |
| Enterprise | Negotiated |

**Annual discount:** ~**17%** (pay for 10 months, get 12).

### 4.3 What is included (all SaaS plans)

- Hosted WSSO web app  
- Auth, roles, RLS-backed data isolation per org  
- Standard workforce modules shipped in product  
- MCP endpoint access for that org’s users (where enabled)  
- Email support (response targets by plan)  
- Product updates on the shared platform  

### 4.4 What is not included

- Custom features / integrations → **custom SOW** (Section 7)  
- Dedicated DB / single-tenant → **Model B**  
- Source-code ownership → **Model C**  
- On-site training / change management → optional add-on  

### 4.5 Example quotes

| Client | Users | Choice | Price |
|---|---|---|---|
| 8-person shop | 8 | Starter monthly | **$99/mo** |
| 40-person company | 40 | Growth annual | **$2,990/yr** |
| 120 users | 120 | Business monthly | **$699/mo** |
| 200 users | 200 | Business + 50 seats | **$699 + (50 × $6) = $999/mo** |

---

## 5. Model B — Dedicated instance (per-client stack)

### 5.1 Cost structure (what we must cover)

| Line | Amount | Who pays |
|---|---|---|
| Supabase Pro (per client) | ~**$25/mo** | Us first, billed into plan |
| Vercel Pro (per client) | ~**$20/mo** | Us first, billed into plan |
| **Infra floor** | ~**$45/mo** | Included in dedicated fee |
| Our platform + ops fee | See below | Client |

Do **not** sell dedicated as “just $45 + our small fee.” Ops, monitoring, upgrades, and support cost real time.

### 5.2 Suggested dedicated pricing (US)

| Item | Monthly | Annual |
|---|---|---|
| **Dedicated WSSO** (up to 50 users) | **$499 / mo** | **$4,990 / yr** |
| Extra seats | **$10 / user / mo** | Same, billed yearly × 12 |
| Custom domain + SSL | Included | Included |
| Separate Supabase project | Included | Included |
| Managed updates (minor) | Included | Included |

**Enterprise dedicated** (SSO, higher SLA, VPC / stricter isolation): **custom** — typically **$1,500–$4,000+/mo**.

### 5.3 How to explain it to the client

> “You get your own database and app environment. We manage it. Your subscription covers hosting (~$45 infra) plus our platform, security updates, and support.”

### 5.4 When to push dedicated

- Security / compliance review demands single-tenant  
- Client refuses multi-tenant SaaS  
- Heavy customizations that should not sit on shared SaaS  
- Partner / white-label deployments  

---

## 6. Model C — Product sale (one-time license)

### 6.1 One-time license (US list)

| Package | One-time fee | What they get |
|---|---|---|
| **Standard license** | **$4,500 – $7,500** | Deployable WSSO for **one** company / one production env |
| **Agency / multi-site license** | **$12,000 – $25,000** | Deploy for multiple end-clients (contract defines seat/site caps) |
| **Source + commercial rights** | **Custom ($25k+)** | Broader rights; legal review required |

Exact number depends on modules included, MCP, and whether we hand over deployment help.

### 6.2 After the one-time fee

| Add-on | Pricing | Notes |
|---|---|---|
| **Self-hosted** | Client pays their own cloud | We can bill setup once (Section 7) |
| **Hosted by us** | Same as dedicated recurring, or lighter **Hosted License Care** | e.g. **$199–$399/mo** |
| **Maintenance & support** | **15–20% of license / year** | Bugfixes, dependency updates, security patches |
| **Major version upgrades** | Included in maintenance **or** 30–40% of original license | Define in contract |
| **Custom features** | Time & materials / fixed SOW | Always separate |

**Example maintenance:**  
License **$6,000** → maintenance **$900–$1,200 / year** (or **$75–$100 / mo**).

### 6.3 Recommended packaging for “buy the product”

1. One-time **license**  
2. Optional **implementation / setup** (fixed)  
3. Optional **annual maintenance**  
4. Optional **hosting** (if we run Vercel + Supabase for them)  
5. Optional **custom** backlog  

---

## 7. Services & custom work (any model)

| Service | Typical US pricing |
|---|---|
| Implementation / onboarding | **$1,500 – $5,000** one-time |
| Data migration | **$1,000 – $4,000** (scope-dependent) |
| Training (remote) | **$500 – $1,500** per session |
| Custom feature (small) | **$1,500 – $5,000** |
| Custom feature (medium) | **$5,000 – $15,000** |
| Integration (HRIS, Slack, payroll, etc.) | **$2,500 – $20,000+** |
| Dedicated partner MCP integration support | **$2,000 – $8,000** or retainer |
| Hourly (when T&M) | **$100 – $175 / hr** |

Always use a short **Statement of Work (SOW)** for custom work: scope, timeline, acceptance, payment milestones.

---

## 8. Side-by-side comparison (how to choose on a sales call)

| Question | Recommend |
|---|---|
| “We just need it working this month” | **SaaS** |
| “We don’t want to manage servers” | **SaaS** |
| “Our security team wants our own DB” | **Dedicated** |
| “We want to own the software forever” | **License** + maintenance |
| “We’re an agency selling to many clients” | **Agency license** or white-label SaaS |
| “We need a weird custom workflow” | Any model + **custom SOW** |

### Margin sketch (internal)

| Model | Client pays (example) | Our approx cost | Notes |
|---|---|---|---|
| SaaS Growth | $299/mo | Shared infra << $45 | Best long-term margin |
| Dedicated 50 users | $499/mo | ~$45 + ops time | Isolation premium |
| License $6k + $1k maint/yr | Upfront heavy | Support time | Cash now, less recurring unless hosted |

---

## 9. Packaging we should sell first (default offer)

**Default public offer (US):**

1. **SaaS Growth — $299/mo or $2,990/yr** (up to 50 users)  
2. Extra seats **$8/user/mo**  
3. Optional onboarding **$2,500**  
4. Custom work only after paid discovery or clear SOW  

**Upsells:**

- Annual prepay  
- Business plan  
- Dedicated instance  
- MCP / AI agent enablement for partners  
- Maintenance (for license deals)  

---

## 10. Contract & billing basics

| Topic | Recommendation |
|---|---|
| Billing cycle | Monthly card **or** annual invoice |
| Payment | **Stripe** (workspace admin pays for the company). Invoice / Net-15 as Super Admin “Mark paid” backup only |
| Free trial | 14 days SaaS **or** paid pilot ($499) |
| Seat true-up | Monthly or quarterly |
| Data ownership | Client owns their data; export on request |
| Cancellation | SaaS: end of billing period; data export window 30 days |
| Dedicated teardown | 30-day notice; export + destroy confirmation |
| License | Non-exclusive unless paid for exclusivity |
| Custom IP | Client owns custom SOW deliverables **or** we retain platform IP — state clearly |

---

## 11. Objection handling (short scripts)

**“Why not just pay $25 Supabase + $20 Vercel myself?”**  
You’re not buying hosting — you’re buying a maintained product, auth/RLS, updates, MCP, and support. Self-hosting still needs engineering time every month.

**“Can we pay once and be done?”**  
Yes — Model C license. Hosting and maintenance are optional after that. Product still evolves; without maintenance you freeze on the version you bought.

**“We need our own database.”**  
Dedicated plan. Same product, isolated stack, higher monthly because infra and ops are not shared.

**“Prices feel high for a small team.”**  
Start with Starter ($99/mo) or a 14-day trial; move to Growth when seats grow.

---

## 12. Internal decision checklist before quoting

- [ ] SaaS vs dedicated vs license — which model?  
- [ ] Seat count (today + 12-month estimate)  
- [ ] Monthly vs annual  
- [ ] Onboarding / migration needed?  
- [ ] Any custom features (SOW)?  
- [ ] MCP / partner AI access required?  
- [ ] Compliance / single-tenant requirement?  
- [ ] Who hosts Supabase + Vercel?  

---

## 13. Sample quote templates

### Template A — SaaS annual

```text
WSSO Growth (SaaS) — up to 50 users
Annual subscription: $2,990
Onboarding (optional): $2,500
Total year 1: $5,490
```

### Template B — Dedicated

```text
WSSO Dedicated Instance — up to 50 users
Includes managed Supabase + Vercel environment
Monthly: $499
or Annual: $4,990
Extra seats: $10/user/mo
```

### Template C — Product license

```text
WSSO Standard License (one production company): $6,000 (one-time)
Implementation setup: $2,500 (one-time)
Annual maintenance (18%): $1,080/yr
Optional hosted care: $249/mo
Custom features: quoted separately via SOW
```

---

## 14. Summary recommendation

| Priority | Do this |
|---|---|
| **1** | Sell **multi-tenant SaaS** with seat tiers (monthly + annual) |
| **2** | Offer **dedicated** only when isolation is required; price well above raw $45 infra |
| **3** | Offer **one-time license** for ownership buyers + **annual maintenance** + optional hosting |
| **4** | Always separate **custom work** as paid SOWs |
| **5** | Keep US list prices simple; discount only on annual or multi-year enterprise |

We run WSSO for ourselves on shared Vercel + Supabase. That same pattern is the product we sell as SaaS. Duplicating Supabase + Vercel per client is a **premium delivery option**, not the default — and it must carry our fees, not just pass-through hosting.

---

## 15. Revision log

| Version | Date | Notes |
|---|---|---|
| 1.0 | Aug 2026 | Initial US sales & pricing playbook |
