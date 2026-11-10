// Color picker in the style of Figma UI3, opened from a color field's chit.
// FigUI ships the hue and opacity sliders and the hex input but no picker
// (its registry/ui3/ui/color-picker.tsx is an empty stub), so the
// saturation/brightness area, the eyedropper and the layout live here.
import * as React from 'react';
import chroma from 'chroma-js';
import { Popover } from '@base-ui/react/popover';
import { ColorRangeSlider, OpacitySlider } from '@/components/ui/slider';
import { ColorInput, ColorChit, InputGroup, InputGroupAddon } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { normalizeHex } from '../validate.js';
import { C, IconButton, NumberField } from './parts';
import { t, useStore, current, throttle, commitHex, send } from './store';

type HSV = [h: number, s: number, v: number];

// Grey has no hue: keep the one the user had, so the area does not jump to red.
function toHsv(hex: string, hue = 0): HSV {
  const [h, s, v] = chroma(hex).hsv();
  return [Number.isNaN(h) ? hue : h, s, v];
}
const toHex = ([h, s, v]: HSV) => chroma.hsv(h, s, v).hex();
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHEXResult: string }> };
const EyeDropper = (globalThis as { EyeDropper?: EyeDropperCtor }).EyeDropper;

type PickerProps = {
  hex: string;
  onHex: (hex: string) => void;
  opacity?: number;
  onOpacity?: (a: number) => void;
};

