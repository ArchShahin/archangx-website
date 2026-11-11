// Minimal Stripe REST client on Node's built-in fetch (Node 18+). No dependencies.
// Shared by sync-catalogue.mjs and export-attendees.mjs. The key is read from the
// STRIPE_API_KEY environment variable and never printed.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const API = "https://api.stripe.com/v1";
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadKey({ live = false } = {}) {
  const key = process.env.STRIPE_API_KEY;
  if (!key) {
    fail("STRIPE_API_KEY is not set. In your own terminal run:  export STRIPE_API_KEY=rk_test_...  (never paste the key into a chat or a file).");
  }
  const isLive = /^(rk|sk)_live_/.test(key);
  const isTest = /^(rk|sk)_test_/.test(key);
  if (!isLive && !isTest) fail("STRIPE_API_KEY does not look like a Stripe secret or restricted key (expected rk_test_..., rk_live_..., sk_test_... or sk_live_...).");
  if (isLive && !live) fail("STRIPE_API_KEY is a LIVE key and --live was not passed. Refusing to touch live mode.");
  if (!isLive && live) fail("--live was passed but STRIPE_API_KEY is a test (sandbox) key. Drop --live or use the live key.");
  if (key.startsWith("sk_")) console.warn("warning: this is an unrestricted secret key. Prefer a restricted key (rk_) with only the permissions in stripe/README.md.");
  return { key, livemode: isLive };
}

export function fail(message, code = 2) {
  console.error("error: " + message);
  process.exit(code);
}

// Encodes nested objects/arrays the way Stripe expects: a[b][0][c]=v
export function formEncode(params, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (v === null) out.append(name, "");
    else if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" && item !== null) ? formEncode(item, `${name}[${i}]`, out) : out.append(`${name}[${i}]`, String(item)));
    else if (typeof v === "object") formEncode(v, name, out);
    else out.append(name, String(v));
  }
  return out;
}

export class Stripe {
  constructor(key, { dryRun = false } = {}) { this.key = key; this.dryRun = dryRun; this.writes = 0; }

  async request(method, pathname, params) {
    const headers = { Authorization: `Bearer ${this.key}`, "Stripe-Version": "2026-10-28.endive" };
    let url = API + pathname, body;
    if (method === "GET") { const q = formEncode(params || {}).toString(); if (q) url += (url.includes("?") ? "&" : "?") + q; }
    else { headers["Content-Type"] = "application/x-www-form-urlencoded"; body = formEncode(params || {}).toString(); }
    let res, json;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url, { method, headers, body });
      json = await res.json().catch(() => ({}));
      if (res.status !== 429 && res.status < 500) break;
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
    if (!res.ok) {
      const e = json.error || {};
      const hint = e.code === "api_key_expired" || res.status === 401 ? " The key is invalid or expired."
        : res.status === 403 || /permission/i.test(e.message || "") ? " The restricted key lacks a permission; see stripe/README.md for the list." : "";
      throw new Error(`Stripe ${method} ${pathname} -> ${res.status} ${e.type || ""} ${e.code || ""}: ${e.message || "unknown error"}.${hint}`);
    }
    return json;
  }

  get(pathname, params) { return this.request("GET", pathname, params); }

  // Writes are counted and skipped in dry-run mode.
  async post(pathname, params, label) {
    this.writes++;
    if (this.dryRun) { console.log(`  [dry-run] would POST ${pathname}  ${label || ""}`); return { id: `(new ${pathname.split("/")[1]})`, dry_run: true, ...params }; }
    return this.request("POST", pathname, params);
  }

  // Walks every page of a list endpoint.
  async *list(pathname, params = {}) {
    let starting_after;
    for (;;) {
      const page = await this.get(pathname, { limit: 100, ...params, starting_after });
      for (const item of page.data) yield item;
      if (!page.has_more || !page.data.length) return;
      starting_after = page.data[page.data.length - 1].id;
    }
  }
}

export function readCatalogue(file = path.join(ROOT, "stripe", "catalogue.json")) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function isTodo(v) { return typeof v === "string" && /^TODO/i.test(v.trim()); }

export function toCents(price) {
  const n = Number(String(price).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error(`bad price ${JSON.stringify(price)}`);
  return Math.round(n * 100);
}

export function money(cents, currency) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: currency.toUpperCase(), currencyDisplay: "narrowSymbol" }).format(cents / 100);
}
