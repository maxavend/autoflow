// Panel pieces FigUI does not ship (section header, icon, spinner, toast,
// side picker, menu, toolbar with its pickers, number / color / label fields),
// built from FigUI's components (ui/components/ui), Base UI and FigUI's tokens.
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { Popover } from '@base-ui/react/popover';
import { Toolbar } from '@base-ui/react/toolbar';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { TextInput, NumericInputRoot, NumericScrubArea, NumericInput, InputGroup, InputGroupAddon } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ICONS } from '../icons.js';
import { GLYPHS } from '../glyphs.js';
import {
  S, t, useStore, current, throttle, commitNumber, sendLabel, setPicker, applyPick, sideAt, setPort, portValue,
  PALETTE, type PortKey, type Side,
} from './store';

// FigUI color tokens, light and dark.
export const C = {
  text: 'text-black-1000 dark:text-white-1000',
  muted: 'text-black-500 dark:text-white-500',
  faint: 'text-black-400 dark:text-white-400',
  line: 'border-grey-200 dark:border-grey-600',
  soft: 'bg-grey-100 dark:bg-grey-700',
  panel: 'bg-white-1000 dark:bg-grey-800',
  icon: 'text-black-800 dark:text-white-1000',
  iconMuted: 'text-black-500 dark:text-white-500',
  hover: 'hover:bg-black-100 dark:hover:bg-white-100',
  selected: 'bg-blue-200 dark:bg-blue-900',
  focus: 'outline-none focus-visible:inset-ring focus-visible:inset-ring-blue-500',
};

// Official UI3 icons (ui/icons.js) and the extra glyphs (ui/glyphs.js):
// static, trusted SVG strings, never document data.
const SVGS = { ...(ICONS as Record<string, string>), ...(GLYPHS as Record<string, string>) };
export function Icon({ name, className }: { name: string; className?: string }) {
  return <span data-icon={name} aria-hidden="true" className={cn('icon', className)} dangerouslySetInnerHTML={{ __html: SVGS[name] || '' }} />;
}

export const Spinner = () => (
  <span role="img" aria-label="Procesando" className="inline-flex"><Loader2 aria-hidden className="size-3 animate-spin" /></span>
);

// A button that runs a tracked action: spinner, disabled and aria-busy while it runs.
export function ActionButton({ busy, children, disabled, className, size, ...props }: React.ComponentProps<typeof Button> & { busy?: boolean }) {
  return (
    <Button {...props} size={size} disabled={disabled || busy} aria-busy={busy || undefined} className={className}>
      {busy && size !== 'icon' && <Spinner />}
      {children}
    </Button>
  );
}

