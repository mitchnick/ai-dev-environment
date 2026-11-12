// Servers: every local dev server in one list, on or off, with Start, Stop and
// Restart, a group's buttons for all of its servers at once, and every port a
// click away from the clipboard.
//
// ~/.local/bin/herdr-app-servers does all the work; this mod only draws and
// clicks, as Automations does with its CLI. The server list is private, in
// ~/.config/herdr-app-servers/projects.json (herdr-app/servers.example.json in
// ai-dev-environment shows its shape), so nothing here names a project.
//
// It polls only while its panel shows: `status --json` every 3 seconds (one
// lsof; the apps never see it), every second while a start or stop runs, and
// with --deep, which asks each Rails app's /up again, every 15 seconds and on
// opening. Hidden, it polls only while something it started is still running.
//
// Remote, at the bottom: `remote --json` on opening and every minute, for the
// hosted servers in the list's "remote" entries (Fly apps, a Hetzner box):
// up or down, what runs, and what it costs a month. It only looks.
//
// A row's log opens in its project's space: the one the list names, else the
// space named like the server or its group, else the one whose folder holds it.
//
// Other machines: every machine Herdr connects to is asked the same way,
// through herdr-core, and one with its own CLI and list gets a section under
// its name, as in the spaces list. Its buttons act there, and its logs open in
// a space on it. One without a list stays out of sight, asked again each
// minute; one that's offline isn't asked.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, home, appHome, readTextFile, theme, layout, spaces, machines, notify, run } from "herdr";

const POLL_MS = 3000;
const BUSY_POLL_MS = 1000;
const DEEP_MS = 15000;
const REMOTE_MS = 60000;
const ABSENT_MS = 60000;
const CONFIRM_MS = 4000;
const PENDING_MS = 30000;
const icon = (name) => `mods/servers/${name}.svg`;
const cli = () => `${home()}/.local/bin/herdr-app-servers`;
const stop = (_e, cx) => cx.stop_propagation();

// herdr-core runs another machine's programs with a bare PATH, so the CLI is
// found there through that machine's own HOME.
const THERE = 'exec "$HOME/.local/bin/herdr-app-servers" "$@"';
const argv = (on, args) => (on ? ["/bin/sh", "-c", THERE, "sh", ...args] : [cli(), ...args]);
function runCli(on, args) {
  const [cmd, ...rest] = argv(on, args);
  return on ? exec(cmd, rest, { on }) : exec(cmd, rest);
}

// One per machine; name null is this one. `pending`: rows clicked whose
// action the CLI hasn't shown yet, by key.
const newHost = (name) => ({
  name, data: null, raw: null, error: null, loading: false, again: null,
  lastPoll: 0, lastDeep: 0, seen: null, known: false, absent: false, offline: false,
  pending: new Map(),
});
const prefix = (h) => (h.name ? `${h.name}:` : "");
const on = (h, what) => (h.name ? `${what} on ${h.name}` : what);

// "cmd-shift-j" as macOS writes it: ⇧⌘J.
function keyLabel(key) {
  const parts = key.split("-");
  let last = parts.pop();
  if (last === "" && parts.at(-1) === "") { parts.pop(); last = "-"; }
  const marks = { ctrl: "⌃", alt: "⌥", shift: "⇧", cmd: "⌘" };
  const mods = Object.keys(marks).filter((m) => parts.includes(m)).map((m) => marks[m]).join("");
  return mods + (last.length === 1 ? last.toUpperCase() : last[0].toUpperCase() + last.slice(1));
}

function money(amount, currency) {
  const sign = { USD: "$", EUR: "€", GBP: "£" }[currency];
  const n = amount.toFixed(2);
  return sign ? `${sign}${n}` : `${n} ${currency}`;
}

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// Shown when it is the side panel's open child (main-plus). Anywhere else, a
// pane or another layout, it counts as shown.
function showing() {
  const root = layout(), body = find(root, "panel-body");
  const mine = body?.children?.find((c) => c.content?.mod === "servers");
  if (!mine) return true;
  const panel = find(root, "panel");
  return Boolean(panel && !panel.hidden && body.active === mine.id);
}

