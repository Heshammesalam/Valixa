import { effectScope } from 'vue';
import { expectTypeOf, it } from 'vitest';
import { createValixaKey, defineValixaAdapter, provideValixa, useValixa, useValixaAdapter, useValixaField } from 'valixa-vue';
import { fileMetadata, useVuetifyField, useVuetifyFileField } from 'valixa-vuetify';
import type { FileMetadata } from 'valixa-vuetify';

it('infers names/values and rejects incompatible adapters through emitted declarations', () => {
  const scope = effectScope(); scope.run(() => {
    const form = useValixa({ email: [''], age: [18], agree: [false], tags: { initial: [] as string[] },
      people: { initial: [] as { id: number; title: string }[] }, uploads: { initial: [] as FileMetadata[] } });
    const field = useValixaField(form, 'age'); expectTypeOf(field.state.value.value).toEqualTypeOf<number>();
    const text = useVuetifyField(form, 'email', { kind: 'text' }); expectTypeOf(text.value.modelValue).toEqualTypeOf<string>();
    const checked = useVuetifyField(form, 'agree', { kind: 'checkbox' }); expectTypeOf(checked.value.modelValue).toEqualTypeOf<boolean>();
    if (false) {
      // @ts-expect-error invalid field name
      useValixaField(form, 'missing');
      // @ts-expect-error invalid field value
      field.setValue('18');
      // @ts-expect-error invalid component/value pair
      useVuetifyField(form, 'agree', { kind: 'text' });
      // @ts-expect-error invalid numeric clearing value
      useVuetifyField(form, 'age', { kind: 'number', emptyValue: null });
      // @ts-expect-error array selection must declare multiple
      useVuetifyField(form, 'tags', { kind: 'select', multiple: false, clearValue: [] });
      // @ts-expect-error object items require returnObject
      useVuetifyField(form, 'people', { kind: 'autocomplete', multiple: true });
      // @ts-expect-error object-only combobox cannot represent free-text entries
      useVuetifyField(form, 'people', { kind: 'combobox', multiple: true, returnObject: true });
      // @ts-expect-error metadata encoder cannot bind a string field
      useVuetifyFileField(form, 'email', fileMetadata, { multiple: true });
      const nullable = defineValixaAdapter<number | null, { clear: () => void }>(field => ({ clear: () => field.setValue(null) }));
      // @ts-expect-error nullable adapter may not write null into number-only field
      useValixaAdapter(form, 'age', nullable);
      const key = createValixaKey<{ other: boolean }>();
      // @ts-expect-error provider values must match their key
      provideValixa(key, form);
    }
  }); scope.stop();
});
