// Claude and OpenAI subscription usage in the sidebar.
//
// The Claude subscription signed in on this Mac comes first, its 5h, 7d and
// Fable windows a row each with when each resets. Every other Claude
// subscription is one row: its 7d window and its reset. OpenAI last. The
// hover on any row has the details: every window, its reset, the reading's age.
//
// ~/.local/bin/herdr-usage (a LaunchAgent, every two minutes) does the
// fetching and keeps the last reading per account in
// ~/.claude/usage-accounts/<email>.json, plus `.active`, the account signed in
// here. This mod only reads those files, so it never touches a credential.
//
// Short names stay out of this file, which is published: `names` in
// ~/.claude/usage-accounts/.config.json maps each email to its name, in the
// order shown. Without it, every account with a reading still shows, named
// from its email.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { home, readTextFile, theme, layout, run } from "herdr";
import * as fs from "fs/promises";

const SCOPED_MODEL = /^fable/i;
// herdr-usage reads every two minutes; older than this, the reading is from
// an account signed in nowhere it reaches, or herdr-usage has stopped.
const FRESH_MS = 10 * 60 * 1000;
const WEEK_MS = 7 * 24 * 3600 * 1000;
// This block's id in the layout, so it can size itself to its rows.
const BLOCK = "usage";
const HEAD_H = 36;
const TITLE_H = 26;
const LINE_H = 24;
const PCT_W = 40;
const RESET_W = 62;

const accountsDir = () => `${home()}/.claude/usage-accounts`;
const openaiCache = () => `${home()}/.pi/agent/openai-usage-cache.json`;

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

const parseJSON = (text) => {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};
const toMs = (iso) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : null;
};
const win = (pct, reset) => (pct == null || !Number.isFinite(Number(pct)) ? null : { pct: Number(pct), reset });

function nameOf(email, names) {
  if (names[email]) return names[email];
  const [user, domain = ""] = email.split("@");
  return /^(gmail|icloud|outlook|hotmail|me)\./.test(domain) ? user : domain.split(".")[0];
}

function claudeRow(email, data, active, names) {
  const limits = data?.limits ?? [];
  const limit = (kind, ok = () => true) => limits.find((l) => l.kind === kind && ok(l));
  const session = limit("session");
  const weekly = limit("weekly_all");
  const scoped = limit("weekly_scoped", (l) => SCOPED_MODEL.test(l.scope?.model?.display_name ?? ""));
  return {
    key: email,
    provider: "Claude",
    email,
    name: nameOf(email, names),
    active,
    host: data?.account?.host ?? null,
    fetchedAt: toMs(data?.account?.fetched_at),
    five: data?.five_hour
      ? win(data.five_hour.utilization, toMs(data.five_hour.resets_at))
      : session && win(session.percent, toMs(session.resets_at)),
    week: data?.seven_day
      ? win(data.seven_day.utilization, toMs(data.seven_day.resets_at))
      : weekly && win(weekly.percent, toMs(weekly.resets_at)),
    fable: scoped && win(scoped.percent, toMs(scoped.resets_at)),
  };
}

// OpenAI's windows go by length: a short one is 5h, a long one 7d. The cache
// has no timestamp, but reset_at less reset_after_seconds is when it was read.
function openaiRow(data) {
  const rl = data?.rate_limit;
  if (!rl) return null;
  const row = { key: "openai", provider: "OpenAI", email: null, name: null, five: null, week: null, fable: null, fetchedAt: null };
  for (const w of [rl.primary_window, rl.secondary_window]) {
    if (!w) continue;
    const reset = w.reset_at ? w.reset_at * 1000 : null;
    const slot = (w.limit_window_seconds ?? 0) <= 6 * 3600 ? "five" : "week";
    row[slot] ??= win(w.used_percent, reset);
    if (reset && w.reset_after_seconds != null) row.fetchedAt ??= reset - w.reset_after_seconds * 1000;
  }
  return row;
}

// The active Claude subscription first, the other Claude ones, then OpenAI.
async function load() {
  const dir = accountsDir();
  let files = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    files = [];
  }
  const active = (await readTextFile(`${dir}/.active`))?.trim() ?? null;
  const names = parseJSON(await readTextFile(`${dir}/.config.json`))?.names ?? {};
  const known = Object.keys(names);
  const emails = new Set(known);
  for (const f of files) if (f.endsWith(".json") && !f.startsWith(".")) emails.add(f.slice(0, -5));
  const rank = (email) => (email === active ? -1 : known.indexOf(email) < 0 ? 99 : known.indexOf(email));
  const order = [...emails].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const rows = await Promise.all(
    order.map(async (email) =>
      claudeRow(email, parseJSON(await readTextFile(`${dir}/${email}.json`)), email === active, names),
    ),
  );
  const openai = openaiRow(parseJSON(await readTextFile(openaiCache())));
  if (openai) rows.push(openai);
  return rows;
}

