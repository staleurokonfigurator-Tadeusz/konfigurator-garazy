"use client";

import { GarageConfig, RoofType, WallFace, GarageElement, GateType, SheetProfile } from '@/types';
import { Home, Maximize, PaintBucket, Plus, Trash2, BoxSelect, Layers, ChevronDown, Edit2, Settings, Smartphone, Eye } from 'lucide-react';
import { findValidPosition } from '@/lib/collision';
import { v4 as uuidv4 } from 'uuid';
import React, { useMemo, useState, Dispatch, SetStateAction } from 'react';

interface ConfigPanelProps {
  config: GarageConfig;
  setConfig: Dispatch<SetStateAction<GarageConfig>>;
  selectedWall: WallFace;
  setSelectedWall: Dispatch<SetStateAction<WallFace>>;
  appData: any;
  isGeneratingAR?: boolean;
  setIsGeneratingAR?: Dispatch<SetStateAction<boolean>>;
  isReadOnly?: boolean; 
  activeDimId?: string | null;
  setActiveDimId?: Dispatch<SetStateAction<string | null>>;
}

const WOJEWODZTWA = [
  "Dolnośląskie", "Kujawsko-pomorskie", "Lubelskie", "Lubuskie", 
  "Łódzkie", "Małopolskie", "Mazowieckie", "Opolskie", 
  "Podkarpackie", "Podlaskie", "Pomorskie", "Śląskie", 
  "Świętokrzyskie", "Warmińsko-mazurskie", "Wielkopolskie", "Zachodniopomorskie"
];

function Section({ title, icon, children, defaultOpen = true }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-zinc-50 rounded-2xl border border-zinc-100 shadow-sm overflow-hidden mb-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-zinc-100">
        <h2 className="flex items-center gap-2 font-bold text-lg text-zinc-900"><span className="text-[var(--theme)]">{icon}</span>{title}</h2>
        <ChevronDown size={20} className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 border-t border-zinc-200 pt-4">{children}</div>}
    </section>
  );
}

