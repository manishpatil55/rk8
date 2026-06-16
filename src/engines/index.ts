"use client";

import type { EngineId } from "@/config/systems.config";
import type { EmulationEngine } from "./types";
import { EjsEngine } from "./ejs";
import { RuffleEngine } from "./ruffle";
import { JsDosEngine } from "./jsdos";

export type * from "./types";

export function createEngine(id: EngineId): EmulationEngine {
  switch (id) {
    case "ejs":
      return new EjsEngine();
    case "ruffle":
      return new RuffleEngine();
    case "jsdos":
      return new JsDosEngine();
  }
}
