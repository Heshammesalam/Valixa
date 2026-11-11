import { defineComponent, h, onMounted, onScopeDispose, ref, toRaw, watch } from 'vue';
import type { PropType } from 'vue';
import type { ValixaInspection } from 'valixa-devtools';
import { mountValixaDevtools } from 'valixa-devtools/panel';
import type { DevtoolsPanel } from 'valixa-devtools/panel';

export const ValixaDevtools = defineComponent({ name: 'ValixaDevtools', props: { inspections: { type: Array as PropType<readonly ValixaInspection[]>, required: true } }, setup(props) {
  const host = ref<HTMLElement>(); let panel: DevtoolsPanel | undefined;
  onMounted(() => { panel = mountValixaDevtools(host.value!, props.inspections.map(toRaw)); });
  watch(() => props.inspections, inspections => panel?.update(inspections.map(toRaw)), { flush: 'post' });
  onScopeDispose(() => panel?.destroy()); return () => h('div', { ref: host, 'data-valixa-devtools-host': 'vue' });
} });