export function IconButton({ label, icon, tooltip, className, ...props }: React.ComponentProps<typeof ActionButton> & { label: string; icon: string; tooltip?: boolean }) {
  const button = <ActionButton variant="ghost" size="icon" aria-label={label} className={cn(C.icon, className)} {...props} />;
  if (!tooltip) return <ActionButton variant="ghost" size="icon" aria-label={label} className={cn(C.icon, className)} {...props}><Icon name={icon} /></ActionButton>;
  return (
    <Tooltip>
      <TooltipTrigger render={button}><Icon name={icon} /></TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// Section like Figma's properties panel: title on the left, actions on the right.
export function Section({ id, titleId, title, actions, children }: { id: string; titleId: string; title: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={titleId} className={cn('flex flex-col gap-2 border-b px-4 pt-3 pb-3 last:border-b-0', C.line)}>
      <header className="flex min-h-10 items-center gap-0">
        <h3 id={titleId} className={cn('typography-body-medium-strong min-w-0 flex-1', C.text)}>{title}</h3>
        {actions && <span className="-mr-1 flex shrink-0 items-center gap-0.5">{actions}</span>}
      </header>
      {children}
    </section>
  );
}

export const Hint = ({ className, ...props }: React.ComponentProps<'p'>) => <p className={cn('typography-body-medium', C.muted, className)} {...props} />;
export const Subhead = ({ className, ...props }: React.ComponentProps<'p'>) => <p className={cn('typography-body-medium-strong mt-1', C.text, className)} {...props} />;

// ------------------------------------------------------------------ toast

// Brief confirmation inside the panel, dark in both themes like UI3's.
export function Toast() {
  useStore();
  const { text, key } = S.toast;
  const [shown, setShown] = React.useState(0);
  React.useEffect(() => {
    if (!key) return;
    setShown(key);
    const id = setTimeout(() => setShown(0), 2200);
    return () => clearTimeout(id);
  }, [key]);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-4">
      {shown > 0 && (
        <div className="typography-body-medium max-w-full rounded-md bg-grey-900 px-3 py-2 text-white-1000 shadow-400 inset-ring inset-ring-white-200">{text}</div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ side picker

// Where a connector leaves or enters an element: a small box with a dot on
// each side's midpoint and one in the centre (automatic). Click or drag the
// handle; arrows move it like a 3×3 grid whose corners are not used.
const SIDES: [Side, number, number][] = [['top', 50, 0], ['left', 0, 50], ['auto', 50, 50], ['right', 100, 50], ['bottom', 50, 100]];
const MOVE: Record<string, Record<Side, Side>> = {
  ArrowUp: { top: 'top', bottom: 'auto', auto: 'top', left: 'top', right: 'top' },
  ArrowDown: { bottom: 'bottom', top: 'auto', auto: 'bottom', left: 'bottom', right: 'bottom' },
  ArrowLeft: { left: 'left', right: 'auto', auto: 'left', top: 'left', bottom: 'left' },
  ArrowRight: { right: 'right', left: 'auto', auto: 'right', top: 'right', bottom: 'right' },
};

export function SidePicker({ k, label, filled }: { k: PortKey; label: string; filled: boolean }) {
  useStore();
  const value = portValue(k);
  const box = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);
  const pick = (side: Side) => {
    if (side !== portValue(k)) setPort(k, side);
    box.current?.querySelector<HTMLElement>(`[data-side="${side}"]`)?.focus();
  };
  const fromPointer = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    pick(sideAt(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100));
  };
  return (
    <span className="mt-1 flex flex-col items-center">
      <div
        ref={box}
        role="radiogroup"
        aria-label={label}
        data-port={k}
        className={cn('relative h-12 w-[72px] touch-none rounded-md', filled ? C.panel : C.soft)}
        onPointerDown={(e) => {
          e.preventDefault();
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => dragging.current && fromPointer(e)}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
        onKeyDown={(e) => {
          const next = MOVE[e.key]?.[value];
          if (next) {
            e.preventDefault();
            pick(next);
          } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            pick('auto');
          }
        }}
      >
        {SIDES.map(([side, x, y]) => {
          const on = side === value;
          return (
            <span
              key={side}
              role="radio"
              aria-checked={on}
              aria-label={t(`side.${side}`)}
              data-side={side}
              tabIndex={on ? 0 : -1}
              style={{ left: `calc(8px + (100% - 16px) * ${x / 100})`, top: `calc(8px + (100% - 16px) * ${y / 100})` }}
              className="group absolute grid size-4 -translate-x-1/2 -translate-y-1/2 cursor-default place-items-center rounded-full outline-none"
            >
              <span className={cn('block rounded-full group-focus-visible:ring-2 group-focus-visible:ring-blue-300 dark:group-focus-visible:ring-blue-700',
                on ? 'size-3 bg-blue-500' : 'size-1 bg-grey-400 dark:bg-grey-500')} />
            </span>
          );
        })}
      </div>
      <span aria-hidden="true" className={cn('typography-body-medium', C.muted)}>{t(`side.${value}`)}</span>
    </span>
  );
}

// ------------------------------------------------------------------ fields

// Number field on FigUI's NumericInput: an icon (drag it to scrub) or a unit,
// committed on Enter, blur, arrows or the end of a scrub. Empty or invalid
// input restores the last good value.
export function NumberField({ k, min, max, step = 1, label, icon, unit, className }: {
  k: string; min: number; max: number; step?: number; label: string; icon?: string; unit?: string; className?: string;
}) {
  useStore();
  const raw = (current() as unknown as Record<string, number | undefined>)[k];
  const percent = k === 'fromT' || k === 'toT' || k === 'opacity';
  const shown = raw === undefined ? '' : String(percent ? Math.round(raw * 100) : raw);
  const [draft, setDraft] = React.useState<string | null>(null);
  const pending = React.useRef<string | null>(null);
  const commit = () => {
    const text = pending.current;
    pending.current = null;
    setDraft(null);
    if (text !== null) commitNumber(k, text, min, max);
  };
  return (
    <InputGroup className={cn('w-full min-w-0', className)}>
      <NumericInputRoot
        value={draft ?? shown}
        min={min}
        max={max}
        nudgeAmount={step}
        className="min-w-0 flex-1"
        onValueChange={(next) => {
          pending.current = next;
          setDraft(next);
        }}
        onValueCommitted={(n) => {
          pending.current = n === null ? '' : String(n);
          commit();
        }}
      >
        {icon && (
          <NumericScrubArea>
            <InputGroupAddon className={C.iconMuted}><Icon name={icon} /></InputGroupAddon>
          </NumericScrubArea>
        )}
        <NumericInput aria-label={label} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
      </NumericInputRoot>
      {unit && <InputGroupAddon className={cn('w-auto pr-1.5', C.muted)}>{unit}</InputGroupAddon>}
    </InputGroup>
  );
}

// Connector label: typed text goes to the plugin throttled; the field keeps
// what the user types while it has focus.
export function LabelField({ label, many }: { label: string; many: boolean }) {
  const [text, setText] = React.useState<string | null>(null);
  const push = React.useMemo(() => throttle((v: string) => sendLabel(v), 250), []);
  return (
    <TextInput
      id="labelText"
      aria-label={t('label.ph')}
      placeholder={many ? t('label.phMany') : t('label.ph')}
      value={text ?? (many ? '' : label)}
      onFocus={() => setText(many ? '' : label)}
      onBlur={() => setText(null)}
      onChange={(e) => {
        setText(e.target.value);
        push(e.target.value);
      }}
      className="min-w-0 flex-1"
    />
  );
}

// ------------------------------------------------------------------ menu

const menuItem = 'typography-body-medium flex h-6 cursor-default items-center rounded-md px-2 text-white-1000 outline-none select-none data-highlighted:bg-blue-500 data-disabled:text-white-400';

export function ActionMenu({ label, busy, items }: { label: string; busy?: boolean; items: ({ value: string; text: string; disabled?: boolean; onClick: () => void } | 'separator')[] }) {
  return (
    <Menu.Root>
      <Menu.Trigger render={<ActionButton variant="ghost" size="icon" busy={busy} aria-label={label} className={C.icon} />}>
        <Icon name="more" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} collisionPadding={8} className="z-50">
          <Menu.Popup className="min-w-40 rounded-lg bg-grey-900 p-2 shadow-400 outline-none dark:inset-shadow-2xs dark:inset-shadow-white-200">
            {items.map((item, i) => item === 'separator'
              ? <Menu.Separator key={`sep${i}`} className="mx-[-8px] my-2 h-px bg-white-200" />
              : <Menu.Item key={item.value} data-value={item.value} disabled={item.disabled} onClick={item.onClick} className={menuItem}>{item.text}</Menu.Item>)}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

// ------------------------------------------------------------------ toolbar

// FigJam-style toolbar: each item opens its icon picker (a popover anchored
// under it); the item stays pressed while its picker is open.
export const toolItem = cn(
  'flex h-6 min-w-6 flex-1 cursor-default items-center justify-center rounded-md px-0.5',
  C.icon, C.hover, C.focus,
  'data-popup-open:bg-black-200 dark:data-popup-open:bg-white-200',
);

export function Picker({ name, label, popupLabel, trigger, children }: { name: string; label: string; popupLabel: string; trigger: React.ReactNode; children: React.ReactNode }) {
  const popup = React.useRef<HTMLDivElement>(null);
  return (
    <Popover.Root open={S.picker === name} onOpenChange={(open) => setPicker(open ? name : S.picker === name ? null : S.picker)}>
      <Popover.Trigger render={<Toolbar.Button />} data-picker={name} aria-label={label} aria-haspopup="dialog" className={toolItem}>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="center" sideOffset={6} collisionPadding={8} className="z-50">
          <Popover.Popup
            ref={popup}
            aria-label={popupLabel}
            data-for={name}
            // Focus the current choice, like the picker it replaces.
            initialFocus={() => popup.current?.querySelector<HTMLElement>('[aria-pressed="true"], [aria-checked="true"]') || popup.current?.querySelector<HTMLElement>('button') || true}
            onKeyDown={(e) => { if (e.key === 'Tab') setPicker(null); }}
            finalFocus={() => {
              const id = S.afterPicker;
              S.afterPicker = null;
              return (id && document.getElementById(id)) || true;
            }}
            className="flex items-center gap-1 rounded-[13px] bg-grey-900 p-1 text-white-1000 shadow-400 outline-none inset-ring inset-ring-white-200"
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

const pickItem = 'grid size-8 cursor-default place-items-center rounded-[9px] text-white-1000 outline-none hover:bg-white-100 focus-visible:inset-ring focus-visible:inset-ring-white-600 aria-pressed:bg-blue-500 aria-pressed:hover:bg-blue-500';

// Icon choices: one selection per group, arrow keys move between them.
export function IconChoices({ groups }: { groups: { belt: string; label: string; value: string; items: { value: string; label: string; glyph: string; mirror?: boolean }[] }[] }) {
  return (
    <Toolbar.Root className="flex items-center gap-1">
      {groups.map((g, i) => (
        <React.Fragment key={g.belt}>
          {i > 0 && <Toolbar.Separator className="h-5 w-px shrink-0 bg-white-200" />}
          <Toolbar.Group aria-label={g.label} data-belt={g.belt} className="flex items-center gap-0.5">
            {g.items.map((item) => (
              <Toolbar.Button key={item.value} aria-pressed={item.value === g.value} aria-label={item.label} title={item.label}
                onClick={() => applyPick(g.belt, item.value)} className={pickItem}>
                <Icon name={item.glyph} className={item.mirror ? 'mirror' : undefined} />
              </Toolbar.Button>
            ))}
          </Toolbar.Group>
        </React.Fragment>
      ))}
    </Toolbar.Root>
  );
}

const RAINBOW = 'conic-gradient(from 90deg, #f24822, #ffcd29, #14ae5c, #2fc6b8, #0d99ff, #9747ff, #f849c1, #f24822)';

// Color grid: FigJam's palette and a custom color, arrows move by cell and by row.
export function ColorGrid({ value }: { value: string }) {
  const items: [string, string, string][] = [...PALETTE.map(([c, k]) => [c, k, c] as [string, string, string]), ['custom', 'color.custom', RAINBOW]];
  const selected = PALETTE.some(([c]) => c === value) ? value : 'custom';
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const cells = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
    const i = cells.indexOf(document.activeElement as HTMLElement);
    const step = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: 11, ArrowUp: -11 } as Record<string, number>)[e.key];
    if (step) {
      e.preventDefault();
      cells[Math.max(0, Math.min(cells.length - 1, (i < 0 ? 0 : i) + step))].focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      cells[e.key === 'Home' ? 0 : cells.length - 1].focus();
    }
  };
  return (
    <div role="radiogroup" aria-label={t('tool.color')} onKeyDown={onKeyDown} className="grid grid-cols-[repeat(11,24px)] gap-0.5">
      {items.map(([v, key, bg]) => (
        <button key={v} type="button" role="radio" aria-checked={v === selected} tabIndex={-1} aria-label={t(key)} title={t(key)} data-value={v}
          onClick={() => applyPick('color', v)} className="group grid size-6 cursor-default place-items-center rounded-full outline-none">
          <span style={{ background: bg }}
            className="size-[18px] rounded-full inset-ring inset-ring-white-200 transition-transform duration-[120ms] group-hover:scale-110 group-focus-visible:shadow-[0_0_0_2px_var(--color-grey-900),0_0_0_3px_var(--color-white-700)] group-aria-checked:shadow-[0_0_0_2px_var(--color-grey-900),0_0_0_4px_var(--color-blue-500)]" />
        </button>
      ))}
    </div>
  );
}
