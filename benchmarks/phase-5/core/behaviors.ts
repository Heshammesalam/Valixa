import { copy, equal, freeze } from './data.js';
import type { FieldBehavior } from './types.js';

export interface BehaviorState { readonly visible: boolean; readonly enabled: boolean; readonly required: boolean; readonly readonly: boolean; readonly validate: boolean; readonly reset: boolean }
export class BehaviorEngine {
  private states = new Map<string, BehaviorState>();
  readonly configured: boolean;
  constructor(private readonly config: Readonly<Record<string, FieldBehavior>>, names: readonly string[], private readonly inflate: (flat: Record<string, unknown>) => Record<string, unknown> = value => value) {
    this.configured = Object.keys(config).length > 0;
    for (const [name, behavior] of Object.entries(config)) {
      if (!names.includes(name)) throw new TypeError(`Behavior references unknown field ${name}`);
      for (const dependency of behavior.dependsOn ?? []) if (!names.includes(dependency)) throw new TypeError(`Behavior ${name} depends on unknown field ${dependency}`);
    }
  }
  get(name: string): BehaviorState | undefined { return this.states.get(name); }
  /** Evaluate on a draft; commit only after reset transitions converge. */
  evaluate<V extends Record<string, unknown>>(input: V, initial: V, changed?: ReadonlySet<string>, reset = false): V {
    if (!this.configured) return input;
    const draft = copy(input), next = reset ? new Map<string, BehaviorState>() : new Map(this.states);
    let affected = changed;
    for (let pass = 0; pass <= Object.keys(this.config).length + 1; pass++) {
      const context = { values: freeze(this.inflate(draft)) };
      const resets: string[] = [];
      for (const [name, behavior] of Object.entries(this.config)) {
        if (affected && behavior.dependsOn !== undefined && !behavior.dependsOn.some(dependency => affected!.has(dependency)) && next.has(name)) continue;
        const state = { visible: behavior.visibleWhen?.(context) ?? true, enabled: behavior.enabledWhen?.(context) ?? true,
          required: behavior.requiredWhen?.(context) ?? false, readonly: behavior.readonlyWhen?.(context) ?? false,
          validate: behavior.validateWhen?.(context) ?? true, reset: behavior.resetWhen?.(context) ?? false };
        if (state.reset && !next.get(name)?.reset && !equal(draft[name], initial[name])) resets.push(name);
        next.set(name, Object.freeze(state));
      }
      if (!resets.length) { this.states = next; return draft; }
      for (const name of resets) (draft as Record<string, unknown>)[name] = copy(initial[name]);
      affected = new Set(resets);
    }
    throw new TypeError('Conditional reset behaviors did not converge; remove cyclic resetWhen transitions');
  }
}
