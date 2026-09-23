/// <reference path="./bindings/v0.2/index.d.ts" />
import type * as Mojang from "@minecraft/server-gametest";
import type { Vector3, CommandResult, GameMode } from "@minecraft/server";
import { getNextHandlerId } from "./handler-id";
import * as hostGameTest from "pumpkin:plugin/gametest@0.2.0";
import type {
  GameMode as HostGameMode,
  Position as HostPosition,
} from "pumpkin:plugin/common@0.2.0";
import type {
  SimulatedPlayer as HostSimulatedPlayer,
  Test as HostTest,
} from "pumpkin:plugin/gametest@0.2.0";

type GameTestHandler = Parameters<typeof Mojang.registerAsync>[2];

type PendingRegistration = {
  testClassName: string;
  testName: string;
  handlerId: number;
};

const handlers = new Map<number, GameTestHandler>();
const pendingRegistrations: PendingRegistration[] = [];
let flushedRegistrationCount = 0;

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : String(error);
}

function toHostPosition(location: Vector3): HostPosition {
  return [location.x, location.y, location.z] as HostPosition;
}

function fromHostPosition(location: HostPosition): Vector3 {
  return { x: location[0], y: location[1], z: location[2] };
}

function toHostGameMode(gameMode: unknown): HostGameMode | undefined {
  if (gameMode === undefined || gameMode === null) {
    return undefined;
  }

  if (typeof gameMode === "number") {
    const numericModes: HostGameMode[] = [
      "survival",
      "creative",
      "adventure",
      "spectator",
    ];
    const mode = numericModes[gameMode];
    if (mode !== undefined) {
      return mode;
    }
  }

  const normalized = String(gameMode).toLowerCase();
  if (
    normalized === "survival" ||
    normalized === "creative" ||
    normalized === "adventure" ||
    normalized === "spectator"
  ) {
    return normalized as HostGameMode;
  }

  throw new Error("Unsupported GameMode value: " + String(gameMode));
}

function unsupportedRegistrationBuilder(): Mojang.RegistrationBuilder {
  let proxy: object;
  proxy = new Proxy(
    {},
    {
      get(_target, property) {
        // Promise machinery probes then; the builder must not become thenable.
        if (property === "then") {
          return undefined;
        }
        if (property === Symbol.toStringTag) {
          return "PumpkinUnsupportedRegistrationBuilder";
        }
        return () => {
          throw new Error(
            "RegistrationBuilder." +
              String(property) +
              " is not supported by Pumpkin's minimal GameTest shim",
          );
        };
      },
    },
  );
  // Unsupported builder methods throw; no unbacked functionality is claimed.
  return proxy as Mojang.RegistrationBuilder;
}

/**
 * Pumpkin compatibility implementation of @minecraft/server-gametest.registerAsync.
 *
 * This intentionally performs no host call during module evaluation. It stores
 * a numeric handler ID and pending registration that on-load flushes later.
 */
export function registerAsync(
  testClassName: string,
  testName: string,
  testFunction: GameTestHandler,
): Mojang.RegistrationBuilder {
  if (!testClassName.trim() || !testName.trim()) {
    throw new Error("GameTest class and test names must not be empty");
  }

  const handlerId = getNextHandlerId();
  handlers.set(handlerId, testFunction);
  pendingRegistrations.push({ testClassName, testName, handlerId });
  return unsupportedRegistrationBuilder();
}

export async function flushGameTestRegistrations(): Promise<void> {
  while (flushedRegistrationCount < pendingRegistrations.length) {
    const registration = pendingRegistrations[flushedRegistrationCount];
    await hostGameTest.registerTest(
      registration.testClassName,
      registration.testName,
      registration.handlerId,
    );
    flushedRegistrationCount++;
  }
}

export async function dispatchGameTest(
  handlerId: number,
  hostTest: HostTest,
): Promise<void> {
  const handler = handlers.get(handlerId);
  if (!handler) {
    throw "No GameTest handler registered for ID " + handlerId;
  }

  try {
    // Only the backed Test subset crosses this explicit compatibility boundary.
    await handler(new Test(hostTest) as unknown as Mojang.Test);
  } catch (error) {
    throw errorMessage(error);
  }
}

/** Minimal Test wrapper: only spawnSimulatedPlayer is backed by v0.2. */
export class Test {
  constructor(private readonly host: HostTest) {}

  spawnSimulatedPlayer(
    blockLocation: Vector3,
    name: string = "Simulated Player",
    gameMode?: GameMode,
  ): SimulatedPlayer {
    const player = this.host.spawnSimulatedPlayer(
      toHostPosition(blockLocation),
      name,
      toHostGameMode(gameMode),
    );
    return new SimulatedPlayer(player);
  }
}

/**
 * Minimal SimulatedPlayer wrapper.
 *
 * Mojang types inherited runCommand/location and disconnect synchronously.
 * Pumpkin v0.2 crosses an async Component Model boundary, so callers must await
 * them at runtime. Await remains source-compatible with the Mojang declarations.
 */
export class SimulatedPlayer {
  constructor(private readonly host: Promise<HostSimulatedPlayer>) {}

  async runCommand(command: string): Promise<CommandResult> {
    return (await this.host).runCommand(command);
  }

  get location(): Promise<Vector3> {
    return this.readLocation();
  }

  private async readLocation(): Promise<Vector3> {
    return fromHostPosition(await (await this.host).getPosition());
  }

  async disconnect(): Promise<void> {
    await (await this.host).disconnect();
  }
}

// Check official argument and result contracts while exposing async operations
// truthfully inside the adapter. Guest source uses the official declarations.
const _registerContract: typeof Mojang.registerAsync = registerAsync;
type SpawnArguments = Parameters<Mojang.Test["spawnSimulatedPlayer"]>;
const _spawnContract: (...args: SpawnArguments) => SimulatedPlayer =
  Test.prototype.spawnSimulatedPlayer;
