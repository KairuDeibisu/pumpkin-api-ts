import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// 0.4.5's snapshot linker supplies sync traps for async imports. Build the
// same componentizer with only that linker fixed; guest WIT stays unchanged.
const revision = "e563c6d6ae50b087980414015663ca9c948c09bb";
const crateHash = "6e3a182c2ed4e216c999def79e11ef9587a98be654334a7ac9696d2ffea25d35";
const patch = path.join(import.meta.dirname, "componentize-qjs-async-stubs.patch");
const patchHash = createHash("sha256").update(fs.readFileSync(patch)).digest("hex").slice(0, 16);

export function ensureComponentizer() {
  if (process.env.PUMPKIN_COMPONENTIZE_QJS) return process.env.PUMPKIN_COMPONENTIZE_QJS;
  const cache = path.join(os.homedir(), ".cache", "pumpkin-api-ts", `qjs-${revision}-${patchHash}`);
  const source = path.join(cache, "source");
  const binary = path.join(source, "target", "debug", process.platform === "win32" ? "componentize-qjs.exe" : "componentize-qjs");
  if (fs.existsSync(binary)) return binary;
  fs.mkdirSync(cache, { recursive: true });
  const run = (cmd, args, cwd = cache) => execFileSync(cmd, args, { cwd, stdio: "inherit" });
  if (!fs.existsSync(source)) {
    run("git", ["clone", "--no-checkout", "https://github.com/andreiltd/componentize-qjs.git", source]);
    run("git", ["checkout", "--detach", revision], source);
  }
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: source, encoding: "utf8" }).trim();
  if (head !== revision) throw new Error("Unexpected componentize-qjs source revision");
  try {
    execFileSync("git", ["apply", "--reverse", "--check", patch], { cwd: source, stdio: "ignore" });
  } catch {
    run("git", ["apply", patch], source);
  }
  const archive = path.join(cache, "componentize-qjs.crate");
  if (!fs.existsSync(archive)) {
    run("curl", ["--fail", "--location", "https://crates.io/api/v1/crates/componentize-qjs/0.4.5/download", "--output", archive]);
  }
  if (createHash("sha256").update(fs.readFileSync(archive)).digest("hex") !== crateHash) {
    throw new Error("componentize-qjs runtime archive checksum mismatch");
  }
  run("tar", ["xf", archive]);
  fs.cpSync(path.join(cache, "componentize-qjs-0.4.5", "prebuilt"), path.join(source, "crates", "core", "prebuilt"), { recursive: true });
  console.log("Building the pinned componentize-qjs async snapshot fix (requires Rust)...");
  run("cargo", ["build", "--locked", "-p", "componentize-qjs-cli"], source);
  return binary;
}
