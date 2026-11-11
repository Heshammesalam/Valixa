/** Value-free lifecycle events. Ordinals are per form, in actual execution order. */
export type LifecycleEventType = 'field.changed' | 'field.touched' | 'form.touched' | 'validation.scheduled' | 'validation.started' | 'validation.completed' | 'validation.failed' | 'validation.cancelled' | 'submit.started' | 'submit.succeeded' | 'submit.failed' | 'submit.cancelled' | 'collection.added' | 'collection.removed' | 'collection.moved' | 'collection.replaced' | 'behavior.changed' | 'locale.changed' | 'errors.set' | 'errors.cleared' | 'flags.changed' | 'form.reset' | 'form.disposed';
export interface LifecycleEvent {
  readonly sequence: number; readonly type: LifecycleEventType; readonly field?: string;
  readonly request?: number; readonly reason?: string; readonly index?: number; readonly to?: number; readonly key?: string;
}
export type LifecycleObserver = (event: LifecycleEvent) => void;
export interface EventObservationOptions { readonly types?: readonly LifecycleEventType[] }
