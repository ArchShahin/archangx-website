#!/usr/bin/env node
// Exports completed, paid, non-refunded ticket orders from Stripe into a CSV for badge printing and door
// check-in. Read-only: needs a restricted key with Read on Checkout Sessions, Payment Intents and Charges.
//
//   node scripts/stripe/export-attendees.mjs                 sandbox orders -> exports/attendees-<date>.csv
//   node scripts/stripe/export-attendees.mjs --live          live orders (rk_live_ key)
//   node scripts/stripe/export-attendees.mjs --since 2027-01-01 --edition toronto --include-refunded
//
// The exports/ folder is git-ignored: the file holds personal data. Delete it when the event is over.

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Stripe, ROOT, loadKey, readCatalogue, fail } from "./stripe-api.mjs";

const argv = process.argv.slice(2);
const flag = n => argv.includes(n);
const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
for (const a of argv) if (a.startsWith("--") && !["--live", "--since", "--edition", "--include-refunded", "--out"].includes(a)) fail(`unknown option ${a}`);

const cat = readCatalogue();
const { key, livemode } = loadKey({ live: flag("--live") });
const stripe = new Stripe(key);
const since = opt("--since") ? Math.floor(new Date(opt("--since")).getTime() / 1000) : undefined;
const edition = opt("--edition");
const includeRefunded = flag("--include-refunded");
const out = opt("--out") || path.join(ROOT, "exports", `attendees-${livemode ? "live" : "test"}-${new Date().toISOString().slice(0, 10)}.csv`);

const rows = [];
let scanned = 0, skipped = { unpaid: 0, refunded: 0, other: 0 };
for await (const s of stripe.list("/checkout/sessions", { status: "complete", created: since ? { gte: since } : undefined, expand: ["data.line_items", "data.payment_intent.latest_charge"] })) {
  scanned++;
  const k = s.metadata?.catalogue_key;
  if (!k || s.metadata?.event !== cat.event) { skipped.other++; continue; }
  if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") { skipped.unpaid++; continue; }
  const charge = s.payment_intent?.latest_charge;
  const refunded = !!(charge && (charge.refunded || charge.amount_refunded > 0));
  if (refunded && !includeRefunded) { skipped.refunded++; continue; }
  const cf = Object.fromEntries((s.custom_fields || []).map(f => [f.key, f.dropdown?.value ?? f.text?.value ?? f.numeric?.value ?? ""]));
  if (edition && cf.edition !== edition) continue;
  const li = s.line_items?.data?.[0];
  rows.push({
    order: s.id, paid_at: new Date(s.created * 1000).toISOString(), edition: cf.edition || "", ticket_key: k, ticket: li?.description || k, quantity: li?.quantity ?? 1,
    buyer_name: s.collected_information?.individual_name || s.customer_details?.name || "", organisation: s.collected_information?.business_name || "",
    email: s.customer_details?.email || "", phone: s.customer_details?.phone || "", other_attendees: cf.attendees || "", needs: cf.needs || "",
    amount_total: (s.amount_total / 100).toFixed(2), currency: (s.currency || "").toUpperCase(), tax: ((s.total_details?.amount_tax || 0) / 100).toFixed(2),
    discount: ((s.total_details?.amount_discount || 0) / 100).toFixed(2), refunded: refunded ? "yes" : "no", payment_intent: typeof s.payment_intent === "object" ? s.payment_intent?.id : s.payment_intent || "",
    livemode: s.livemode ? "live" : "test",
  });
}
rows.sort((a, b) => a.edition.localeCompare(b.edition) || a.ticket_key.localeCompare(b.ticket_key) || a.buyer_name.localeCompare(b.buyer_name));

const cols = Object.keys(rows[0] || { order: 1, paid_at: 1, edition: 1, ticket_key: 1, ticket: 1, quantity: 1, buyer_name: 1, organisation: 1, email: 1, phone: 1, other_attendees: 1, needs: 1, amount_total: 1, currency: 1, tax: 1, discount: 1, refunded: 1, payment_intent: 1, livemode: 1 });
const q = v => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = [cols.join(","), ...rows.map(r => cols.map(c => q(r[c])).join(","))].join("\r\n") + "\r\n";
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, "﻿" + csv); // BOM so Excel opens accents correctly

const seats = rows.reduce((n, r) => n + Number(r.quantity), 0);
console.log(`${scanned} completed sessions scanned; ${rows.length} orders / ${seats} seats exported to ${path.relative(ROOT, out)}`);
console.log(`skipped: ${skipped.unpaid} unpaid, ${skipped.refunded} refunded, ${skipped.other} not from this catalogue`);
const byType = {};
for (const r of rows) byType[`${r.edition || "-"} / ${r.ticket_key}`] = (byType[`${r.edition || "-"} / ${r.ticket_key}`] || 0) + Number(r.quantity);
for (const [k, n] of Object.entries(byType).sort()) console.log(`  ${k.padEnd(40)} ${n}`);
