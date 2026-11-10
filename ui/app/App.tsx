// Autoflow panel: create (route or flow list + copy / ⌘V), the selected
// connector(s), style (toolbar, saved styles, more options) and the page.
import * as React from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import { Toolbar } from '@base-ui/react/toolbar';
import { Button } from '@/components/ui/button';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { TextInput } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { normalizeHex } from '../validate.js';
import {
  S, t, tPlural, useStore, paint, post, current, editingConnectors, orderedNodes, pairsOf, sendPlan, reverse, copyConnector,
  run, makeArrows, ids, selectEnd, setAdvanced, textTool, removeLabel, fontLists, setFamily, setFontStyle,
  lookKey, openPresetForm, savePreset, applyPreset, deletePreset, throttle, PASTE,
  PALETTE, WEIGHTS, DASHES, KINDS, CAPS, type NodeRef, type Preset, type PortKey,
} from './store';
import {
  C, Icon, ActionButton, IconButton, Section, Hint, Subhead, Toast, SidePicker, NumberField, LabelField,
  ActionMenu, Picker, IconChoices, ColorGrid, toolItem,
} from './parts';
import { ColorField } from './color-picker';

export function App() {
  useStore();
  const app = React.useRef<HTMLElement>(null);

  // The plugin creates on a paste, so it gets the order, link mode and sides after every change.
  React.useEffect(() => sendPlan());

  React.useEffect(() => {
    post({ type: 'env', paste: PASTE });
    // The plugin window follows the panel's height.
    let last = 0;
    const report = throttle(() => {
      const h = Math.ceil(app.current!.scrollHeight);
      if (Math.abs(h - last) < 2) return;
      last = h;
      post({ type: 'resize', height: h });
    }, 50);
    const observer = new ResizeObserver(report);
    observer.observe(app.current!);
    post({ type: 'ready' });
    return () => observer.disconnect();
  }, []);

  const conns = S.state ? S.state.connectors.length : 0;
  return (
    <>
      <main id="app" ref={app}>
        {conns ? <ConnectorSection /> : <CreateSection />}
        <StyleSection />
        <PageSection />
      </main>
      <p className="sr-only" id="status" role="status" aria-live="polite">{S.status}</p>
      <Toast />
    </>
  );
}

// ------------------------------------------------------------------ route

function Slot({ id, label, filled, next, name, port, portLabel }: {
  id: string; label: string; filled: boolean; next?: boolean; name: React.ReactNode; port: PortKey; portLabel: string;
}) {
  return (
    <div id={id} className={cn('flex min-w-0 flex-col gap-0.5 rounded-md px-2 pt-2 pb-1.5',
      filled ? cn(C.soft, C.text) : next ? 'inset-ring inset-ring-blue-500 text-black-400 dark:text-white-400' : cn('inset-ring inset-ring-grey-200 dark:inset-ring-grey-600', C.faint))}>
      <span className={cn('typography-body-medium', next && !filled ? 'text-blue-600 dark:text-blue-400' : C.muted)}>{label}</span>
      {name}
      <SidePicker k={port} label={portLabel} filled={filled} />
    </div>
  );
}

const RouteArrow = () => <Icon name="capArrow" className={cn('mirror self-center', C.iconMuted)} />;

