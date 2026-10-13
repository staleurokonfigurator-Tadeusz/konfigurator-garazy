"use client";

import { GarageConfig, RoofType, WallFace } from '@/types';
import { Home, Maximize, PaintBucket, Settings, Edit2, ChevronDown, DoorOpen } from 'lucide-react';
import { useMemo, useState, Dispatch, SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ConfigPanelProps {
  config: GarageConfig;
  setConfig: Dispatch<SetStateAction<GarageConfig>>;
  appData: any;
  selectedWall: WallFace;
  setSelectedWall: Dispatch<SetStateAction<WallFace>>;
  isGeneratingAR?: boolean;
  setIsGeneratingAR?: Dispatch<SetStateAction<boolean>>;
}

function Section({ title, icon, children, defaultOpen = true }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-zinc-50 rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-zinc-100">
        <h2 className="flex items-center gap-2 font-bold text-lg text-zinc-900"><span className="text-[var(--theme)]">{icon}</span>{title}</h2>
        <ChevronDown size={20} className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 border-t border-zinc-200 pt-4">{children}</div>}
    </section>
  );
}

export default function TrashConfigPanel({ config, setConfig, appData, selectedWall, setSelectedWall }: ConfigPanelProps) {
  const [activeColorEdit, setActiveColorEdit] = useState<string | null>(null);
  
  const pricing = appData.pricing || {};
  const dbColors = appData.colors || [];

  const matColors = dbColors.filter((c: any) => c.type === 'mat');
  const gladkieColors = dbColors.filter((c: any) => c.type === 'gladkie');
  const drewnoColors = dbColors.filter((c: any) => c.type === 'drewno');

  const getColorData = (id: string) => dbColors.find((c: any) => c.id === id) || { hex: '#d4d4d4', label: 'Wybierz', texture: '' };

  const calculatedPrice = useMemo(() => {
    let total = Number(appData.baseConfig?.p) || 0; 
    let percentMultiplier = 1;
    
    const baseArea = (Number(appData.baseConfig?.w) / 100) * (Number(appData.baseConfig?.l) / 100);
    const currentArea = (Number(config.width) / 100) * (Number(config.length) / 100);
    const extraArea = Math.max(0, currentArea - baseArea); 
    
    if (extraArea > 0 && pricing.sqm_v) {
      if (pricing.sqm_t === 'fixed') total += (extraArea * Number(pricing.sqm_v));
      else percentMultiplier += (extraArea * Number(pricing.sqm_v) / 100);
    }

    return Math.round(total * percentMultiplier);
  }, [config, pricing, appData]);

  const updateConfig = <K extends keyof GarageConfig>(key: K, value: GarageConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleColorSelect = (colorId: string) => {
    if (activeColorEdit) {
      updateConfig(activeColorEdit as keyof GarageConfig, colorId as any);
      setActiveColorEdit(null);
    }
  };

  const addElement = (type: 'gate' | 'door') => {
    const id = uuidv4();
    let defaultWidth = type === 'gate' ? 200 : 100;
    let defaultHeight = 200;
    setConfig(prev => ({
      ...prev,
      elements: [...prev.elements, {
        id, type, wall: selectedWall, x: 0, y: 0,
        width: defaultWidth, height: defaultHeight,
        clearanceHeight: defaultHeight - 10,
        hingeSide: 'left'
      }]
    }));
  };

  const updateElement = (id: string, updates: any) => {
    setConfig(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === id ? { ...el, ...updates } : el)
    }));
  };

  const removeElement = (id: string) => {
    setConfig(prev => ({ ...prev, elements: prev.elements.filter(el => el.id !== id) }));
  };

  const ColorSelectionModal = () => (
    <div className="mt-4 p-4 bg-white border-2 border-zinc-200 rounded-xl shadow-inner">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h4 className="font-bold text-zinc-900">Wybierz kolor</h4>
        <button onClick={() => setActiveColorEdit(null)} className="text-zinc-400 hover:text-red-500 font-bold">✕ Zamknij</button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h5 className="font-bold text-sm mb-3">Matowe:</h5>
          <div className="space-y-2">
            {matColors.map((c: any) => (
              <button key={c.id} onClick={() => handleColorSelect(c.id)} className="w-full flex items-center gap-3 p-1.5 hover:bg-zinc-100 rounded-lg transition-colors">
                <div className="w-8 h-8 rounded border shadow-sm" style={{backgroundColor: c.hex}}></div>
                <span className="text-xs font-medium text-left">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h5 className="font-bold text-sm mb-3">Gładkie:</h5>
          <div className="space-y-2">
            {gladkieColors.map((c: any) => (
              <button key={c.id} onClick={() => handleColorSelect(c.id)} className="w-full flex items-center gap-3 p-1.5 hover:bg-zinc-100 rounded-lg transition-colors">
                <div className="w-8 h-8 rounded border shadow-sm" style={{backgroundColor: c.hex}}></div>
                <span className="text-xs font-medium text-left">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {drewnoColors.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h5 className="font-bold text-sm mb-3">Drewnopodobne:</h5>
          <div className="grid grid-cols-2 gap-2">
            {drewnoColors.map((c: any) => (
              <button key={c.id} onClick={() => handleColorSelect(c.id)} className="flex items-center gap-3 p-1.5 hover:bg-zinc-100 rounded-lg transition-colors">
                {c.texture ? (
                  <div className="w-8 h-8 rounded border shadow-sm bg-cover bg-center" style={{backgroundImage: `url(${c.texture})`}}></div>
                ) : (
                  <div className="w-8 h-8 rounded border shadow-sm" style={{backgroundColor: c.hex}}></div>
                )}
                <span className="text-xs font-medium text-left">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 pb-12">
      <Section title="Wybierz Typ Dachu Wiaty" icon={<Home size={20} />}>
        <div className="flex flex-wrap gap-2">
          {([
            { id: 'slope-back',  label: 'Spad w tył', symbol: '◢' },
            { id: 'dual-slope',  label: 'Dwuspadowy', symbol: '▲' },
            { id: 'slope-left',  label: 'Spad w lewo', symbol: '◤' },
            { id: 'slope-right', label: 'Spad w prawo', symbol: '◥' },
            { id: 'slope-front', label: 'Spad w przód', symbol: '◣' },
          ] as { id: RoofType; label: string; symbol: string }[]).map(rt => {
            const active = config.roofType === rt.id;
            return (
              <button
                key={rt.id}
                onClick={() => updateConfig('roofType', rt.id)}
                className={`flex-1 min-w-[100px] rounded-xl border-2 p-3 flex flex-col items-center justify-center gap-2 transition-all ${
                  active ? 'border-[var(--theme)] bg-zinc-50 shadow-sm text-[var(--theme)]' : 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-600'
                }`}
              >
                <span className="text-2xl">{rt.symbol}</span>
                <span className="text-xs font-bold text-center leading-tight">{rt.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Wymiary Główne" icon={<Maximize size={20} />}>
        <div className="space-y-6">
          {[{ label: 'Szerokość', key: 'width' as const, min: 200, max: 600, step: 1 }, { label: 'Długość', key: 'length' as const, min: 200, max: 800, step: 1 }, { label: 'Wysokość w świetle', key: 'height' as const, min: 200, max: 350, step: 1 }].map(dim => (
            <div key={dim.key}>
              <div className="flex justify-between mb-2 text-sm font-semibold text-zinc-700"><label>{dim.label}</label><span className="bg-white px-2 py-1 rounded border text-[var(--theme)] font-bold">{config[dim.key]} cm</span></div>
              <input type="range" min={dim.min} max={dim.max} step={dim.step} value={config[dim.key]} onChange={(e) => updateConfig(dim.key, Number(e.target.value))} className="w-full" style={{accentColor: 'var(--theme)'}} />
            </div>
          ))}
        </div>
      </Section>
      
      <Section title="Bramy i Drzwi" icon={<DoorOpen size={20} />}>
        <div className="flex bg-zinc-100 p-1 rounded-xl mb-4">
          {([
            { id: 'front', label: 'PRZÓD' },
            { id: 'back', label: 'TYŁ' },
            { id: 'left', label: 'LEWA' },
            { id: 'right', label: 'PRAWA' },
          ] as { id: WallFace; label: string }[]).map(wall => (
            <button key={wall.id} onClick={() => setSelectedWall(wall.id)} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${selectedWall === wall.id ? 'bg-white text-[var(--theme)] shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>{wall.label}</button>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          <button onClick={() => addElement('gate')} className="flex-1 bg-[var(--theme)]/10 text-[var(--theme)] hover:bg-[var(--theme)]/20 py-2.5 rounded-xl font-bold text-sm transition-colors border border-[var(--theme)]/20">+ Brama</button>
          <button onClick={() => addElement('door')} className="flex-1 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 py-2.5 rounded-xl font-bold text-sm transition-colors border border-zinc-200">+ Drzwi</button>
        </div>

        <div className="space-y-4">
          {config.elements.filter(e => e.wall === selectedWall).map(el => (
            <div key={el.id} className="bg-white border-2 border-zinc-200 rounded-xl p-4 shadow-sm relative group">
              <button onClick={() => removeElement(el.id)} className="absolute -top-3 -right-3 bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold shadow-lg hover:bg-red-600 transition-colors z-10 border-2 border-white">✕</button>
              
              <div className="flex items-center gap-3 mb-4 border-b border-zinc-100 pb-3">
                <span className="bg-zinc-100 text-zinc-800 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider">{el.type === 'gate' ? 'Brama' : 'Drzwi'}</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 mb-1 block">Szerokość (cm)</label>
                    <input type="number" value={el.width} onChange={(e) => updateElement(el.id, { width: Number(e.target.value) })} className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm font-semibold focus:border-[var(--theme)] focus:ring-1 focus:ring-[var(--theme)] outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-500 mb-1 block">Pozycja X (cm)</label>
                    <input type="number" value={el.x} onChange={(e) => updateElement(el.id, { x: Number(e.target.value) })} className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm font-semibold focus:border-[var(--theme)] focus:ring-1 focus:ring-[var(--theme)] outline-none transition-all" />
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {config.elements.filter(e => e.wall === selectedWall).length === 0 && (
            <div className="text-center py-6 border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50">
              <p className="text-sm font-medium text-zinc-400">Brak elementów na tej ścianie.</p>
            </div>
          )}
        </div>
      </Section>

      <Section title="Kolory Konstrukcji" icon={<PaintBucket size={20} />}>
        <div className="bg-zinc-900 text-white rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 flex items-center justify-between border-b border-zinc-800">
            <h3 className="font-bold tracking-widest flex items-center gap-2"><PaintBucket size={16}/> ELEMENTY WIATY</h3>
          </div>
          <div className="p-2 space-y-1">
            {[
              { label: 'Kolor lameli ściennych', key: 'wallColor' }, 
              { label: 'Kolor dachu', key: 'roofColor' },
              { label: 'Kolor bram/drzwi', key: 'gateColor' },
            ].map((item) => {
              const colorData = getColorData(config[item.key as keyof GarageConfig] as string);
              return (
                <div key={item.key} className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-800 transition-colors">
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
                    <button 
                      onClick={() => setActiveColorEdit(activeColorEdit === item.key ? null : item.key)}
                      className={`p-2 rounded bg-zinc-800 border transition-colors ${activeColorEdit === item.key ? 'border-[var(--theme)] text-[var(--theme)]' : 'border-zinc-700 hover:border-zinc-500'}`}
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {activeColorEdit && <ColorSelectionModal />}
      </Section>
      
      <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex justify-between items-end mb-6 pb-4 border-b border-zinc-700">
          <span className="text-zinc-400 font-medium">Szacowana Cena:</span>
          <span className="text-3xl font-extrabold text-[var(--theme)]">{calculatedPrice} zł</span>
        </div>
        <button className="w-full font-bold py-4 px-6 rounded-xl text-lg uppercase transition-all shadow-md bg-[var(--theme)] hover:opacity-90 text-white cursor-pointer">
          Wybierz Wiatę Śmietnikową
        </button>
      </div>
    </div>
  );
}
