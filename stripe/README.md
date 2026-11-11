# Stripe ticketing for Summit and Exhibition 2027

Paid tickets are sold through **Stripe Payment Links**: Stripe-hosted checkout pages reached by a plain link from
`summit-tickets.html` and `exhibitions.html`. The website stays static (no backend, no Stripe script, decision D9).

```
stripe/catalogue.json              what is sold: names, prices, capacities, status   (edit this)
scripts/stripe/sync-catalogue.mjs  pushes the catalogue to Stripe, idempotently        (run this)
site/data/summit-tickets.json      public result: prices, status, Payment Link URLs   (generated, committed)
tools/render_tickets.py            writes the ticket cards into the two HTML pages     (run after a sync)
scripts/stripe/export-attendees.mjs  attendee list CSV for badges and check-in         (read-only)
```

## Requirements

- Node 18 or newer (`node --version`); no npm packages are needed.
- A Stripe **restricted API key** in the environment variable `STRIPE_API_KEY`. Never put it in a file, a commit,
  a Jira comment or a chat. Set it in your own terminal only:
  - PowerShell: `$env:STRIPE_API_KEY = "rk_test_..."`
  - bash/zsh: `export STRIPE_API_KEY=rk_test_...`
- Key permissions (Dashboard → Developers → API keys → Create restricted key; tick "Authorizing agent access to
  your account" so refunds and payouts stay behind approval rules):

| Resource | Permission | Used by |
|---|---|---|
| Products | Write | sync |
| Prices | Write | sync |
| Payment Links | Write | sync |
| Coupons, Promotion Codes | Write (optional: only if you want discount codes created by script later) | — |
| Checkout Sessions | Read | sync (sold counts), export |
| Payment Intents | Read | export |
| Charges | Read | export (to leave out refunded orders) |
| Everything else | None | |

Sandbox keys start with `rk_test_`, live keys with `rk_live_`. The scripts refuse a live key unless `--live` is
passed, and refuse `--live` with a sandbox key.

## Run it

```bash
node scripts/stripe/sync-catalogue.mjs --dry-run   # plan: what would be created or changed; no writes
node scripts/stripe/sync-catalogue.mjs             # apply in the sandbox
python tools/render_tickets.py                     # put the new prices/links into the HTML pages
python tools/check_site.py                         # 0 problems
git add stripe site/data site/*.html && git commit -m "SCRUM-1377: sync ticket catalogue"
```

A second real run must print `0 change(s) applied`. The dry run also works without a key (offline plan) and
lists every `TODO` still in the catalogue; a real run stops on any `TODO`.

## Change something

| To | Do |
|---|---|
| Change a price | Edit `price` in `catalogue.json`, run the sync. Stripe prices are immutable, so the script creates a new Price, deactivates the old one, **creates a new Payment Link** (its URL changes) and deactivates the old link. Re-render and commit. |
| Close a ticket type (early-bird ends, booths full) | Set `"status": "closed"` (or let `sales_end` pass) and run the sync: the link is deactivated and the card shows "Sales closed". Reopen with `"status": "on_sale"`. |
| Let a type sell out automatically | Set `capacity` to a number. Stripe deactivates the link after that many completed checkouts and the next sync marks the card "Sold out". `null` means unlimited. |
| Change what a ticket includes | Edit `includes`, run `python tools/render_tickets.py` (no sync needed). |
| Create a discount code | Dashboard → Product catalog → Coupons → Create coupon, then "Add promotion code" (for example `SPEAKER100`). Promotion codes are already enabled on every link. Customers type the code at checkout, or use `?prefilled_promo_code=CODE` on the link. |
| Refund an order | Dashboard → Payments → open the payment → Refund. The next attendee export leaves refunded orders out. |
| See how many sold | Dashboard → Payment links → the link → Payments and analytics, or run the export. |
| Turn tax on | Dashboard → Settings → Tax → activate, add registrations (GST/HST, QST), set the default product tax code; then set `"automatic_tax": true` in `catalogue.json` and run the sync. |

What the sync never does: delete anything, touch objects it did not create (it only looks at objects whose
`metadata.event` matches the catalogue), or run in live mode without `--live`.

## Attendee list

```bash
node scripts/stripe/export-attendees.mjs                 # sandbox orders -> exports/attendees-test-<date>.csv
node scripts/stripe/export-attendees.mjs --live          # real orders
node scripts/stripe/export-attendees.mjs --live --edition toronto --since 2027-01-01
```

One row per order with ticket type, quantity, buyer and organisation name, email, phone (booths), edition, names
of other attendees, dietary or accessibility needs, amounts, tax and discount. Refunded and unpaid orders are
left out (`--include-refunded` to keep them). `exports/` is git-ignored because the file contains personal data.

## Test cards (sandbox only)

`4242 4242 4242 4242`, any future expiry, any CVC and postal code. Declined: `4000 0000 0000 0002`.
