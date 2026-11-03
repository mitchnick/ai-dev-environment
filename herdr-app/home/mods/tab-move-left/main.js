// cmd-alt-shift-left (keys.json: "mod.open:tab-move-left"): move the focused tab one slot left
// in its space's tab bar. No wrap-around: at the end of the bar it does nothing.
// Replaces ~/.local/bin/herdr-move-tab from the old Herdr. It opens as an invisible overlay
// only to run once, then closes itself. Outside an overlay (herdr-app check) it does nothing.
import { View, div } from "gpui-kit";
import { focused, spaces, run, props, closeOverlay } from "herdr";

const STEP = -1;

export default class TabMove extends View {
  init(_props, _cx) {
    const overlay = props()?.overlay;
    if (!overlay) return;
    try {
      const f = focused();
      const space = f && spaces().find((s) => s.id === f.space);
      const tab = space?.tabs.find((t) => t.id === f.tab);
      const index = tab ? tab.index + STEP : 0;
      if (tab && index >= 1 && index <= space.tabs.length) run("tab.move", { id: tab.id, index });
    } finally {
      closeOverlay(overlay);
    }
  }
  render() {
    return div();
  }
}
