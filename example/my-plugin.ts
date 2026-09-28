import { Plugin, registerPlugin } from "@pumpkinmc/pumpkin-api-ts";
import { register, type Test } from "@minecraft/server-gametest";
import type { PluginMetadata } from "pumpkin:plugin/metadata@0.2.0";

class MyPlugin extends Plugin {
  metadata(): PluginMetadata {
    return {
      name: "Always Pass GameTest",
      version: "0.2.0",
      authors: ["alex"],
      description: "Provides minecraft:always_pass through WIT 0.2",
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
