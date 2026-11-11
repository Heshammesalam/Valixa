import type { RuleInput, ValidationContext } from './types.js';
import { readPath } from './paths.js';

export interface ParsedRule { readonly name: string; readonly param?: string }
export class RuleSyntaxError extends Error {
  constructor(message: string) { super(message); this.name = 'RuleSyntaxError'; }
}
/** Grammar: rule (| rule)*; rule: identifier (: number)?; whitespace allowed. */
export function parseRules(input: RuleInput = ''): readonly ParsedRule[] {
  const expressions = typeof input === 'string' ? [input] : input;
  return expressions.flatMap(expression => {
    if (!expression.trim()) return [];
    return expression.split('|').map((part): ParsedRule => {
      const match = /^\s*([a-zA-Z][a-zA-Z0-9]*)(?:\s*:\s*([^|:]+))?\s*$/.exec(part);
      if (!match?.[1]) throw new RuleSyntaxError(`Invalid rule expression: "${part}"`);
      const name = match[1];
      const param = match[2]?.trim();
      if (!['required', 'email', 'url', 'min', 'max', 'minValue', 'maxValue', 'same'].includes(name)) throw new RuleSyntaxError(`Unknown rule: ${name}`);
      if (['min', 'max', 'minValue', 'maxValue'].includes(name)) {
        if (param === undefined || !/^-?\d+(?:\.\d+)?$/.test(param) || !Number.isFinite(Number(param))) throw new RuleSyntaxError(`${name} requires a finite numeric parameter`);
        if (['min', 'max'].includes(name) && (!Number.isInteger(Number(param)) || Number(param) < 0)) throw new RuleSyntaxError(`${name} requires a nonnegative integer length`);
      } else if (name === 'same') {
        if (!param) throw new RuleSyntaxError('same requires a field name');
      } else if (param !== undefined) throw new RuleSyntaxError(`${name} does not accept parameters`);
      return param === undefined ? { name } : { name, param };
    });
  });
}
export const defaultMessages: Readonly<Record<string, string>> = Object.freeze({
  required: '{label} is required.', email: '{label} must be a valid email address.',
  url: '{label} must be an HTTP or HTTPS URL.', min: '{label} must contain at least {param} items or characters.',
  max: '{label} must contain at most {param} items or characters.', minValue: '{label} must be at least {param}.',
  maxValue: '{label} must be at most {param}.', same: '{label} must match {param}.',
  custom: '{label} is invalid.', exception: '{label} could not be validated.', timeout: '{label} validation timed out.'
});
function empty(value: unknown): boolean { return value == null || value === '' || (Array.isArray(value) && value.length === 0); }
export function checkRule(rule: ParsedRule, value: unknown, context: ValidationContext): boolean {
  if (rule.name === 'required') return !empty(value) && value !== false;
  if (empty(value)) return true;
  switch (rule.name) {
    case 'email': return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'url': {
      if (typeof value !== 'string' || /\s/.test(value)) return false;
      try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
      } catch { return false; }
    }
    case 'min': return (typeof value === 'string' || Array.isArray(value)) && value.length >= Number(rule.param);
    case 'max': return (typeof value === 'string' || Array.isArray(value)) && value.length <= Number(rule.param);
    case 'minValue': return typeof value === 'number' && Number.isFinite(value) && value >= Number(rule.param);
    case 'maxValue': return typeof value === 'number' && Number.isFinite(value) && value <= Number(rule.param);
    case 'same': return Object.is(value, readPath(context.values, rule.param!));
    default: return true;
  }
}