function CreateSection() {
  const nodes = orderedNodes();
  const n = nodes.length;
  const pairs = pairsOf(nodes);
  const ready = n >= 2;
  const nameOf = (node: NodeRef | undefined, placeholder: string, filled: boolean) => (
    <span className={cn('typography-body-medium truncate', filled && 'typography-body-medium-strong')}>{node ? node.name : placeholder}</span>
  );
  const hint = !S.copied ? t('hint.copy') : ready ? t('hint.again') : n === 1 ? t('hint.target') : t('hint.source');
  return (
    <Section id="secTool" titleId="hTool" title={n > 2 ? t('new.many', { n: pairs.length }) : t('new.title')}
      actions={<IconButton tooltip id="reverseBtn" label={t('reverse')} icon="swap" disabled={n < 2} onClick={reverse} />}>
      {n <= 2 ? (
        // One or two elements: origin → target
        <div id="route" role="group" aria-label={t('route')} className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-stretch gap-1">
          <Slot id="slotFrom" label={t('source')} filled={!!nodes[0]} next name={nameOf(nodes[0], t('slot.click'), !!nodes[0])} port="planFrom" portLabel={t('leaves')} />
          <RouteArrow />
          <Slot id="slotTo" label={t('target')} filled={!!nodes[1]} next={n === 1} name={nameOf(nodes[1], t('slot.shift'), !!nodes[1])} port="planTo" portLabel={t('enters')} />
        </div>
      ) : (
        // Three or more: how to link them, and the list ⌘V will create
        <div id="many" className="flex flex-col gap-2">
          <SegmentedControl id="linkMode" value={S.linkMode} aria-label={t('link.how')} className="w-full"
            onValueChange={(v) => { S.linkMode = v === 'fan' ? 'fan' : 'chain'; paint(); }}>
            <SegmentedControlItem value="chain" className="flex-1">{t('link.chain')}</SegmentedControlItem>
            <SegmentedControlItem value="fan" className="flex-1">{t('link.fan')}</SegmentedControlItem>
          </SegmentedControl>
          <Links pairs={pairs} />
        </div>
      )}

      {/* Next action: copy the connector (styled as configured below), then ⌘V on the canvas creates it. */}
      <div id="next" className="flex flex-col gap-2">
        {S.copied && ready && (
          <div id="pastePrompt" key={S.pasteNudge} className={cn('paste typography-body-medium-strong flex min-h-10 items-center gap-2 rounded-md bg-blue-100 p-2 dark:bg-blue-1000', C.text, S.pasteNudge > 0 && 'is-fresh')}>
            <kbd className={cn('kbd-large rounded-sm px-1.5 py-0.5 font-[inherit] text-xs/[18px] font-semibold inset-ring inset-ring-grey-200 dark:inset-ring-grey-600', C.panel)}>{PASTE}</kbd>
            <span className="flex-1">{pairs.length > 1 ? t('paste.many', { n: pairs.length }) : t('paste.one')}</span>
          </div>
        )}
        {/* Once copied, ⌘V is the action: the copy button steps back. */}
        <Button id="copyBtn" variant={S.copied && ready ? 'secondary' : 'primary'} className="w-full" onClick={copyConnector}>
          {S.copyFlash ? t('copied') : S.copied ? t('copy.again') : t('copy')}
        </Button>
        <Hint id="nextHint" aria-live="polite">{hint}</Hint>
      </div>
    </Section>
  );
}

const MAX_LINKS = 6;
function Links({ pairs }: { pairs: [NodeRef, NodeRef][] }) {
  const shown = pairs.length > MAX_LINKS ? pairs.slice(0, MAX_LINKS - 1) : pairs;
  return (
    <ul id="linkList" aria-label={t('links')} className="m-0 flex list-none flex-col gap-0.5 p-0">
      {shown.map(([a, b], i) => (
        <li key={`${i}:${a.id}:${b.id}`} aria-label={t('link.item', { a: a.name, b: b.name })} className={cn('typography-body-medium flex h-6 items-center gap-0.5 rounded-md px-2', C.soft, C.text)}>
          <span className="max-w-[calc(50%-14px)] min-w-0 truncate">{a.name}</span>
          <Icon name="capArrow" className={cn('mirror', C.iconMuted)} />
          <span className="max-w-[calc(50%-14px)] min-w-0 truncate">{b.name}</span>
        </li>
      ))}
      {shown.length < pairs.length && (
        <li className={cn('typography-body-medium px-2 leading-6', C.muted)}>{t('links.more', { n: pairs.length - shown.length })}</li>
      )}
    </ul>
  );
}

