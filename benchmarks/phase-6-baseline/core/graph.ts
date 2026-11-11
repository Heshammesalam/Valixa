import { freeze } from './data.js';
import type { CompiledField } from './blueprint.js';
const emptyDependencies: string[] = Object.freeze([]) as unknown as string[];

export interface DependencyDiagnostics {
  readonly dependencies: Readonly<Record<string, readonly string[]>>;
  readonly dependents: Readonly<Record<string, readonly string[]>>;
  readonly unknown: readonly string[];
  /** Supported validation-only same cycles, visited once per invalidation traversal. */
  readonly cycles: readonly (readonly string[])[];
}

/** Edges point from a validation target to the values it reads. */
export class DependencyGraph {
  readonly diagnostics: DependencyDiagnostics;
  constructor(fields: Readonly<Record<string, CompiledField>>) {
    const dependencies: Record<string, string[]> = Object.create(null);
    const dependents: Record<string, string[]> = Object.create(null);
    const unknown: string[] = [];
    for (const name of Object.keys(fields)) dependents[name] = emptyDependencies;
    for (const [name, field] of Object.entries(fields)) {
      const reads = new Set(field.dependsOn ?? []);
      for (const rule of field.rules) if (rule.name === 'same') reads.add(rule.param!);
      dependencies[name] = reads.size ? [...reads] : emptyDependencies;
      if (field.validators.length && field.dependsOn === undefined) unknown.push(name);
      for (const dependency of reads) {
        if (!Object.hasOwn(fields, dependency)) throw new TypeError(`Field ${name} depends on unknown field ${dependency}`);
        if (dependents[dependency] === emptyDependencies) dependents[dependency] = [];
        dependents[dependency]!.push(name);
      }
    }
    const cycles: string[][] = [];
    const order: string[] = [];
    const complete = new Set<string>(), visiting = new Set<string>(), stack: string[] = [];
    const visit = (name: string): void => {
      if (visiting.has(name)) { cycles.push([...stack.slice(stack.indexOf(name)), name]); return; }
      if (complete.has(name)) return;
      visiting.add(name); stack.push(name);
      for (const dependency of dependencies[name]!) visit(dependency);
      stack.pop(); visiting.delete(name); complete.add(name); order.push(name);
    };
    for (const name of Object.keys(fields)) visit(name);
    // Kosaraju components keep graph construction O(vertices + edges). Only an
    // unsupported edge needs a diagnostic-path search, immediately before throw.
    const components = new Map<string, number>(); let component = 0;
    for (const start of order.reverse()) {
      if (components.has(start)) continue;
      const queue = [start]; components.set(start, ++component);
      for (let index = 0; index < queue.length; index++) for (const next of dependents[queue[index]!]!) {
        if (!components.has(next)) { components.set(next, component); queue.push(next); }
      }
    }
    // Legacy same cycles compare frozen values and remain supported. New explicit
    // cycles, including edges inside an inferred component, are rejected.
    for (const [name, field] of Object.entries(fields)) for (const dependency of field.dependsOn ?? []) {
      if (components.get(name) !== components.get(dependency)) continue;
      const queue: string[][] = [[dependency]], visited = new Set<string>();
      for (let index = 0; index < queue.length; index++) {
        const path = queue[index]!, target = path[path.length - 1]!;
        if (target === name) throw new TypeError(`Validation dependency cycle: ${[name, ...path].join(' -> ')}. Remove an explicit dependency or combine the constraint in a form validator.`);
        if (visited.has(target)) continue; visited.add(target);
        for (const next of dependencies[target]!) queue.push([...path, next]);
      }
    }
    this.diagnostics = freeze({ dependencies, dependents, unknown, cycles });
    Object.freeze(this);
  }
  affected(changed: Iterable<string>): ReadonlySet<string> {
    const affected = new Set([...changed, ...this.diagnostics.unknown]);
    const queue = [...affected];
    for (let index = 0; index < queue.length; index++) {
      for (const name of this.diagnostics.dependents[queue[index]!] ?? []) {
        if (!affected.has(name)) { affected.add(name); queue.push(name); }
      }
    }
    return affected;
  }
}
