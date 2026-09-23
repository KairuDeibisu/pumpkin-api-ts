#! /usr/bin/env node

import * as esbuild from "esbuild";
import { componentize } from "componentize-qjs";
import * as path from "node:path";
import * as fs from "node:fs";
import { execFileSync } from "node:child_process";
import { ensureComponentizer } from "./componentizer.js";

const packageRoot = path.resolve(import.meta.dirname, "..");

function parseArgs(argv) {
  const positionals = [];
  let abi = "0.2";
  let witDir;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--abi") {
      abi = argv[++i];
    } else if (arg.startsWith("--abi=")) {
      abi = arg.slice("--abi=".length);
    } else if (arg === "--wit-dir") {
      witDir = argv[++i];
    } else if (arg.startsWith("--wit-dir=")) {
      witDir = arg.slice("--wit-dir=".length);
    } else {
      positionals.push(arg);
    }
  }

  if (positionals.length < 2) {
    console.log(
      "Usage: pumpkin-plugin-build <entry.ts> <output.wasm> [wit-dir] [--abi 0.1|0.2] [--wit-dir path]",
    );
    process.exit(1);
  }

  // Preserve the previous optional third positional WIT-directory argument.
  witDir ??= positionals[2];

  if (abi !== "0.1" && abi !== "0.2") {
    throw new Error("Unsupported Pumpkin plugin ABI: " + abi);
  }

  witDir ??= path.join(
    packageRoot,
    abi === "0.2" ? "wit-v0.2" : "wit/v0.1",
  );

  return {
    entryPath: positionals[0],
    outputPath: positionals[1],
    witDir,
    abi,
  };
}

async function buildPlugin(entryPath, outputPath, witDir, abi) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const tempJs = path.join(path.dirname(outputPath), "temp.js");

  const apiEntry = path.join(
    packageRoot,
    "dist",
    abi === "0.2" ? "index.ts" : "v0.1.ts",
  );

  const alias = {
    "@pumpkinmc/pumpkin-api-ts": apiEntry,
  };

  if (abi === "0.2") {
    alias["@minecraft/server-gametest"] = path.join(
      packageRoot,
      "dist",
      "minecraft-server-gametest.ts",
    );
  }

  console.log(
    "1. Bundling " + entryPath + " for pumpkin:plugin@" + abi + ".0...",
  );
  await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    outfile: tempJs,
    format: "esm",
    target: "es2022",
    alias,
    external: ["pumpkin:plugin/*"],
  });

  console.log("2. Running through componentize-qjs...");
  try {
    if (abi === "0.2") {
      execFileSync(ensureComponentizer(), [
        "--wit", witDir, "--world", "plugin", "--js", tempJs,
        "--output", outputPath, "--opt-size", "--minify",
      ], { stdio: "inherit" });
    } else {
    const { component } = await componentize({
      world: "plugin",
      witPath: witDir,
      jsSource: fs.readFileSync(tempJs, "utf8"),
      optSize: true,
    });
    fs.writeFileSync(outputPath, component);
    }
  } finally {
    if (fs.existsSync(tempJs)) {
      fs.unlinkSync(tempJs);
    }
  }

  console.log("Successfully built plugin to " + outputPath);
}

const options = parseArgs(process.argv.slice(2));

buildPlugin(
  options.entryPath,
  options.outputPath,
  options.witDir,
  options.abi,
).catch((err) => {
  console.error(err);
  process.exit(1);
});
