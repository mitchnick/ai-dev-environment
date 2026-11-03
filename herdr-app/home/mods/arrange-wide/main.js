// cmd-shift-r (keys.json: "mod.open:arrange-wide"): arrange the shown tab's panes in up to 4
// equal columns, more panes adding rows. ~/.local/bin/herdr-app-arrange does the work (the port
// of the old herdr-arrange wide); a failure shows as a toast.
// It opens as an invisible overlay only to run that, then closes itself. Outside an
// overlay (herdr-app check) it does nothing.
import { View, div } from "gpui-kit";
import { focused, panes, exec, home, run, notify, props, closeOverlay } from "herdr";

export default class Arrange extends View {
  init(_props, cx) {
    const overlay = props()?.overlay;
    if (!overlay) return;
    const f = focused();
    if (!f?.tab) return closeOverlay(overlay);
    // Like the old script: a zoomed tab is unzoomed first.
    const zoomed = panes().find((p) => p.tab === f.tab && p.zoomed);
    if (zoomed) run("pane.zoom", { pane: zoomed.pane });
    cx.spawn(async () => {
      try {
        const r = await exec(`${home()}/.local/bin/herdr-app-arrange`, ["wide", "--tab", f.tab]);
        if (r.code !== 0) notify({ title: "Arrange failed", body: (r.stderr || r.stdout).trim(), level: "error" });
      } catch (e) {
        notify({ title: "Arrange failed", body: String(e), level: "error" });
      } finally {
        closeOverlay(overlay);
      }
    });
  }
  render() {
    return div();
  }
}
