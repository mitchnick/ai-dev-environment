// cmd-] (keys.json: "mod.open:pane-next"): focus the next pane of the shown tab, wrapping
// around, like the old Herdr's cycle_pane_next. Herdr only has directional pane.go.
// It opens as an invisible overlay only to run once, then closes itself. Outside an
// overlay (herdr-app check) it does nothing.
import { View, div } from "gpui-kit";
import { focused, panes, run, props, closeOverlay } from "herdr";

const STEP = 1;

export default class PaneCycle extends View {
  init(_props, _cx) {
    const overlay = props()?.overlay;
    if (!overlay) return;
    let target = null;
    try {
      const f = focused();
      const list = f?.pane ? panes().filter((p) => p.tab === f.tab) : [];
      const i = list.findIndex((p) => p.pane === f?.pane);
      if (list.length > 1 && i >= 0) target = list[(i + STEP + list.length) % list.length].pane;
    } finally {
      closeOverlay(overlay);
    }
    if (target) run("pane.focus", { pane: target });
  }
  render() {
    return div();
  }
}