function age(epoch) {
  if (!epoch) return "";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - epoch));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const WORDS = {
  up: "up", down: "down", error: "error", busy: "busy", boot: "booting", foreign: "port taken",
  queued: "queued", starting: "starting", stopping: "stopping",
};
// The word beside a row: none for plain up and down, which the dot says.
const LABEL = { ...WORDS, up: "", down: "" };

function tone(t, state) {
  if (state === "up") return t.ansi2 ?? t.done;
  if (state === "error" || state === "foreign") return t.ansi1 ?? t.blocked;
  if (state === "down") return t.dim;
  return t.ansi3 ?? t.working;
}

const isWeb = (url) => /^https?:\/\//.test(url ?? "");

export default class Servers extends View {
  init(_props, cx) {
    this.hosts = new Map([[null, newHost(null)]]);
    this.shown = false; this.confirm = null;
    this.remote = null; this.remoteError = null; this.remoteLoading = false; this.lastRemote = 0;
    this.shortcut = null;
    try { this.collapsed = JSON.parse(localStorage.getItem("collapsed") ?? "{}"); } catch { this.collapsed = {}; }
    cx.timer.every(1000, (cx) => this.tick(cx));
    this.tick(cx);
  }

  tick(cx) {
    const now = Date.now();
    if (this.confirm && now > this.confirm.until) { this.confirm = null; cx.notify(); }
    const hosts = this.syncHosts(cx);
    const busy = (h) => Boolean(h.data?.active || h.pending.size);
    if (!showing()) {
      this.shown = false;
      // Keep up with a start or stop it began, so its outcome still toasts.
      for (const h of hosts) if (busy(h) && !h.offline && now - h.lastPoll >= POLL_MS) this.refresh(cx, h, false);
      return;
    }
    const opened = !this.shown;
    this.shown = true;
    for (const h of hosts) {
      if (h.offline) continue;
      const every = h.absent ? ABSENT_MS : busy(h) ? BUSY_POLL_MS : POLL_MS;
      if (opened || now - h.lastPoll >= every) this.refresh(cx, h, opened || now - h.lastDeep >= DEEP_MS);
    }
    if (opened || now - this.lastRemote >= REMOTE_MS) this.refreshRemote(cx);
    if (opened) this.readShortcut(cx);
  }

  // This computer and every machine Herdr connects to. One whose layout is
  // unavailable (offline, asleep) isn't asked until it's back.
  syncHosts(cx) {
    let list = [];
    try { list = machines(); } catch {}
    const names = new Set([null]);
    for (const m of list) {
      if (!m.name) continue;
      names.add(m.name);
      if (!this.hosts.has(m.name)) this.hosts.set(m.name, newHost(m.name));
      const h = this.hosts.get(m.name), offline = m.layout === "unavailable";
      if (h.offline !== offline) { h.offline = offline; cx.notify(); }
    }
    for (const name of [...this.hosts.keys()]) if (!names.has(name)) { this.hosts.delete(name); cx.notify(); }
    return [...this.hosts.values()];
  }

  // The machines with a list to show: this one always.
  shownHosts() {
    return [...this.hosts.values()].filter((h) => !h.name || (h.known && !h.absent));
  }

  // The key keys.json binds to this panel, read again each time it opens.
  readShortcut(cx) {
    cx.spawn(async (cx) => {
      let found = null;
      try {
        const keys = JSON.parse(await readTextFile(`${appHome()}/keys.json`) ?? "{}");
        for (const section of Object.values(keys)) {
          const key = Object.keys(section ?? {}).find((k) => section[k] === "tabs-plus.servers");
          if (key) { found = keyLabel(key); break; }
        }
      } catch {}
      if (found !== this.shortcut) { this.shortcut = found; cx.notify(); }
    });
  }

  // Fly answers in seconds, so this runs on its own, once a minute.
  refreshRemote(cx) {
    if (this.remoteLoading) return;
    this.remoteLoading = true;
    this.lastRemote = Date.now();
    cx.spawn(async (cx) => {
      try {
        const r = await exec(cli(), ["remote", "--json"]);
        let parsed = null;
        try { parsed = JSON.parse(r.stdout); } catch {}
        if (parsed?.error && /no "remote" entries/.test(parsed.error)) { this.remote = null; this.remoteError = null; }
        else if (parsed?.error || !parsed) throw new Error(parsed?.error ?? (r.stderr || r.stdout || `exit ${r.code}`).trim());
        else { this.remote = parsed; this.remoteError = null; }
      } catch (e) {
        this.remoteError = String(e?.message ?? e);
      }
      this.remoteLoading = false;
      cx.notify();
    });
  }

