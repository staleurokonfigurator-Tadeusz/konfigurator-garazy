"use client";

import dynamic from 'next/dynamic';
import { ChevronDown, DoorOpen, Edit2, Eye, FileDown, Home, Maximize, PaintBucket, Trash2 } from 'lucide-react';
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { GarageConfig, GarageElement, GateType, RoofType, SheetProfile, WallFace } from '@/types';
import EditableDimension from './EditableDimension';
import { updateGarageElement } from '@/lib/garageOptions';
import { getTrashPanelBands, getTrashPanelColor, getTrashPanelPatternSettings, getTrashWallPanelHeightCm, setTrashPanelColor } from '@/lib/trashPanels';

const OfferDialog = dynamic(() => import('./OfferDialog'), { ssr: false });

interface ConfigPanelProps {
  config: GarageConfig;
  setConfig: Dispatch<SetStateAction<GarageConfig>>;
  appData: {
    colors?: ColorOption[];
    addons?: Array<{ id: string; label?: string }>;
    trashConfig?: { p?: number };
    baseConfig?: { p?: number };
    storeUrl?: string;
  };
  selectedWall: WallFace;
  setSelectedWall: Dispatch<SetStateAction<WallFace>>;
  isOfferMode?: boolean;
  storeUrl?: string;
  requestARExport?: () => Promise<Blob>;
  onCaptureViewsChange?: (capturing: boolean) => void;
  activeDimId?: string | null;
  setActiveDimId?: Dispatch<SetStateAction<string | null>>;
}

type ColorTarget =
  | { kind: 'config'; key: 'wallColor' | 'roofColor' | 'gateColor' | 'doorColor' }
  | { kind: 'panel'; wall: WallFace; index: number }
  | { kind: 'panels'; wall: WallFace; indexes: number[] };

interface ColorOption { id: string; label?: string; type?: string; hex?: string; texture?: string }

const faceNames: Record<WallFace, string> = { front: 'przedniej', back: 'tylnej', left: 'lewej', right: 'prawej' };

function Section({ title, icon, children, defaultOpen = true }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm">
    <button type="button" onClick={() => setOpen(value => !value)} className="flex w-full items-center justify-between p-5 text-left hover:bg-zinc-100">
      <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900"><span className="text-[var(--theme)]">{icon}</span>{title}</h2>
      <ChevronDown size={20} className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="border-t border-zinc-200 px-5 pb-5 pt-4">{children}</div>}
  </section>;
}

