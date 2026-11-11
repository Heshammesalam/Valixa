# valixa-auto

Framework-independent typed UI metadata and immutable rendering plans. Depends only
on valixa; no DOM or UI framework imports.

```ts
import { blueprint, createValixa } from 'valixa';
import { defineAutoForm, createRenderingPlan } from 'valixa-auto';
const schema = blueprint({ name: ['', 'required'], age: [18] });
const ui = defineAutoForm(schema, { fields: {
  name: { component: 'text', label: 'Full name' },
  age: { component: 'number', label: 'Age', emptyValue: 0 }
} });
const nodes = createRenderingPlan(createValixa(schema), ui, {
  name: 'My adapter', widgets: ['text', 'number']
});
```

Author with `defineAutoForm(schema, config)` to check paths and value types. Metadata
must be plain data; functions are retained for codecs, comparators and presentation.
Groups use `{group,label,columns,children}`; collections supply row `ui` and
`createItem`. No widgets/labels are inferred from validation. Numbers need an explicit
empty value, object choices need compare, dates need an explicit codec with a view tag.
Unsupported capabilities and missing custom/date registrations throw before render.

Exports include `defineAutoCodec`, `resolveAutoCodec`, `selectedOptions`, `choiceValue`
and renderer contracts (`AutoUI`, `PlanNode`, `RuntimeField`, `AutoCapabilities`).
React/Vue renderers live at valixa-react/auto and valixa-vue/auto; UI adapters at
valixa-mui/auto and valixa-vuetify/auto. Angular uses valixa-angular-auto.

See docs/phase-6.md in the repository for the complete cross-framework guide.
