import type { ValixaInspection } from './index.js';

export interface DevtoolsPanel { update(inspections: readonly ValixaInspection[]): void; destroy(): void }
let panelId = 0;
/** DOM is touched only when called with an explicit host. No telemetry/storage/global mounting. */
export function mountValixaDevtools(host: HTMLElement, initial: readonly ValixaInspection[]): DevtoolsPanel {
  const document = host.ownerDocument;
  if (!document?.createElement) throw new TypeError('Valixa DevTools panel requires an explicit DOM host');
  const root = document.createElement('section'); root.className = 'valixa-tools'; root.setAttribute('aria-label', 'Valixa DevTools'); root.dataset.valixaDevtools = '';
  const style = document.createElement('style'); style.textContent = `.valixa-tools{font:13px/1.5 ui-monospace,monospace;color:#dce8e4;background:#162520;border:1px solid #52685e;border-radius:12px;padding:16px;margin:20px 0;overflow:auto}.valixa-tools h2{font:600 20px system-ui;margin:0}.valixa-tools .vt-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:12px 0}.valixa-tools input,.valixa-tools select,.valixa-tools button{font:inherit;color:inherit;background:#233c32;border:1px solid #759181;border-radius:5px;padding:6px;max-width:100%}.valixa-tools button{cursor:pointer}.valixa-tools button:disabled{opacity:.55;cursor:default}.valixa-tools summary{cursor:pointer;font-weight:700;padding:8px 0}.valixa-tools pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:320px;overflow:auto;padding:10px;background:#0e1c16;border-radius:6px}.valixa-tools ol{max-height:300px;overflow:auto;padding-left:30px}.valixa-tools svg{min-width:540px;max-width:100%;height:auto}.valixa-tools small{color:#b7c8be}.valixa-tools .vt-status{padding:2px 7px;border:1px solid #759181;border-radius:12px}`;
  const header = document.createElement('h2'); header.textContent = 'Valixa DevTools';
  const privacy = document.createElement('small'); privacy.textContent = 'Local inspection · values and messages redacted by default · no network or storage';
  const toolbar = document.createElement('div'); toolbar.className = 'vt-toolbar';
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, label: string): HTMLElementTagNameMap[K] => { const element = document.createElement(tag); element.setAttribute('aria-label', label); return element; };
  const formSelect = make('select', 'Inspect form'), search = make('input', 'Search diagnostics'), pause = make('button', 'Pause recording'), clear = make('button', 'Clear timeline'), detach = make('button', 'Detach selected form'), status = make('span', 'Inspection status');
  search.type = 'search'; search.placeholder = 'Fields, events, dependencies…'; pause.type = clear.type = detach.type = 'button'; clear.textContent = 'Clear timeline'; detach.textContent = 'Detach'; status.className = 'vt-status';
  toolbar.append(formSelect, search, pause, clear, detach, status);
  const details = (label: string, open = false) => { const section = document.createElement('details'); section.open = open; const title = document.createElement('summary'); title.textContent = label; section.append(title); root.append(section); return section; };
  root.append(style, header, privacy, toolbar);
  const stateSection = details('State inspector', true), fieldSection = details('Field inspector'), errorSection = details('Validation errors'), graphSection = details('Dependency graph'), rowsSection = details('Dynamic collections'), timelineSection = details('Event timeline', true);
  const statePre = make('pre', 'Current form state'), fieldSelect = make('select', 'Inspect field'), fieldPre = make('pre', 'Selected field state'), errorsPre = make('pre', 'Validation errors'), graph = make('div', 'Dependency graph viewer'), rowsPre = make('pre', 'Collection identities'), timeline = make('ol', 'Lifecycle event timeline');
  stateSection.append(statePre); fieldSection.append(fieldSelect, fieldPre); errorSection.append(errorsPre); graphSection.append(graph); rowsSection.append(rowsPre); timelineSection.append(timeline);
  host.append(root);
  let inspections: readonly ValixaInspection[] = [], releases: (() => void)[] = [], selected = 0, disposed = false;
  const id = ++panelId;
  const current = () => inspections[selected];
  const json = (value: unknown) => JSON.stringify(value, null, 2) ?? '';
  const graphView = (inspection: ValixaInspection, scopeId: string, query: string) => {
    graph.replaceChildren(); const scope = inspection.getSnapshot().scopes.find(item => item.id === scopeId); if (!scope) return;
    const all = Object.keys(scope.description.fields).filter(name => name.toLowerCase().includes(query)), names = all.slice(0, 80);
    const namespace = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(namespace, 'svg'); svg.setAttribute('viewBox', `0 0 800 ${Math.max(110, Math.ceil(names.length / 3) * 75 + 20)}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Validation dependency graph');
    const defs = document.createElementNS(namespace, 'defs'), marker = document.createElementNS(namespace, 'marker'); marker.id = `vt-arrow-${id}`; marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '9'); marker.setAttribute('refY', '5'); marker.setAttribute('markerWidth', '5'); marker.setAttribute('markerHeight', '5'); marker.setAttribute('orient', 'auto-start-reverse'); const arrow = document.createElementNS(namespace, 'path'); arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z'); arrow.setAttribute('fill', '#9dbfad'); marker.append(arrow); defs.append(marker); svg.append(defs);
    const positions = new Map(names.map((name, index) => [name, { x: 20 + index % 3 * 265, y: 20 + Math.floor(index / 3) * 75 }]));
    for (const target of names) for (const dependency of scope.dependencies.dependencies[target] ?? []) {
      const from = positions.get(dependency), to = positions.get(target); if (!from || !to) continue;
      const line = document.createElementNS(namespace, 'line'); line.setAttribute('x1', String(from.x + 115)); line.setAttribute('y1', String(from.y + 40)); line.setAttribute('x2', String(to.x + 115)); line.setAttribute('y2', String(to.y)); line.setAttribute('stroke', '#9dbfad'); line.setAttribute('marker-end', `url(#vt-arrow-${id})`); svg.append(line);
    }
    for (const name of names) { const position = positions.get(name)!; const group = document.createElementNS(namespace, 'g'), rect = document.createElementNS(namespace, 'rect'), text = document.createElementNS(namespace, 'text'), title = document.createElementNS(namespace, 'title');
      rect.setAttribute('x', String(position.x)); rect.setAttribute('y', String(position.y)); rect.setAttribute('width', '235'); rect.setAttribute('height', '40'); rect.setAttribute('rx', '6'); rect.setAttribute('fill', '#294b3b'); rect.setAttribute('stroke', '#a7c9b6'); if (scope.dependencies.unknown.includes(name)) rect.setAttribute('stroke-dasharray', '4 3');
      text.setAttribute('x', String(position.x + 8)); text.setAttribute('y', String(position.y + 25)); text.setAttribute('fill', '#e4f4eb'); text.setAttribute('font-size', '12'); text.textContent = name.length > 28 ? `${name.slice(0, 27)}…` : name; title.textContent = name; group.append(title, rect, text); svg.append(group);
    }
    const note = document.createElement('small'); note.textContent = `Value dependency → validation target. Dashed nodes have unknown reads. Showing ${names.length}/${all.length} matching fields.`; graph.append(svg, note);
  };
  const render = () => {
    if (disposed) return;
    const inspection = current(), query = search.value.toLowerCase();
    if (!inspection) { status.textContent = 'No attached forms'; statePre.textContent = ''; fieldPre.textContent = ''; errorsPre.textContent = ''; rowsPre.textContent = ''; fieldSelect.replaceChildren(); graph.replaceChildren(); timeline.replaceChildren(); pause.disabled = clear.disabled = detach.disabled = true; return; }
    const snapshot = inspection.getSnapshot(); status.textContent = snapshot.status; pause.disabled = clear.disabled = detach.disabled = snapshot.status !== 'attached'; pause.textContent = snapshot.recording ? 'Pause recording' : 'Resume recording'; pause.setAttribute('aria-label', pause.textContent);
    statePre.textContent = json({ ...snapshot.state, values: snapshot.values, touched: snapshot.touched, dirty: snapshot.dirtyFields, behaviors: snapshot.scopes.map(scope => ({ scope: scope.id, fields: scope.behaviors })) }); errorsPre.textContent = json({ fields: snapshot.errors, codes: snapshot.errorCodes, form: snapshot.formErrors }); rowsPre.textContent = json(snapshot.collections);
    const selectedField = fieldSelect.value; fieldSelect.replaceChildren(); const none = document.createElement('option'); none.value = ''; none.textContent = 'Select a field'; fieldSelect.append(none);
    for (const scope of snapshot.scopes) for (const name of Object.keys(scope.description.fields)) if (`${scope.path}${name}`.toLowerCase().includes(query)) { const option = document.createElement('option'); option.value = JSON.stringify([scope.id, name]); option.textContent = `${scope.id} · ${name}`; fieldSelect.append(option); }
    fieldSelect.value = Array.from(fieldSelect.options).some(option => option.value === selectedField) ? selectedField : '';
    let scope = '$';
    if (fieldSelect.value) { const [selectedScope, name] = JSON.parse(fieldSelect.value) as [string, string]; scope = selectedScope; try { fieldPre.textContent = json(inspection.inspectField(name, scope)); } catch { fieldPre.textContent = 'Field no longer exists'; } } else fieldPre.textContent = 'Select a field to inspect its redacted current state.';
    graphView(inspection, scope, query); timeline.replaceChildren();
    for (const event of snapshot.events) if (`${event.type} ${event.scope} ${event.field ?? ''} ${event.reason ?? ''}`.toLowerCase().includes(query)) { const item = document.createElement('li'); item.textContent = `#${event.ordinal} ${event.type} · ${event.scope}${event.field ? ` · ${event.field}` : ''}${event.request === undefined ? '' : ` · request ${event.request}`}${event.reason ? ` · ${event.reason}` : ''}${event.key ? ` · ${event.key}` : ''}`; timeline.append(item); }
  };
  const selectForm = () => { selected = Number(formSelect.value) || 0; fieldSelect.value = ''; render(); };
  const toggle = () => { const inspection = current(); if (inspection?.getSnapshot().recording) inspection.pause(); else inspection?.resume(); render(); };
  const clearHistory = () => { current()?.clear(); render(); }; const detachForm = () => { current()?.detach(); render(); };
  formSelect.addEventListener('change', selectForm); search.addEventListener('input', render); fieldSelect.addEventListener('change', render); pause.addEventListener('click', toggle); clear.addEventListener('click', clearHistory); detach.addEventListener('click', detachForm);
  const update = (next: readonly ValixaInspection[]) => {
    if (disposed) return; const previous = current(); for (const release of releases) release(); inspections = [...next]; selected = previous && inspections.includes(previous) ? inspections.indexOf(previous) : 0;
    releases = inspections.map(inspection => inspection.subscribe(render)); formSelect.replaceChildren(); inspections.forEach((inspection, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = inspection.getSnapshot().name; formSelect.append(option); }); formSelect.value = String(selected); render();
  };
  update(initial);
  return { update, destroy() { if (disposed) return; disposed = true; for (const release of releases) release(); releases = []; inspections = [];
    formSelect.removeEventListener('change', selectForm); search.removeEventListener('input', render); fieldSelect.removeEventListener('change', render); pause.removeEventListener('click', toggle); clear.removeEventListener('click', clearHistory); detach.removeEventListener('click', detachForm);
    statePre.textContent = fieldPre.textContent = errorsPre.textContent = rowsPre.textContent = ''; timeline.replaceChildren(); graph.replaceChildren(); fieldSelect.replaceChildren(); formSelect.replaceChildren(); root.replaceChildren(); root.remove();
  } };
}
