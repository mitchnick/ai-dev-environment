// cmd-k (keys.json: "mod.open:link-picker"): the links the focused terminal's agent mentioned,
// newest first, numbered. The herdr-app port of the openr plugin's link picker.
// ~/.local/bin/herdr-app-links finds them: the Claude or Codex transcript when there is one
// (so URLs hidden behind Markdown link text still show), else the screen and scrollback.
//
// Keys: type to filter (text or number), ↑/↓, Enter or click opens it in the browser,
// ctrl-y copies it, Esc closes. `herdr-app do link-picker.key:<key>` / `.type:<text>`
// drive it from a shell.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { focused, exec, home, theme, props, closeOverlay, nextCommand, notify } from "herdr";

const ROW = 30;
const MAX_ROWS = 12;

export default class LinkPicker extends View {
  init(_props, cx) {
    this.urls = null;
    this.source = null;
    this.error = null;
    this.filter = "";
    this.at = 0;
    this.top = 0;
    this.terminal = focused()?.terminal ?? null;
    this.input = InputState.new({ placeholder: "Filter links…" });
    this.input.on("change", (_e, cx) => {
      this.filter = this.input.value();
      this.at = 0;
      this.top = 0;
      cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.open(this.shown()[this.at]));
    this.input.focus();
    cx.timer.after(150, () => this.input.focus());
    cx.spawn(async (cx) => {
      if (!this.terminal) {
        this.error = "No terminal has the keyboard.";
        return cx.notify();
      }
      try {
        const r = await exec(`${home()}/.local/bin/herdr-app-links`, ["--terminal", this.terminal]);
        if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim());
        const d = JSON.parse(r.stdout);
        this.urls = d.urls;
        this.source = d.source;
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
          this.filter = c.slice(5);
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

  // Numbered as listed, so a number keeps meaning the same link while filtering.
  shown() {
    const f = this.filter.trim().toLowerCase();
    return (this.urls ?? [])
      .map((url, i) => ({ url, n: i + 1 }))
      .filter((it) => !f || it.url.toLowerCase().includes(f) || String(it.n) === f);
  }

  open(it) {
    if (!it) return;
    this.done();
    exec("/usr/bin/open", [it.url]).catch((e) => notify({ title: "Couldn't open the link", body: String(e), level: "error" }));
  }

  copy(it) {
    if (!it) return;
    this.done();
    exec("/bin/sh", ["-c", 'printf %s "$1" | /usr/bin/pbcopy', "sh", it.url])
      .then(() => notify({ title: "Link copied", body: it.url, level: "success", timeout: 2500 }))
      .catch((e) => notify({ title: "Couldn't copy the link", body: String(e), level: "error" }));
  }

  // `fromKeyboard`: Enter from the filter arrives as its submit, so skip it here.
  press(k, fromKeyboard, cx, ctrl = false) {
    const list = this.shown();
    const n = Math.max(1, list.length);
    if (k === "escape") this.done();
    else if (k === "down") this.at = (this.at + 1) % n;
    else if (k === "up") this.at = (this.at + n - 1) % n;
    else if (k === "enter" && !fromKeyboard) this.open(list[this.at]);
    else if ((k === "y" && ctrl) || k === "ctrl-y") this.copy(list[this.at]);
    else return false;
    cx.notify();
    return true;
  }

  render(_cx) {
    const t = theme();
    const list = this.shown();
    this.at = Math.max(0, Math.min(this.at, list.length - 1));
    if (this.at < this.top) this.top = this.at;
    if (this.at >= this.top + MAX_ROWS) this.top = this.at - MAX_ROWS + 1;
    this.top = Math.max(0, Math.min(this.top, Math.max(0, list.length - MAX_ROWS)));
    const rows = list.slice(this.top, this.top + MAX_ROWS);
    const note = this.error
      ? this.error
      : this.urls === null
        ? "Looking…"
        : !this.urls.length
          ? this.source === "transcript" ? "The agent hasn't mentioned any links." : "No links on this terminal's screen or scrollback."
          : !list.length
            ? "Nothing matches."
            : null;

    const row = (it) => {
      const on = it === list[this.at];
      const m = it.url.match(/^(https?:\/\/)([^/?#]+)(.*)$/);
      return h_flex()
        .id(`lk-${it.n}`)
        .h(ROW)
        .flex_none()
        .px(10)
        .gap(10)
        .rounded(7)
        .items_center()
        .cursor_pointer()
        .when(on, (el) => el.bg(t.hover))
        .hover((s) => s.bg(t.hover))
        .on_click(() => this.open(it))
        .child(div().w(22).flex_none().text_size(11.5).text_color(t.dim).child(String(it.n)))
        .child(
          h_flex()
            .flex_1()
            .min_w(0)
            .child(div().flex_none().text_color(t.foreground).child(m ? m[2] : it.url))
            .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(m ? m[3] : "")),
        );
    };

    return v_flex()
      .id("link-picker")
      .w_full()
      .p(14)
      .gap(8)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        if (this.press(e.key, true, cx, e.modifiers.control)) cx.stop_propagation();
      })
      .child(
        h_flex()
          .items_center()
          .gap(8)
          .child(div().flex_1().text_size(14).font_semibold().text_color(t.foreground).child("Links"))
          .when(Boolean(this.source), (el) =>
            el.child(div().text_size(11).text_color(t.dim).child(this.source === "transcript" ? "from the agent's replies" : "from the screen")),
          )
          .child(div().text_size(11).text_color(t.dim).child("Enter open · ctrl-y copy · Esc")),
      )
      .child(
        h_flex().h(34).flex_none().px(10).gap(8).items_center().rounded(8).border_1().border_color(t.accent).bg(t.background)
          .child(svg("mods/workspace-chrome/search.svg").size(14).text_color(t.dim))
          .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground)),
      )
      .when(Boolean(note), (el) => el.child(div().px(10).text_size(12.5).text_color(this.error ? t.blocked : t.muted).child(note)))
      .when(rows.length > 0, (el) => el.child(v_flex().flex_none().children(rows.map(row))))
      .when(list.length > MAX_ROWS, (el) => el.child(div().px(10).text_size(11).text_color(t.dim).child(`${list.length} links · ↑↓ for more`)));
  }
}
