import { ChangeDetectionStrategy, Component, DestroyRef, Directive, TemplateRef, computed, contentChildren, effect, forwardRef, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { ValixaIds, bindValixa, numberCodec } from '@valixa/angular';
import type { AngularField, AngularForm, ValueCodec } from '@valixa/angular';
import { VALIXA_MATERIAL } from '@valixa/angular-material';
import { choiceValue, createRenderingPlan, resolveAutoCodec, selectedOptions } from '@valixa/auto';
import type { AutoCapabilities, AutoUI, PlanNode, RuntimeField } from '@valixa/auto';
import type { CollectionRow, SubmitHandler, SubmitResult } from '@valixa/core';

export interface AngularAutoAdapter extends AutoCapabilities {}
export const angularMaterialAdapter: AngularAutoAdapter = Object.freeze({ name: 'Angular Material', widgets: ['text', 'email', 'password', 'number', 'textarea', 'select', 'checkbox', 'radio', 'switch', 'autocomplete', 'date', 'custom'] as const, dateView: 'date',
  validateField: (field: RuntimeField, name: string) => { if (field.component === 'autocomplete' && field.multiple) throw new TypeError(`Angular Material autocomplete ${name} does not support multiple values; use select or a custom renderer`); } });
export interface AutoTemplateContext<T> { readonly $implicit: AngularField<T>; readonly config: RuntimeField }
@Directive({ selector: 'ng-template[valixaAutoRenderer]', standalone: true })
export class ValixaAutoRenderer<T> {
  readonly key = input.required<string>({ alias: 'valixaAutoRenderer' });
  /** Establishes the strict-template value type of the custom renderer context. */
  readonly example = input.required<AngularField<T>>({ alias: 'autoField' });
  readonly template = inject<TemplateRef<AutoTemplateContext<T>>>(TemplateRef);
  static ngTemplateContextGuard<T>(_directive: ValixaAutoRenderer<T>, context: unknown): context is AutoTemplateContext<T> { return true; }
}
const imports = [NgTemplateOutlet, MatInputModule, MatFormFieldModule, MatSelectModule, MatCheckboxModule, MatRadioModule, MatSlideToggleModule, MatAutocompleteModule, MatDatepickerModule, ...VALIXA_MATERIAL];
@Component({ selector: 'valixa-auto-field', standalone: true, imports, providers: [provideNativeDateAdapter()], changeDetection: ChangeDetectionStrategy.OnPush, template: `
  @if (field().state().visible && config().presentationWhen?.(field().state()) !== false) {
    <div [class]="config().className" [attr.data-valixa-field]="name()">
    @switch (config().component) {
      @case ('custom') { @if (customTemplate(); as template) { <ng-container [ngTemplateOutlet]="template" [ngTemplateOutletContext]="{ $implicit: field(), config: config() }"/> } }
      @case ('checkbox') { <mat-checkbox [valixaField]="field()" [required]="field().state().required">{{ config().label }}</mat-checkbox> }
      @case ('switch') { <mat-slide-toggle [valixaField]="field()">{{ config().label }}</mat-slide-toggle> }
      @case ('radio') { <span [id]="field().id + '-label'">{{ config().label }}</span><mat-radio-group [attr.aria-labelledby]="field().id + '-label'" [valixaField]="field()" [valixaCodec]="choices()">@for (option of config().options; track $index) { <mat-radio-button [value]="$index.toString()">{{ option.label }}</mat-radio-button> }</mat-radio-group> }
      @default {
        <mat-form-field><mat-label>{{ config().label }}</mat-label>
        @switch (config().component) {
          @case ('textarea') { <textarea matInput [valixaField]="field()" [required]="field().state().required"></textarea> }
          @case ('number') { <input matInput type="number" [valixaField]="field()" [valixaCodec]="numeric()" [required]="field().state().required"> }
          @case ('select') { <mat-select [valixaField]="field()" [valixaCodec]="choices()" [multiple]="!!config().multiple" [required]="field().state().required">@for (option of config().options; track $index) { <mat-option [value]="$index.toString()">{{ option.label }}</mat-option> }</mat-select> }
          @case ('autocomplete') { <input matInput [valixaField]="field()" [valixaCodec]="autocomplete()" [matAutocomplete]="options" [required]="field().state().required"><mat-autocomplete #options="matAutocomplete" [displayWith]="displayOption">@for (option of autocompleteOptions(); track option.index) { <mat-option [value]="option">{{ option.label }}</mat-option> }</mat-autocomplete> }
          @case ('date') { <input matInput [matDatepicker]="picker" [valixaField]="field()" [valixaCodec]="date()" [required]="field().state().required"><mat-datepicker-toggle matIconSuffix [for]="picker"/><mat-datepicker #picker/> }
          @default { <input matInput [type]="config().component" [valixaField]="field()" [required]="field().state().required"> }
        }
        @if (config().description) { <mat-hint [id]="field().id + '-description'">{{ config().description }}</mat-hint> }
        @if (inlineError()) { <mat-error [id]="field().errorId">{{ field().error() }}</mat-error> }
        </mat-form-field>
      }
    }
    @if (checkedWidget() && inlineError()) { <span role="alert" [id]="field().errorId">{{ field().error() }}</span> }
    </div>
  }` })
class AutoField {
  readonly form = input.required<AngularForm<any>>(); readonly name = input.required<string>(); readonly config = input.required<RuntimeField>(); readonly adapter = input.required<AngularAutoAdapter>(); readonly renderers = input<readonly ValixaAutoRenderer<any>[]>([]);
  readonly field = computed<AngularField<any>>(() => {
    const original = this.form().field(this.name()), config = this.config();
    return Object.freeze({ ...original, state: computed(() => Object.freeze({ ...original.state(), disabled: original.state().disabled || Boolean(config.disabled), readonly: original.state().readonly || Boolean(config.readonly) })), setValue: (value: any) => { if (!config.disabled && !config.readonly) original.setValue(value); } });
  });
  readonly inlineError = computed(() => !['summary', 'none'].includes(this.config().errorPlacement ?? '') && Boolean(this.field().error()));
  readonly checkedWidget = computed(() => ['checkbox', 'switch', 'radio', 'custom'].includes(this.config().component));
  readonly numeric = computed(() => numberCodec(this.config().emptyValue as number | null | undefined));
  readonly choices = computed<ValueCodec<any, string | string[]>>(() => ({ decode: value => { const selected = selectedOptions(this.config(), value).map(String); return this.config().multiple ? selected : selected[0] ?? ''; }, encode: value => choiceValue(this.config(), (Array.isArray(value) ? value : value === '' ? [] : [value]).map(Number)) }));
  readonly date = computed(() => resolveAutoCodec(this.config(), this.adapter()) as ValueCodec<any, Date | null>);
  readonly autocompleteOptions = computed(() => (this.config().options ?? []).map((option, index) => ({ label: option.label, index })));
  readonly autocomplete = computed<ValueCodec<any, string | { label: string; index: number } | null>>(() => ({ decode: value => this.autocompleteOptions()[selectedOptions(this.config(), value)[0] ?? -1] ?? null,
    encode: value => choiceValue(this.config(), value && typeof value === 'object' ? [value.index] : []) }));
  readonly displayOption = (value: { label?: string } | string | null): string => value && typeof value === 'object' ? value.label ?? '' : '';
  readonly customTemplate = computed(() => this.renderers().find(renderer => renderer.key() === this.config().renderer)?.template ?? null);
}
@Component({ selector: 'valixa-auto-nodes', standalone: true, imports: [AutoField, forwardRef(() => AutoCollection), forwardRef(() => AutoNodes)], changeDetection: ChangeDetectionStrategy.OnPush, template: `
  @for (node of nodes(); track key(node)) { @switch (node.kind) {
    @case ('field') { <valixa-auto-field [form]="form()" [name]="node.name" [config]="node.config" [adapter]="adapter()" [renderers]="renderers()"/> }
    @case ('collection') { <valixa-auto-collection [form]="form()" [node]="node" [adapter]="adapter()" [renderers]="renderers()"/> }
    @case ('group') { <fieldset [attr.data-valixa-group]="node.id"><legend>{{ node.label }}</legend>@if (node.description) { <p>{{ node.description }}</p> }<div style="display:grid;gap:16px" [style.grid-template-columns]="'repeat(' + node.columns + ', minmax(0, 1fr))'"><valixa-auto-nodes [form]="form()" [nodes]="node.children" [adapter]="adapter()" [renderers]="renderers()"/></div></fieldset> }
  } }` })
class AutoNodes {
  readonly form = input.required<AngularForm<any>>(); readonly nodes = input.required<readonly PlanNode[]>(); readonly adapter = input.required<AngularAutoAdapter>(); readonly renderers = input<readonly ValixaAutoRenderer<any>[]>([]);
  key(node: PlanNode): string { return node.kind === 'group' ? `group:${node.id}` : `${node.kind}:${node.name}`; }
}
@Component({ selector: 'valixa-auto-row', standalone: true, imports: [AutoNodes], changeDetection: ChangeDetectionStrategy.OnPush, template: `<valixa-auto-nodes [form]="form" [nodes]="ui().nodes" [adapter]="adapter()" [renderers]="renderers()"/>` })
class AutoRow {
  readonly row = input.required<CollectionRow<any>>(); readonly ui = input.required<AutoUI<any>>(); readonly adapter = input.required<AngularAutoAdapter>(); readonly renderers = input<readonly ValixaAutoRenderer<any>[]>([]);
  private readonly destroyRef = inject(DestroyRef); form!: AngularForm<any>;
  private readonly id = inject(ValixaIds).create();
  ngOnInit(): void { this.form = bindValixa(this.row().form, { id: this.id, destroyRef: this.destroyRef }); }
}
@Component({ selector: 'valixa-auto-collection', standalone: true, imports: [AutoRow], changeDetection: ChangeDetectionStrategy.OnPush, template: `
  @if (field().state().visible) { <fieldset [disabled]="field().state().disabled" [attr.data-valixa-collection]="node().name"><legend>{{ node().label }}</legend>
    @for (row of rows(); track row.key; let index = $index) { <div [attr.data-valixa-row]="row.key"><valixa-auto-row [row]="row" [ui]="node().ui" [adapter]="adapter()" [renderers]="renderers()"/><button type="button" [disabled]="blocked()" (click)="collection().remove(index)">{{ node().removeLabel }}</button>@if (node().movable) { <button type="button" [attr.aria-label]="'Move row ' + (index + 1) + ' up'" [disabled]="blocked() || index === 0" (click)="collection().move(index, index - 1)">Move up</button> }</div> }
    <button type="button" [disabled]="blocked()" (click)="collection().append(node().createItem())">{{ node().addLabel }}</button>
  </fieldset> }` })
class AutoCollection {
  readonly form = input.required<AngularForm<any>>(); readonly node = input.required<Extract<PlanNode, { kind: 'collection' }>>(); readonly adapter = input.required<AngularAutoAdapter>(); readonly renderers = input<readonly ValixaAutoRenderer<any>[]>([]);
  readonly collection = computed(() => this.form().array(this.node().name)); readonly field = computed(() => this.form().field(this.node().name)); readonly rows = signal<readonly CollectionRow<any>[]>([]);
  readonly blocked = computed(() => this.field().state().disabled || this.field().state().readonly);
  private readonly destroyRef = inject(DestroyRef);
  ngOnInit(): void { const collection = this.collection(); this.rows.set(collection.items); this.destroyRef.onDestroy(collection.subscribe(() => { if (this.rows() !== collection.items) this.rows.set(collection.items); })); }
}
@Component({ selector: 'valixa-auto-actions', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, template: `
  @if (ui().summary && form().state().invalid) { <div role="alert" aria-label="Form errors"><ul>@for (entry of errors(); track entry.name) { @for (message of entry.messages; track $index) { <li>{{ entry.name }}: {{ message }}</li> } }@for (message of form().state().formErrors; track $index) { <li>{{ message }}</li> }</ul></div> }
  @if (error()) { <p role="alert">{{ error() }}</p> }
  @if (defaults()) { <button type="submit" [disabled]="form().submitting() || form().state().disabled">{{ form().submitting() ? 'Submitting…' : ui().submitLabel }}</button><button type="reset" [disabled]="form().submitting()">{{ ui().resetLabel }}</button> }` })
class AutoActions {
  readonly form = input.required<AngularForm<any>>(); readonly ui = input.required<AutoUI<any>>(); readonly error = input(''); readonly defaults = input(true);
  readonly errors = computed(() => Object.entries(this.form().state().errors).map(([name, messages]) => ({ name, messages: messages as readonly string[] })));
}
@Component({ selector: 'valixa-auto-form', standalone: true, imports: [AutoNodes, AutoActions], changeDetection: ChangeDetectionStrategy.OnPush, template: `<form novalidate (submit)="save($event)" (reset)="reset($event)">@for (revision of [epoch()]; track revision) { <valixa-auto-nodes [form]="form()" [nodes]="plan()" [adapter]="adapter()" [renderers]="renderers()"/> }<valixa-auto-actions [form]="form()" [ui]="ui()" [error]="error()" [defaults]="showDefaultActions()"/><ng-content select="[autoActions]"/></form>` })
export class ValixaAutoForm<V extends Record<string, unknown> = any> {
  readonly form = input.required<AngularForm<V>>(); readonly ui = input.required<AutoUI<V>>(); readonly adapter = input<AngularAutoAdapter>(angularMaterialAdapter);
  readonly onSubmit = input.required<SubmitHandler<V, unknown>>(); readonly result = output<SubmitResult<V, unknown>>(); readonly failure = output<unknown>(); readonly error = signal('');
  readonly showDefaultActions = input(true);
  readonly epoch = signal(0);
  constructor() { effect(cleanup => { const form = this.form(); this.epoch.update(value => value + 1); cleanup(form.core.observeEvents(() => { this.epoch.update(value => value + 1); this.error.set(''); }, { types: ['form.reset'] })); }); }
  readonly renderers = contentChildren(ValixaAutoRenderer);
  readonly plan = computed(() => createRenderingPlan(this.form().core, this.ui(), { ...this.adapter(), custom: this.renderers().map(renderer => renderer.key()) }));
  save(event: Event): void { event.preventDefault(); this.error.set(''); void this.form().submit(this.onSubmit()).then(result => this.result.emit(result)).catch(error => { this.error.set('Submission failed.'); this.failure.emit(error); }); }
  reset(event: Event): void { event.preventDefault(); this.form().reset(); this.error.set(''); }
}
