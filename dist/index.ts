/// <reference path="./bindings/index.d.ts" />

import type {
  Command,
  CommandSender,
  CommandSuggestions,
  ConsumedArgs,
  SuggestionRequest,
} from "pumpkin:plugin/command@0.2.0";
import type { Context } from "pumpkin:plugin/context@0.2.0";
import type { Event, EventType, EventPriority } from "pumpkin:plugin/event@0.2.0";
import type { Test as GameTestHostTest } from "pumpkin:plugin/gametest@0.2.0";
import type { IpcMessage, PluginId } from "pumpkin:plugin/ipc@0.2.0";
import type { PluginMetadata } from "pumpkin:plugin/metadata@0.2.0";
import * as scheduler from "pumpkin:plugin/scheduler@0.2.0";
import type { Server } from "pumpkin:plugin/server@0.2.0";
import type {
  ChunkBuffer,
  Entity,
  GenerationPhase,
} from "pumpkin:plugin/world@0.2.0";

import {
  dispatchGameTest,
  flushGameTestRegistrations,
} from "./minecraft-server-gametest";

type MaybePromise<T> = T | Promise<T>;

export type EventHandler<T = any> = (
  srv: Server,
  evt: T,
) => MaybePromise<T | void>;
export type CommandHandler = (
  sender: CommandSender,
  srv: Server,
  args: ConsumedArgs,
) => MaybePromise<number>;
export type CommandSuggestionHandler = (
  sender: CommandSender,
  srv: Server,
  request: SuggestionRequest,
) => MaybePromise<CommandSuggestions>;
export type TaskHandler = (srv: Server) => MaybePromise<void>;
export interface AiGoal {
  canStart: (server: Server, entity: Entity) => MaybePromise<boolean>;
  shouldContinue: (server: Server, entity: Entity) => MaybePromise<boolean>;
  start: (server: Server, entity: Entity) => MaybePromise<void>;
  tick: (server: Server, entity: Entity) => MaybePromise<void>;
  stop: (server: Server, entity: Entity) => MaybePromise<void>;
}
export type ChunkGenerator = (
  phase: GenerationPhase,
  chunk: ChunkBuffer,
) => MaybePromise<void>;

let pluginInstance: Plugin | null = null;
const eventHandlers = new Map<number, EventHandler>();
const commandHandlers = new Map<number, CommandHandler>();
const commandSuggestionHandlers = new Map<number, CommandSuggestionHandler>();
const taskHandlers = new Map<number, TaskHandler>();
const generators = new Map<number, ChunkGenerator>();
const aiGoals = new Map<number, AiGoal>();
let nextHandlerId = 0;

function getNextHandlerId(): number {
  return nextHandlerId++;
}

function stringError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : String(error);
}

export abstract class Plugin {
  abstract metadata(): PluginMetadata;

  async onLoad(_ctx: Context): Promise<void> {}

  async onUnload(_ctx: Context): Promise<void> {}

  async handleIpcMessage(
    _sender: PluginId,
    _message: IpcMessage,
  ): Promise<IpcMessage> {
    throw "This plugin cannot receive messages";
  }

  async registerEvent(
    ctx: Context,
    eventType: EventType,
    handler: EventHandler,
    priority: EventPriority = "normal",
    blocking: boolean = true,
  ): Promise<void> {
    const handlerId = getNextHandlerId();
    eventHandlers.set(handlerId, handler);
    await ctx.registerEvent(handlerId, eventType, priority, blocking);
  }

  async registerCommand(
    ctx: Context,
    cmd: Command,
    handler: CommandHandler,
    permission: string = "",
  ): Promise<void> {
    const handlerId = getNextHandlerId();
    commandHandlers.set(handlerId, handler);
    await cmd.executeWithHandlerId(handlerId);
    await ctx.registerCommand(cmd, permission);
  }

  registerCommandSuggestionHandler(handler: CommandSuggestionHandler): number {
    const handlerId = getNextHandlerId();
    commandSuggestionHandlers.set(handlerId, handler);
    return handlerId;
  }

  async scheduleDelayedTask(
    delayTicks: number | bigint,
    handler: TaskHandler,
  ): Promise<number> {
    const handlerId = getNextHandlerId();
    taskHandlers.set(handlerId, handler);
    return scheduler.scheduleDelayedTask(handlerId, BigInt(delayTicks));
  }

  async scheduleRepeatingTask(
    delayTicks: number | bigint,
    periodTicks: number | bigint,
    handler: TaskHandler,
  ): Promise<number> {
    const handlerId = getNextHandlerId();
    taskHandlers.set(handlerId, handler);
    return scheduler.scheduleRepeatingTask(
      handlerId,
      BigInt(delayTicks),
      BigInt(periodTicks),
    );
  }

  registerAiGoal(goal: AiGoal): number {
    const aiGoalId = getNextHandlerId();
    aiGoals.set(aiGoalId, goal);
    return aiGoalId;
  }