function ConnectorSection() {
  const s = S.state!;
  const c = s.connectors[0];
  const many = s.connectors.length > 1;
  const end = (id: string, which: 'from' | 'to', name: string, has: boolean) => (
    // Names select the element on the canvas
    <button type="button" id={id} disabled={many || !has} title={t('selectOnCanvas')} onClick={() => selectEnd(which)}
      className={cn('typography-body-medium-strong -mx-1 max-w-[calc(100%+8px)] cursor-pointer self-start truncate rounded-sm px-1 text-left outline-none',
        'hover:enabled:bg-black-100 focus-visible:outline focus-visible:outline-blue-500 disabled:cursor-default dark:hover:enabled:bg-white-100')}>
      <span id={`${which}Name`}>{name}</span>
    </button>
  );
  return (
    <Section id="secConn" titleId="connTitle"
      title={many ? t('conn.many', { n: s.connectors.length }) : c.data.broken ? t('conn.loose') : t('conn.title')}
      actions={(
        <>
          <IconButton tooltip id="swapBtn" label={t('reverse')} icon="swap" busy={S.busy.swap} onClick={() => run('swap', { type: 'swap', ids: ids() })} />
          <ActionMenu label={t('moreActions')} busy={S.busy.menu} items={[
            { value: 'prototype', text: t('menu.prototype'), onClick: () => run('menu', { type: 'prototype', ids: ids() }) },
            { value: 'defaults-from', text: t('menu.defaultsFrom'), disabled: many, onClick: () => run('menu', { type: 'defaults-from', id: ids()[0] }) },
            'separator',
            { value: 'delete', text: t('menu.delete'), onClick: () => run('menu', { type: 'delete', ids: ids() }) },
          ]} />
        </>
      )}>
      {/* Same card as when creating */}
      <div role="group" aria-label={t('ends')} className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-stretch gap-1">
        <Slot id="connFrom" label={t('source')} filled={many || !!c.data.from.id} name={end('selFrom', 'from', many ? t('several') : c.fromName, !!c.data.from.id)} port="fromSide" portLabel={t('leaves')} />
        <RouteArrow />
        <Slot id="connTo" label={t('target')} filled={many || !!c.data.to.id} name={end('selTo', 'to', many ? t('several') : c.toName, !!c.data.to.id)} port="toSide" portLabel={t('enters')} />
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ style

const Chevron = () => <Icon name="chevron" className="tool-chevron" />;

function StyleToolbar() {
  const v = current();
  const conn = editingConnectors();
  const color = normalizeHex(v.color) || '#000000';
  const preset = PALETTE.find(([c]) => c === color);
  const colorName = preset ? t(preset[1]) : color.toUpperCase();
  const dash = (DASHES.find(([d]) => d === v.dash) || DASHES[0])[0];
  const kind = KINDS.find(([k]) => k === v.kind) || KINDS[0];
  const cap = (key: 'startCap' | 'endCap') => CAPS.find(([c]) => c === v[key]) || CAPS[1];
  const capChoices = (belt: 'startCap' | 'endCap', label: string) => (
    <IconChoices groups={[{ belt, label, value: cap(belt)[0], items: CAPS.map(([c, g]) => ({ value: c, label: t(`cap.${c}`), glyph: g, mirror: belt === 'endCap' })) }]} />
  );
  const sep = <Toolbar.Separator className="h-4 w-px shrink-0 bg-grey-200 dark:bg-grey-600" />;
  return (
    <Toolbar.Root id="toolbar" aria-label={t('toolbar')} className={cn('flex items-center gap-1 self-stretch rounded-[9px] p-1', C.soft)}>
      <Toolbar.Group aria-label={t('group.colorStroke')} className="flex flex-auto gap-0.5">
        <Picker name="color" label={t('tool.colorIs', { name: colorName })} popupLabel={t('tool.color')}
          trigger={<><span id="colorDot" aria-hidden="true" className="mx-1 size-4 rounded-full inset-ring inset-ring-black-200" style={{ background: color }} /><Chevron /></>}>
          <ColorGrid value={color} />
        </Picker>
        {/* Stroke: weight and line style together, like FigJam's stroke picker. */}
        <Picker name="weight" label={t('tool.strokeIs', { w: v.weight, dash: t(`dash.${dash}`).toLowerCase() })} popupLabel={t('tool.stroke')}
          trigger={<><Icon name="strokeWeight" /><Chevron /></>}>
          <IconChoices groups={[
            { belt: 'weight', label: t('weight.group'), value: String(v.weight), items: WEIGHTS.map((w) => ({ value: String(w), label: `${t(`weight.${w}`)} · ${w}`, glyph: `weight${w}` })) },
            { belt: 'dash', label: t('dash.group'), value: v.dash, items: DASHES.map(([d, g]) => ({ value: d, label: t(`dash.${d}`), glyph: g })) },
          ]} />
        </Picker>
      </Toolbar.Group>
      {sep}
      {conn && (
        <>
          <Toolbar.Group aria-label={t('group.label')} className="flex flex-auto gap-0.5">
            <Toolbar.Button id="textTool" aria-label={t('tool.label')} aria-pressed={!!v.label} onClick={textTool}
              className={cn(toolItem, v.label && cn(C.selected, 'hover:bg-blue-300 dark:hover:bg-blue-800'))}>
              <Icon name="text" />
            </Toolbar.Button>
          </Toolbar.Group>
          {sep}
        </>
      )}
      <Toolbar.Group aria-label={t('group.ends')} className="flex flex-auto gap-0.5">
        <Picker name="startCap" label={t('is', { title: t('tool.start'), value: t(`cap.${cap('startCap')[0]}`) })} popupLabel={t('tool.start')}
          trigger={<><Icon name={cap('startCap')[1]} /><Chevron /></>}>
          {capChoices('startCap', t('tool.start'))}
        </Picker>
        <Picker name="kind" label={t('is', { title: t('tool.kind'), value: t(`kind.${kind[0]}`) })} popupLabel={t('tool.kind')}
          trigger={<><Icon name={kind[1]} /><Chevron /></>}>
          <IconChoices groups={[{ belt: 'kind', label: t('tool.kind'), value: kind[0], items: KINDS.map(([k, g]) => ({ value: k, label: t(`kind.${k}`), glyph: g })) }]} />
        </Picker>
        <Picker name="endCap" label={t('is', { title: t('tool.end'), value: t(`cap.${cap('endCap')[0]}`) })} popupLabel={t('tool.end')}
          trigger={<><Icon name={cap('endCap')[1]} className="mirror" /><Chevron /></>}>
          {capChoices('endCap', t('tool.end'))}
        </Picker>
      </Toolbar.Group>
    </Toolbar.Root>
  );
}

// A short line drawn with the preset's color, weight, dash and end cap.
function PresetLine({ p }: { p: Preset }) {
  const w = Math.min(3, Math.max(1, p.style.weight));
  const dash = p.style.dash === 'dash' ? `${w * 3} ${w * 2}` : p.style.dash === 'dot' ? `0.1 ${w * 2.5}` : undefined;
  return (
    <svg viewBox="0 0 28 12" width="28" height="12" aria-hidden="true" className="shrink-0">
      <path d="M2 6H25" style={{ stroke: p.style.color }} strokeWidth={w} strokeLinecap="round" strokeDasharray={dash} />
      {p.style.endCap !== 'none' && (
        <path d="M21 2.5 25.5 6 21 9.5" fill="none" style={{ stroke: p.style.color }} strokeWidth={Math.min(2, w)} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function PresetForm() {
  const [name, setName] = React.useState('');
  return (
    <div id="presetForm" className="flex items-center gap-1">
      <TextInput id="presetName" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('presets.namePh')} aria-label={t('presets.nameAria')} className="min-w-0 flex-1"
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); savePreset(name); }
          if (e.key === 'Escape') { e.preventDefault(); openPresetForm(false); }
        }} />
      <Button id="presetSave" variant="primary" onClick={() => savePreset(name)}>{t('save')}</Button>
      <IconButton id="presetCancel" label={t('cancel')} icon="minus" className="-mr-1" onClick={() => openPresetForm(false)} />
    </div>
  );
}

// Saved styles: one click applies one, to new connectors or the selection.
function Presets() {
  const list = (S.state && S.state.presets) || [];
  const v = current();
  const now = lookKey(v.kind, v);
  const target = editingConnectors() ? t('presets.toSelection') : t('presets.toNew');
  return (
    <div id="presets" className="flex flex-col gap-1">
      <div className="flex min-h-6 items-center justify-between">
        <p id="presetsTitle" className={cn('typography-body-medium-strong', C.text)}>{t('presets.title')}</p>
        {!S.presetForm && <Button id="presetAdd" variant="ghost" className={cn('-mr-1', C.text)} onClick={() => openPresetForm(true)}>{t('presets.add')}</Button>}
      </div>
      {S.presetForm && <PresetForm />}
      {list.length > 0 && (
        <ul id="presetList" aria-labelledby="presetsTitle" className="m-0 flex list-none flex-col gap-0.5 p-0">
          {list.map((p) => (
            <li key={p.id} className="group relative flex items-center">
              <button type="button" aria-pressed={lookKey(p.kind, p.style) === now} title={`${target}: ${p.name}`} onClick={() => applyPreset(p)}
                className={cn('typography-body-medium flex h-7 min-w-0 flex-1 cursor-pointer items-center justify-start gap-2 rounded-md pr-8 pl-2 text-left outline-none',
                  C.text, C.hover, 'focus-visible:inset-ring focus-visible:inset-ring-blue-500 aria-pressed:bg-blue-200 dark:aria-pressed:bg-blue-900')}>
                <PresetLine p={p} />
                <span className="truncate">{p.name}</span>
              </button>
              <button type="button" title={t('presets.deleteTitle', { name: p.name })} aria-label={t('presets.deleteAria', { name: p.name })} onClick={() => deletePreset(p)}
                className={cn('absolute right-0.5 grid size-6 cursor-pointer place-items-center rounded-md opacity-0 outline-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:inset-ring focus-visible:inset-ring-blue-500',
                  C.iconMuted, 'hover:bg-black-100 hover:text-black-800 dark:hover:bg-white-100 dark:hover:text-white-1000')}>
                <Icon name="minus" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!list.length && !S.presetForm && <Hint id="presetEmpty">{t('presets.empty')}</Hint>}
    </div>
  );
}

function FontSelect({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(String(v ?? ''))} items={options.map((o) => ({ value: o, label: o }))}>
      <SelectTrigger id={id} aria-label={label} className="w-full min-w-0"><SelectValue /></SelectTrigger>
      <SelectContent className="z-50">{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}

// Compact rows like Figma's properties panel: up to three fields per row,
// each named by its icon or unit (and aria-label) instead of a label column.
function Advanced() {
  const v = current();
  const conn = editingConnectors();
  const hasLabel = conn && !!v.label;
  const elbow = v.kind === 'elbow';
  const fonts = fontLists();
  const outShown = v.fromSide !== 'auto';
  const inShown = v.toSide !== 'auto';
  return (
    <div className="flex flex-col gap-2">
      <Subhead>{t('line')}</Subhead>
      <div className={cn('grid gap-2', elbow ? 'grid-cols-3' : 'grid-cols-2')}>
        <ColorField k="color" id="lineColorHex" label={t('line.color')} />
        <NumberField k="weight" min={0.5} max={24} step={0.5} icon="strokeWeight" label={t('line.weight')} />
        {elbow && <NumberField k="radius" min={0} max={200} step={1} icon="corners" label={t('line.radius')} />}
      </div>

      {conn && (
        <div className="flex flex-col gap-2">
          {(outShown || inShown) && <Subhead id="anchorsHead">{t('anchors')}</Subhead>}
          <div className="grid grid-cols-2 gap-2">
            {outShown && (
              <label className={cn('flex min-w-0 items-center gap-1.5', !inShown && 'col-span-full')}>
                <span className={cn('typography-body-medium shrink-0', C.muted)}>{t('anchors.out')}</span>
                <NumberField k="fromT" min={0} max={100} step={1} unit="%" label={t('anchors.outAria')} />
              </label>
            )}
            {inShown && (
              <label className={cn('flex min-w-0 items-center gap-1.5', !outShown && 'col-span-full')}>
                <span className={cn('typography-body-medium shrink-0', C.muted)}>{t('anchors.in')}</span>
                <NumberField k="toT" min={0} max={100} step={1} unit="%" label={t('anchors.inAria')} />
              </label>
            )}
          </div>
        </div>
      )}

      {/* Label typography: always a default; on connectors, only once they have a label. */}
      {!(conn && !hasLabel) && (
        <div id="labelStyle" className="flex flex-col gap-2">
          <Subhead>{t('label.section')}</Subhead>
          <FontSelect id="fontFamily" label={t('font.family')} value={fonts.family} options={fonts.families} onChange={setFamily} />
          <div className="grid grid-cols-3 gap-2">
            <FontSelect id="fontStyle" label={t('font.style')} value={fonts.style} options={fonts.styles} onChange={setFontStyle} />
            <NumberField k="labelSize" min={6} max={96} step={1} icon="fontSize" label={t('font.size')} />
            <ColorField k="labelColor" label={t('text.color')} />
          </div>
        </div>
      )}
    </div>
  );
}

function StyleSection() {
  const conn = editingConnectors();
  const v = current();
  const hasLabel = conn && !!v.label;
  const many = conn && S.state!.connectors.length > 1;
  return (
    <Section id="secStyle" titleId="styleTitle" title={conn ? t('style.conn') : t('style.new')}
      actions={!conn && (
        <ActionButton id="resetDefaults" variant="ghost" className={C.text} busy={S.busy.reset} onClick={() => run('reset', { type: 'reset-defaults' })}>{t('reset')}</ActionButton>
      )}>
      <StyleToolbar />
      <Presets />
      {hasLabel && (
        <div id="labelRow" className="flex items-center gap-2">
          <LabelField label={v.label || ''} many={many} />
          <IconButton id="labelRemove" label={t('label.remove')} icon="minus" className="-mr-1" onClick={removeLabel} />
        </div>
      )}
      <Collapsible.Root open={S.advanced} onOpenChange={setAdvanced} className="flex flex-col gap-2">
        <Collapsible.Trigger render={<Button variant="ghost" id="moreToggle" className={cn('group -ml-1 self-start gap-0 pl-0', C.muted)} />}>
          <Icon name="adjust" className={C.iconMuted} />
          <span>{t('more')}</span>
          <Icon name="chevron" className={cn('disclosure-chevron', C.iconMuted)} />
        </Collapsible.Trigger>
        <Collapsible.Panel id="advanced" keepMounted>
          <Advanced />
        </Collapsible.Panel>
      </Collapsible.Root>
    </Section>
  );
}

// ------------------------------------------------------------------ page

function PageSection() {
  const s = S.state;
  const stats = s ? s.stats : { total: 0, broken: 0, linked: 0, inSelection: 0 };
  const inSel = stats.inSelection || 0;
  return (
    <Section id="secPage" titleId="hPage" title={t('page.title')}
      actions={<span id="count" className={cn('typography-body-medium mr-1 whitespace-nowrap', C.muted)}>{s ? tPlural('count', stats.total) : ''}</span>}>
      {stats.broken > 0 ? (
        <div id="brokenRow" role="status" className={cn('flex min-h-8 items-center gap-1 rounded-md py-1 pr-1', C.soft)}>
          <Icon name="warning" className="shrink-0 text-yellow-1000 dark:text-yellow-400" />
          <p id="brokenText" className={cn('typography-body-medium flex-1', C.text)}>{tPlural('broken', stats.broken)}</p>
          <ActionButton id="showBroken" variant="ghost" className={C.text} busy={S.busy.showBroken} onClick={() => run('showBroken', { type: 'select-broken' })}>{t('show')}</ActionButton>
          <ActionButton id="cleanBtn" variant="ghost" className={C.text} busy={S.busy.clean} onClick={() => run('clean', { type: 'clean' })}>{t('delete')}</ActionButton>
        </div>
      ) : s && <Hint id="pageEmpty">{t('page.ok')}</Hint>}
      {/* The selected flow (else every linked connector) → On click → Navigate */}
      {!!stats.linked && (
        <div id="protoRow" className="flex flex-col gap-2">
          <Hint id="protoHint">{inSel ? tPlural('proto.sel', inSel) : t('proto.hint')}</Hint>
          <ActionButton id="protoBtn" variant="secondary" className="w-full" busy={S.busy.proto} onClick={() => run('proto', { type: 'prototype' })}>
            {inSel ? t('proto.make.sel') : t('proto.make')}
          </ActionButton>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Hint id="protoArrowsHint">{s ? (s.prototypePaste ? tPlural('proto.arrows.paste', s.prototypePaste) : t('proto.arrows.select')) : ''}</Hint>
        <ActionButton id="protoArrowsBtn" variant="secondary" className="w-full" busy={S.busy.protoArrows} disabled={!s?.prototypeSource} onClick={makeArrows}>
          {t('proto.arrows.make')}
        </ActionButton>
      </div>
    </Section>
  );
}
