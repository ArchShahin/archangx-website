#!/usr/bin/env node
// Creates or updates one Stripe Product, Price and Payment Link per entry in stripe/catalogue.json,
// idempotently, and writes the public link URLs to site/data/summit-tickets.json.
//
//   node scripts/stripe/sync-catalogue.mjs --dry-run      plan only, no writes (works without a key too)
//   node scripts/stripe/sync-catalogue.mjs                 apply in the sandbox (rk_test_ key)
//   node scripts/stripe/sync-catalogue.mjs --live          apply in live mode (rk_live_ key, only after Shahin's explicit go)
//
// Matching: Product by metadata.catalogue_key, Price by lookup_key "<event_slug>-<key>", Payment Link by
// metadata.catalogue_key. Running twice changes nothing. A changed price creates a new Price, deactivates the
// old one and, because a link's line items cannot be swapped, creates a new Payment Link and deactivates the
// old link (so the public URL changes: re-render the site afterwards).

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Stripe, ROOT, loadKey, readCatalogue, isTodo, toCents, money, fail } from "./stripe-api.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const live = args.has("--live");
for (const a of args) if (!["--dry-run", "--live"].includes(a)) fail(`unknown option ${a}`);

const cat = readCatalogue();
const OUT = path.join(ROOT, "site", "data", "summit-tickets.json");
const today = new Date().toISOString().slice(0, 10);

// ---- 1. validate the catalogue and list blockers -------------------------------------------------------
const blockers = [];
const autoTax = cat.automatic_tax === true ? true : cat.automatic_tax === false ? false : null;
if (autoTax === null) blockers.push(`automatic_tax is "${cat.automatic_tax}" (must be true or false)`);
const taxCode = isTodo(cat.tax_code) ? null : cat.tax_code || null;
if (isTodo(cat.tax_code)) blockers.push("tax_code is TODO (allowed: the Dashboard default applies until it is set)");
if (!/^https:\/\/www\.archangx\.com\//.test(cat.redirect_url)) blockers.push("redirect_url must be on https://www.archangx.com/");
const keys = new Set();
for (const p of cat.products) {
  if (keys.has(p.key)) blockers.push(`duplicate key ${p.key}`); keys.add(p.key);
  if (isTodo(p.price)) blockers.push(`${p.key}: price is TODO`);
  if (isTodo(p.capacity)) blockers.push(`${p.key}: capacity is TODO (use null for unlimited)`);
  if (isTodo(p.sales_end)) blockers.push(`${p.key}: sales_end is TODO (remove the field if sales simply close at the event)`);
  if (!["on_sale", "closed", "coming_soon"].includes(p.status || "on_sale")) blockers.push(`${p.key}: status must be on_sale, closed or coming_soon`);
  for (const line of p.includes || []) if (isTodo(line)) blockers.push(`${p.key}: an "includes" line is TODO`);
}
const hardBlockers = blockers.filter(b => !b.includes("tax_code"));

console.log(`${cat.event}: ${cat.products.length} products, currency ${cat.currency.toUpperCase()}, automatic tax ${autoTax ?? "TODO"}`);
if (blockers.length) {
  console.log(`\n${blockers.length} value(s) still need Shahin's decision (SCRUM-1374):`);
  for (const b of blockers) console.log("  - " + b);
}
if (hardBlockers.length && !dryRun) fail("the catalogue has TODO values; nothing was sent to Stripe. Fill them in and run again.", 1);

// ---- 2. desired state per product ----------------------------------------------------------------------
const slug = cat.event_slug || "summit2027";
const editionField = cat.editions?.length ? {
  key: "edition", type: "dropdown", optional: false,
  label: { type: "custom", custom: "Which edition will you attend?" },
  dropdown: { options: cat.editions.map(e => ({ label: e.label, value: e.value })) },
} : null;

function desiredFor(p) {
  const isBooth = p.kind === "booth";
  const todo = isTodo(p.price) || isTodo(p.capacity);
  const unitAmount = todo ? null : toCents(p.price);
  const capacity = p.capacity === null || p.capacity === undefined ? null : Number(p.capacity);
  const salesEnded = p.sales_end && !isTodo(p.sales_end) && p.sales_end < today;
  const active = (p.status || "on_sale") === "on_sale" && !salesEnded;
  const customFields = [editionField,
    isBooth ? null : { key: "attendees", type: "text", optional: true, label: { type: "custom", custom: "Names of the other attendees (if buying more than one)" } },
    isBooth ? null : { key: "needs", type: "text", optional: true, label: { type: "custom", custom: "Dietary or accessibility needs" } },
  ].filter(Boolean);
  return {
    product: { name: p.name, metadata: { catalogue_key: p.key, event: cat.event, managed_by: "scripts/stripe/sync-catalogue.mjs" }, tax_code: taxCode || undefined },
    lookupKey: `${slug}-${p.key}`,
    unitAmount,
    capacity,
    active,
    salesEnded,
    link: {
      allow_promotion_codes: true,
      billing_address_collection: "required",
      automatic_tax: { enabled: autoTax === true },
      after_completion: { type: "redirect", redirect: { url: `${cat.redirect_url}?t=${encodeURIComponent(p.key)}` } },
      phone_number_collection: { enabled: isBooth },
      name_collection: isBooth
        ? { business: { enabled: true, optional: false }, individual: { enabled: true, optional: false } }
        : { individual: { enabled: true, optional: false }, business: { enabled: true, optional: true } },
      custom_fields: customFields,
      restrictions: capacity ? { completed_sessions: { limit: capacity } } : undefined,
      inactive_message: cat.inactive_message,
      submit_type: "pay",
      metadata: { catalogue_key: p.key, event: cat.event },
      payment_intent_data: { metadata: { catalogue_key: p.key, event: cat.event } },
    },
    adjustable: { enabled: !isBooth, minimum: 1, maximum: isBooth ? 1 : 10 },
  };
}

// ---- 3. talk to Stripe ---------------------------------------------------------------------------------
let stripe = null, livemode = false;
if (process.env.STRIPE_API_KEY || !dryRun) { const k = loadKey({ live }); stripe = new Stripe(k.key, { dryRun }); livemode = k.livemode; }
else console.log("\n(no STRIPE_API_KEY: offline plan, assuming nothing exists in Stripe yet)");
console.log(dryRun ? "\nDRY RUN: nothing will be written.\n" : `\nApplying to ${livemode ? "LIVE MODE" : "the sandbox"}.\n`);

const existing = { products: new Map(), prices: new Map(), links: new Map() };
if (stripe) {
  for (const active of [true, false]) for await (const pr of stripe.list("/products", { active })) if (pr.metadata?.catalogue_key && pr.metadata?.event === cat.event) existing.products.set(pr.metadata.catalogue_key, pr);
  const lookupKeys = cat.products.map(p => `${slug}-${p.key}`);
  for await (const price of stripe.list("/prices", { lookup_keys: lookupKeys, active: true })) existing.prices.set(price.lookup_key, price);
  for await (const l of stripe.list("/payment_links", { expand: ["data.line_items"] })) if (l.metadata?.catalogue_key && l.metadata?.event === cat.event && l.active) existing.links.set(l.metadata.catalogue_key, l);
}

const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
function norm(v) { // drop undefined/null-ish and sort keys so Stripe's response compares equal to our request
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).filter(k => v[k] !== undefined && v[k] !== null).sort().map(k => [k, norm(v[k])]));
  return v;
}