function PickerBody({ hex, onHex, opacity, onOpacity }: PickerProps) {
  const [hsv, setHsv] = React.useState<HSV>(() => toHsv(hex));
  // Colors this picker produced. The store echoes them back late (throttled,
  // then the plugin's state), so only a color it did not produce resets the area.
  const produced = React.useRef(new Set<string>([hex]));
  React.useEffect(() => {
    if (!produced.current.has(hex)) setHsv((prev) => toHsv(hex, prev[0]));
  }, [hex]);

  // Handlers read the latest color, not the last render's: fast key repeats
  // and pointer moves can arrive before React re-renders.
  const latest = React.useRef(hsv);
  latest.current = hsv;
  const set = (next: HSV) => {
    latest.current = next;
    setHsv(next);
    const out = toHex(next);
    produced.current.add(out);
    onHex(out);
  };

  const area = React.useRef<HTMLDivElement>(null);
  const fromPointer = (e: React.PointerEvent) => {
    const r = area.current!.getBoundingClientRect();
    set([latest.current[0], clamp01((e.clientX - r.left) / r.width), clamp01(1 - (e.clientY - r.top) / r.height)]);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowDown: [0, -step], ArrowUp: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    const [h, s, v] = latest.current;
    set([h, clamp01(s + d[0]), clamp01(v + d[1])]);
  };

  const [alpha, setAlpha] = React.useState(opacity ?? 1);
  const sentAlpha = React.useRef(new Set<number>([opacity ?? 1]));
  React.useEffect(() => {
    if (opacity !== undefined && !sentAlpha.current.has(opacity)) setAlpha(opacity);
  }, [opacity]);

  const pure = `hsl(${hsv[0]} 100% 50%)`;
  const shown = toHex(hsv);
  const ids = React.useId();

  return (
    <div className="flex w-60 flex-col">
      <div className="p-2 pb-0">
        <div
          ref={area}
          role="slider"
          tabIndex={0}
          aria-label={t('color.area')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hsv[1] * 100)}
          aria-valuetext={t('color.areaValue', { s: Math.round(hsv[1] * 100), v: Math.round(hsv[2] * 100) })}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            e.currentTarget.focus();
            fromPointer(e);
          }}
          onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && fromPointer(e)}
          onKeyDown={onKey}
          className="relative h-44 w-full cursor-crosshair touch-none rounded-[5px] outline-none inset-ring inset-ring-black-100 select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 dark:inset-ring-white-100"
          style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${pure}` }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white-1000 shadow-[0_0_0_1px_rgb(0_0_0/0.2),0_1px_3px_rgb(0_0_0/0.3)]"
            style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`, background: shown }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-2 pt-3 pb-2">
        {EyeDropper && (
          <IconButton
            icon="eyedropper"
            label={t('color.eyedropper')}
            tooltip
            className="shrink-0"
            onClick={async () => {
              try {
                const { sRGBHEXResult } = await new EyeDropper().open();
                set(toHsv(sRGBHEXResult, latest.current[0]));
              } catch { /* cancelled with Escape */ }
            }}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <span id={`${ids}-hue`} className="sr-only">{t('color.hue')}</span>
          <ColorRangeSlider
            value={Math.round(hsv[0])}
            aria-labelledby={`${ids}-hue`}
            onValueChange={(h) => set([h, latest.current[1], latest.current[2]])}
            className="w-full"
          />
          {onOpacity && (
            <>
              <span id={`${ids}-opacity`} className="sr-only">{t('color.opacity')}</span>
              <OpacitySlider
                value={alpha}
                color={shown}
                aria-labelledby={`${ids}-opacity`}
                onValueChange={(a) => {
                  const v = Math.round(a * 100) / 100;
                  setAlpha(v);
                  sentAlpha.current.add(v);
                  onOpacity(v);
                }}
                // Same width and thumb travel as the hue slider above it.
                thumbAlignment="edge"
                className="w-full px-0"
              />
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 px-2 pb-2">
        <InputGroup className="min-w-0 flex-1">
          <ColorInput aria-label="Hex" value={shown.slice(1).toUpperCase()} onValueChange={(v) => {
            const valid = chroma.valid(`#${v}`) ? chroma(`#${v}`).hex().slice(0, 7) : null;
            if (valid) set(toHsv(valid, latest.current[0]));
          }} className="min-w-0 flex-1" />
        </InputGroup>
        {onOpacity && <NumberField k="opacity" min={0} max={100} label={t('color.opacity')} unit="%" className="w-16 shrink-0" />}
      </div>
    </div>
  );
}

// The chit that opens the picker, for use inside an InputGroupAddon.
export function ColorPickerTrigger({ label, ...props }: PickerProps & { label: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={label}
        className={cn('grid size-6 cursor-default place-items-center rounded-sm', C.focus, 'data-popup-open:bg-black-100 dark:data-popup-open:bg-white-100')}
      >
        <ColorChit color={props.hex} opacity={props.opacity === undefined ? undefined : Math.round(props.opacity * 100)} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={8} className="z-50">
          <Popover.Popup
            aria-label={label}
            className={cn('rounded-[13px] shadow-400 outline-none inset-ring inset-ring-black-100 dark:inset-ring-white-100', C.panel, C.text)}
          >
            <PickerBody {...props} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

// Color field: the chit opens the picker; FigUI's hex input beside it. The line
// color also edits the stroke opacity (the label text has none).
export function ColorField({ k, label, id }: { k: 'color' | 'labelColor'; label: string; id?: string }) {
  useStore();
  const hex = normalizeHex(current()[k]) || '#000000';
  const fromPicker = React.useMemo(() => throttle((v: string) => commitHex(k, v), 80), [k]);
  const opacityTo = React.useMemo(() => throttle((a: number) => send('opacity', a), 80), []);
  const line = k === 'color';
  return (
    <InputGroup className="w-full min-w-0">
      <InputGroupAddon>
        <ColorPickerTrigger label={label} hex={hex} onHex={fromPicker}
          {...(line ? { opacity: current().opacity, onOpacity: opacityTo } : {})} />
      </InputGroupAddon>
      <ColorInput id={id} aria-label={label} value={hex.slice(1).toUpperCase()} onValueChange={(v) => commitHex(k, v)} className="min-w-0 flex-1" />
    </InputGroup>
  );
}