  refresh(cx, h, deep) {
    if (h.loading) { h.again = { deep: Boolean(h.again?.deep || deep) }; return; }
    h.loading = true;
    const asked = h.lastPoll = Date.now();
    if (deep) h.lastDeep = h.lastPoll;
    // A click shows until a status asked after the CLI answered it, which has
    // its action (or its result) on file by then.
    const done = [...h.pending].filter(([, p]) => (p.answered && p.answered <= asked) || asked - p.at > PENDING_MS).map(([key]) => key);
    cx.spawn(async (cx) => {
      let changed = false;
      try {
        const r = await runCli(h.name, ["status", "--json", ...(deep ? ["--deep"] : [])]);
        const out = r.stdout.trim();
        let parsed = null;
        try { parsed = JSON.parse(out); } catch {}
        // Another machine without the CLI, or without a list of its own, has nothing to show.
        const absent = Boolean(h.name) && (r.code === 127 || /no server list/.test(parsed?.error ?? ""));
        if (absent !== h.absent) { h.absent = absent; changed = true; }
        if (absent) {
          if (h.data || h.error) { h.data = null; h.raw = null; h.error = null; changed = true; }
        } else {
          if (parsed?.error) throw new Error(parsed.error);
          if (r.code !== 0 || !parsed) throw new Error((r.stderr || r.stdout || `exit ${r.code}`).trim());
          if (out !== h.raw) { h.raw = out; h.data = parsed; h.known = true; this.announce(h); changed = true; }
          if (h.error) { h.error = null; changed = true; }
        }
      } catch (e) {
        let msg = String(e?.message ?? e);
        if (!h.name && /no such file|not found|cannot start|ENOENT/i.test(msg)) msg = `herdr-app-servers isn't installed in ~/.local/bin (${msg})`;
        if (msg !== h.error) { h.error = msg; changed = true; }
      }
      for (const key of done) if (h.pending.delete(key)) changed = true;
      h.loading = false;
      if (changed) cx.notify();
      if (h.again) { const d = h.again.deep; h.again = null; this.refresh(cx, h, d); }
    });
  }

  rows(h) { return (h.data?.groups ?? []).flatMap((g) => g.servers); }
  nameOf(h, key) { return this.rows(h).find((r) => r.key === key)?.name ?? key; }

  // A start or stop that failed, or came up with an error, finds you as a
  // toast. The first read only learns what is there.
  announce(h) {
    const rows = this.rows(h), now = {};
    for (const r of rows) if (r.last?.finished) now[r.key] = r.last.finished;
    if (h.seen) for (const r of rows) {
      const l = r.last;
      if (!l?.finished || l.finished <= (h.seen[r.key] ?? 0) || l.level === "success") continue;
      notify({
        title: `${on(h, r.name)}: ${l.verb} ${l.ok ? "came up with an error" : "failed"}`,
        body: l.message ?? "", level: l.level === "warning" ? "warning" : "error",
      });
    }
    h.seen = now;
  }

  // `keys`: the rows it should act on, which show it at once.
  act(cx, h, verb, target, label, keys) {
    this.confirm = null;
    const at = Date.now();
    for (const key of keys) h.pending.set(key, { verb, at, answered: 0 });
    cx.notify();
    cx.spawn(async (cx) => {
      let started = [];
      try {
        const r = await runCli(h.name, [verb, target, "--json"]);
        let out = null;
        try { out = JSON.parse(r.stdout); } catch {}
        started = out?.started ?? [];
        if (!out || out.error) {
          notify({ title: `Can't ${verb} ${label}`, body: out?.error ?? (r.stderr || r.stdout).trim(), level: "error" });
        } else {
          for (const x of out.refused ?? []) notify({ title: `Can't ${verb} ${on(h, this.nameOf(h, x.key))}`, body: x.why, level: "warning" });
          if (!out.started?.length && !out.refused?.length) {
            const why = out.skipped?.length === 1 ? out.skipped[0].why : `nothing to ${verb}`;
            notify({ title: label, body: why, level: "info", timeout: 2500 });
          }
        }
      } catch (e) {
        notify({ title: `Can't ${verb} ${label}`, body: String(e?.message ?? e), level: "error" });
      }
      // The ones it took on show from its records after the next status; the
      // rest (refused, skipped, failed) go back now.
      const answered = Date.now();
      for (const key of keys) {
        const p = h.pending.get(key);
        if (p?.at !== at) continue;
        if (started.includes(key)) p.answered = answered;
        else h.pending.delete(key);
      }
      cx.notify();
      this.refresh(cx, h, true);
    });
  }

