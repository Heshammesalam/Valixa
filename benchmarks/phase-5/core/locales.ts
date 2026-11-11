import { defaultMessages } from './rules.js';
import { configuration } from './data.js';

export interface MessageCatalog { readonly messages: Readonly<Record<string, string>>; readonly labels?: Readonly<Record<string, string>> }
export interface ValidationErrorDetail {
  readonly code: string;
  readonly field: string;
  readonly label: string;
  readonly param: string;
  readonly source: 'field' | 'form' | 'server';
  /** Literal custom/server messages are never translated implicitly. */
  readonly message?: string;
}
const catalogs = new Map<string, MessageCatalog>([
  ['en', { messages: defaultMessages }],
  ['ar', { messages: {
    required: '{label} مطلوب.', email: 'يجب أن يكون {label} عنوان بريد إلكتروني صالحًا.',
    url: 'يجب أن يكون {label} رابط HTTP أو HTTPS صالحًا.', min: 'يجب ألا يقل طول {label} عن {param}.',
    max: 'يجب ألا يزيد طول {label} عن {param}.', minValue: 'يجب ألا تقل قيمة {label} عن {param}.',
    maxValue: 'يجب ألا تزيد قيمة {label} عن {param}.', same: 'يجب أن يطابق {label} الحقل {param}.',
    custom: '{label} غير صالح.', exception: 'تعذر التحقق من {label}.', timeout: 'انتهت مهلة التحقق من {label}.'
  } }]
]);
export function registerLocale(locale: string, catalog: MessageCatalog): void {
  if (!locale.trim()) throw new TypeError('Locale name must not be empty');
  catalogs.set(locale, configuration(catalog));
}
export function renderError(detail: ValidationErrorDetail, locale: string, fallback: string, messages: Readonly<Record<string, string>> = {}, labels: Readonly<Record<string, Readonly<Record<string, string>>>> = {}): string {
  if (detail.message !== undefined) return detail.message;
  const catalog = catalogs.get(locale), fallbackCatalog = catalogs.get(fallback);
  const template = messages[detail.code] ?? catalog?.messages[detail.code] ?? fallbackCatalog?.messages[detail.code] ?? defaultMessages[detail.code] ?? defaultMessages.custom!;
  const own = (dictionary: Readonly<Record<string, string>> | undefined, key: string) => dictionary && Object.hasOwn(dictionary, key) ? dictionary[key] : undefined;
  const label = own(Object.hasOwn(labels, locale) ? labels[locale] : undefined, detail.field) ?? own(catalog?.labels, detail.field) ?? own(Object.hasOwn(labels, fallback) ? labels[fallback] : undefined, detail.field) ?? own(fallbackCatalog?.labels, detail.field) ?? detail.label;
  return template.replace(/\{label\}/g, () => label).replace(/\{param\}/g, () => detail.param);
}