  registerChunkGenerator(generator: ChunkGenerator): number {
    const generatorId = getNextHandlerId();
    generators.set(generatorId, generator);
    return generatorId;
  }
}

export function registerPlugin(plugin: Plugin): void {
  pluginInstance = plugin;
}

// Exports for the v0.2 WIT world.
export async function initPlugin(): Promise<void> {}

export async function onLoad(ctx: Context): Promise<void> {
  try {
    if (pluginInstance) {
      await pluginInstance.onLoad(ctx);
    }

    // registerAsync() is safe during JS module evaluation because it only
    // queues registrations. Host registration is deferred until on-load,
    // after Pumpkin has populated plugin/server/name host state.
    await flushGameTestRegistrations();
  } catch (error) {
    throw stringError(error);
  }
}

export async function onUnload(ctx: Context): Promise<void> {
  try {
    if (pluginInstance) {
      await pluginInstance.onUnload(ctx);
    }
  } catch (error) {
    throw stringError(error);
  }
}

export async function handleEvent(
  eventId: number,
  srv: Server,
  evt: Event,
): Promise<Event> {
  const handler = eventHandlers.get(eventId);
  if (handler) {
    const result = await handler(srv, evt.val);
    if (result !== undefined) {
      evt.val = result;
    }
  }
  return evt;
}

export async function handleCommand(
  commandId: number,
  sender: CommandSender,
  srv: Server,
  args: ConsumedArgs,
): Promise<number> {
  const handler = commandHandlers.get(commandId);
  if (handler) {
    return handler(sender, srv, args);
  }
  throw new Error("No handler for command ID " + commandId);
}

export async function handleCommandSuggestion(
  handlerId: number,
  sender: CommandSender,
  srv: Server,
  request: SuggestionRequest,
): Promise<CommandSuggestions> {
  const handler = commandSuggestionHandlers.get(handlerId);
  if (handler) {
    return handler(sender, srv, request);
  }
  throw new Error(
    "No command suggestion handler registered for ID " + handlerId,
  );
}

export async function handleTask(
  handlerId: number,
  srv: Server,
): Promise<void> {
  const handler = taskHandlers.get(handlerId);
  if (handler) {
    await handler(srv);
  }
}

export async function handleGametest(
  handlerId: number,
  test: GameTestHostTest,
): Promise<void> {
  try {
    await dispatchGameTest(handlerId, test);
  } catch (error) {
    // WIT result<_, string> maps a rejected guest call to the string error.
    throw stringError(error);
  }
}

export async function handleIpcMessage(
  sender: PluginId,
  message: IpcMessage,
): Promise<IpcMessage> {
  try {
    if (pluginInstance) {
      return await pluginInstance.handleIpcMessage(sender, message);
    }
    throw "No plugin instance available";
  } catch (error) {
    throw stringError(error);
  }
}

export async function handleAiGoalCanStart(
  goalId: number,
  server: Server,
  entity: Entity,
): Promise<boolean> {
  const aiGoal = aiGoals.get(goalId);
  if (aiGoal) {
    return aiGoal.canStart(server, entity);
  }
  throw new Error("No AI goal registered for ID " + goalId);
}

export async function handleAiGoalShouldContinue(
  goalId: number,
  server: Server,
  entity: Entity,
): Promise<boolean> {
  const aiGoal = aiGoals.get(goalId);
  if (aiGoal) {
    return aiGoal.shouldContinue(server, entity);
  }
  throw new Error("No AI goal registered for ID " + goalId);
}

export async function handleAiGoalStart(
  goalId: number,
  server: Server,
  entity: Entity,
): Promise<void> {
  const aiGoal = aiGoals.get(goalId);
  if (aiGoal) {
    await aiGoal.start(server, entity);
    return;
  }
  throw new Error("No AI goal registered for ID " + goalId);
}

export async function handleAiGoalTick(
  goalId: number,
  server: Server,
  entity: Entity,
): Promise<void> {
  const aiGoal = aiGoals.get(goalId);
  if (aiGoal) {
    await aiGoal.tick(server, entity);
    return;
  }
  throw new Error("No AI goal registered for ID " + goalId);
}

export async function handleAiGoalStop(
  goalId: number,
  server: Server,
  entity: Entity,
): Promise<void> {
  const aiGoal = aiGoals.get(goalId);
  if (aiGoal) {
    await aiGoal.stop(server, entity);
    return;
  }
  throw new Error("No AI goal registered for ID " + goalId);
}

export async function handleGeneratePhase(
  generatorId: number,
  phase: GenerationPhase,
  chunk: ChunkBuffer,
): Promise<void> {
  const generator = generators.get(generatorId);
  if (generator) {
    await generator(phase, chunk);
    return;
  }
  throw new Error("No generator registered for ID " + generatorId);
}

export const metadata = {
  getMetadata(): PluginMetadata {
    if (pluginInstance) {
      return pluginInstance.metadata();
    }
    return {
      name: "unknown",
      version: "0.0.0",
      authors: [],
      description: "No metadata",
      dependencies: [],
      permissions: [],
    };
  },
};

export const common = {};