  // What a row is doing: the CLI's action, else a click it hasn't shown yet.
  phaseOf(h, r) {
    if (r.action) return r.action.phase;
    const p = h.pending.get(r.key);
    return p ? (p.verb === "start" ? "starting" : "stopping") : null;
  }

  copy(cx, url) {
    cx.write_to_clipboard(url);
    notify({ title: "Copied", body: url, level: "success", timeout: 2000 });
  }

  // The space a server's log opens in, on its machine. Null on this one means
  // the space showing; another machine's log needs a space there, so it falls
  // back to that machine's shown space, else its first.
  spaceFor(h, r) {
    const g = h.data?.groups?.find((x) => x.key === r.group);
    const there = spaces().filter((s) => (s.machine ?? null) === h.name);
    const low = (x) => String(x ?? "").toLowerCase();
    for (const want of [r.space, g?.space, r.name, r.id, g?.key, g?.name]) {
      const hit = want && there.find((s) => low(s.name) === low(want));
      if (hit) return hit;
    }
    const base = h.data?.home ?? home();
    const holds = (s) => s.folder && s.folder !== base && (r.dir === s.folder || r.dir.startsWith(s.folder.replace(/\/+$/, "") + "/"));
    const hit = there.filter(holds).sort((a, b) => b.folder.length - a.folder.length)[0];
    if (hit || !h.name) return hit ?? null;
    return there.find((s) => s.active) ?? there[0] ?? null;
  }

  // One log tab per server, in its project's space: shown again when it's
  // there. `log --follow` moves to the next log after a restart, so an old
  // tab never tails yesterday's file.
  tail(h, r) {
    const space = this.spaceFor(h, r), name = `${r.name} log`;
    if (h.name && !space) return;
    const tab = space?.tabs.find((t) => t.name === name);
    if (tab) { run("space.select", { id: space.id }); run("tab.select", { id: tab.id }); return; }
    run("tab.new", { ...(space ? { space: space.id } : {}), name, folder: r.dir, argv: argv(h.name, ["log", r.key, "--follow"]) });
  }

  toggle(key, cx) {
    this.collapsed[key] = !this.collapsed[key];
    if (!this.collapsed[key]) delete this.collapsed[key];
    localStorage.setItem("collapsed", JSON.stringify(this.collapsed));
    cx.notify();
  }

  // --- render ---------------------------------------------------------------

