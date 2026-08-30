import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const archiveScript = join(homedir(), ".local", "bin", "agent-session-archive");

function archiveSession(ctx: any): void {
  if (ctx?.mode !== "tui" || process.env.PI_SUBAGENT === "1") return;

  const transcript = ctx?.sessionManager?.getSessionFile?.();
  const sessionId = ctx?.sessionManager?.getSessionId?.();
  const cwd = ctx?.sessionManager?.getCwd?.() ?? ctx?.cwd;
  if (typeof transcript !== "string" || !transcript) return;

  const args = [archiveScript, "archive", "--harness", "pi", "--transcript", transcript];
  if (typeof sessionId === "string" && sessionId) args.push("--session-id", sessionId);
  if (typeof cwd === "string" && cwd) args.push("--cwd", cwd);

  try {
    const child = spawn("python3", args, {
      detached: true,
      stdio: "ignore",
    });
    child.on("error", () => {});
    child.unref();
  } catch {
    // Session archival is best-effort and must never block shutdown.
  }
}

export default function (pi: ExtensionAPI): void {
  pi.on("session_shutdown", (event, ctx) => {
    if (event.reason === "reload") return;
    archiveSession(ctx);
  });
}