const RoofIcon = ({ type }: { type: RoofType }) => {
  return (
    <svg viewBox="0 0 100 100" className="w-12 h-12 mb-2 text-[var(--theme)] opacity-90 group-hover:scale-110 transition-transform">
      {type === 'dual-slope' && <path d="M50 20 L90 50 L90 80 L10 80 L10 50 Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="6" strokeLinejoin="round"/>}
      {type === 'slope-back' && <path d="M10 30 L90 50 L90 80 L10 80 Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="6" strokeLinejoin="round"/>}
      {type === 'slope-front' && <path d="M10 50 L90 30 L90 80 L10 80 Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="6" strokeLinejoin="round"/>}
      {type === 'slope-left' && <path d="M10 50 L90 20 L90 80 L10 80 Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="6" strokeLinejoin="round"/>}
      {type === 'slope-right' && <path d="M10 20 L90 50 L90 80 L10 80 Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="6" strokeLinejoin="round"/>}
    </svg>
  );
};

export default function ConfigPanel({ config, setConfig, selectedWall, setSelectedWall, appData, isGeneratingAR, setIsGeneratingAR, isReadOnly = false, activeDimId, setActiveDimId }: ConfigPanelProps) {
  const [activeColorEdit, setActiveColorEdit] = useState<string | null>(null);
  const [region, setRegion] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const pricing = appData?.pricing || {};
  const customAddons = appData?.addons || [];
  const dbColors = appData?.colors || [];

  const groupedColors = useMemo(() => {
    const groups: Record<string, any[]> = {};
    dbColors.forEach((c: any) => {
      const groupName = c.type ? c.type.trim() : 'Inne';
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(c);
    });
    return groups;
  }, [dbColors]);

  const getColorData = (id: string) => dbColors.find((c: any) => c.id === id) || { hex: '#d4d4d4', label: 'Brak danych', texture: '' };

  const safeNum = (val: any) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  const calculatedPrice = useMemo(() => {
    let totalBase = 0; 
    let percentBaseMultiplier = 1;
    let totalFinal = 0;
    let percentFinalMultiplier = 1;

    let baseM2Price = config.roofType === 'dual-slope' ? safeNum(pricing.sqm_dual_v) : safeNum(pricing.sqm_single_v);
    
    const baseH = safeNum(appData?.baseConfig?.h) || 210;
    const extraHeight = Math.max(0, config.height - baseH);
    const heightIncrements = Math.floor(extraHeight / 10);
    baseM2Price = baseM2Price * (1 + (heightIncrements * 0.10)); 
    
    const area = (config.width / 100) * (config.length / 100);
    totalBase += area * baseM2Price;

    // NOWE: Wycena Wiaty Zintegrowanej na m2
    if (config.hasCarport && config.carportWidth) {
      const carportArea = (config.carportWidth / 100) * (config.length / 100);
      totalBase += carportArea * safeNum(pricing.integrated_carport_m2_v);
    }

    if (config.gutters) {
      let gutterMeters = 0;
      if (config.roofType === 'dual-slope') gutterMeters = (config.length / 100) * 2; 
      else if (config.roofType === 'slope-back' || config.roofType === 'slope-front') gutterMeters = (config.width / 100); 
      else gutterMeters = (config.length / 100);
      totalBase += gutterMeters * safeNum(pricing.gutter_v);
    }

    config.elements.forEach(el => {
      if (el.type === 'skylight') {
         totalBase += (el.width / 100) * safeNum(pricing.skylight_v);
      }
      if (el.type === 'window' || el.type === 'pvc-window') {
        if (el.width === 80 && el.height === 60) totalBase += safeNum(pricing.win_80x60);
        else if (el.width === 40 && el.height === 180) totalBase += safeNum(pricing.win_40x180);
        else if (el.width === 60 && el.height === 180) totalBase += safeNum(pricing.win_60x180);
      }
      if (el.type === 'gate') {
        if (el.gateType === 'up-and-over') {
          if (el.width === 200) totalBase += safeNum(pricing.gate_up_2x2);
          else if (el.width === 300) totalBase += safeNum(pricing.gate_up_3x2);
          else if (el.width === 400) totalBase += safeNum(pricing.gate_up_4x2);
          else if (el.width === 500) totalBase += safeNum(pricing.gate_up_5x2);
        } else if (el.gateType === 'sectional') {
          if (el.width === 300) totalBase += safeNum(pricing.gate_sec_3x2);
          else if (el.width === 400) totalBase += safeNum(pricing.gate_sec_4x2);
          else if (el.width === 500) totalBase += safeNum(pricing.gate_sec_5x2);
        } else if (el.gateType === 'swing') {
          // NOWE: Bramy dwuskrzydłowe
          if (el.width === 300) totalBase += safeNum(pricing.gate_double_3x2);
          else if (el.width === 400) totalBase += safeNum(pricing.gate_double_4x2);
        }
        
        // NOWE: Dopłata za drzwi w bramie
        if ((el as any).hasDoor) {
          totalBase += safeNum(pricing.door_in_gate_v);
        }
      }
      if (el.type === 'door') {
        if (pricing.door_t === 'fixed') totalBase += safeNum(pricing.door_v);
        else if (pricing.door_t === 'pct_base') percentBaseMultiplier += (safeNum(pricing.door_v)/100);
        else percentFinalMultiplier += (safeNum(pricing.door_v)/100);
      }
    });

    if (config.extraOptions?.includes('roofTile')) {
       totalBase += area * safeNum(pricing.roof_tile_v);
    }

    if (config.extraOptions?.includes('cornerFlashings')) {
        if (pricing.flash_corner_t === 'fixed') totalBase += safeNum(pricing.flash_corner_v);
        else if (pricing.flash_corner_t === 'pct_base') percentBaseMultiplier += (safeNum(pricing.flash_corner_v)/100);
        else percentFinalMultiplier += (safeNum(pricing.flash_corner_v)/100);
    }
    if (config.extraOptions?.includes('roofFlashings')) {
        if (pricing.flash_roof_t === 'fixed') totalBase += safeNum(pricing.flash_roof_v);
        else if (pricing.flash_roof_t === 'pct_base') percentBaseMultiplier += (safeNum(pricing.flash_roof_v)/100);
        else percentFinalMultiplier += (safeNum(pricing.flash_roof_v)/100);
    }

    // Dodane wycenianie nowo przypisanych kolorów (okna i drzwi)
    const activeColors = [
      config.wallColor, config.roofColor, config.gateColor, 
      config.doorColor, config.windowColor, 
      config.cornerFlashingColor, config.roofFlashingColor, config.gutterColor
    ];
    const uniqueColors = Array.from(new Set(activeColors));
    let hasWoodColor = false;

    uniqueColors.forEach(cId => {
       const c = dbColors.find((col: any) => col.id === cId);
       if (c && safeNum(c.price) > 0) totalBase += safeNum(c.price);
       if (c && c.type && c.type.toLowerCase().includes('drewn')) hasWoodColor = true;
    });

    if (hasWoodColor) {
        if (pricing.wood_t === 'fixed') totalBase += safeNum(pricing.wood_v);
        else if (pricing.wood_t === 'pct_base') percentBaseMultiplier += (safeNum(pricing.wood_v)/100);
        else percentFinalMultiplier += (safeNum(pricing.wood_v)/100);
    }

    let customAddonTotal = 0;
    (config.extraOptions || []).forEach(addonId => {
      const addon = customAddons.find((a: any) => a.id === addonId);
      if (addon) {
        if (addon.type === 'fixed') customAddonTotal += safeNum(addon.price);
        else if (addon.type === 'pct' || addon.type === 'pct_total') percentFinalMultiplier += (safeNum(addon.price) / 100);
        else if (addon.type === 'pct_base') percentBaseMultiplier += (safeNum(addon.price) / 100);
        else if (addon.type === 'm2') customAddonTotal += area * safeNum(addon.price);
        else if (addon.type === 'mb') customAddonTotal += ((config.width / 100) + (config.length / 100)) * 2 * safeNum(addon.price);
      }
    });

    totalBase = totalBase * percentBaseMultiplier;
    return Math.round((totalBase + totalFinal) * percentFinalMultiplier + customAddonTotal);
  }, [config, pricing, customAddons, appData, dbColors]);

  const updateConfig = <K extends keyof GarageConfig>(key: K, value: GarageConfig[K]) => {
    if (isReadOnly) return;
    setConfig(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'applyColorToAll' && value === true) {
        next.roofColor = prev.wallColor;
        next.gateColor = prev.wallColor;
        next.doorColor = prev.wallColor;
        next.windowColor = prev.wallColor;
        next.cornerFlashingColor = prev.wallColor;
        next.roofFlashingColor = prev.wallColor;
        next.gutterColor = prev.wallColor;
      }
      return next;
    });
  };

  const handleColorSelect = (colorId: string) => {
    if (!activeColorEdit || isReadOnly) return;
    
    if (config.applyColorToAll) {
      setConfig(prev => ({
        ...prev,
        wallColor: colorId, roofColor: colorId, gateColor: colorId, doorColor: colorId, windowColor: colorId, cornerFlashingColor: colorId, roofFlashingColor: colorId, gutterColor: colorId
      }));
    } else {
      updateConfig(activeColorEdit as keyof GarageConfig, colorId as any);
    }
    setActiveColorEdit(null);
  };

  const addElement = (type: GarageElement['type'], wall: WallFace = selectedWall) => {
    if (isReadOnly) return;
    let width = 80, height = 60; 
    if (type === 'gate') { width = 200; height = 200; }
    if (type === 'door') { width = 100; height = 200; }
    if (type === 'skylight') { width = 100; height = 30; }

    const wallWidth = wall === 'front' || wall === 'back' ? config.width : config.length;
    
    let startX = 0;
    if (wall === 'front' && type !== 'gate') {
      const hasGates = config.elements.some(e => e.wall === 'front' && e.type === 'gate');
      if (hasGates) {
        startX = -(wallWidth / 2) + (width / 2) + 20; 
      }
    }

    const newElement: GarageElement = { 
      id: uuidv4(), 
      type, 
      wall, 
      x: startX, 
      y: type === 'window' || type === 'pvc-window' ? 100 : (type === 'skylight' ? config.height - 40 : 0), 
      width, 
      height, 
      gateType: type === 'gate' ? 'up-and-over' : undefined, 
      clearanceHeight: type === 'gate' ? 190 : undefined, 
      hingeSide: 'left' 
    };

    const validPos = findValidPosition(newElement, config.elements, wallWidth, config.height);
    if (validPos) {
      newElement.x = validPos.x; newElement.y = validPos.y;
      setConfig(prev => ({ ...prev, elements: [...prev.elements, newElement] }));
      setSelectedWall(wall);
    } else { alert("Brak miejsca na tej ścianie!"); }
  };

  const updateElement = (id: string, updates: Partial<GarageElement & {hasDoor?: boolean}>) => {
    if (isReadOnly && !updates.hasOwnProperty('isOpen')) return; 

    setConfig(prev => {
      const newElements = prev.elements.map(el => {
        if (el.id === id) {
          const updated = { ...el, ...updates };
          const wallWidth = updated.wall === 'front' || updated.wall === 'back' ? prev.width : prev.length;
          const pos = findValidPosition(updated, prev.elements, wallWidth, prev.height);
          if (!pos && (updates.x !== undefined || updates.y !== undefined || updates.width !== undefined || updates.height !== undefined)) return el; 
          if (pos && (updates.x !== undefined || updates.y !== undefined)) { if (pos.x !== updated.x || pos.y !== updated.y) return el; }
          return updated as GarageElement;
        }
        return el;
      });
      return { ...prev, elements: newElements };
    });
  };

  const removeElement = (id: string) => {
    if (isReadOnly) return;
    setConfig(prev => ({ ...prev, elements: prev.elements.filter(e => e.id !== id) }));
  }
  
  const gates = config.elements.filter(e => e.type === 'gate');

  const handleCheckout = () => {
    if (isReadOnly) return;
    setIsProcessing(true);

    try {
      let snapshotBase64 = '';
      const canvas = document.querySelector('canvas');
      if (canvas) {
        snapshotBase64 = canvas.toDataURL('image/jpeg', 0.6);
      }

      const configString = JSON.stringify(config);

      if (window.parent !== window) {
        window.parent.postMessage({
          action: 'konfigurator_checkout',
          config: configString, 
          price: calculatedPrice,
          thumbnail: snapshotBase64
        }, '*');
      } else {
        alert('Aplikacja musi być osadzona na stronie sklepu.');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Błąd podczas finalizacji:', error);
      setIsProcessing(false);
    }
  };

  const InlineColorSelector = () => (
    <div className="p-4 bg-zinc-950 border-t border-zinc-800 shadow-inner animate-in slide-in-from-top-2 duration-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {Object.entries(groupedColors).map(([groupName, colors]) => (
          <div key={groupName} className="mb-2">
            <h5 className="font-bold text-xs mb-3 capitalize text-zinc-400 tracking-wider border-b border-zinc-800 pb-1">{groupName}:</h5>
            <div className="grid grid-cols-2 lg:grid-cols-2 gap-2">
              {colors.map((c: any) => (
                <button key={c.id} onClick={() => handleColorSelect(c.id)} className="w-full flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-800 hover:border-[var(--theme)]">
                  {c.texture ? (
                    <div className="w-6 h-6 rounded border border-zinc-600 shadow-sm bg-cover bg-center shrink-0" style={{backgroundImage: `url(${c.texture})`}}></div>
                  ) : (
                    <div className="w-6 h-6 rounded border border-zinc-600 shadow-sm shrink-0" style={{backgroundColor: c.hex}}></div>
                  )}
                  <span className="text-xs font-medium text-left text-zinc-300">
                    {c.label} {safeNum(c.price) > 0 ? <span className="text-[var(--theme)] font-bold block mt-0.5">(+{c.price}zł)</span> : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button onClick={() => setActiveColorEdit(null)} className="text-xs font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors">
          Zamknij panel
        </button>
      </div>
    </div>
  );

  return (
    <div className="pb-12">
      <Section title="Wybierz Typ Garażu" icon={<Home size={20} />}>
        <div className="flex flex-wrap gap-2">
          {([
            { id: 'slope-back',  label: 'Spad w tył' },
            { id: 'dual-slope',  label: 'Dwuspadowy' },
            { id: 'slope-left',  label: 'Spad w lewo' },
            { id: 'slope-right', label: 'Spad w prawo' },
            { id: 'slope-front', label: 'Spad w przód' },
          ] as { id: RoofType; label: string; }[]).map(rt => {
            const active = config.roofType === rt.id;
            return (
              <button
                key={rt.id}
                disabled={isReadOnly}
                onClick={() => updateConfig('roofType', rt.id)}
                className={`flex-1 min-w-[100px] rounded-xl border-2 p-3 flex flex-col items-center justify-center gap-1 transition-all group ${
                  active
                    ? 'border-[var(--theme)] bg-zinc-50 shadow-sm text-[var(--theme)]'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-600'
                } ${isReadOnly ? 'opacity-90 cursor-not-allowed' : ''}`}
              >
                <RoofIcon type={rt.id} />
                <span className="text-xs font-bold text-center leading-tight">{rt.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Wymiary Główne" icon={<Maximize size={20} />}>
        <div className="space-y-6">
        {[{ label: 'Szerokość', key: 'width' as const, min: 200, max: 800, step: 10 }, { label: 'Długość', key: 'length' as const, min: 300, max: 1000, step: 10 }, { label: 'Wysokość', key: 'height' as const, min: 200, max: 350, step: 10 }].map(dim => (
            <div key={dim.key}>
              <div className="flex justify-between mb-2 text-sm font-semibold text-zinc-700"><label>{dim.label}</label><span className="bg-white px-2 py-1 rounded border text-[var(--theme)] font-bold">{config[dim.key]} cm</span></div>
              {!isReadOnly && <input type="range" min={dim.min} max={dim.max} step={dim.step} value={config[dim.key]} onChange={(e) => updateConfig(dim.key, Number(e.target.value))} className="w-full" style={{accentColor: 'var(--theme)'}} />}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Zintegrowana Wiata" icon={<Home size={20} />}>
        <div className="space-y-4">
          <label className={`flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors bg-white shadow-sm ${isReadOnly ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}>
            <span className="text-sm font-semibold text-zinc-700">Dodaj wiatę do garażu</span>
            <input type="checkbox" disabled={isReadOnly} checked={config.hasCarport || false} onChange={(e) => updateConfig('hasCarport', e.target.checked)} className="w-5 h-5 rounded text-[var(--theme)] focus:ring-[var(--theme)] disabled:opacity-50" />
          </label>

          {config.hasCarport && (
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1"><label className="text-xs font-bold uppercase text-zinc-500">Szerokość wiaty (cm)</label><span className="font-bold text-[var(--theme)]">{config.carportWidth || 300}</span></div>
                {!isReadOnly && <input type="range" min={100} max={500} step={10} value={config.carportWidth || 300} onChange={(e) => updateConfig('carportWidth', Number(e.target.value))} className="w-full" style={{accentColor: 'var(--theme)'}} />}
              </div>
              
              <div>
                <label className="text-xs font-bold uppercase text-zinc-500 block mb-2">Strona wiaty</label>
                <div className="flex gap-2">
                  <button disabled={isReadOnly} onClick={() => updateConfig('carportSide', 'left')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${config.carportSide === 'left' ? 'bg-zinc-800 text-white' : 'bg-white border border-zinc-300'} ${isReadOnly ? 'cursor-not-allowed' : ''}`}>Lewa</button>
                  <button disabled={isReadOnly} onClick={() => updateConfig('carportSide', 'right')} className={`flex-1 py-2 text-xs font-bold rounded-lg ${config.carportSide !== 'left' ? 'bg-zinc-800 text-white' : 'bg-white border border-zinc-300'} ${isReadOnly ? 'cursor-not-allowed' : ''}`}>Prawa</button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-zinc-500 block mb-2">Zabudowa ścian (Lamele)</label>
                <div className="grid grid-cols-3 gap-2">
                  {['front', 'side', 'back'].map((wFace) => {
                    const isChecked = config.carportWalls?.[wFace as keyof typeof config.carportWalls] ?? true;
                    return (
                      <label key={wFace} className={`flex justify-center items-center py-2 border rounded-lg text-xs font-bold transition-all ${isChecked ? 'border-[var(--theme)] bg-zinc-100 text-[var(--theme)]' : 'border-zinc-300 bg-white text-zinc-400'} ${isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input type="checkbox" disabled={isReadOnly} className="hidden" checked={isChecked} onChange={(e) => updateConfig('carportWalls' as any, { ...(config.carportWalls || {front: true, side: true, back: true}), [wFace]: e.target.checked })} />
                        {wFace === 'front' ? 'Przód' : wFace === 'back' ? 'Tył' : 'Bok'}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section title="Parametry Bram" icon={<BoxSelect size={20} />}>
        {!isReadOnly && (
          <div className="mb-4 flex justify-between items-center">
            <span className="text-sm font-medium text-zinc-700">Ilość bram (przód)</span>
            <div className="flex gap-2 bg-white rounded-lg border border-zinc-200 p-1">
              <button onClick={() => { if (gates.length === 2) removeElement(gates[1].id); if (gates.length === 0) addElement('gate', 'front'); }} className={`px-3 py-1 rounded-md text-sm ${gates.length === 1 ? 'bg-zinc-100 font-bold text-[var(--theme)]' : ''}`}>1</button>
              <button onClick={() => { if (gates.length < 2) addElement('gate', 'front'); }} className={`px-3 py-1 rounded-md text-sm ${gates.length === 2 ? 'bg-zinc-100 font-bold text-[var(--theme)]' : ''}`}>2</button>
            </div>
          </div>
        )}

        {config.roofType === 'slope-front' && <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">⚠️ Dach spadowy w przód — max. wysokość bramy ograniczona.</div>}

        {gates.map((gate, i) => (
          <div key={gate.id} className={`bg-white p-4 rounded-xl border-2 transition-all shadow-sm mb-3 ${activeDimId === gate.id ? 'border-[var(--theme)]' : 'border-zinc-200'}`}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-zinc-800">Brama #{i+1}</h3>
                <button 
                  onClick={() => { setSelectedWall(gate.wall); setActiveDimId?.(activeDimId === gate.id ? null : gate.id); }} 
                  className={`p-1.5 rounded-lg transition-colors shadow-sm ${activeDimId === gate.id ? 'bg-[var(--theme)] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-[var(--theme)]'}`} 
                  title="Pokaż wymiary na modelu 3D"
                >
                  <Eye size={16} />
                </button>
              </div>
              <select disabled={isReadOnly} value={gate.gateType} onChange={(e) => { 
                const nType = e.target.value as GateType;
                let nWidth = gate.width;
                if (nType === 'sectional' && nWidth < 300) nWidth = 300;
                if (nType === 'swing' && nWidth < 300) nWidth = 300;
                setSelectedWall('front'); 
                updateElement(gate.id, { gateType: nType, width: nWidth, height: 200, isOpen: false, hasDoor: false }); 
              }} className="text-sm border-zinc-300 rounded-lg p-1 bg-zinc-50 text-zinc-900 font-bold disabled:opacity-80">
                <option value="up-and-over">Uchylna</option>
                <option value="sectional">Segmentowa</option>
                <option value="swing">Dwuskrzydłowa</option>
              </select>
            </div>
            
            <div className="space-y-4 mb-3">
            <div className="mb-2">
                <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block">Wymiar Bramy (Wys x Szer)</label>
                <select 
                  disabled={isReadOnly}
                  value={`${gate.width}x${gate.height}`}
                  onChange={(e) => { 
                    const [w, h] = e.target.value.split('x').map(Number); 
                    updateElement(gate.id, { width: w, height: h }); 
                  }}
                  className="w-full border-zinc-300 rounded-lg p-2 text-sm bg-zinc-50 text-zinc-900 font-bold disabled:opacity-80 focus:ring-2 focus:ring-[var(--theme)]"
                >
                  {(() => {
                    const otherGatesWidth = config.elements.filter(e => e.wall === gate.wall && e.id !== gate.id).reduce((sum, e) => sum + e.width + 20, 0);
                    const availableWidth = config.width - otherGatesWidth;
                    
                    if (gate.gateType === 'up-and-over') {
                      return (
                        <>
                          <option value="200x200" disabled={200 + 20 > availableWidth}>Wys: 200 x Szer: 200 cm</option>
                          <option value="300x200" disabled={300 + 20 > availableWidth}>Wys: 200 x Szer: 300 cm</option>
                          <option value="400x200" disabled={400 + 20 > availableWidth}>Wys: 200 x Szer: 400 cm</option>
                          <option value="500x200" disabled={500 + 20 > availableWidth}>Wys: 200 x Szer: 500 cm</option>
                        </>
                      );
                    } else if (gate.gateType === 'swing') {
                      return (
                        <>
                          <option value="300x200" disabled={300 + 20 > availableWidth}>Wys: 200 x Szer: 300 cm</option>
                          <option value="400x200" disabled={400 + 20 > availableWidth}>Wys: 200 x Szer: 400 cm</option>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <option value="300x200" disabled={300 + 20 > availableWidth}>Wys: 200 x Szer: 300 cm</option>
                          <option value="400x200" disabled={400 + 20 > availableWidth}>Wys: 200 x Szer: 400 cm</option>
                          <option value="500x200" disabled={500 + 20 > availableWidth}>Wys: 200 x Szer: 500 cm</option>
                        </>
                      );
                    }
                  })()}
                </select>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase">Przesunięcie w poziomie (cm)</label>
                  <input type="number" disabled={isReadOnly} value={gate.x} onChange={(e) => updateElement(gate.id, { x: Number(e.target.value) })} className="w-16 border border-zinc-300 p-1 rounded text-xs bg-zinc-50 outline-none text-right disabled:opacity-80 disabled:cursor-not-allowed" />
                </div>
                {!isReadOnly && <input type="range" min={-(config.width / 2) + gate.width/2} max={(config.width / 2) - gate.width/2} step={5} value={gate.x} onChange={(e) => updateElement(gate.id, { x: Number(e.target.value) })} className="w-full" style={{accentColor: 'var(--theme)'}} />}
              </div>

              {/* Dodatkowe drzwi w bramie */}
              {(gate.gateType === 'up-and-over' || gate.gateType === 'swing') && (
                <div className="mt-2 pt-2 border-t border-zinc-100">
                  <label className={`flex items-center gap-2 text-xs font-bold text-zinc-600 ${isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                    <input 
                      type="checkbox" 
                      disabled={isReadOnly} 
                      checked={(gate as any).hasDoor || false} 
                      onChange={(e) => updateElement(gate.id, { hasDoor: e.target.checked })} 
                      className="w-4 h-4 rounded text-[var(--theme)] focus:ring-[var(--theme)]" 
                    />
                    Dodatkowe drzwi w bramie (+{safeNum(pricing.door_in_gate_v)} zł)
                  </label>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-100">
              <button
                onClick={() => updateElement(gate.id, { isOpen: !gate.isOpen })}
                className={`w-full py-2 text-sm font-bold rounded-lg transition-all ${
                  gate.isOpen
                    ? 'bg-[var(--theme)] text-white shadow-md'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {gate.isOpen ? '🔓 Zamknij bramę' : '🔑 Otwórz bramę'}
              </button>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Drzwi, Okna i Świetliki" icon={<Layers size={20} />}>
        <div className="mb-4">
          <label className="text-sm font-medium text-zinc-700 block mb-2">Edytuj ścianę:</label>
          <div className="flex gap-2">
            {(['front', 'back', 'left', 'right'] as WallFace[]).map(wall => (
              <button key={wall} onClick={() => setSelectedWall(wall)} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-colors ${selectedWall === wall ? 'bg-zinc-800 text-white' : 'bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-100'}`}>
                {wall === 'front' ? 'Przód' : wall === 'back' ? 'Tył' : wall === 'left' ? 'Lewa' : 'Prawa'}
              </button>
            ))}
          </div>
        </div>
        {!isReadOnly && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            <button onClick={() => addElement('door')} className="flex-none bg-white border border-zinc-300 text-zinc-700 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 hover:border-zinc-400"><Plus size={16} /> Drzwi</button>
            <button onClick={() => addElement('window')} className="flex-none bg-white border border-zinc-300 text-zinc-700 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 hover:border-zinc-400"><Plus size={16} /> Okno</button>
            <button onClick={() => addElement('skylight')} className="flex-none bg-white border border-zinc-300 text-zinc-700 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 hover:border-zinc-400"><Plus size={16} /> Świetlik (mb)</button>
          </div>
        )}
        <div className="space-y-4">
          {config.elements.filter(e => e.wall === selectedWall && e.type !== 'gate').length === 0 ? (
            <div className="text-sm text-zinc-400 text-center py-4 bg-white border border-dashed rounded-lg">Brak elementów na tej ścianie.</div>
          ) : (
            config.elements.filter(e => e.wall === selectedWall && e.type !== 'gate').map((el, idx) => {
              const wallW = el.wall === 'front' || el.wall === 'back' ? config.width : config.length;
              const maxX = Math.max(0, Math.floor(wallW / 2) - Math.floor(el.width / 2));
              const maxY = Math.max(0, config.height - el.height);

              return (
                <div key={el.id} className={`bg-white p-4 rounded-xl border-2 transition-all shadow-sm relative group ${activeDimId === el.id ? 'border-[var(--theme)]' : 'border-zinc-200'}`}>
                  {!isReadOnly && (
                    <button onClick={() => removeElement(el.id)} className="absolute top-4 right-4 text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                  )}
                  
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="font-semibold text-zinc-800 capitalize">{el.type === 'door' ? 'Drzwi' : el.type === 'skylight' ? 'Świetlik (mb)' : 'Okno'} #{idx + 1}</h3>
                    <button 
                      onClick={() => { setSelectedWall(el.wall); setActiveDimId?.(activeDimId === el.id ? null : el.id); }} 
                      className={`p-1.5 rounded-lg transition-colors shadow-sm ${activeDimId === el.id ? 'bg-[var(--theme)] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-[var(--theme)]'}`} 
                      title="Pokaż wymiary na modelu 3D"
                    >
                      <Eye size={16} />
                    </button>
                  </div>

                  <div className="space-y-4">
                  {(el.type === 'window' || el.type === 'pvc-window') ? (
                      <div className="mb-2">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block">Wymiar Okna (Wys x Szer)</label>
                        <select 
                          disabled={isReadOnly}
                          value={`${el.width}x${el.height}`}
                          onChange={(e) => { 
                            const [w, h] = e.target.value.split('x').map(Number); 
                            updateElement(el.id, { width: w, height: h }); 
                          }}
                          className="w-full border-zinc-300 rounded-lg p-2 text-sm bg-zinc-50 text-zinc-900 font-bold disabled:opacity-80 focus:ring-2 focus:ring-[var(--theme)]"
                        >
                          {(() => {
                            const otherElemsWidth = config.elements.filter(e => e.wall === el.wall && e.id !== el.id).reduce((sum, e) => sum + e.width + 20, 0);
                            const availableWidth = wallW - otherElemsWidth;
                            return (
                              <>
                                <option value="80x60" disabled={availableWidth < 80 + 20 || config.height < 60 + 20}>Wys: 60 x Szer: 80 cm</option>
                                <option value="40x180" disabled={availableWidth < 40 + 20 || config.height < 180 + 20}>Wys: 180 x Szer: 40 cm</option>
                                <option value="60x180" disabled={availableWidth < 60 + 20 || config.height < 180 + 20}>Wys: 180 x Szer: 60 cm</option>
                              </>
                            );
                          })()}
                        </select>
                      </div>
                    ) : el.type === 'skylight' ? (
                       <div className="mb-2">
                          <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block">Długość Świetlika (w cm)</label>
                          <input type="number" disabled={isReadOnly} value={el.width} onChange={(e) => updateElement(el.id, { width: Number(e.target.value) })} className="w-full border border-zinc-300 p-2 rounded text-sm bg-zinc-50 outline-none disabled:opacity-80" />
                          <p className="text-[10px] text-zinc-500 mt-1">Szerokość pobierana w metrach bieżących do cennika.</p>
                       </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 mb-2">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] text-zinc-500 font-bold uppercase truncate pr-1">Szer. (cm)</label>
                            <input type="number" disabled={isReadOnly} value={el.width} onChange={(e) => updateElement(el.id, { width: Number(e.target.value) })} className="w-16 border border-zinc-300 p-1 rounded text-xs bg-zinc-50 focus:bg-white focus:border-[var(--theme)] outline-none text-right disabled:opacity-80 disabled:cursor-not-allowed" />
                          </div>
                          {!isReadOnly && <input type="range" min={20} max={wallW} step={5} value={el.width} onChange={(e) => updateElement(el.id, { width: Number(e.target.value) })} className="w-full" style={{accentColor: 'var(--theme)'}} />}
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] text-zinc-500 font-bold uppercase truncate pr-1">Wys. (cm)</label>
                            <input type="number" disabled={isReadOnly} value={el.height} onChange={(e) => updateElement(el.id, { height: Number(e.target.value) })} className="w-16 border border-zinc-300 p-1 rounded text-xs bg-zinc-50 focus:bg-white focus:border-[var(--theme)] outline-none text-right disabled:opacity-80 disabled:cursor-not-allowed" />
                          </div>
                          {!isReadOnly && <input type="range" min={20} max={config.height} step={5} value={el.height} onChange={(e) => updateElement(el.id, { height: Number(e.target.value) })} className="w-full" style={{accentColor: 'var(--theme)'}} />}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 mb-2">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] text-zinc-500 font-bold uppercase truncate pr-1">Przesunięcie w poziomie</label>
                          <input type="number" disabled={isReadOnly} value={el.x} onChange={(e) => updateElement(el.id, { x: Number(e.target.value) })} className="w-16 border border-zinc-300 p-1 rounded text-xs bg-zinc-50 focus:bg-white focus:border-[var(--theme)] outline-none text-right disabled:opacity-80 disabled:cursor-not-allowed" />
                        </div>
                        {!isReadOnly && <input type="range" min={-maxX} max={maxX} step={5} value={el.x} onChange={(e) => updateElement(el.id, { x: Number(e.target.value) })} className="w-full" style={{accentColor: 'var(--theme)'}} />}
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] text-zinc-500 font-bold uppercase truncate pr-1">Wys. od podłoża (cm)</label>
                          <input type="number" disabled={isReadOnly} value={el.y} onChange={(e) => updateElement(el.id, { y: Number(e.target.value) })} className="w-16 border border-zinc-300 p-1 rounded text-xs bg-zinc-50 focus:bg-white focus:border-[var(--theme)] outline-none text-right disabled:opacity-80 disabled:cursor-not-allowed" />
                        </div>
                        {!isReadOnly && <input type="range" min={0} max={maxY} step={5} value={el.y} onChange={(e) => updateElement(el.id, { y: Number(e.target.value) })} className="w-full" style={{accentColor: 'var(--theme)'}} />}
                      </div>
                    </div>

                    {el.type === 'door' && (
                      <div className="mt-2 pt-3 border-t border-zinc-100">
                        <label className="text-xs text-zinc-500 block mb-1">Strona zawiasów</label>
                        <div className="flex gap-2">
                          <button disabled={isReadOnly} onClick={() => updateElement(el.id, { hingeSide: 'left' })} className={`flex-1 py-1.5 text-xs font-semibold rounded ${el.hingeSide === 'left' ? 'bg-[var(--theme)] text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'} ${isReadOnly ? 'cursor-not-allowed' : ''}`}>Lewe</button>
                          <button disabled={isReadOnly} onClick={() => updateElement(el.id, { hingeSide: 'right' })} className={`flex-1 py-1.5 text-xs font-semibold rounded ${el.hingeSide === 'right' ? 'bg-[var(--theme)] text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'} ${isReadOnly ? 'cursor-not-allowed' : ''}`}>Prawe</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Section>

      <Section title="Opcje Dodatkowe" icon={<Settings size={20} />}>
        <div className="space-y-3">
          <label className={`flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors bg-white shadow-sm ${isReadOnly ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}>
            <div className="flex items-center gap-3">
              <input type="checkbox" disabled={isReadOnly} checked={config.extraOptions?.includes('roofTile')} onChange={(e) => { const next = e.target.checked ? [...(config.extraOptions || []), 'roofTile'] : (config.extraOptions || []).filter(x => x !== 'roofTile'); updateConfig('extraOptions' as any, next); }} className="w-5 h-5 rounded border-zinc-300 text-[var(--theme)] focus:ring-[var(--theme)] disabled:opacity-50" />
              <span className="text-sm font-semibold text-zinc-700">Dach: Blachodachówka</span>
            </div>
            <span className="text-xs font-bold text-[var(--theme)] bg-[var(--theme)]/10 px-2 py-1 rounded">
              +{Math.round((config.width / 100) * (config.length / 100) * safeNum(pricing.roof_tile_v))} zł
            </span>
          </label>

          <label className={`flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors bg-white shadow-sm ${isReadOnly ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}>
            <div className="flex items-center gap-3">
              <input type="checkbox" disabled={isReadOnly} checked={config.gutters} onChange={(e) => updateConfig('gutters', e.target.checked)} className="w-5 h-5 rounded border-zinc-300 text-[var(--theme)] focus:ring-[var(--theme)] disabled:opacity-50" />
              <span className="text-sm font-semibold text-zinc-700">Rynny i rury spustowe</span>
            </div>
            <span className="text-xs font-bold text-[var(--theme)] bg-[var(--theme)]/10 px-2 py-1 rounded">
              +{Math.round((config.roofType === 'dual-slope' ? (config.length / 100) * 2 : (config.roofType === 'slope-back' || config.roofType === 'slope-front' ? (config.width / 100) : (config.length / 100))) * safeNum(pricing.gutter_v))} zł
            </span>
          </label>

          <label className={`flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors bg-white shadow-sm ${isReadOnly ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}>
            <div className="flex items-center gap-3">
              <input type="checkbox" disabled={isReadOnly} checked={config.extraOptions?.includes('cornerFlashings')} onChange={(e) => { const next = e.target.checked ? [...(config.extraOptions || []), 'cornerFlashings'] : (config.extraOptions || []).filter(x => x !== 'cornerFlashings'); updateConfig('extraOptions' as any, next); }} className="w-5 h-5 rounded border-zinc-300 text-[var(--theme)] focus:ring-[var(--theme)] disabled:opacity-50" />
              <span className="text-sm font-semibold text-zinc-700">Obróbki narożne ściany</span>
            </div>
            <span className="text-xs font-bold text-zinc-500 bg-zinc-100 px-2 py-1 rounded">
              {pricing.flash_corner_t === 'pct' ? `+${safeNum(pricing.flash_corner_v)}%` : `+${safeNum(pricing.flash_corner_v)} zł`}
            </span>
          </label>

          <label className={`flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors bg-white shadow-sm ${isReadOnly ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}>
            <div className="flex items-center gap-3">
              <input type="checkbox" disabled={isReadOnly} checked={config.extraOptions?.includes('roofFlashings')} onChange={(e) => { const next = e.target.checked ? [...(config.extraOptions || []), 'roofFlashings'] : (config.extraOptions || []).filter(x => x !== 'roofFlashings'); updateConfig('extraOptions' as any, next); }} className="w-5 h-5 rounded border-zinc-300 text-[var(--theme)] focus:ring-[var(--theme)] disabled:opacity-50" />
              <span className="text-sm font-semibold text-zinc-700">Obróbki krawędzi dachu</span>
            </div>
            <span className="text-xs font-bold text-zinc-500 bg-zinc-100 px-2 py-1 rounded">
              {pricing.flash_roof_t === 'pct' ? `+${safeNum(pricing.flash_roof_v)}%` : `+${safeNum(pricing.flash_roof_v)} zł`}
            </span>
          </label>

          {customAddons.map((opt: any) => {
            const isActive = (config.extraOptions || []).includes(opt.id);
            let priceLabel = `+${safeNum(opt.price)} zł`;
            if (opt.type === 'pct' || opt.type === 'pct_total' || opt.type === 'pct_base') priceLabel = `+${safeNum(opt.price)}%`;
            else if (opt.type === 'm2') priceLabel = `+${safeNum(opt.price)} zł / m²`;
            else if (opt.type === 'mb') priceLabel = `+${safeNum(opt.price)} zł / mb`;

            return (
              <label key={opt.id} className={`flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors bg-white shadow-sm ${isReadOnly ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" disabled={isReadOnly} checked={isActive} onChange={(e) => { const next = e.target.checked ? [...(config.extraOptions || []), opt.id] : (config.extraOptions || []).filter(x => x !== opt.id); updateConfig('extraOptions' as any, next); }} className="w-5 h-5 rounded border-zinc-300 text-[var(--theme)] focus:ring-[var(--theme)] disabled:opacity-50" />
                  <span className="text-sm font-semibold text-zinc-700">{opt.label}</span>
                </div>
                <span className="text-xs font-bold text-zinc-500 bg-zinc-100 px-2 py-1 rounded">{priceLabel}</span>
              </label>
            );
          })}
        </div>
      </Section>

      <Section title="Kolory Garażu i Przetłoczenia" icon={<PaintBucket size={20} />}>
        <div className="mb-6">
          <h3 className="font-bold text-sm mb-3 uppercase tracking-wider text-zinc-500">Wzór Przetłoczenia Ścian</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'pionowe-t7', label: 'Pionowe T-7', lines: '|||||||||||' },
              { id: 'poziome-t7', label: 'Poziome T-7', lines: '========' },
              { id: 'pionowe-t14', label: 'Pionowe T-14', lines: '| | | | |' },
              { id: 'poziome-t14', label: 'Poziome T-14', lines: '= = = =' },
              { id: 'pionowe-t17', label: 'Pionowe T-17 (mini rąbek)', lines: '|  |  |  |' },
              { id: 'poziome-t17', label: 'Poziome T-17', lines: '=  =  =  =' },
            ].map(prof => (
              <button 
                key={prof.id} 
                disabled={isReadOnly}
                onClick={() => updateConfig('wallProfile', prof.id as SheetProfile)}
                className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${config.wallProfile === prof.id ? 'border-[var(--theme)] bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300 bg-white'} ${isReadOnly ? 'opacity-90 cursor-not-allowed' : ''}`}
              >
                <div className="w-12 h-10 border-t-2 border-l-2 border-r-2 border-zinc-800 flex items-center justify-center overflow-hidden relative bg-white">
                  <div className="absolute inset-0 opacity-20 text-[8px] font-mono flex items-center justify-center tracking-tighter">
                    {prof.lines}
                  </div>
                </div>
                <span className="text-xs font-semibold text-zinc-700">{prof.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 text-white rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 flex items-center justify-between border-b border-zinc-800">
            <h3 className="font-bold tracking-widest flex items-center gap-2"><PaintBucket size={16}/> KOLORY GARAŻU</h3>
          </div>
          <div className="p-2 flex flex-col">
            {[
              { label: 'Kolor ścian', key: 'wallColor' },
              { label: 'Kolor dachu', key: 'roofColor' },
              { label: 'Brama', key: 'gateColor' },
              { label: 'Kolor drzwi', key: 'doorColor' },
              { label: 'Kolor okien', key: 'windowColor' },
              { label: 'Kolor rynien', key: 'gutterColor' },
              { label: 'Obróbki narożne', key: 'cornerFlashingColor' },
              { label: 'Obróbki dachu', key: 'roofFlashingColor' },
            ].map((item) => {
              const colorData = getColorData(config[item.key as keyof GarageConfig] as string);
              const isEditingThis = activeColorEdit === item.key;
              
              return (
                <React.Fragment key={item.key}>
                  <div className={`flex items-center justify-between p-3 rounded-lg transition-colors ${isEditingThis ? 'bg-zinc-800' : 'hover:bg-zinc-800'}`}>
                    <span className="text-sm font-medium text-zinc-300">{item.label}:</span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {colorData.texture ? (
                          <div className="w-8 h-8 rounded bg-cover bg-center border border-zinc-600 shadow-md" style={{backgroundImage: `url(${colorData.texture})`}}></div>
                        ) : (
                          <div className="w-8 h-8 rounded border border-zinc-600 shadow-md" style={{backgroundColor: colorData.hex}}></div>
                        )}
                        <span className="text-xs font-bold w-24 leading-tight">{colorData.label}</span>
                      </div>
                      {!isReadOnly && (
                        <button 
                          onClick={() => setActiveColorEdit(isEditingThis ? null : item.key)}
                          className={`p-2 rounded bg-zinc-800 border transition-colors ${isEditingThis ? 'border-[var(--theme)] text-[var(--theme)]' : 'border-zinc-700 hover:border-zinc-500'}`}
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {isEditingThis && !isReadOnly && <InlineColorSelector />}
                </React.Fragment>
              );
            })}
            
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-800 transition-colors border-t border-zinc-800 mt-2">
              <span className="text-sm font-medium text-zinc-300">Ściągnięcie folii:</span>
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold w-24 text-right text-zinc-400">{config.removeFoil ? 'Tak' : 'Nie'}</span>
                {!isReadOnly && (
                  <button onClick={() => updateConfig('removeFoil', !config.removeFoil)} className="p-2 rounded bg-zinc-800 border border-zinc-700 hover:border-[var(--theme)] hover:text-[var(--theme)] transition-colors"><Edit2 size={14} /></button>
                )}
              </div>
            </div>
          </div>
          
          {!isReadOnly && (
            <div className="p-4 border-t border-zinc-800 bg-zinc-950">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={config.applyColorToAll} onChange={(e) => updateConfig('applyColorToAll', e.target.checked)} className="w-5 h-5 rounded border-zinc-700 bg-zinc-800 text-[var(--theme)]" />
                <span className="text-sm font-medium text-zinc-300">Użyj koloru dla wszystkich elementów</span>
              </label>
            </div>
          )}
        </div>
      </Section>
      
      <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl text-white">
        {!isReadOnly && (
          <div className="flex flex-col gap-2 mb-4">
            <label className="text-sm font-semibold text-zinc-300">Województwo <span className="text-red-500">*</span></label>
            <select 
              value={region} 
              onChange={(e) => setRegion(e.target.value)} 
              className="p-3 rounded-lg text-zinc-900 bg-white border-none outline-none font-medium focus:ring-2" 
              style={{accentColor: 'var(--theme)'}} 
              required 
            >
              <option value="" disabled>Wybierz z listy...</option>
              {WOJEWODZTWA.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        )}
        <div className={`flex justify-between items-end mb-6 ${isReadOnly ? 'pb-0 border-none' : 'pb-4 border-b border-zinc-700'}`}>
          <span className="text-zinc-400 font-medium">Cena całkowita:</span>
          <span className="text-3xl font-extrabold text-[var(--theme)]">{calculatedPrice} zł</span>
        </div>
        
        <button 
          onClick={() => setIsGeneratingAR && setIsGeneratingAR(true)} 
          disabled={isGeneratingAR}
          className="w-full flex items-center justify-center gap-2 font-bold py-3 px-6 rounded-xl text-zinc-900 bg-zinc-100 hover:bg-zinc-200 transition-all shadow-sm mb-3 disabled:opacity-50"
        >
          <Smartphone size={18} /> {isGeneratingAR ? 'Generowanie pakietu...' : 'Zobacz Garaż w AR (Na żywo)'}
        </button>

        {!isReadOnly && (
          <button 
            onClick={handleCheckout} 
            disabled={isProcessing}
            className="w-full font-bold py-4 px-6 rounded-xl text-lg uppercase transition-all shadow-md bg-[var(--theme)] hover:opacity-90 text-white cursor-pointer disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {isProcessing ? 'Przekierowywanie do kasy...' : 'Kupuję i płacę'}
          </button>
        )}
      </div>
    </div>
  );
}