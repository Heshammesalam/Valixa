import { Component, EventEmitter, inject, signal } from '@angular/core';
import { provideValixaControl } from '@valixa/angular';
@Component({ selector: 'seat-counter', standalone: true,
  providers: [provideValixaControl(() => {
    const counter = inject(SeatCounter);
    return { writeValue: (value: number) => counter.value.set(value), setState: state => { counter.disabled.set(state.disabled || state.readonly); counter.issue.set(state.errors[0]); },
      connect: (change, touched) => { const off = counter.amount.subscribe(payload => { change(payload.amount); touched(); }); return () => off.unsubscribe(); } };
  })], template: `<p>Seats: {{ value() }}</p><button type="button" [disabled]="disabled()" (click)="amount.emit({amount:value()+1})">Add seat</button>@if (issue()) { <p>{{ issue() }}</p> }` })
export class SeatCounter { value = signal(0); disabled = signal(false); issue = signal<string | undefined>(undefined); amount = new EventEmitter<{ amount: number }>(); }
