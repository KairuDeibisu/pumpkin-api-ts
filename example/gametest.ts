import { Plugin, registerPlugin } from "@pumpkinmc/pumpkin-api-ts";
import type { PluginMetadata } from "pumpkin:plugin/metadata@0.2.0";
import * as gametest from "@minecraft/server-gametest";

gametest.registerAsync(
  "PumpkinTests",
  "simulatedPlayerTeleport",
  async (test) => {
    const player = test.spawnSimulatedPlayer(
      { x: 0, y: 80, z: 0 },
      "PumpkinBot",
    );

    try {
      const result = await player.runCommand("tp @s 10 80 10");
      if (result.successCount < 1) {
        throw new Error(
          "Teleport command reported zero successful executions",
        );
      }

      // Mojang types location synchronously. Pumpkin's v0.2 runtime must cross
      // an async Component Model boundary, so awaiting it is required here.
      const location = await player.location;

      if (
        location.x !== 10 ||
        location.y !== 80 ||
        location.z !== 10
      ) {
        throw new Error(
          "Expected simulated player at 10,80,10 but got " +
            location.x +
            "," +
            location.y +
            "," +
            location.z,
        );
      }
    } finally {
      await player.disconnect();
    }
  },
);

class GameTestPlugin extends Plugin {
  metadata(): PluginMetadata {
    return {
      name: "Pumpkin GameTest Example",
      version: "0.1.0",
      authors: ["Pumpkin"],
      description: "Minimal simulated-player GameTest vertical slice",
      dependencies: [],
      permissions: [],
    };
  }
}

registerPlugin(new GameTestPlugin());

export * from "@pumpkinmc/pumpkin-api-ts";
