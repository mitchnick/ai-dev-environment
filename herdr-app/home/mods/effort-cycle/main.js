// cmd-shift-e (keys.json: "mod.open:effort-cycle"): advance reasoning effort in the focused
// terminal's agent. ~/.local/bin/herdr-app-cycle-effort decides per agent (Claude's model
// picker, Codex's or Pi's own key) and runs detached, so a slow Claude picker never holds
// this overlay open. Its output goes to $TMPDIR/herdr-app-cycle-effort.log.
// It opens as an invisible overlay only to start that, then closes itself. Outside an
// overlay (herdr-app check) it does nothing.
import { View, div } from "gpui-kit";
import { focused, panes, exec, home, props, closeOverlay } from "herdr";

export default class EffortCycle extends View {
  init(_props, cx) {
    const overlay = props()?.overlay;
    if (!overlay) return;
    const f = focused();
    if (!f?.terminal) return closeOverlay(overlay);
    const args = ["--terminal", f.terminal];
    if (f.pane) {
      args.push("--pane", f.pane);
      if (panes().find((p) => p.pane === f.pane)?.zoomed) args.push("--zoomed");
    }
    cx.spawn(async () => {
      try {
        await exec("/bin/sh", [
          "-c",
          'nohup "$0" "$@" >>"${TMPDIR:-/tmp}/herdr-app-cycle-effort.log" 2>&1 </dev/null &',
          `${home()}/.local/bin/herdr-app-cycle-effort`,
          ...args,
        ]);
      } catch (e) {
        console.log(`effort-cycle: ${e}`);
      } finally {
        closeOverlay(overlay);
      }
    });
  }
  render() {
    return div();
  }
}
