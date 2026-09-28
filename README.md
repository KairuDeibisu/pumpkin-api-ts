# Pumpkin API for TypeScript

Build Pumpkin WIT 0.2 plugins as WebAssembly components. This initial API provides GameTest function registration and `Test.succeed()` using the exact `@minecraft/server-gametest` import.

The official Minecraft package supplies the TypeScript declarations. `pumpkin-plugin-build` bundles Pumpkin's implementation of that module into the plugin.

## Example

```typescript
import { Plugin, registerPlugin } from "@pumpkinmc/pumpkin-api-ts";
import { register, type Test } from "@minecraft/server-gametest";
import type { PluginMetadata } from "pumpkin:plugin/metadata@0.2.0";

class MyPlugin extends Plugin {
  metadata(): PluginMetadata {
    return {
      name: "Always Pass GameTest",
      version: "0.2.0",
      authors: ["you"],
      description: "Provides minecraft:always_pass",
      dependencies: [],
      permissions: [],
    };
  }
}

register("minecraft", "always_pass", (test: Test) => {
  test.succeed();
});

registerPlugin(new MyPlugin());
export * from "@pumpkinmc/pumpkin-api-ts";
```

Register at module scope or during `onLoad()`. Pumpkin registers these callbacks during plugin loading. GameTest callbacks run through `pumpkin-scheduler`; the game tick observes their completion without waiting for the plugin.

## Build and run

Install the SDK package, then build:

```bash
pumpkin-plugin-build my-plugin.ts build/plugin.wasm
```

Copy the component into Pumpkin's `plugins/` directory and start the server with its plugin signature policy configured to allow your development plugin. Run:

```text
/test run minecraft:always_pass
```

Pumpkin's bundled datapack supplies the `minecraft:always_pass` test instance and its empty structure. The example supplies the function and marks the run successful.

Only `register()` and `Test.succeed()` are implemented in this first version. RegistrationBuilder options and other GameTest methods are unsupported; test instance configuration comes from datapacks. The WIT 0.2 files in `wit-v0.2/` match `plugin-v0.2-fork/crates/pumpkin-plugin-wit/v0.2/`.

## Develop this SDK

```bash
npm install
npm run check
npm pack
```

The existing WIT submodule and `dist/index.ts` contain the previous 0.1 bindings. The package entry point and default build target use 0.2.
