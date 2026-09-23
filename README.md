# Pumpkin API for TypeScript

This package provides the TypeScript bindings for building [Pumpkin](https://github.com/Pumpkin-MC/Pumpkin) plugins using WebAssembly (Wasm) components.

## Features

- **Type-safe API**: Full TypeScript definitions for all Pumpkin plugin interfaces.
- **Easy Build Process**: Includes a build script to bundle your TypeScript code and componentize it into a `.wasm` file.
- **Wasm Components**: Built on the WebAssembly Component Model for high performance and portability.

## Installation

You'll want to download the latest version of the bindings from the [CI release](https://github.com/Pumpkin-MC/pumpkin-api-ts/releases/tag/CI).

We don't have stable versions as Pumpkin and its API is still pre-release.

Then `npm install` the downloaded `.tgz`. e.g.

```bash
npm install pumpkinmc-pumpkin-api-ts-50917277.tgz
```

You may also choose to install directly from the download URL (after determining it; commit hash changes)

```bash
npm install https://github.com/Pumpkin-MC/pumpkin-api-ts/releases/download/CI/pumpkinmc-pumpkin-api-ts-XXXXXXXX.tgz
```

## Creating a Plugin

1. Create a new TypeScript file (e.g., `my-plugin.ts`).
2. Extend the `Plugin` class and implement the `metadata()` method.
3. Register your plugin using `registerPlugin()`.
4. Add `export * from "@pumpkinmc/pumpkin-api-ts";` at the end.

Example:

```typescript
import { Plugin, registerPlugin } from "@pumpkinmc/pumpkin-api-ts";

import { PluginMetadata } from "pumpkin:plugin/metadata@0.1.0";
import { Context } from "pumpkin:plugin/context@0.1.0";
import { TextComponent } from "pumpkin:plugin/text@0.1.0";
import * as logging from "pumpkin:plugin/logging@0.1.0";
import { PlayerJoinEventData } from "pumpkin:plugin/event@0.1.0";

class MyPlugin extends Plugin {
  metadata(): PluginMetadata {
    return {
      name: "My TypeScript Plugin",
      version: "0.1.0",
      authors: ["alex"],
      description: "A sample plugin written in TypeScript",
      dependencies: [],
      permissions: [],
    };
  }
  onLoad(ctx: Context): void {
    super.onLoad(ctx);
    logging.log("info", "Hello from TypeScript plugin!");

    this.registerEvent(
      ctx,
      "player-join-event",
      (_srv, evt: PlayerJoinEventData) => {
        logging.log("info", `Player ${evt.player.getName()} joined!`);

        evt.player
          .getWorld()
          .broadcastSystemMessage(
            TextComponent.text(
              `Welcome ${evt.player.getName()} to the server!`,
            ),
            false,
          );
      },
    );
  }
}

registerPlugin(new MyPlugin());

export * from "@pumpkinmc/pumpkin-api-ts";
```

## Building Your Plugin

To build your plugin into a `.wasm` component, use the provided build script:

```bash
./node_modules/.bin/pumpkin-plugin-build <entry-file.ts> <output-file.wasm>
```

Example:

```bash
./node_modules/.bin/pumpkin-plugin-build my-plugin.ts build/my-plugin.wasm
```

For convience, it's recommended to add a scripts section to your `package.json`

```json
{
  "scripts": {
    "build": "pumpkin-plugin-build my-plugin.ts build/my-plugin.wasm"
  },
  "dependencies": {
    ...
  }
}
```

Execute with `npm run build`


## v0.2 ABI and GameTest

The build command now accepts an explicit ABI:

    pumpkin-plugin-build plugin.ts build/plugin.wasm --abi 0.2
    pumpkin-plugin-build plugin.ts build/plugin.wasm --abi 0.1

v0.2 is the default. The exact v0.2 WIT package used by the Pumpkin GameTest
feature branch is vendored in wit-v0.2; v0.1 continues to use wit/v0.1.

Generate guest declarations with `npm run generate:v0.2` or `npm run generate:v0.1`.
They live in separate `dist/bindings/v0.2` and `dist/bindings/v0.1` directories,
so generating either ABI does not invalidate the other wrapper.

For v0.2 GameTest source, install @minecraft/server-gametest for Mojang's public
TypeScript declarations and keep the normal import:

    import * as gametest from "@minecraft/server-gametest";

The build tool aliases that module to Pumpkin's runtime compatibility shim.
Only this vertical slice is implemented: registerAsync, Test.spawnSimulatedPlayer,
the inherited runCommand/location surface, and SimulatedPlayer.disconnect.

registerAsync queues a numeric handler ID during JavaScript module evaluation;
the actual Pumpkin host registration is deferred until the plugin on-load export,
when the host plugin/server/name state is available.

Pumpkin v0.2 host calls are asynchronous even where Mojang's API is synchronous.
Use:

    const result = await player.runCommand("tp @s 10 80 10");
    const location = await player.location;
    await player.disconnect();

This remains valid against Mojang's declarations because await accepts immediate
values as well as Promises. RegistrationBuilder options and the rest of the
GameTest/SimulatedPlayer API are intentionally unsupported; builder calls fail
with an explicit error.

See example/gametest.ts for the complete teleport GameTest.


`test.spawnSimulatedPlayer(position, name)` returns a wrapper immediately, as in
Mojang's declaration. The wrapper holds the pending host resource; its three
backed operations await that resource. Runtime `runCommand`, `location`, and
`disconnect` return Promises despite Mojang's synchronous declarations. Always
await them as shown above. No other Test/Player members are implemented. All
v0.2 callbacks share one numeric ID allocator, and callbacks stay in JavaScript.

### Local validation

Use Node 24.12.0 (`nvm use`). From a clone, initialize the pinned v0.1 submodule:

```sh
git submodule update --init wit
npm install
npm run generate:v0.2
npm run typecheck
npm run build:gametest
cd example
npm install
npm run build:v0.1
```

The v0.2 build requires Rust/Cargo, Git, curl, tar, and a native C toolchain on
its first run. Published `componentize-qjs@0.4.5` uses synchronous trap stubs for
native async imports during snapshot initialization, which fails with an async
type mismatch before guest initialization. `src/componentizer.js` builds the
pinned upstream revision with `src/componentize-qjs-async-stubs.patch`, changing
only these snapshot stubs. The exact vendored WIT is used unchanged. The runtime
archive is SHA-256 verified and the built tool is cached under
`~/.cache/pumpkin-api-ts/`. Run `npm run setup:componentizer` to prepare it
separately. `PUMPKIN_COMPONENTIZE_QJS` can select an already-patched CLI.
The v0.1 build continues to use the published npm componentizer.

Pumpkin's v0.2 runtime currently backs GameTest and lifecycle resource handling.
Other v0.2 host systems are trapping stubs; the generated declarations describe
the ABI, not a promise that every host system is implemented. v0.1 retains its
existing implementation.
