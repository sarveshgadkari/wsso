# WSSO SaaS — Supabase scripts

Run these in the **Supabase SQL Editor**, in order. Do not skip files.

After SQL is applied, the app already contains Super Admin, tenant isolation, signup, and billing.

| # | File | What it does |
|---|---|---|
| 1 | `01_add_super_admin_role.sql` | Adds `super_admin` to `user_role` |
| 2 | `02_organizations_and_tenant_columns.sql` | Creates `organizations`, adds `organization_id` to every business table, backfills current data into one workspace, per-org codes, seat helpers |
| 3 | `03_tenant_rls.sql` | Restrictive RLS so Tenant A cannot read Tenant B |
| 4 | `04_bootstrap_super_admin.sql` | **Edit the email**, then run — promotes you to platform Super Admin |
| 5 | `05_verify.sql` | Optional sanity checks (read-only) |
| 6 | `06_subscription_plans_and_payments.sql` | Dynamic plans Super Admin edits + payment records |
| 8 | `08_time_log_day_cap.sql` | Caps a work day at 24 hours and clips clock-out at local midnight |
| 9 | `09_workspace_ops.sql` | **Required for new ops features** — workspace settings, locations, leave types, custom fields, checklists, follow-ups, compliance, recurring jobs |

The same SQL is also copied to `supabase/migrations/20260828000001–03_saas_*.sql` so it stays in git history.

---

## Model

```
super_admin  (you — platform owner, no tenant)
   └── organizations  (each paying customer / workspace)
         ├── admin      (that customer's workspace owner)
         ├── director
         ├── manager
         └── employee
```

- One Vercel app + one Supabase project.
- Every business row belongs to an `organization_id`.
- Org **admin / director / manager / employee** only see their own workspace (RLS).
- **Super Admin** uses `/platform` to create orgs, set plan / seats, suspend, and create the first workspace admin.

Plans (from the sales guide):

| Plan | Seats |
|---|---|
| Trial (14 days) | 10 |
| Starter | 10 |
| Growth | 50 |
| Business | 150 |
| Enterprise | custom |

---

## After SQL

1. Run files `01` → `03`.
2. Open `04_bootstrap_super_admin.sql`, replace `YOUR_EMAIL_HERE` with your login email, run it.
3. Sign out and sign back in. You should land on **Platform** (`/platform`).
4. Existing company data stays in the backfilled workspace (`default` slug). **If you were the only admin**, open that workspace in Platform and invite a workspace admin so the original team can keep logging in.
5. New customers: `/signup` or Super Admin → New workspace.

---

## App routes added

| Route | Who |
|---|---|
| `/signup` | Public — create workspace + first admin |
| `/platform` | Super Admin only |
| `/platform/organizations/[id]` | Super Admin — org detail |
| `/settings/billing` | Workspace admin — plan & seats |

Set `NEXT_PUBLIC_SAAS_SIGNUP_ENABLED=false` to hide public signup (Super Admin can still create orgs).

---

## Stripe (payment gateway)

Workspace admins pay for the whole company from `/settings/billing`. Super Admin sets prices on `/platform/plans`. Checkout uses Stripe Subscriptions (inline `price_data`), so you do not need to create Products in the Stripe Dashboard when you change a plan in WSSO.

### Env (Vercel + `.env.local`)

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://your-domain
```

### Webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint  
2. URL: `{NEXT_PUBLIC_APP_URL}/api/billing/webhook`  
3. Events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`

Also enable **Customer portal** in Stripe (Settings → Billing → Customer portal) so admins can update the card, download invoices, or cancel.

### Flow

1. Org admin picks a plan → Stripe Checkout (or free-plan activate).
2. Webhook marks the workspace `active` and stores `stripe_customer_id` / `stripe_subscription_id`.
3. Renewals and failed cards update status from invoice/subscription events.
4. If they already subscribe to that plan, Billing opens the Stripe portal instead of a second Checkout.
5. Super Admin **Mark paid** is only for money collected outside Stripe (wire, invoice).