const summary = [], output = [];
let changes = 0;
for (const p of cat.products) {
  const d = desiredFor(p);
  const log = m => console.log(`  ${m}`);
  console.log(`${p.key}  (${p.name})`);
  const row = { key: p.key, name: p.name, kind: p.kind, currency: cat.currency, includes: p.includes || [], sales_end: p.sales_end && !isTodo(p.sales_end) ? p.sales_end : null,
    capacity: d.capacity, price_cents: d.unitAmount, price_display: d.unitAmount === null ? null : money(d.unitAmount, cat.currency), url: null, status: "coming_soon", sold: 0 };

  if (d.unitAmount === null || isTodo(p.capacity)) { log("skipped: price or capacity is TODO"); summary.push([p.key, "blocked"]); output.push(row); continue; }
  if (!stripe) { log(`would create product, price ${row.price_display}, payment link (${d.active ? "active" : "inactive"})`); changes++; summary.push([p.key, "create"]); output.push(row); continue; }

  // Product
  let product = existing.products.get(p.key);
  if (!product) { product = await stripe.post("/products", d.product, `create product ${p.name}`); log("product: create"); changes++; }
  else {
    const patch = {};
    if (product.name !== d.product.name) patch.name = d.product.name;
    if ((product.tax_code || null) !== (taxCode || null) && taxCode) patch.tax_code = taxCode;
    if (!product.active) patch.active = true;
    if (Object.keys(patch).length) { await stripe.post(`/products/${product.id}`, patch, `update product ${Object.keys(patch).join(",")}`); log(`product: update ${Object.keys(patch).join(", ")}`); changes++; }
    else log("product: unchanged");
  }

  // Price (immutable: a changed amount creates a new one and moves the lookup key)
  let price = existing.prices.get(d.lookupKey);
  let priceChanged = false;
  if (price && price.product !== product.id && !product.dry_run) { log("warning: lookup key belongs to another product; creating a fresh price"); price = null; }
  if (!price || price.unit_amount !== d.unitAmount || price.currency !== cat.currency) {
    const old = price;
    price = await stripe.post("/prices", { product: product.id, currency: cat.currency, unit_amount: d.unitAmount, lookup_key: d.lookupKey, transfer_lookup_key: true,
      tax_behavior: autoTax ? "exclusive" : undefined, metadata: { catalogue_key: p.key } }, `create price ${row.price_display}`);
    if (old) { await stripe.post(`/prices/${old.id}`, { active: false }, "deactivate old price"); log(`price: ${money(old.unit_amount, old.currency)} -> ${row.price_display} (new price, old one deactivated)`); }
    else log(`price: create ${row.price_display}`);
    priceChanged = true; changes++;
  } else log(`price: unchanged (${row.price_display})`);

  // Payment Link
  let link = existing.links.get(p.key);
  const linkPrice = link?.line_items?.data?.[0]?.price?.id;
  if (link && (priceChanged || (linkPrice && linkPrice !== price.id))) {
    await stripe.post(`/payment_links/${link.id}`, { active: false }, "deactivate old payment link");
    log("payment link: price changed, old link deactivated (URL will change)"); link = null; changes++;
  }
  if (!link) {
    if (d.active) {
      link = await stripe.post("/payment_links", { line_items: [{ price: price.id, quantity: 1, adjustable_quantity: d.adjustable }], ...d.link, active: d.active }, "create payment link");
      log(`payment link: create (${d.active ? "active" : "inactive"})`); changes++;
    } else { log("payment link: none, and the type is closed; nothing to create"); }
  } else {
    const want = { ...d.link, active: d.active };
    const have = { allow_promotion_codes: link.allow_promotion_codes, billing_address_collection: link.billing_address_collection, automatic_tax: { enabled: link.automatic_tax?.enabled },
      after_completion: { type: link.after_completion?.type, redirect: { url: link.after_completion?.redirect?.url } }, phone_number_collection: { enabled: link.phone_number_collection?.enabled },
      name_collection: link.name_collection ? { individual: pick(link.name_collection.individual), business: pick(link.name_collection.business) } : undefined,
      custom_fields: (link.custom_fields || []).map(f => ({ key: f.key, type: f.type, optional: f.optional, label: { type: f.label?.type, custom: f.label?.custom }, dropdown: f.dropdown ? { options: f.dropdown.options.map(o => ({ label: o.label, value: o.value })) } : undefined })),
      restrictions: link.restrictions?.completed_sessions?.limit ? { completed_sessions: { limit: link.restrictions.completed_sessions.limit } } : undefined,
      inactive_message: link.inactive_message, submit_type: link.submit_type, metadata: pickKeys(link.metadata, ["catalogue_key", "event"]),
      payment_intent_data: { metadata: pickKeys(link.payment_intent_data?.metadata, ["catalogue_key", "event"]) }, active: link.active };
    const patch = {};
    for (const k of Object.keys(want)) if (!same(want[k], have[k])) patch[k] = want[k] === undefined ? (k === "restrictions" ? { completed_sessions: { limit: "" } } : want[k]) : want[k];
    const li = link.line_items?.data?.[0];
    if (li && li.adjustable_quantity && !same(li.adjustable_quantity, d.adjustable)) patch.line_items = [{ id: li.id, adjustable_quantity: d.adjustable }];
    if (Object.keys(patch).length) { await stripe.post(`/payment_links/${link.id}`, patch, `update payment link ${Object.keys(patch).join(",")}`); log(`payment link: update ${Object.keys(patch).join(", ")}`); changes++; }
    else log("payment link: unchanged");
    link = { ...link, ...patch, active: d.active };
  }

  // Public state for the website
  const sold = link?.restrictions?.completed_sessions?.count || 0;
  row.sold = sold;
  row.url = link?.url && !link.dry_run ? link.url : null;
  row.status = !d.active ? "closed" : d.capacity && sold >= d.capacity ? "sold_out" : row.url ? "on_sale" : "coming_soon";
  summary.push([p.key, row.status]);
  output.push(row);
}

// ---- 4. write the public file --------------------------------------------------------------------------
const publicFile = { generated_at: new Date().toISOString(), livemode, event: cat.event, currency: cat.currency, tax_note: cat.tax_note, support_email: cat.support_email,
  editions: cat.editions || [], tickets: output };
if (!dryRun) { mkdirSync(path.dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(publicFile, null, 2) + "\n"); }
console.log(`\n${changes} change(s) ${dryRun ? "planned" : "applied"}; ${stripe?.writes || 0} write call(s)${dryRun ? " skipped" : ""}.`);
for (const [k, s] of summary) console.log(`  ${k.padEnd(22)} ${s}`);
if (!dryRun) console.log(`\nWrote ${path.relative(ROOT, OUT)}. Now run:  python tools/render_tickets.py   and commit both.`);
if (dryRun && hardBlockers.length) console.log("\nA real run is blocked until the TODO values above are filled in.");

function pick(o) { return o ? { enabled: o.enabled, optional: o.optional } : undefined; }
function pickKeys(o, ks) { return Object.fromEntries(ks.filter(k => o && o[k] !== undefined).map(k => [k, o[k]])); }