// --- formatting -------------------------------------------------------------

const two = (n) => String(n).padStart(2, "0");
function clock(ms) {
  const d = new Date(ms);
  const h = d.getHours();
  return `${h % 12 || 12}:${two(d.getMinutes())}${h < 12 ? "am" : "pm"}`;
}
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const day = (ms) => {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]} ${two(d.getMonth() + 1)}/${two(d.getDate())}`;
};
function age(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${Math.max(m, 1)}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// A reading keeps until a newer one comes. Once its reset has passed, the
// window has started over: 0%. A weekly window resets on the same weekday and
// time every week, so its next reset is the old one plus a week (as many weeks
// as have gone by); a 5h window starts with the next use, so it has none.
function shown(w, kind, now) {
  if (!w) return null;
  if (w.reset == null || w.reset > now) return { pct: Math.round(w.pct), reset: w.reset, rolled: false };
  let next = null;
  if (kind === "week") for (next = w.reset; next <= now; next += WEEK_MS);
  return { pct: 0, reset: next, rolled: true };
}
// When it resets: a time for the 5h window (it resets today), a day for the weekly ones.
const resetText = (s, kind) => (!s?.reset ? "" : kind === "five" ? clock(s.reset) : day(s.reset));

const isStale = (r, now) => !r.fetchedAt || now - r.fetchedAt > FRESH_MS;

// The block's height for these rows: the active subscription's title and its
// three windows, one line for each other.
const heightOf = (rows) => HEAD_H + rows.reduce((h, r) => h + (r.active ? TITLE_H + 3 * LINE_H : LINE_H), 0) + 8;

export default class Usage extends View {
  init(_props, cx) {
    this.rows = null;
    this.fitted = null;
    this.refresh(cx);
    cx.timer.every(30000, (cx) => this.refresh(cx));
  }

  refresh(cx) {
    cx.spawn(async (cx) => {
      try {
        this.rows = await load();
      } catch (e) {
        console.log(`usage: ${e}`);
        this.rows ??= [];
      }
      this.fit();
      cx.notify();
    });
  }

  // Grow or shrink this block to its rows.
  fit() {
    const node = find(layout(), BLOCK);
    if (!node || node.content?.mod !== "usage") return;
    const px = heightOf(this.rows?.length ? this.rows : [{}]);
    if (node.size?.px === px || this.fitted === px) return;
    this.fitted = px;
    run("layout.resize", { id: BLOCK, px });
  }

  color(t, s) {
    if (!s) return t.dim;
    if (s.pct >= 80) return t.ansi1 ?? t.blocked;
    if (s.pct >= 50) return t.ansi3 ?? t.working;
    return t.ansi2 ?? t.done;
  }

  // A stale reading is a floor: until its reset, a window's usage only goes up.
  // So at 50% or more its yellow or red still holds; under that it could be
  // anything, and a window that has rolled over since is a guess: both dim.
  tone(t, s, stale) {
    if (stale && (!s || s.rolled || s.pct < 50)) return t.dim;
    return this.color(t, s);
  }

  tip(r, now) {
    const lines = [r.email ?? "OpenAI (Codex)"];
    const source = r.active ? "signed in on this Mac" : r.host ? `signed in on ${r.host}` : null;
    if (r.fetchedAt) lines.push(`Read ${age(now - r.fetchedAt)} ago${source ? `, ${source}` : ""}`);
    else lines.push("No reading yet");
    for (const [label, w, kind] of [["5h", r.five, "five"], ["7d", r.week, "week"], ["Fable", r.fable, "week"]]) {
      const s = shown(w, kind, now);
      if (!s) continue;
      // The hover has room for the time a weekly window resets, not just its day.
      const reset = s.reset && kind === "week" ? `${day(s.reset)} ${clock(s.reset)}` : resetText(s, kind);
      const status = s.rolled ? "reset since it was read" : null;
      lines.push(`${label} ${s.pct}%${reset ? `, resets ${reset}` : ""}${status ? ` (${status})` : ""}`);
    }
    return lines.join("\n");
  }

  // The provider, then its subscription smaller and quieter; a dot when signed in here.
  label(t, r, stale) {
    return h_flex()
      .flex_1()
      .min_w(0)
      .gap(6)
      .items_center()
      .child(div().flex_none().text_color(stale ? t.muted : t.foreground).child(r.provider))
      .when(Boolean(r.name), (el) => el.child(div().min_w(0).truncate().text_size(11).text_color(t.dim).child(r.name)))
      .when(Boolean(r.active), (el) => el.child(div().size(6).flex_none().rounded_full().bg(t.accent)));
  }

  // One window: what it is on the left, its percentage, then when it resets.
  line(t, id, left, s, reset, faded, tip) {
    return h_flex()
      .id(id)
      .h(LINE_H)
      .flex_none()
      .px(8)
      .gap(4)
      .rounded(6)
      .items_center()
      .hover((st) => st.bg(t.hover))
      .tooltip(tip)
      .child(left)
      .child(div().w(PCT_W).flex_none().text_right().text_color(this.tone(t, s, faded)).child(s ? `${s.pct}%` : "—"))
      .child(div().w(RESET_W).flex_none().text_right().text_size(11).text_color(t.dim).whitespace_nowrap().child(reset));
  }

  // The active subscription: a title, then 5h, 7d and Fable a row each. Fable's
  // week is usually the 7d one; its reset shows only when it differs. A plan
  // with no 5h window keeps that row's reset time: the 7d window's, under which
  // the 7d row has the day.
  activeBlock(t, r, now) {
    const stale = isStale(r, now);
    const tip = this.tip(r, now);
    const weekly = shown(r.week, "week", now);
    const week = resetText(weekly, "week");
    const windows = [
      ["5h", r.five, "five"],
      ["7d", r.week, "week"],
      ["fable", r.fable, "fable"],
    ];
    return v_flex()
      .flex_none()
      .child(h_flex().id(`usage-${r.key}`).h(TITLE_H).px(8).items_center().tooltip(tip).child(this.label(t, r, stale)))
      .children(
        windows.map(([name, w, kind]) => {
          const s = shown(w, kind === "fable" ? "week" : kind, now);
          const reset = !w && kind === "five" && weekly?.reset ? clock(weekly.reset) : resetText(s, kind === "fable" ? "week" : kind);
          return this.line(
            t,
            `usage-${r.key}-${name}`,
            div().flex_1().min_w(0).pl(12).text_size(12).text_color(t.muted).child(name),
            s,
            kind === "fable" && reset === week ? "" : reset,
            stale,
            tip,
          );
        }),
      );
  }

  // Any other subscription: its 7d window (or its 5h, when that's all it has).
  otherRow(t, r, now) {
    const stale = isStale(r, now);
    const kind = r.week || !r.five ? "week" : "five";
    const s = shown(kind === "week" ? r.week : r.five, kind, now);
    return this.line(t, `usage-${r.key}`, this.label(t, r, stale), s, resetText(s, kind), stale, this.tip(r, now));
  }

  // The rail: one number per subscription, its tightest window.
  railRow(t, r, now) {
    const stale = isStale(r, now);
    const worst = [[r.five, "five"], [r.week, "week"], [r.fable, "week"]]
      .map(([w, kind]) => shown(w, kind, now))
      .filter(Boolean)
      .sort((a, b) => b.pct - a.pct)[0];
    return div()
      .id(`usage-${r.key}`)
      .h(24)
      .flex()
      .items_center()
      .justify_center()
      .text_size(11)
      .tooltip(`${r.provider}${r.name ? ` ${r.name}` : ""}\n${this.tip(r, now)}`)
      .text_color(this.tone(t, worst, stale))
      .child(worst ? `${worst.pct}` : "—");
  }

  render() {
    const t = theme();
    const now = Date.now();
    const rows = this.rows ?? [];
    const base = v_flex().size_full().min_h(0).bg(t.chrome).border_t(1).border_color(t.border).text_size(13);
    if (narrow()) return base.pt(6).children(rows.map((r) => this.railRow(t, r, now)));
    return base
      .child(
        h_flex()
          .px(16)
          .h(HEAD_H)
          .pt(12)
          .pb(5)
          .flex_none()
          .items_center()
          .text_size(11.5)
          .font_medium()
          .text_color(t.dim)
          .child("Usage"),
      )
      .when(this.rows !== null && rows.length === 0, (el) =>
        el.child(div().px(16).text_size(12).text_color(t.dim).child("No usage readings yet. ~/.local/bin/herdr-usage writes them.")),
      )
      .child(v_flex().px(8).children(rows.map((r) => (r.active ? this.activeBlock(t, r, now) : this.otherRow(t, r, now)))));
  }
}
