# Operations: updating and running the website

## Change content

| To change | Edit | Notes |
|---|---|---|
| Text on a page | `site/<page>.html` | each page is self-contained HTML |
| Navigation or footer | the `<header class="site">` / `<footer class="site">` block in **every** page | keep them identical |
| Colours, spacing, layout | `site/assets/style.css` | shared by all pages |
| Logos and icons | `site/assets/` | keep the same file names, or update the references |
| Contact email | `contact.html`: the mailto link and the form script | search the pages for `@archangx.com` |
| Add a page | copy an existing page, change its content and `<title>`, add it to the nav in every page | the checker catches broken links |

Preview before publishing:
```bash
cd site && python -m http.server 8000     # open http://localhost:8000
python tools/check_site.py                # must report 0 problems
```

## Publish

```bash
git add site/ && git commit -m "Update <what>" && git push
```
GitHub Actions publishes in 1-2 minutes. Watch it in the repo's **Actions** tab; a red run means the checker found a
problem and the live site was **not** changed.

## Roll back

Every version is a commit. To undo the last change:
```bash
git revert HEAD && git push
```
The previous version is live again in 1-2 minutes.

## Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Deploy run is red at "Check every linked file exists" | a link or image path is wrong | run `python tools/check_site.py` locally, fix the listed paths |
| Change not visible | the page itself is cached for up to 10 minutes (GitHub Pages `max-age=600`) | check the Actions run finished, then reload normally; CSS and images get new URLs on every deploy, so no cache clearing is needed |
| Old styles or images still show after a deploy and a reload | that asset link isn't a plain double-quoted `assets/<file>` path (e.g. single quotes), so the deploy didn't add a hash to it | fix the link; see "Caching" in ARCHITECTURE.md. A hand-written `?v=` fails the link check instead |
| "Your connection isn't private" | certificate not issued yet, or expired | see DEPLOYMENT.md section 3 |
| Site shows "Website Expired" | DNS points back at Squarespace | check the DNS records in DEPLOYMENT.md section 2 |
| 404 "Site not found" from GitHub | custom domain removed in repo settings | Settings → Pages → custom domain `www.archangx.com` |
| Email stopped working | MX/TXT records changed | restore the Google Workspace records (DEPLOYMENT.md section 2) |

## Ticket sales (Summit and Exhibition 2027)

Tickets are Stripe Payment Links; the website only links to them (decision D9). Day-to-day tasks need the Stripe
Dashboard, not a developer. Full detail and the key permissions: [`stripe/README.md`](../stripe/README.md).

| Task | Where | How |
|---|---|---|
| See sales so far | Dashboard → Payment links → the link → *Payments and analytics* | or run `node scripts/stripe/export-attendees.mjs --live` for a CSV by type and edition |
| Refund an order | Dashboard → Payments → open the payment → **Refund** (full or partial) | Stripe emails the buyer; money returns in 5–10 business days. The next export leaves the order out |
| Cancel a ticket or transfer it to someone else | Refund (above) if within policy; for a transfer, note the new attendee name on the payment (*Add note*) | the export's `other_attendees`/notes are checked at the door |
| Create a discount code | Dashboard → Product catalog → Coupons → *Create coupon* → *Add promotion code* | codes work on every link; share `https://buy.stripe.com/...?prefilled_promo_code=CODE` |
| Close early bird on the agreed date | `stripe/catalogue.json`: set `"status": "closed"` on `summit-early-bird` (or set `sales_end`), run `node scripts/stripe/sync-catalogue.mjs --live`, `python tools/render_tickets.py`, commit and push on a branch | the link is deactivated and the card says "Sales closed" |
| Mark a type sold out by hand | same as closing; Stripe also closes a link automatically when `capacity` completed checkouts are reached | |
| Change a price | edit `price`, run the sync: a new link is created (new URL), the old one deactivated; re-render, commit | never change a Price in the Dashboard: the sync would undo it |
| Export the attendee list for badges and check-in | `node scripts/stripe/export-attendees.mjs --live --edition toronto` → `exports/attendees-live-<date>.csv` | personal data: keep it off shared drives, delete after the event |
| Reconcile payouts | Dashboard → Balance → Payouts: each payout lists the payments and Stripe fees it contains; *Export* for the bookkeeper. Match payout totals to the bank statement; record fees as an expense | Reports → *Balance summary* for a month-end view |
| Weekly sales report | Dashboard → Reports, or the export's per-type totals | tickets sold by type and edition, revenue, remaining capacity (`capacity - sold` in `site/data/summit-tickets.json`) |
| Dispute (chargeback) | Dashboard → Payments → Disputes: respond with the receipt, the attendee's check-in record and the refund policy | Shahin responds within the deadline Stripe shows |
| After the event | final export for the financial close (SCRUM-180); expire the restricted API key (Developers → API keys → ⋯ → Expire); delete `exports/` | |

Version 2, not built (needs Shahin's approval because it changes D1): a small webhook receiver (Cloud Run or a
Cloudflare Worker, ~US$0–5/month, plus an email API such as Postmark ~US$15/month) that issues QR-code tickets,
sends branded confirmation emails and offers scan-to-check-in.

## Regular checks

- Domain renewal: Squarespace, expires 2027-07-28.
- GitHub Actions: the runner images and action versions (`checkout`, `configure-pages`, `upload-pages-artifact`,
  `deploy-pages`) are updated by GitHub; bump the major versions in the workflow when GitHub announces deprecations.