export default function TrashConfigPanel({ config, setConfig, appData, selectedWall, setSelectedWall, isOfferMode = false, storeUrl, requestARExport, onCaptureViewsChange, activeDimId, setActiveDimId }: ConfigPanelProps) {
  const [colorTarget, setColorTarget] = useState<ColorTarget | null>(null);
  const [elementError, setElementError] = useState('');
  const [offerOpen, setOfferOpen] = useState(false);
  const [selectedPanels, setSelectedPanels] = useState<number[]>([]);
  const colors: ColorOption[] = appData.colors || [];
  const normalizedType = (value: unknown) => String(value || '').trim().toLowerCase();
  const isWoodColor = (color: ColorOption) => normalizedType(color.type).includes('drew') || Boolean(color.texture);
  const colorGroups = [
    { title: 'Drewnopodobne', items: colors.filter(isWoodColor) },
    { title: 'Matowe', items: colors.filter(color => !isWoodColor(color) && normalizedType(color.type).includes('mat')) },
    { title: 'Połysk i gładkie', items: colors.filter(color => !isWoodColor(color) && !normalizedType(color.type).includes('mat')) },
  ].filter(group => group.items.length);
  const getColor = (id: string) => colors.find(color => color.id === id) || { id, hex: id.startsWith('#') ? id : '#d4d4d4', label: id || 'Wybierz', texture: '' };
  const pattern = 'wide' as const;
  const patternSettings = getTrashPanelPatternSettings(pattern);
  const panelWallHeight = getTrashWallPanelHeightCm({ height: config.height, roofType: config.roofType }, selectedWall);
  const panelBands = useMemo(() => getTrashPanelBands(panelWallHeight, pattern), [panelWallHeight, pattern]);
  const estimatedPrice = Math.round(Number(appData.trashConfig?.p ?? appData.baseConfig?.p) || 0);

  const updateConfig = <K extends keyof GarageConfig>(key: K, value: GarageConfig[K]) => setConfig(previous => ({ ...previous, [key]: value }));
  const selectColor = (colorId: string) => {
    if (!colorTarget) return;
    if (colorTarget.kind === 'config') updateConfig(colorTarget.key, colorId);
    else if (colorTarget.kind === 'panel') setConfig(previous => setTrashPanelColor(previous, colorTarget.wall, colorTarget.index, colorId));
    else setConfig(previous => colorTarget.indexes.reduce((next, index) => setTrashPanelColor(next, colorTarget.wall, index, colorId), previous));
    if (colorTarget.kind === 'panels') setSelectedPanels([]);
    setColorTarget(null);
  };

  const addElement = (type: 'gate' | 'door') => {
    const element: GarageElement = {
      id: uuidv4(), type, wall: selectedWall, x: 0, y: 0,
      width: type === 'gate' ? 200 : 100, height: 200,
      clearanceHeight: 190, hingeSide: 'left', gateType: type === 'gate' ? 'swing' : undefined,
      profile: 'poziome-t7', isOpen: false,
    };
    setConfig(previous => ({ ...previous, elements: [...previous.elements, element] }));
    setActiveDimId?.(element.id);
  };
  const updateElement = (id: string, updates: Partial<GarageElement>) => {
    setConfig(previous => {
      const next = updateGarageElement(previous, id, updates);
      if (!next) { setElementError('Ten wymiar lub położenie nachodzi na inny otwór albo wykracza poza ścianę.'); return previous; }
      setElementError('');
      return next;
    });
  };
  const removeElement = (id: string) => setConfig(previous => ({ ...previous, elements: previous.elements.filter(element => element.id !== id) }));

  return <div className="space-y-4 pb-12">
    <Section title="Typ dachu wiaty" icon={<Home size={20} />}>
      <div className="grid grid-cols-2 gap-3">
        {([
          ['slope-back', 'Spad w tył', '▱'], ['dual-slope', 'Dwuspadowy', '⌂'],
          ['slope-left', 'Spad w lewo', '◩'], ['slope-right', 'Spad w prawo', '◪'],
          ['slope-front', 'Spad w przód', '▰'],
        ] as [RoofType, string, string][]).map(([id, label, symbol]) => <button type="button" key={id} onClick={() => updateConfig('roofType', id)} className={`rounded-xl border-2 p-3 text-center transition ${config.roofType === id ? 'border-[var(--theme)] bg-white text-[var(--theme)]' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'}`}>
          <span className="block text-2xl leading-none">{symbol}</span><span className="mt-2 block text-xs font-bold">{label}</span>
        </button>)}
      </div>
    </Section>

    <Section title="Wymiary główne" icon={<Maximize size={20} />}>
      <p className="mb-4 rounded-xl bg-orange-50 px-4 py-3 text-xs text-orange-900">Kliknij wartość z ołówkiem, aby wpisać dokładny wymiar ręcznie.</p>
      <div className="space-y-5">
        {[
          { label: 'Szerokość', key: 'width' as const, min: 150, max: 1200 },
          { label: 'Długość', key: 'length' as const, min: 150, max: 1200 },
          { label: 'Wysokość niższej ściany', key: 'height' as const, min: 180, max: 450 },
        ].map(dimension => <div key={dimension.key}>
          <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-zinc-700"><label>{dimension.label}</label><EditableDimension label={dimension.label} value={config[dimension.key]} min={dimension.min} max={dimension.max} onChange={value => updateConfig(dimension.key, value)} /></div>
          <input type="range" min={dimension.min} max={dimension.max} value={config[dimension.key]} onChange={event => updateConfig(dimension.key, Number(event.target.value))} className="w-full" style={{ accentColor: 'var(--theme)' }} />
        </div>)}
      </div>
    </Section>

    <Section title="Układ paneli" icon={<PaintBucket size={20} />}>
      <div className="rounded-xl border-2 border-[var(--theme)] bg-white p-4 text-zinc-900">
        <div className="mb-3 flex h-16 flex-col justify-end overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 px-2 pb-2">
          {Array.from({ length: 4 }, (_, index) => <span key={index} className="block h-[9px] shrink-0 rounded-[2px] bg-amber-600" style={{ marginTop: index === 0 ? 0 : 3 }} />)}
        </div>
        <strong className="block text-sm">Panele poziome 24 cm</strong>
        <span className="mt-1 block text-xs leading-relaxed text-zinc-600">Stały prześwit 3 cm. Liczba pełnych paneli jest automatycznie obliczana z wysokości wybranej ściany.</span>
        <span className="mt-3 inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-800">{panelBands.length} paneli na tej ścianie</span>
      </div>
    </Section>

    <Section title="Bramy i drzwi" icon={<DoorOpen size={20} />}>
      <div className="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-zinc-100 p-1">
        {(['front', 'back', 'left', 'right'] as WallFace[]).map(wall => <button type="button" key={wall} onClick={() => { setSelectedWall(wall); setSelectedPanels([]); }} className={`rounded-lg py-2 text-[10px] font-black ${selectedWall === wall ? 'bg-white text-[var(--theme)] shadow-sm' : 'text-zinc-500'}`}>{wall === 'front' ? 'PRZÓD' : wall === 'back' ? 'TYŁ' : wall === 'left' ? 'LEWA' : 'PRAWA'}</button>)}
      </div>
      <div className="mb-5 flex gap-2"><button type="button" onClick={() => addElement('gate')} className="flex-1 rounded-xl border border-orange-200 bg-orange-50 py-2.5 text-sm font-bold text-[var(--theme)]">+ Brama</button><button type="button" onClick={() => addElement('door')} className="flex-1 rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-bold">+ Drzwi</button></div>
      {elementError && <p className="mb-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{elementError}</p>}
      <div className="space-y-4">
        {config.elements.filter(element => element.wall === selectedWall).map((element, index) => {
          const wallWidth = element.wall === 'front' || element.wall === 'back' ? config.width : config.length;
          const left = Math.round(wallWidth / 2 + element.x - element.width / 2);
          const right = Math.max(0, Math.round(wallWidth - left - element.width));
          return <div key={element.id} className={`rounded-xl border-2 bg-white p-4 ${activeDimId === element.id ? 'border-[var(--theme)]' : 'border-zinc-200'}`}>
            <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><strong className="text-sm">{element.type === 'gate' ? 'Brama' : 'Drzwi'} #{index + 1}</strong><button type="button" onClick={() => setActiveDimId?.(activeDimId === element.id ? null : element.id)} className="rounded-lg bg-zinc-100 p-1.5"><Eye size={15} /></button></div><button type="button" onClick={() => removeElement(element.id)} className="rounded-lg bg-red-50 p-1.5 text-red-500"><Trash2 size={16} /></button></div>
            {element.type === 'gate' && <div className="mb-3 grid grid-cols-2 gap-3"><label className="text-xs font-bold text-zinc-500">Typ bramy<select value={element.gateType || 'swing'} onChange={event => updateElement(element.id, { gateType: event.target.value as GateType })} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-2 text-zinc-900"><option value="swing">Dwuskrzydłowa</option><option value="up-and-over">Uchylna</option><option value="sectional">Segmentowa</option></select></label><label className="text-xs font-bold text-zinc-500">Przetłoczenie<select value={element.profile || 'poziome-t7'} onChange={event => updateElement(element.id, { profile: event.target.value as SheetProfile })} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-2 text-zinc-900"><option value="poziome-t7">Poziome T-7</option><option value="poziome-t14">Poziome T-14</option><option value="poziome-t17">Poziome T-17</option><option value="pionowe-t7">Pionowe T-7</option></select></label></div>}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Szerokość', value: element.width, min: 50, max: wallWidth, update: (value: number) => updateElement(element.id, { width: value }) },
                { label: 'Wysokość', value: element.height, min: 80, max: config.height, update: (value: number) => updateElement(element.id, { height: value }) },
                { label: 'Od lewej krawędzi', value: left, min: 0, max: Math.max(0, wallWidth - element.width), update: (value: number) => updateElement(element.id, { x: value - wallWidth / 2 + element.width / 2 }) },
                { label: 'Od posadzki', value: element.y, min: 0, max: Math.max(0, config.height - element.height), update: (value: number) => updateElement(element.id, { y: value }) },
              ].map(field => <label key={field.label} className="text-[10px] font-bold uppercase text-zinc-500">{field.label} (cm)<input type="number" value={field.value} min={field.min} max={field.max} onChange={event => field.update(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-900" /></label>)}
            </div>
            <p className="mt-2 text-[10px] text-zinc-500">Do prawej krawędzi: <strong>{right} cm</strong></p>
            <div className="mt-3 flex gap-2 border-t border-zinc-100 pt-3"><button type="button" onClick={() => updateElement(element.id, { hingeSide: 'left' })} className={`flex-1 rounded-lg py-2 text-xs font-bold ${element.hingeSide !== 'right' ? 'bg-[var(--theme)] text-white' : 'bg-zinc-100'}`}>Zawiasy lewe</button><button type="button" onClick={() => updateElement(element.id, { hingeSide: 'right' })} className={`flex-1 rounded-lg py-2 text-xs font-bold ${element.hingeSide === 'right' ? 'bg-[var(--theme)] text-white' : 'bg-zinc-100'}`}>Zawiasy prawe</button></div>
          </div>;
        })}
        {!config.elements.some(element => element.wall === selectedWall) && <div className="rounded-xl border-2 border-dashed border-zinc-200 py-7 text-center text-sm text-zinc-400">Brak elementów na tej ścianie.</div>}
      </div>
    </Section>

    <Section title="Kolory konstrukcji i paneli" icon={<PaintBucket size={20} />}>
      <div className="overflow-hidden rounded-xl bg-zinc-900 text-white">
        {([
          ['Kolor domyślny paneli', 'wallColor'], ['Kolor dachu', 'roofColor'], ['Kolor bram', 'gateColor'], ['Kolor drzwi', 'doorColor'],
        ] as const).map(([label, key]) => {
          const color = getColor(config[key]);
          return <button type="button" key={key} onClick={() => setColorTarget({ kind: 'config', key })} className="flex w-full items-center justify-between border-b border-zinc-800 p-3 text-left hover:bg-zinc-800"><span className="text-sm text-zinc-300">{label}</span><span className="flex items-center gap-2"><span className="h-8 w-8 rounded border border-zinc-600 bg-cover bg-center" style={color.texture ? { backgroundImage: `url(${color.texture})` } : { backgroundColor: color.hex }} /><strong className="max-w-28 text-xs">{color.label}</strong><Edit2 size={14} /></span></button>;
        })}
      </div>
      <div className="mt-5 flex items-start justify-between gap-3 text-zinc-900"><div className="min-w-0"><h3 className="font-bold text-zinc-900">Panele ściany {faceNames[selectedWall]}</h3><p className="mt-1 text-xs leading-relaxed text-zinc-600">{panelBands.length} paneli · prześwit {patternSettings.gapCm} cm. Kliknij karty, aby zmienić kolor kilku paneli naraz.</p></div><button type="button" onClick={() => { setConfig(previous => ({ ...previous, trashPanelColors: { ...(previous.trashPanelColors || {}), [selectedWall]: [] } })); setSelectedPanels([]); }} className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-700 shadow-sm hover:border-zinc-400">Resetuj</button></div>
      <div className="mt-3 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 p-2 text-zinc-900">
        <button type="button" onClick={() => setSelectedPanels(selectedPanels.length === panelBands.length ? [] : panelBands.map(band => band.index))} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-800 shadow-sm hover:border-zinc-400">{selectedPanels.length === panelBands.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}</button>
        {selectedPanels.length > 0 && <><span className="text-xs font-semibold text-zinc-600">Zaznaczono: {selectedPanels.length}</span><button type="button" onClick={() => setColorTarget({ kind: 'panels', wall: selectedWall, indexes: selectedPanels })} className="ml-auto rounded-lg bg-[var(--theme)] px-3 py-2 text-xs font-black text-white">Zmień kolor zaznaczonych</button></>}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-2">
        {panelBands.map(band => { const color = getColor(getTrashPanelColor(config, selectedWall, band.index)); const selected = selectedPanels.includes(band.index); return <div key={band.index} className={`flex min-h-[70px] items-center gap-2 rounded-xl border-2 bg-white p-2.5 text-zinc-900 shadow-sm transition ${selected ? 'border-[var(--theme)] ring-2 ring-[var(--theme)]/10' : 'border-zinc-200 hover:border-zinc-300'}`}><button type="button" aria-pressed={selected} onClick={() => setSelectedPanels(previous => previous.includes(band.index) ? previous.filter(index => index !== band.index) : [...previous, band.index])} className="flex min-w-0 flex-1 items-center gap-3 text-left text-zinc-900"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-xs font-black ${selected ? 'border-[var(--theme)] bg-[var(--theme)] text-white' : 'border-zinc-300 bg-white text-transparent'}`}>✓</span><span className="h-11 w-11 shrink-0 rounded-lg border border-zinc-300 bg-cover bg-center shadow-inner" style={color.texture ? { backgroundImage: `url(${color.texture})` } : { backgroundColor: color.hex }} /><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-zinc-900">Panel {String(band.index + 1).padStart(2, '0')}</span><span className="block truncate text-xs font-medium text-zinc-600">{color.label}</span><span className="mt-0.5 block text-[10px] text-zinc-400">wys. {Math.round(band.heightCm)} cm</span></span></button><button type="button" aria-label={`Zmień kolor panelu ${band.index + 1}`} title="Zmień tylko ten panel" onClick={() => setColorTarget({ kind: 'panel', wall: selectedWall, index: band.index })} className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-zinc-600 hover:border-[var(--theme)] hover:bg-white hover:text-[var(--theme)]"><Edit2 size={15} /></button></div>; })}
      </div>
      {colorTarget && <div className="mt-4 rounded-xl border-2 border-zinc-200 bg-white p-4 text-zinc-900 shadow-inner"><div className="mb-3 flex items-center justify-between gap-3"><div><strong className="text-zinc-900">Wybierz kolor</strong>{colorTarget.kind === 'panels' && <p className="text-xs font-normal text-zinc-500">Kolor zostanie zastosowany do {colorTarget.indexes.length} zaznaczonych paneli.</p>}</div><button type="button" onClick={() => setColorTarget(null)} className="shrink-0 text-sm font-semibold text-zinc-500 hover:text-zinc-900">Zamknij ✕</button></div><div className="space-y-4">{colorGroups.map(group => <div key={group.title}><h4 className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-500">{group.title}</h4><div className="grid grid-cols-2 gap-2 xl:grid-cols-3">{group.items.map(color => <button type="button" key={color.id} onClick={() => selectColor(color.id)} className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2 text-left text-zinc-900 hover:border-[var(--theme)]"><span className="h-8 w-8 shrink-0 rounded border bg-cover bg-center" style={color.texture ? { backgroundImage: `url(${color.texture})` } : { backgroundColor: color.hex }} /><span className="truncate text-xs font-bold text-zinc-800">{color.label}</span></button>)}</div></div>)}</div></div>}
    </Section>

    <div className="rounded-2xl bg-zinc-900 p-6 text-white shadow-xl"><div className="mb-5 flex items-end justify-between border-b border-zinc-700 pb-4"><span className="text-sm text-zinc-400">Cena orientacyjna</span><strong className="text-3xl text-[var(--theme)]">{estimatedPrice.toLocaleString('pl-PL')} zł</strong></div>{isOfferMode ? <button type="button" onClick={() => setOfferOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--theme)] py-4 text-lg font-black uppercase"><FileDown size={20} /> Przygotuj ofertę</button> : <button type="button" className="w-full rounded-xl bg-[var(--theme)] py-4 text-lg font-black uppercase">Wybierz wiatę śmietnikową</button>}</div>

    {offerOpen && <OfferDialog productType="trash" config={{ ...config, productType: 'trash' }} estimatedPrice={estimatedPrice} colors={colors} addons={appData.addons || []} selectedWall={selectedWall} setSelectedWall={setSelectedWall} onClose={() => setOfferOpen(false)} storeUrl={storeUrl || appData.storeUrl} requestARExport={requestARExport} onCaptureViewsChange={onCaptureViewsChange} />}
  </div>;
}
