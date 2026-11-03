// cmd-f (keys.json: "mod.open:scrollback-search"): search the focused terminal's screen and
// scrollback (the last 5000 lines, from `hc read`), newest match first, with the lines around
// the selected one. Enter copies the matching line; shift-enter copies it with its context.
// herdr-app has no copy mode a mod can drive, so this stands in for the old Cmd+F / copy mode.
//
// Matching: plain text, case-insensitive unless the query has a capital (smart case);
// /pattern/ is a regular expression. ↑/↓ move, Esc closes.
// `herdr-app do scrollback-search.key:<key>` / `.type:<text>` drive it from a shell.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { focused, hc, exec, theme, props, closeOverlay, nextCommand, notify, settings } from "herdr";

const HISTORY = 5000;
const ROW = 26;
const MAX_ROWS = 12;
const CONTEXT = 2;

export default class ScrollbackSearch extends View {
  init(_props, cx) {
    this.lines = null;
    this.error = null;
    this.query = "";
    this.at = 0;
    this.top = 0;
    this.terminal = focused()?.terminal ?? null;
    this.input = InputState.new({ placeholder: "Search scrollback…" });
    this.input.on("change", (_e, cx) => {
      this.query = this.input.value();
      this.at = 0;
      this.top = 0;
      cx.notify();
    });
    this.input.on("submit", (e, cx) => this.copy(e?.shift));
    this.input.focus();
    cx.timer.after(150, () => this.input.focus());
    cx.spawn(async (cx) => {
      if (!this.terminal) {
        this.error = "No terminal has the keyboard.";
        return cx.notify();
      }
      try {
        const r = await hc(["read", this.terminal, "--lines", String(HISTORY)]);
        if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim());
        this.lines = r.stdout.split("\n").map((l) => l.replace(/\s+$/, ""));
        while (this.lines.length && !this.lines[this.lines.length - 1]) this.lines.pop();
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      cx.notify();
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key:")) this.press(c.slice(4), false, cx);
        else if (c.startsWith("type:")) {
          this.input.set_value(c.slice(5));
          this.query = c.slice(5);
          this.at = 0;
          cx.notify();
        }
      }
    });
  }

  done() {
    const id = props()?.overlay;
    if (id) closeOverlay(id);
  }

  // A RegExp for the query, or null when it's empty or an unfinished /regex/.
  pattern() {
    const q = this.query;
    if (!q.trim()) return null;
    const re = q.match(/^\/(.+)\/$/);
    try {
      if (re) return new RegExp(re[1], /[A-Z]/.test(re[1]) ? "" : "i");
      return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), /[A-Z]/.test(q) ? "" : "i");
    } catch {
      return null;
    }
  }

  // Newest first: { line index, match start, match end }.
  matches() {
    const re = this.pattern();
    if (!re || !this.lines) return [];
    const out = [];
    for (let i = this.lines.length - 1; i >= 0 && out.length < 500; i--) {
      const m = re.exec(this.lines[i]);
      if (m && m[0].length) out.push({ i, from: m.index, to: m.index + m[0].length });
    }
    return out;
  }

  copy(withContext) {
    const m = this.matches()[this.at];
    if (!m) return;
    const text = withContext
      ? this.lines.slice(Math.max(0, m.i - CONTEXT), m.i + CONTEXT + 1).join("\n")
      : this.lines[m.i].trim();
    this.done();
    exec("/bin/sh", ["-c", 'printf %s "$1" | /usr/bin/pbcopy', "sh", text])
      .then(() => notify({ title: withContext ? "Lines copied" : "Line copied", body: text.slice(0, 200), level: "success", timeout: 2500 }))
      .catch((e) => notify({ title: "Couldn't copy", body: String(e), level: "error" }));
  }

  // `fromKeyboard`: Enter from the search field arrives as its submit, so skip it here.
  press(k, fromKeyboard, cx) {
    const n = Math.max(1, this.matches().length);
    if (k === "escape") this.done();
    else if (k === "down") this.at = (this.at + 1) % n;
    else if (k === "up") this.at = (this.at + n - 1) % n;
    else if (k === "enter" && !fromKeyboard) this.copy(false);
    else if (k === "shift-enter" && !fromKeyboard) this.copy(true);
    else return false;
    cx.notify();
    return true;
  }

  render(_cx) {
    const t = theme();
    const mono = settings().font_family;
    const list = this.matches();
    this.at = Math.max(0, Math.min(this.at, list.length - 1));
    if (this.at < this.top) this.top = this.at;
    if (this.at >= this.top + MAX_ROWS) this.top = this.at - MAX_ROWS + 1;
    const rows = list.slice(this.top, this.top + MAX_ROWS);
    const sel = list[this.at];
    const total = this.lines?.length ?? 0;
    const note = this.error
      ? this.error
      : this.lines === null
        ? "Reading…"
        : !this.query.trim()
          ? `Type to search ${total} lines.`
          : !this.pattern()
            ? "That regular expression doesn't parse yet."
            : !list.length
              ? "No matches."
              : null;

    const hit = (m) =>
      h_flex()
        .flex_1()
        .min_w(0)
        .overflow_hidden()
        .font_family(mono)
        .text_size(12.5)
        .whitespace_nowrap()
        .child(div().flex_none().text_color(t.muted).child(this.lines[m.i].slice(Math.max(0, m.from - 60), m.from).trimStart()))
        .child(div().flex_none().rounded(3).bg(t.selection).text_color(t.foreground).child(this.lines[m.i].slice(m.from, m.to)))
        .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(this.lines[m.i].slice(m.to)));

    const row = (m, k) =>
      h_flex()
        .id(`sb-${m.i}`)
        .h(ROW)
        .flex_none()
        .px(10)
        .gap(10)
        .rounded(6)
        .items_center()
        .cursor_pointer()
        .when(m === sel, (el) => el.bg(t.hover))
        .hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => {
          this.at = this.top + k;
          cx.notify();
        })
        .child(div().w(40).flex_none().text_size(11).text_color(t.dim).child(`${total - m.i}↑`))
        .child(hit(m));

    const context = sel
      ? this.lines.slice(Math.max(0, sel.i - CONTEXT), sel.i + CONTEXT + 1).map((line, j) => {
          const i = Math.max(0, sel.i - CONTEXT) + j;
          return div()
            .id(`sb-ctx-${i}`)
            .font_family(mono)
            .text_size(12)
            .truncate()
            .text_color(i === sel.i ? t.foreground : t.dim)
            .child(line || " ");
        })
      : [];

    return v_flex()
      .id("scrollback-search")
      .w_full()
      .p(14)
      .gap(8)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        if (this.press(e.key, true, cx)) cx.stop_propagation();
      })
      .child(
        h_flex()
          .items_center()
          .gap(8)
          .child(div().flex_1().text_size(14).font_semibold().text_color(t.foreground).child("Search scrollback"))
          .child(div().text_size(11).text_color(t.dim).child("Enter copy line · ⇧Enter with context · Esc")),
      )
      .child(
        h_flex().h(34).flex_none().px(10).gap(8).items_center().rounded(8).border_1().border_color(t.accent).bg(t.background)
          .child(svg("mods/workspace-chrome/search.svg").size(14).text_color(t.dim))
          .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground))
          .when(list.length > 0, (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(`${this.at + 1} of ${list.length}${list.length === 500 ? "+" : ""}`))),
      )
      .when(Boolean(note), (el) => el.child(div().px(10).text_size(12.5).text_color(this.error ? t.blocked : t.muted).child(note)))
      .when(rows.length > 0, (el) => el.child(v_flex().flex_none().children(rows.map(row))))
      .when(context.length > 0, (el) =>
        el.child(v_flex().flex_none().mt(2).p(10).gap(2).rounded(8).bg(t.background).border_1().border_color(t.border).children(context)),
      );
  }
}
