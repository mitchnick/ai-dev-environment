// cmd-m (keys.json: "mod.open:pane-mover-tabs"): the move-pane menu, opened straight on the
// tab list. ./mover.js is an identical copy of ../pane-mover/mover.js: edit that one, copy here.
import { Mover } from "./mover.js";

export default class PaneMoverTabs extends Mover {
  startView() {
    return "tabs";
  }
}
