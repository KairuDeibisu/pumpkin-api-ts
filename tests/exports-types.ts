import * as api from "../dist/index";
import type * as Guest from "pumpkin:plugin/plugin@0.2.0";

// All exported values must match the generated exact v0.2 guest contract.
const exports: typeof Guest = api;
void exports;
