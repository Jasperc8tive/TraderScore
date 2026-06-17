import { FraudFlagType, FraudSubjectType, FraudSeverity } from "@tradescore/shared";
import type { Edge, DetectedFlag } from "./types";

/**
 * Circular trading detection (TAR F4): cycles in the directed graph of
 * CONFIRMED-trade relationships indicate parties trading in a loop to inflate each
 * other's reputation. v1 detects 2-cycles (A↔B) and 3-cycles (A→B→C→A) — bounded
 * length, so cost is predictable. Pure and deterministic.
 */
export function detectCircularTrading(edges: Edge[]): DetectedFlag[] {
  const adj = new Map<string, Set<string>>();
  const has = new Set<string>();
  for (const e of edges) {
    if (e.from === e.to) continue;
    if (!adj.has(e.from)) adj.set(e.from, new Set());
    adj.get(e.from)!.add(e.to);
    has.add(`${e.from}>${e.to}`);
  }

  const cycles = new Map<string, string[]>(); // canonical key → members

  // 2-cycles: A→B and B→A.
  for (const e of edges) {
    if (has.has(`${e.to}>${e.from}`) && e.from !== e.to) {
      const members = [e.from, e.to].sort((a, b) => a.localeCompare(b));
      cycles.set(members.join("|"), members);
    }
  }

  // 3-cycles: A→B→C→A, all distinct.
  for (const [a, bs] of adj) {
    for (const b of bs) {
      const cs = adj.get(b);
      if (!cs) continue;
      for (const c of cs) {
        if (c === a || c === b) continue;
        if (has.has(`${c}>${a}`)) {
          const members = [a, b, c].sort((x, y) => x.localeCompare(y));
          cycles.set(members.join("|"), members);
        }
      }
    }
  }

  return Array.from(cycles.entries()).map(([key, members]) => ({
    flagType: FraudFlagType.CIRCULAR_TRADING,
    subjectType: FraudSubjectType.RELATIONSHIP,
    subjectId: key,
    severity: members.length >= 3 ? FraudSeverity.HIGH : FraudSeverity.MEDIUM,
    detail: { members, cycleLength: members.length },
  }));
}
