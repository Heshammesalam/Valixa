import { ChangeDetectorRef, Directive, ElementRef, Renderer2, forwardRef, inject } from '@angular/core';
import type { ControlValueAccessor } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatRadioGroup } from '@angular/material/radio';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatDatepickerInput } from '@angular/material/datepicker';
import { DateAdapter } from '@angular/material/core';
import { VALIXA_CONTROL, ValixaFieldDirective, nativeControlAdapter, valueAccessorAdapter } from 'valixa-angular';
import type { ControlStatus, ValixaControlAdapter } from 'valixa-angular';

/** Actual Material selectors and DI tokens define supported hosts; no component-name guessing. */
@Directive({
  selector: 'input[matInput][valixaField],textarea[matInput][valixaField],mat-select[valixaField],mat-checkbox[valixaField],mat-radio-group[valixaField],mat-slide-toggle[valixaField]',
  standalone: true,
  providers: [{ provide: VALIXA_CONTROL, useExisting: forwardRef(() => ValixaMaterialDirective) }]
})
export class ValixaMaterialDirective implements ValixaControlAdapter<unknown> {
  readonly preserveViewOnChange = true;
  private readonly input = inject(MatInput, { self: true, optional: true });
  private readonly select = inject(MatSelect, { self: true, optional: true });
  private readonly checkbox = inject(MatCheckbox, { self: true, optional: true });
  private readonly radio = inject(MatRadioGroup, { self: true, optional: true });
  private readonly toggle = inject(MatSlideToggle, { self: true, optional: true });
  private readonly autocomplete = inject(MatAutocompleteTrigger, { self: true, optional: true });
  private readonly date = inject(MatDatepickerInput, { self: true, optional: true });
  private readonly dateAdapter = inject(DateAdapter, { optional: true });
  get requiresCodec(): boolean { return Boolean(this.autocomplete || this.date || this.input?.type === 'number'); }
  private readonly host = inject(ElementRef).nativeElement;
  private readonly renderer = inject(Renderer2);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly adapter: ValixaControlAdapter<unknown>;
  private invalid = false;
  private readonly matcher = { isErrorState: () => this.invalid };
  constructor() {
    if (this.date && this.autocomplete) throw new Error('Do not combine datepicker and autocomplete on one Valixa control');
    const accessor: ControlValueAccessor | null = this.date ?? this.autocomplete ?? this.select ?? this.checkbox ?? this.radio ?? this.toggle;
    this.adapter = accessor ? valueAccessorAdapter(accessor) : nativeControlAdapter(this.host, this.renderer);
    if (this.input) this.input.errorStateMatcher = this.matcher;
    if (this.select) this.select.errorStateMatcher = this.matcher;
  }
  writeValue(value: unknown): void { this.adapter.writeValue(value); }
  connect(change: (value: unknown) => void, touched: () => void): () => void {
    return this.adapter.connect(value => {
      // A date CVA emits null for both clearing and parse failure. Preserve invalid drafts explicitly.
      if (this.date && value === null && typeof this.host.value === 'string' && this.host.value.trim()) change(this.dateAdapter!.invalid());
      else change(value);
    }, touched);
  }
  setState(state: ControlStatus): void {
    this.adapter.setState(state); this.invalid = state.errors.length > 0;
    this.renderer.setAttribute(this.host, 'aria-required', String(state.required ?? false));
    this.renderer.setAttribute(this.host, 'aria-readonly', String(state.readonly));
    if (this.input) { this.input.id = state.id; this.input.name = state.name; this.input.readonly = state.readonly; this.input.disabled = state.disabled; this.input.updateErrorState(); }
    if (this.select) { this.select.id = state.id; this.select.updateErrorState(); }
    if (this.checkbox) { this.checkbox.id = state.id; this.checkbox.name = state.name; this.checkbox.ariaDescribedby = state.errors.length ? state.errorId : ''; }
    if (this.radio) this.radio.name = state.id;
    if (this.toggle) { this.toggle.id = state.id; this.toggle.name = state.name; }
    if (this.autocomplete) { this.autocomplete.autocompleteDisabled = state.disabled || state.readonly; if (this.autocomplete.autocompleteDisabled) this.autocomplete.closePanel(); }
    if (this.checkbox || this.radio || this.toggle) {
      this.renderer.setAttribute(this.host, 'id', state.id);
      if (state.errors.length) this.renderer.setAttribute(this.host, 'aria-describedby', state.errorId); else this.renderer.removeAttribute(this.host, 'aria-describedby');
      for (const input of this.host.querySelectorAll('input')) this.renderer.setAttribute(input, 'aria-invalid', String(this.invalid));
    }
    this.changeDetector.markForCheck();
  }
}
/** Import this tuple into a standalone component's imports. */
export const VALIXA_MATERIAL = [ValixaFieldDirective, ValixaMaterialDirective] as const;
