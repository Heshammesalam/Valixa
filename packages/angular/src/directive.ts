import { Directive, ElementRef, Renderer2, effect, inject, input, untracked } from '@angular/core';
import { NG_VALUE_ACCESSOR, NgControl } from '@angular/forms';
import type { AngularField } from './form.js';
import { VALIXA_CONTROL, valueAccessorAdapter } from './adapters.js';
import type { ControlStatus, ValixaControlAdapter, ValueCodec } from './adapters.js';

function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
/** Native renderer binding; no browser globals, no Angular Forms state. */
export function nativeControlAdapter(element: { tagName: string; type?: string; value?: unknown; checked?: boolean; selectedOptions?: ArrayLike<{ value: string }>; multiple?: boolean }, renderer: Renderer2): ValixaControlAdapter<unknown> {
  const tag = element.tagName.toLowerCase();
  if (!['input', 'textarea', 'select'].includes(tag) || element.type === 'file') throw new Error('Supply an explicit adapter or ControlValueAccessor for this control');
  const checked = element.type === 'checkbox';
  return {
    preserveViewOnChange: true,
    get requiresCodec() { return element.type === 'number'; },
    writeValue(value) {
      if (element.type === 'radio') renderer.setProperty(element, 'checked', Object.is(element.value, value));
      else if (checked) renderer.setProperty(element, 'checked', Boolean(value));
      else if (tag === 'select' && element.multiple) {
        const values = Array.isArray(value) ? value : [];
        const options = (element as unknown as { options: ArrayLike<{ value: string }> }).options;
        for (const option of Array.from(options)) renderer.setProperty(option, 'selected', values.includes(option.value));
      } else renderer.setProperty(element, 'value', value ?? '');
    },
    setState(state) { renderer.setProperty(element, 'disabled', state.disabled); renderer.setProperty(element, 'readOnly', state.readonly);
      renderer.setAttribute(element, 'aria-required', String(state.required ?? false));
      const radio = element.type === 'radio';
      renderer.setAttribute(element, 'id', radio ? `${state.id}-${encodeURIComponent(String(element.value))}` : state.id);
      renderer.setAttribute(element, 'name', radio ? state.id : state.name);
      renderer.setAttribute(element, 'aria-invalid', String(state.errors.length > 0)); },
    connect(change, touched) {
      const off = renderer.listen(element, tag === 'select' || checked || element.type === 'radio' ? 'change' : 'input', () => {
        if (element.type === 'radio' && !element.checked) return;
        change(checked ? Boolean(element.checked) : tag === 'select' && element.multiple ? Array.from(element.selectedOptions ?? []).map(option => option.value) : element.value);
      });
      const blur = renderer.listen(element, 'blur', touched); return () => { off(); blur(); };
    }
  };
}

@Directive({ selector: '[valixaField]', standalone: true })
export class ValixaFieldDirective<T, View = T> {
  readonly field = input.required<AngularField<T>>({ alias: 'valixaField' });
  readonly codec = input<ValueCodec<T, View> | undefined>(undefined, { alias: 'valixaCodec' });
  private readonly element = inject(ElementRef).nativeElement;
  private readonly renderer = inject(Renderer2);
  private readonly explicit = inject(VALIXA_CONTROL, { self: true, optional: true });
  private readonly accessors = inject(NG_VALUE_ACCESSOR, { self: true, optional: true });
  private adapter!: ValixaControlAdapter<unknown>;
  private last: unknown;
  private writing = false;
  ngOnInit(): void {
    // Content controls (notably MatRadioGroup) need their value before child ngOnInit hooks.
    const field = this.field(), codec = this.codec();
    if (this.adapter.requiresCodec && !codec) throw new Error('This control requires an explicit valixaCodec');
    this.last = field.state().value;
    this.write(codec ? codec.decode(this.last as T) : this.last);
  }
  constructor() {
    if (inject(NgControl, { self: true, optional: true })) throw new Error('Do not combine valixaField with ngModel/formControl/formControlName');
    this.adapter = this.explicit ?? (this.accessors?.length === 1 ? valueAccessorAdapter(this.accessors[0]!) : nativeControlAdapter(this.element, this.renderer));
    effect(onCleanup => {
      const field = this.field(), codec = this.codec();
      if (this.adapter.requiresCodec && !codec) throw new Error('This control requires an explicit valixaCodec');
      const decode = (value: unknown) => codec ? codec.decode(value as T) : value;
      untracked(() => {
        this.last = field.state().value; this.write(decode(this.last));
        onCleanup(this.adapter.connect(view => {
          if (this.writing) return;
          const current = field.state();
          if (current.disabled || current.readonly) { this.write(decode(current.value)); return; }
          field.setValue(codec ? codec.encode(view as View) : view as T);
          if (this.adapter.preserveViewOnChange) this.last = field.state().value;
        }, field.onBlur));
      });
    });
    effect(() => {
      const field = this.field(), codec = this.codec(), state = field.state();
      if (!equal(state.value, this.last)) { this.last = state.value; this.write(codec ? codec.decode(state.value as T) : state.value); }
      const status: ControlStatus = { ...state, name: field.name, id: field.id, errorId: field.errorId };
      this.adapter.setState(status);
    });
  }
  private write(value: unknown): void { this.writing = true; try { this.adapter.writeValue(value); } finally { this.writing = false; } }
}
