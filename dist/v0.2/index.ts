/// <reference path="../bindings-v0.2/index.d.ts" />

import type { PluginMetadata } from "pumpkin:plugin/metadata@0.2.0";
import { loadGameTests } from "./server-gametest";
export { handleGameTest } from "./server-gametest";

export abstract class Plugin {
  abstract metadata(): PluginMetadata;
  onLoad(): void {}
  onUnload(): void {}
}

let plugin: Plugin | undefined;

export function registerPlugin(instance: Plugin): void {
  plugin = instance;
}

export function initPlugin(): void {}

export function onLoad(): void {
  plugin?.onLoad();
  loadGameTests();
}

export function onUnload(): void {
  plugin?.onUnload();
}

export const metadata = {
  getMetadata(): PluginMetadata {
    if (!plugin) {
      throw new Error("No plugin registered");
    }
    return plugin.metadata();
  },
};
