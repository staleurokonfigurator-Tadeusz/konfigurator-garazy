"use client";

import { GarageConfig, WallFace } from '@/types';
import { Maximize, PaintBucket, Edit2, ChevronDown, Layers } from 'lucide-react';
import { useMemo, useState, Dispatch, SetStateAction } from 'react';

interface ConfigPanelProps {
  config: GarageConfig;
  setConfig: Dispatch<SetStateAction<GarageConfig>>;
  appData: any;
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

export default function PergolaConfigPanel({ config, setConfig, appData }: ConfigPanelProps) {
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

    const mods = config.modulesCount || 1;
    if (mods > 1) {
       total += (mods - 1) * 1500; // Przykładowa stała cena za dodatkowy moduł
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

  const modules = config.modulesCount || 1;

  return (
    <div className="space-y-4 pb-12">
      <Section title="Konfiguracja Modułów" icon={<Layers size={20} />}>
        <div className="mb-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-zinc-700">Ilość modułów (Sektorów)</span>
            <div className="flex gap-2 bg-white rounded-lg border border-zinc-200 p-1">
              {[1, 2, 3, 4].map(num => (
                <button 
                  key={num}
                  onClick={() => updateConfig('modulesCount', num)} 
                  className={`px-4 py-2 rounded-md text-sm transition-colors ${modules === num ? 'bg-[var(--theme)] font-bold text-white shadow-md' : 'hover:bg-zinc-100'}`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">Pergola zostanie podzielona na wybraną ilość równych sektorów wzdłuż swojej długości.</p>
        </div>
      </Section>

      <Section title="Wymiary Główne" icon={<Maximize size={20} />}>
        <div className="space-y-6">
          {[{ label: 'Głębokość (Szerokość)', key: 'width' as const, min: 200, max: 600, step: 1 }, { label: 'Długość Całkowita', key: 'length' as const, min: 200, max: 1200, step: 1 }, { label: 'Wysokość (Prześwit)', key: 'height' as const, min: 200, max: 350, step: 1 }].map(dim => (
            <div key={dim.key}>
              <div className="flex justify-between mb-2 text-sm font-semibold text-zinc-700"><label>{dim.label}</label><span className="bg-white px-2 py-1 rounded border text-[var(--theme)] font-bold">{config[dim.key]} cm</span></div>
              <input type="range" min={dim.min} max={dim.max} step={dim.step} value={config[dim.key]} onChange={(e) => updateConfig(dim.key, Number(e.target.value))} className="w-full" style={{accentColor: 'var(--theme)'}} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Kolory i Wykończenie" icon={<PaintBucket size={20} />}>
        <div className="bg-zinc-900 text-white rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 flex items-center justify-between border-b border-zinc-800">
            <h3 className="font-bold tracking-widest flex items-center gap-2"><PaintBucket size={16}/> ELEMENTY PERGOLI</h3>
          </div>
          <div className="p-2 space-y-1">
            {[
              { label: 'Konstrukcja (Słupy)', key: 'wallColor' }, // wallColor used for structure
              { label: 'Lamele (Żaluzje dachowe)', key: 'roofColor' }, // roofColor used for lamellas
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
          Wybierz Pergolę
        </button>
      </div>
    </div>
  );
}
