// Move the focused pane: re-split it beside another pane of its tab, swap it with a
// neighbour, or send it to another tab, another space, a new tab or a new space.
// The herdr-app port of the old Herdr plugin osamahbeig.pane-mover (with the local
// "open-tabs" patch). Two entry points share this file:
//   pane-mover       cmd-shift-m  the whole menu
//   pane-mover-tabs  cmd-m        straight to the tab list
// Mods can't import across folders, so mods/pane-mover-tabs/mover.js is an identical
// copy of mods/pane-mover/mover.js. Edit one, then copy it over the other.
//
// Herdr has no "move pane" command. A move parks the terminal (its pane goes, the
// program keeps running), waits for the park to land, focuses the pane to put it beside,
// and keeps it there: terminal.keep place right/down, plus a pane.swap for left/up.
// A new space comes from fresh herdr.space/herdr.tab labels, which Herdr adopts as a new
// space. Mod panes have no terminal, so they can only swap.
//
// Keys: the menus take ↑/↓ (or j/k), Enter, and the key shown on a row. The tab and
// space lists filter as you type, with ↑/↓ and Enter. Esc goes back, then closes.
// `herdr-app do pane-mover.key:<key>` (or .type:<text>) drives an open menu from a shell.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { focused, panes, spaces, run, hc, theme, props, closeOverlay, nextCommand } from "herdr";

const ARROW = { left: "←", right: "→", up: "↑", down: "↓" };
const DIRS = ["left", "right", "up", "down"];
const PLACE = { left: "right", right: "right", up: "down", down: "down" };
const WHERE = { left: "left (side by side)", right: "right (side by side)", up: "top (stacked)", down: "bottom (stacked)" };
const FILTERED = new Set(["tabs", "spaces"]);

const ROW = 30;
const HEAD = 25;
const MAX_LIST = 420;

// "Claude Code · api", "zsh · keys-test": what the pane runs, and where.
function label(p) {
  const base = (p.cwd ?? "").split("/").filter(Boolean).pop();
  const what = p.program?.name || p.title || p.mod || "pane";
  return base ? `${what} · ${base}` : what;
}

function freshId(prefix) {
  let hex = "";
  for (let i = 0; i < 32; i++) hex += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  return prefix + hex;
}

// Remote ids carry a "machine/" prefix in the app; labels on that machine leave it out.
const localId = (id) => id.split("/").pop();
const height = (it) => (it.head ? HEAD : ROW);

export class Mover extends View {
  // Which view opens first: "root" (the whole menu) or "tabs" (the tab list).
  startView() {
    return "root";
  }

