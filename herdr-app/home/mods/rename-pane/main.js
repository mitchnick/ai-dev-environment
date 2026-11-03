// Rename pane: the Rename tab dialog (the shipped `prompt` mod), for a pane.
// The name is the terminal's `pane.name` label, so it lives in herdr-core and
// survives restarts of the app; the pane-plus header shows it before the
// auto-named task or the program. Empty removes it. Enter saves, Esc cancels.
// Opens on the focused pane (mod.open:rename-pane) or on props { terminal }
// (pane-plus: double-click a header's name).

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, theme, focused, terminals, hc, notify } from "herdr";

const LABEL = "pane.name";

export default class RenamePane extends View {
  init(_props, cx) {
    this.terminal = props()?.terminal ?? focused()?.terminal ?? null;
    this.text = terminals().find((t) => t.address === this.terminal)?.labels?.[LABEL] ?? "";
    this.saving = false;
    this.input = InputState.new({ value: this.text });
    if (this.text) this.input.set_selected_range({ start: 0, end: this.text.length });
    this.input.on("change", (_e, cx) => { this.text = this.input.value(); cx.notify(); });
    this.input.on("submit", (_e, cx) => this.submit(cx));
    this.inputFocused = true;
    this.input.on("focus", (_e, cx) => { this.inputFocused = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.inputFocused = false; cx.notify(); });
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.handle = cx.focus_handle();
  }

  // Label first, close after: closing ends this copy and its tasks.
  submit(cx) {
    const overlay = props().overlay;
    if (!this.terminal) return closeOverlay(overlay);
    if (this.saving) return;
    this.saving = true;
    const terminal = this.terminal;
    const name = this.text.trim();
    cx.spawn(async () => {
      try {
        const r = await hc(["label", terminal, `${LABEL}=${name}`]);
        if (r.code !== 0) notify({ title: "Couldn't rename the pane", body: (r.stderr || r.stdout).trim(), level: "error" });
      } catch (e) {
        notify({ title: "Couldn't rename the pane", body: String(e), level: "error" });
      }
      closeOverlay(overlay);
    });
  }

  key(e, cx) {
    if (e.key === "escape") { closeOverlay(props().overlay); cx.stop_propagation(); }
  }

  render() {
    const t = theme();
    const p = props() ?? {};
    const label = (text) => div().pt(16).pb(7).text_size(11.5).text_color(t.dim).child(text);
    const button = (id, text, primary, action) => h_flex().id(id).h(32).px(14).items_center().rounded(8)
      .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12.5).font_medium().cursor_pointer()
      .hover(s => s.opacity(0.88)).on_click(action).child(text);
    const hint = this.terminal ? "empty: its automatic name" : "This pane has no terminal to name";
    return v_flex().id("rename-pane").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .w_full().min_h(0).p(18).bg(t.popover).text_color(t.foreground)
      .child(h_flex().items_center().child(div().flex_1().text_size(15).font_semibold().child("Rename pane"))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(label("Name"))
      .child(Input.new(this.input).h(36).px(10).rounded(9).border_1().border_color(this.inputFocused ? t.accent : t.input).bg(t.background).text_size(12.8).text_color(t.foreground))
      .child(div().pt(6).text_size(11.5).text_color(t.dim).child(hint))
      .child(h_flex().pt(20).gap(8).justify_end()
        .child(button("rp-cancel", "Cancel", false, () => closeOverlay(p.overlay)))
        .child(button("rp-save", "Save", true, (_e, cx) => this.submit(cx))));
  }
}
