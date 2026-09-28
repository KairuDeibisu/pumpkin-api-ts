import * as host from "pumpkin:plugin/gametest@0.2.0";
import type {
  RegistrationBuilder as MinecraftRegistrationBuilder,
  Test as MinecraftTest,
} from "@minecraft/server-gametest";

type TestFunction = (test: MinecraftTest) => void;
const functions: Array<{ className: string; name: string; callback: TestFunction }> = [];
let loaded = false;

export class Test {
  constructor(private readonly execution: host.Test) {}

  succeed(): void {
    this.execution.succeed();
  }
}

export class RegistrationBuilder {}

export function register(
  testClassName: string,
  testName: string,
  testFunction: TestFunction,
): MinecraftRegistrationBuilder {
  if (loaded) {
    throw new Error("GameTest functions must be registered before plugin loading completes");
  }
  if (typeof testFunction !== "function") {
    throw new TypeError("GameTest callback must be a function");
  }
  functions.push({ className: testClassName, name: testName, callback: testFunction });
  return new RegistrationBuilder() as unknown as MinecraftRegistrationBuilder;
}

export function loadGameTests(): void {
  for (const [handlerId, { className, name }] of functions.entries()) {
    host.register(className, name, handlerId);
  }
  loaded = true;
}

export async function handleGameTest(handlerId: number, execution: host.Test): Promise<void> {
  const entry = functions[handlerId];
  if (!entry) {
    throw new Error(`No GameTest callback for handler ${handlerId}`);
  }
  await entry.callback(new Test(execution) as unknown as MinecraftTest);
}