  init(_props, cx) {
    this.start = this.startView();
    this.view = this.start;
    this.at = 0;
    this.top = 0;
    this.wheel = 0;
    this.filter = "";
    this.busy = null;
    this.error = null;
    this.parked = null;
    this.dest = null;
    const f = focused();
    this.target = f?.pane ? panes().find((p) => p.pane === f.pane) ?? null : null;
    this.space = spaces().find((s) => s.id === f?.space) ?? null;
    this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Filter…" });
    this.input.on("change", (_e, cx) => {
      this.filter = this.input.value();
      this.at = 0;
      this.top = 0;
      cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.choose(this.pickable()[this.at], cx));
    this.focusView();
    cx.timer.after(150, () => this.focusView());
    // "<mod>.key:<key>" presses a key in the menu; "<mod>.type:<text>" sets the filter.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key:")) this.press(c.slice(4), c.slice(4), cx);
        else if (c.startsWith("type:") && FILTERED.has(this.view)) {
          this.input.set_value(c.slice(5));
          this.filter = c.slice(5);
          this.at = 0;
          this.top = 0;
          cx.notify();
        }
      }
    });
  }

  // The lists take typing; the menus take single keys.
  focusView() {
    if (FILTERED.has(this.view)) this.input.focus();
    else this.handle.focus();
  }

  // A move cut short (Esc mid-move) must not strand a running program without a pane.
  async close(_cx) {
    if (this.parked && !panes().some((p) => p.terminal === this.parked)) {
      run("terminal.keep", { terminal: this.parked, place: "tab" });
    }
  }

  done() {
    const id = props()?.overlay;
    if (id) closeOverlay(id);
  }

  // ---- what the menu offers ------------------------------------------------

  siblings() {
    const t = this.target;
    return t ? panes().filter((p) => p.tab === t.tab && p.pane !== t.pane) : [];
  }

  // Same machine only (a terminal can't change machines); the current space first.
  sameMachine() {
    const machine = this.space?.machine ?? null;
    const list = spaces().filter((s) => (s.machine ?? null) === machine);
    return [...list.filter((s) => s.id === this.space?.id), ...list.filter((s) => s.id !== this.space?.id)];
  }

  otherTabs() {
    const t = this.target;
    return this.sameMachine().flatMap((s) => s.tabs.filter((tab) => tab.id !== t?.tab).map((tab) => ({ space: s, tab })));
  }

  otherSpaces() {
    return this.sameMachine().filter((s) => s.id !== this.space?.id);
  }

  matches(...words) {
    const f = this.filter.trim().toLowerCase();
    return !f || words.join(" ").toLowerCase().includes(f);
  }

  items() {
    const t = this.target;
    if (!t) return [];
    const term = t.terminal;
    const out = [];
    if (this.view === "root") {
      const sibs = this.siblings();
      if (sibs.length) {
        out.push({ head: "This tab" });
        if (term) {
          const sib = sibs[0];
          DIRS.forEach((d, i) =>
            out.push({ key: String(i + 1), label: `Re-split ${ARROW[d]} ${d === "up" ? "above" : d === "down" ? "below" : `${d} of`} ${label(sib)}`, act: (cx) => this.resplit(cx, sib, d) }),
          );
        }
        DIRS.forEach((d, i) => out.push({ key: String(i + 5), label: `Swap ${ARROW[d]} ${d}`, act: () => this.swap(d) }));
      }
      if (term) {
        out.push({ head: "Elsewhere" });
        if (this.otherTabs().length) out.push({ key: "t", label: "Move to another tab…", view: "tabs" });
        if (this.otherSpaces().length) out.push({ key: "w", label: "Move to another space…", view: "spaces" });
        if (sibs.length) out.push({ key: "n", label: "Move to a new tab (this space)", act: (cx) => this.toNewTab(cx) });
        out.push({ key: "N", label: "Move to a new space", act: (cx) => this.toNewSpace(cx) });
      }
    } else if (this.view === "tabs") {
      let last = null;
      for (const { space, tab } of this.otherTabs()) {
        if (!this.matches(space.name, tab.name)) continue;
        if (space.id !== last) {
          out.push({ head: space.id === this.space?.id ? `${space.name} (this space)` : space.name });
          last = space.id;
        }
        out.push({ label: tab.name, hint: tab.panes > 1 ? `${tab.panes} panes` : "", view: "place", dest: { space, tab } });
      }
    } else if (this.view === "place") {
      const { space, tab } = this.dest;
      out.push({ head: `Into ${space.name} / ${tab.name}` });
      DIRS.forEach((d, i) => out.push({ key: String(i + 1), label: `${ARROW[d]} ${WHERE[d]}`, act: (cx) => this.toTab(cx, space, tab, d) }));
    } else if (this.view === "spaces") {
      for (const s of this.otherSpaces()) {
        if (this.matches(s.name, s.branch ?? "")) out.push({ label: s.name, hint: s.branch ?? "", act: (cx) => this.toSpace(cx, s) });
      }
    }
    return out;
  }

  pickable() {
    return this.items().filter((it) => !it.head);
  }

  go(view, cx) {
    this.view = view;
    this.at = 0;
    this.top = 0;
    this.error = null;
    if (FILTERED.has(view)) {
      this.filter = "";
      this.input.set_value("");
    }
    this.focusView();
    cx.notify();
  }

  back(cx) {
    if (this.view === this.start) return this.done();
    this.go(this.view === "place" ? "tabs" : "root", cx);
  }

  // One key: `k` names it ("escape", "down", "t"), `ch` is what it types ("N" with shift).
  // In the lists, typing belongs to the filter, so only the arrows, Enter and Esc count.
  press(k, ch, cx, fromKeyboard = false) {
    if (this.busy) return false;
    const pickable = this.pickable();
    const n = Math.max(1, pickable.length);
    const typing = FILTERED.has(this.view);
    if (k === "escape") this.back(cx);
    else if (k === "down" || (!typing && k === "j")) this.at = (this.at + 1) % n;
    else if (k === "up" || (!typing && k === "k")) this.at = (this.at + n - 1) % n;
    else if (k === "enter") {
      // In a list, the filter's own submit handles a real Enter.
      if (typing && fromKeyboard) return false;
      this.choose(pickable[this.at], cx);
    } else if (!typing && k === "q") this.done();
    else {
      const hit = !typing && pickable.find((it) => it.key && it.key === ch);
      if (!hit) return false;
      this.choose(hit, cx);
    }
    cx.notify();
    return true;
  }

  choose(it, cx) {
    if (!it || this.busy) return;
    if (it.view) {
      if (it.dest) this.dest = it.dest;
      return this.go(it.view, cx);
    }
    this.busy = it.label;
    this.error = null;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        await it.act(cx);
        this.done();
      } catch (e) {
        this.busy = null;
        this.error = String(e?.message ?? e);
        if (this.parked && !panes().some((p) => p.terminal === this.parked)) {
          run("terminal.keep", { terminal: this.parked, place: "tab" });
          this.error += " It went to a new tab instead.";
        }
        this.parked = null;
        cx.notify();
      }
    });
  }

  // ---- moves ---------------------------------------------------------------

  async park(cx) {
    const term = this.target.terminal;
    this.parked = term;
    run("terminal.park", { terminal: term });
    for (let i = 0; i < 60; i++) {
      if (!panes().some((p) => p.terminal === term)) return;
      await cx.sleep(50);
    }
    throw new Error("The pane didn't come away.");
  }

  async kept(cx) {
    const term = this.target.terminal;
    for (let i = 0; i < 60; i++) {
      const p = panes().find((p) => p.terminal === term);
      if (p) {
        this.parked = null;
        return p;
      }
      await cx.sleep(50);
    }
    throw new Error("The pane didn't arrive.");
  }

  // The kept pane is focused and sits right of / below where it was put: left and up swap once.
  async keepBeside(cx, dir) {
    run("terminal.keep", { terminal: this.target.terminal, place: PLACE[dir] });
    const p = await this.kept(cx);
    if (dir === "left" || dir === "up") {
      run("pane.focus", { pane: p.pane });
      run("pane.swap", { direction: dir });
    }
    return p;
  }

  swap(dir) {
    run("pane.focus", { pane: this.target.pane });
    run("pane.swap", { direction: dir });
  }

  async resplit(cx, sib, dir) {
    await this.park(cx);
    run("pane.focus", { pane: sib.pane });
    await this.keepBeside(cx, dir);
  }

  async toTab(cx, space, tab, dir) {
    await this.park(cx);
    run("space.select", { id: space.id });
    run("tab.select", { id: tab.id });
    await this.keepBeside(cx, dir);
  }

  async toSpace(cx, space) {
    await this.park(cx);
    run("space.select", { id: space.id });
    run("terminal.keep", { terminal: this.target.terminal, place: "tab" });
    const p = await this.kept(cx);
    run("tab.rename", { id: p.tab, name: "" });
  }

  async toNewTab(cx) {
    await this.park(cx);
    run("terminal.keep", { terminal: this.target.terminal, place: "tab" });
    const p = await this.kept(cx);
    run("tab.rename", { id: p.tab, name: "" });
  }

  async toNewSpace(cx) {
    await this.park(cx);
    const sp = freshId("sp");
    const r = await hc(["label", this.target.terminal, `herdr.space=${sp}`, `herdr.tab=${freshId("tb")}`]);
    if (r.code !== 0) throw new Error(`hc label failed: ${(r.stderr || r.stdout).trim()}`);
    for (let i = 0; i < 80; i++) {
      const s = spaces().find((s) => localId(s.id) === sp);
      if (s) {
        this.parked = null;
        run("space.select", { id: s.id });
        return;
      }
      await cx.sleep(50);
    }
    throw new Error("The new space didn't appear.");
  }

  // ---- drawing ---------------------------------------------------------------

  // The rows from `this.top` that fit in MAX_LIST, moving `top` so the selection shows.
  window(list, sel) {
    const si = list.indexOf(sel);
    this.top = Math.max(0, Math.min(this.top, list.length - 1));
    if (si >= 0 && si < this.top) this.top = si;
    // A group title sits just above its first row.
    if (si > 0 && this.top === si && list[si - 1].head) this.top = si - 1;
    const fits = (from, to) => list.slice(from, to + 1).reduce((h, it) => h + height(it), 0) <= MAX_LIST;
    while (si >= 0 && this.top < si && !fits(this.top, si)) this.top++;
    let end = this.top;
    let h = 0;
    while (end < list.length && h + height(list[end]) <= MAX_LIST) h += height(list[end++]);
    return { rows: list.slice(this.top, end), h, more: end < list.length || this.top > 0 };
  }

  render(_cx) {
    const t = theme();
    const list = this.items();
    const pickable = list.filter((it) => !it.head);
    this.at = Math.max(0, Math.min(this.at, pickable.length - 1));
    const sel = pickable[this.at];
    const typing = FILTERED.has(this.view);
    const { rows, h, more } = this.window(list, sel);
    const title = this.target ? `Move pane · ${label(this.target)}` : "Move pane";
    const note = !this.target
      ? "No pane has the keyboard."
      : !this.target.terminal && !this.siblings().length
        ? "A panel on its own can't move anywhere."
        : !this.target.terminal
          ? "A panel can only swap places."
          : typing && !pickable.length
            ? this.filter ? "Nothing matches." : this.view === "tabs" ? "No other tabs." : "No other spaces."
            : null;

    const row = (it, i) => {
      if (it.head) return h_flex().id(`pm-h-${i}`).h(HEAD).flex_none().px(10).items_end().pb(4).text_size(11).font_semibold().text_color(t.dim).child(div().truncate().child(it.head));
      const on = it === sel;
      return h_flex()
        .id(`pm-${i}`)
        .h(ROW)
        .flex_none()
        .px(10)
        .gap(10)
        .rounded(7)
        .items_center()
        .cursor_pointer()
        .when(on, (el) => el.bg(t.hover))
        .hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => this.choose(it, cx))
        .when(!typing, (el) => el.child(div().w(14).flex_none().text_size(11.5).text_color(t.dim).child(it.key ?? "")))
        .child(div().flex_1().truncate().text_color(t.foreground).child(it.label))
        .when(Boolean(it.hint), (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(it.hint)))
        .when(Boolean(it.view), (el) => el.child(div().flex_none().text_color(t.dim).child("›")));
    };

    return v_flex()
      .id("pane-mover")
      .track_focus(this.handle)
      .w_full()
      .p(14)
      .gap(8)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        if (this.press(e.key, e.key_char ?? e.key, cx, true)) cx.stop_propagation();
      })
      .child(
        h_flex()
          .items_center()
          .gap(8)
          .child(div().flex_1().truncate().text_size(14).font_semibold().text_color(t.foreground).child(title))
          .child(div().flex_none().text_size(11).text_color(t.dim).child(this.view === this.start ? "Esc" : "Esc back")),
      )
      .when(typing && Boolean(this.target?.terminal), (el) =>
        el.child(
          h_flex().h(34).flex_none().px(10).gap(8).items_center().rounded(8).border_1().border_color(t.accent).bg(t.background)
            .child(svg("mods/workspace-chrome/search.svg").size(14).text_color(t.dim))
            .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground))
            .child(div().flex_none().text_size(11).text_color(t.dim).child(this.view === "tabs" ? "tab or space" : "space")),
        ),
      )
      .when(Boolean(note), (el) => el.child(div().px(10).text_size(12.5).text_color(t.muted).child(note)))
      .when(Boolean(this.error), (el) => el.child(div().px(10).text_size(12.5).text_color(t.blocked).child(this.error)))
      .when(Boolean(this.busy), (el) => el.child(div().px(10).text_size(12.5).text_color(t.muted).child(`${this.busy}…`)))
      .child(
        v_flex()
          .id("pm-list")
          .flex_none()
          .h(h)
          .overflow_hidden()
          .on_scroll_wheel((e, cx) => {
            this.wheel -= e.delta.y;
            const step = Math.trunc(this.wheel / ROW);
            if (!step) return;
            this.wheel -= step * ROW;
            this.top = Math.max(0, Math.min(list.length - 1, this.top + step));
            // The selection follows the wheel, so the next frame doesn't scroll back to it.
            const shown = this.window(list, null).rows.filter((it) => !it.head);
            if (shown.length && !shown.includes(sel)) this.at = pickable.indexOf(step > 0 ? shown[0] : shown[shown.length - 1]);
            cx.notify();
          })
          .children(rows.map((it) => row(it, list.indexOf(it)))),
      )
      .when(more, (el) => el.child(div().px(10).text_size(11).text_color(t.dim).child(`${pickable.length} ${this.view === "spaces" ? "spaces" : "tabs"} · ↑↓ to scroll`)));
  }
}