  render() {
    const t = theme(), hosts = this.shownHosts(), local = this.hosts.get(null);
    const live = hosts.filter((h) => h.data && !h.offline);
    const count = live.length ? `${live.reduce((n, h) => n + h.data.up, 0)} of ${live.reduce((n, h) => n + h.data.total, 0)} up` : "";
    const fail = (msg) => div().px(14).py(6).text_size(12).text_color(t.ansi1 ?? t.blocked).child(msg);
    const body = hosts.length > 1
      ? v_flex().pb(10).children(hosts.map((h) => this.machine(t, h)))
      : local.data ? v_flex().pb(10).children(local.data.groups.map((g) => this.group(t, local, g)))
      : div().p(14).text_color(t.dim).child(local.error ? "" : "Loading…");
    return v_flex().id("servers").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background)
      .border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("Servers"))
        .child(div().flex_1())
        .when(Boolean(count), (el) => el.child(div().text_size(11.5).text_color(t.dim).child(count))))
      .when(hosts.length === 1 && Boolean(local.error), (el) => el.child(fail(local.error)))
      .child(div().id("servers-body").flex_1().min_h(0).overflow_y_scrollbar().child(body))
      .when(Boolean(this.remote || this.remoteError), (el) => el.child(this.remoteSection(t)))
      .when(Boolean(this.shortcut), (el) => el.child(h_flex().h(24).flex_none().px(14).items_center()
        .border_t(1).border_color(t.border).text_size(10.5).text_color(t.dim)
        .child(`${this.shortcut} shows or hides this panel`)));
  }

  // A machine's section once another machine has a list: headed as the spaces
  // list heads it, this computer first.
  machine(t, h) {
    const id = h.name ?? "local", key = `~m:${id}`, open = !this.collapsed[key];
    const d = h.offline ? null : h.data;
    const note = h.offline ? "offline" : d ? `${d.up} of ${d.total} up` : "";
    return v_flex().flex_none().when(Boolean(h.name), (el) => el.mt(6).border_t(1).border_color(t.border))
      .child(h_flex().id(`m-${id}`).h(28).mt(2).mx(4).px(6).gap(7).items_center().rounded(6).cursor_pointer()
        .text_size(11).text_color(t.dim).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => this.toggle(key, cx))
        .child(svg(icon(h.name ? "server" : "monitor")).size(13).flex_none())
        .child(div().flex_1().min_w(0).truncate().child(h.name ?? "This computer"))
        .when(Boolean(note), (el) => el.child(div().flex_none().child(note)))
        .child(svg(icon(open ? "chevron-down" : "chevron-right")).size(11).flex_none()))
      .when(open && Boolean(h.error) && !h.offline, (el) => el.child(div().px(14).py(4).text_size(12)
        .text_color(t.ansi1 ?? t.blocked).child(h.error)))
      .when(open && Boolean(d), (el) => el.children(d.groups.map((g) => this.group(t, h, g))))
      .when(open && !d && !h.error && !h.offline, (el) => el.child(div().px(14).py(4).text_color(t.dim).child("Loading…")));
  }

  // --- remote -------------------------------------------------------------------

  remoteTone(t, state) {
    if (state === "up") return t.ansi2 ?? t.done;
    if (state === "warn" || state === "unknown") return t.ansi1 ?? t.blocked;
    if (state === "partial") return t.ansi3 ?? t.working;
    return t.dim;
  }

  remoteSection(t) {
    const d = this.remote, open = !this.collapsed["~remote"];
    const total = d ? Object.entries(d.total).map(([c, v]) => money(v, c)).join(" + ") : "";
    return v_flex().flex_none().border_t(1).border_color(t.border).pb(open ? 6 : 0)
      .child(h_flex().id("remote-head").h(32).px(10).gap(6).items_center().cursor_pointer()
        .on_click((_e, cx) => this.toggle("~remote", cx))
        .child(svg(icon(open ? "chevron-down" : "chevron-right")).size(14).flex_none().text_color(t.dim))
        .child(div().flex_none().font_semibold().text_size(12.5).child("Remote"))
        .when(Boolean(d), (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(`${d.up}/${d.items.length} up`)))
        .child(div().flex_1())
        .when(Boolean(total), (el) => el.child(h_flex().id("remote-total").flex_none().text_size(11.5).text_color(t.muted)
          .tooltip("A month at today's rate. Fly: list prices for what runs now, volumes and IPv4; not bandwidth or snapshots.")
          .child(`${total}/mo`))))
      .when(Boolean(this.remoteError), (el) => el.child(div().px(14).pb(4).text_size(11).text_color(t.ansi1 ?? t.blocked).child(this.remoteError)))
      .when(open && Boolean(d), (el) => el.children(d.items.map((x, i) => this.remoteItem(t, x, i))));
  }

  remoteItem(t, x, i) {
    const color = this.remoteTone(t, x.state);
    const dot = div().size(8).rounded(4).flex_none();
    const partial = x.kind === "fly" ? `${x.running.join(", ")} only` : "partly down";
    const word = { down: "off", partial, warn: "check failing", unknown: "can't tell" }[x.state];
    const since = age(x.since);
    const tip = [
      x.kind === "fly" ? `Fly: ${x.apps.join(", ")}` : x.name,
      since ? `${x.state === "up" ? "up" : "off"} for ${since}` : null,
      x.kind === "fly" ? `machines ${money(x.machine_cost, "USD")} · ${x.volume_gb} GB of volumes ${money(x.volume_cost, "USD")}${x.ipv4 ? ` · IPv4 ${money(x.ip_cost, "USD")}` : ""}` : null,
      x.approx ? "Some machines run outside iad/ewr, which cost more than this says." : null,
      x.note, ...(x.errors ?? []),
      x.missing?.length ? `Not on Fly (yet?): ${x.missing.join(", ")}` : null,
      x.stale ? `Fly didn't answer; this is from ${age(x.stale)} ago.` : null,
    ].filter(Boolean).join("\n");
    const chips = x.kind === "server"
      ? [this.remoteChip(t, `r${i}-type`, `${x.parts[0].running} × ${x.parts[0].label}`, null, null),
        ...(x.checks ?? []).map((c, j) => this.remoteChip(t, `r${i}-c${j}`, c.name,
          c.up ? (t.ansi2 ?? t.done) : (t.ansi1 ?? t.blocked), `${c.url}\n${c.up ? `answers ${c.code}` : c.reason ?? "no answer"}`))]
      : x.parts.filter((p) => p.running || p.stopped).map((p, j) => this.remoteChip(t, `r${i}-p${j}`,
          p.running ? `${p.label} ${p.running}` : p.label,
          p.running ? (p.failing ? (t.ansi1 ?? t.blocked) : (t.ansi2 ?? t.done)) : "hollow",
          [`${p.app}`, ...p.sizes, p.running ? `${money(p.cost, "USD")}/mo` : "stopped: only its volume costs"].join("\n")));
    return v_flex().flex_none().mx(6).px(6).py(3).rounded(6).hover((s) => s.bg(t.hover))
      .child(h_flex().id(`r${i}`).h(20).gap(6).items_center().tooltip(tip)
        .child(x.state === "down" || x.state === "unknown" ? dot.border_1().border_color(color) : dot.bg(color))
        .child(div().flex_1().min_w(0).truncate().text_size(12.5).child(x.name))
        .when(Boolean(word), (el) => el.child(div().flex_none().text_size(11).text_color(x.state === "down" ? t.dim : color).child(word)))
        .child(div().flex_none().text_size(11.5).text_color(x.stale ? t.dim : t.muted).child(`${x.approx ? "≈" : ""}${money(x.cost, x.currency)}`)))
      .when(chips.length > 0, (el) => el.child(h_flex().flex_wrap().gap(2).pl(12).children(chips)));
  }

  remoteChip(t, id, label, dot, tip) {
    let el = h_flex().id(id).h(18).px(5).gap(5).flex_none().items_center().rounded(5).text_size(11).text_color(t.muted);
    if (tip) el = el.tooltip(tip);
    if (dot === "hollow") el = el.child(div().size(6).rounded(3).flex_none().border_1().border_color(t.dim));
    else if (dot) el = el.child(div().size(6).rounded(3).flex_none().bg(dot));
    return el.child(label);
  }

  button(t, id, name, tip, onClick, color) {
    if (!onClick) return div().size(22).flex_none();
    return div().id(id).size(22).flex_none().flex().items_center().justify_center().rounded(5)
      .text_color(color ?? t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(tip).on_mouse_down("left", stop)
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); })
      .child(svg(icon(name)).size(13));
  }

  // A port, named or not: click copies its URL. Its dot says whether it listens.
  chip(t, h, id, label, v, dot) {
    return h_flex().id(`${prefix(h)}${id}`).h(20).px(5).gap(5).flex_none().items_center().rounded(5).text_size(11)
      .text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(h.name ? `Copy ${v.url}\nIt answers on ${h.name}, not here.` : `Copy ${v.url}`).on_mouse_down("left", stop)
      .on_click((_e, cx) => { cx.stop_propagation(); this.copy(cx, v.url); })
      .when(dot !== null, (el) => el.child(div().size(6).rounded(3).flex_none().bg(dot)))
      .when(Boolean(label), (el) => el.child(label))
      .child(div().text_color(t.dim).child(String(v.port)));
  }

  serviceDot(t, v) {
    if (!v.listening) return t.border;
    return v.mine === false ? (t.ansi1 ?? t.blocked) : (t.ansi2 ?? t.done);
  }

  group(t, h, g) {
    const p = prefix(h), key = `${p}${g.key}`, open = !this.collapsed[key];
    return v_flex().flex_none()
      .child(h_flex().id(`${p}g-${g.key}`).h(34).mt(4).px(10).gap(6).items_center().cursor_pointer()
        .on_click((_e, cx) => this.toggle(key, cx))
        .child(svg(icon(open ? "chevron-down" : "chevron-right")).size(14).flex_none().text_color(t.dim))
        .child(div().flex_none().font_semibold().text_size(12.5).child(g.name))
        .child(div().flex_none().text_size(11).text_color(t.dim).child(`${g.up}/${g.total} up`))
        .child(this.bar(t, h, g))
        .child(div().flex_1())
        .when(g.servers.length > 1, (el) => el.children(this.groupButtons(t, h, g))))
      .when(open && g.services.length > 0, (el) => el.child(h_flex().flex_wrap().gap(2).pl(28).pr(10).pb(4)
        .children(g.services.map((v) => this.chip(t, h, `g-${g.key}-${v.name}`, v.name, v, this.serviceDot(t, v))))))
      .when(open, (el) => el.children(g.servers.map((r) => this.server(t, h, r))));
  }

  // A group's servers as a bar that fills from the left: up, then on the way
  // (booting, busy, starting), then broken (error, port taken), then off.
  bar(t, h, g) {
    const kinds = [
      ["up", t.ansi2 ?? t.done], ["coming up", t.ansi3 ?? t.working],
      ["error", t.ansi1 ?? t.blocked], ["off", t.border],
    ];
    const kind = (r) => {
      const s = this.phaseOf(h, r) ?? r.state;
      return s === "up" ? 0 : s === "down" ? 3 : s === "error" || s === "foreign" ? 2 : 1;
    };
    const segs = g.servers.map(kind).sort((a, b) => a - b);
    const tip = kinds.map(([word], k) => [segs.filter((x) => x === k).length, word])
      .filter(([n]) => n).map(([n, word]) => `${n} ${word}`).join(" · ");
    return h_flex().id(`${prefix(h)}g-${g.key}-bar`).w(56).h(5).flex_none().gap(segs.length > 6 ? 1 : 2).tooltip(tip)
      .children(segs.map((k) => div().flex_1().h_full().rounded(1).bg(kinds[k][1])));
  }

  // Start the ones that are off; stop or restart the ones that are on. Stop
  // and restart ask again: the first click arms the button for 4 seconds.
  groupButtons(t, h, g) {
    const idle = g.servers.filter((r) => !this.phaseOf(h, r));
    const off = idle.filter((r) => !r.on && r.exists).map((r) => r.key);
    const running = idle.filter((r) => r.on).map((r) => r.key);
    const target = `${g.key}/all`, p = prefix(h), label = on(h, g.name);
    const armed = (verb, word, name, keys) => {
      const key = `${p}${g.key}:${verb}`;
      if (this.confirm?.key === key) {
        return h_flex().id(`${p}g-${g.key}-${verb}-yes`).h(22).px(8).flex_none().items_center().rounded(5)
          .text_size(11.5).font_medium().bg(t.ansi1 ?? t.blocked).text_color(t.background).cursor_pointer()
          .on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); this.act(cx, h, verb, target, label, keys); })
          .child(`${word} ${keys.length}?`);
      }
      return this.button(t, `${p}g-${g.key}-${verb}`, name, `${word} the ${keys.length} running`,
        keys.length ? (cx) => { this.confirm = { key, until: Date.now() + CONFIRM_MS }; cx.notify(); } : null);
    };
    return [
      this.button(t, `${p}g-${g.key}-start`, "play", `Start the ${off.length} that ${off.length === 1 ? "is" : "are"} off`,
        off.length ? (cx) => this.act(cx, h, "start", target, label, off) : null),
      armed("stop", "Stop", "stop", running),
      armed("restart", "Restart", "rotate", running),
    ];
  }

  dot(t, h, r, state) {
    const busy = Boolean(this.phaseOf(h, r));
    const failed = !busy && r.state === "down" && r.last && !r.last.ok && ["start", "restart"].includes(r.last.verb);
    const color = failed ? (t.ansi1 ?? t.blocked) : tone(t, state);
    let el = div().id(`${prefix(h)}dot-${r.key}`).size(8).rounded(4).flex_none();
    el = r.on || busy || state !== "down" ? el.bg(color) : el.border_1().border_color(color);
    return busy || state === "boot" ? el.loop("opacity", { from: 0.3, to: 1, period: 1200 }) : el;
  }

  server(t, h, r) {
    const phase = this.phaseOf(h, r);
    const state = phase ?? r.state;
    const label = LABEL[state] ?? state;
    const since = age(r.since);
    const p = prefix(h), space = this.spaceFor(h, r);
    const tip = [
      `${r.key} · ${h.name ? `${h.name}:` : ""}${r.dir}`,
      `${WORDS[state] ?? state}${since && !phase ? ` for ${since}` : ""}${r.branch ? ` · ${r.branch}` : ""}`,
      r.last ? `Last ${r.last.verb}: ${r.last.message}` : null,
    ].filter(Boolean).join("\n");
    const showReason = !phase && r.reason && ["error", "busy", "foreign", "down"].includes(r.state);
    const many = r.services.length > 1 && (r.on || phase);
    const main = r.services.find((v) => v.port === r.port) ?? { port: r.port, url: r.url };
    const act = (verb) => (cx) => this.act(cx, h, verb, r.key, on(h, r.name), [r.key]);
    const buttons = phase === "stopping" ? [null, null]
      : phase ? [this.button(t, `${p}s-${r.key}-stop`, "stop", "Stop", act("stop")), null]
      : r.on ? [this.button(t, `${p}s-${r.key}-stop`, "stop", "Stop", act("stop")), this.button(t, `${p}s-${r.key}-restart`, "rotate", "Restart", act("restart"))]
      : [this.button(t, `${p}s-${r.key}-start`, "play", r.exists ? "Start" : "Its folder is missing", r.exists ? act("start") : null, t.ansi2 ?? t.done), null];
    // Another machine's localhost isn't this one's, so its rows open nothing here.
    const opens = !h.name && r.on && isWeb(r.url);
    const logTip = space ? `Follow its log in ${on(h, `the ${space.name} space`)}` : "Follow its log in a new tab here";
    return v_flex().flex_none()
      .child(h_flex().h(28).mx(6).px(6).gap(6).items_center().rounded(6).hover((s) => s.bg(t.hover))
        .child(this.dot(t, h, r, state))
        .child(h_flex().id(`${p}s-${r.key}`).flex_1().min_w(0).gap(6).items_center().tooltip(tip)
          .child(div().w(70).flex_none().truncate().text_size(12.5).text_color(r.exists ? t.foreground : t.dim).child(r.name))
          .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(r.branch ?? ""))
          .when(Boolean(label), (el) => el.child(div().flex_none().text_size(11).text_color(tone(t, state)).child(label))))
        .child(this.chip(t, h, `s-${r.key}-port`, null, main, null))
        .child(h_flex().flex_none().gap(1)
          .children(buttons.map((b) => b ?? div().size(22).flex_none()))
          .child(this.button(t, `${p}s-${r.key}-open`, "external", `Open ${r.url}`, opens ? (cx) => cx.open_url(r.url) : null))
          .child(this.button(t, `${p}s-${r.key}-log`, "log", logTip, r.exists && (space || !h.name) ? () => this.tail(h, r) : null))))
      .when(Boolean(showReason), (el) => el.child(div().id(`${p}s-${r.key}-why`).pl(32).pr(12).pb(3).truncate().text_size(11)
        .text_color(r.state === "down" && !(r.last && !r.last.ok) ? t.dim : (t.ansi1 ?? t.blocked)).tooltip(r.reason).child(`↳ ${r.reason}`)))
      .when(Boolean(many), (el) => el.child(h_flex().flex_wrap().gap(2).pl(26).pr(10).pb(4)
        .children(r.services.map((v) => this.chip(t, h, `s-${r.key}-${v.name}`, v.name, v, this.serviceDot(t, v))))));
  }
}
