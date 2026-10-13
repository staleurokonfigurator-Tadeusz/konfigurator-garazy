"use client";

import type { Dispatch, SetStateAction } from 'react';
import type { GarageConfig } from '@/types';
import { getAssemblyLayout, standaloneUnit, hasSharedAssemblyRoof } from '@/lib/garageAssembly';
import EditableDimension from './EditableDimension';

interface Props {
  config: GarageConfig; setConfig: Dispatch<SetStateAction<GarageConfig>>;
  enabled: boolean; activeGarage: 0 | 1; onSelect: (index: 0 | 1) => void; isReadOnly: boolean;
}
export default function AssemblyPanel({config,setConfig,activeGarage,onSelect,isReadOnly,enabled: enabledFeature}: Props) {
  const layout = getAssemblyLayout(config);
  const toggle = (enabled: boolean) => {
    setConfig(previous => {
      if (Boolean(previous.assembly) === enabled) return previous;
      if (!enabled) return {...standaloneUnit(previous),hasCarport:true,carportSide:previous.hasCarport ? previous.carportSide : 'right'};
      const first = standaloneUnit(previous,'left');
      const second = {...standaloneUnit(previous,'right'),hasCarport:false,
        elements:previous.elements.map(element => ({...element,id:crypto.randomUUID()}))};
      return {...first,assembly:{second,gapWidth:300}};
    });
    onSelect(0);
  };
  const setGap = (gapWidth: number) => setConfig(previous => previous.assembly ? {...previous,assembly:{...previous.assembly,gapWidth}} : previous);
  return <section className="mb-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-sm">
    <div className="bg-zinc-900 p-4 sm:p-5 text-white">
      <p className="text-xs font-bold uppercase tracking-widest text-orange-300">Zaplanuj swoją przestrzeń</p>
      <h2 className="mt-1 text-xl font-bold">Układ zabudowy</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">Jeden garaż lub dwa niezależne garaże połączone wiatą. Dopasuj każdy z nich do swoich potrzeb.</p>
    </div>
    <div className="space-y-4 p-3 sm:p-5">
      {!enabledFeature && <p className="text-sm text-zinc-600">Opcja dwóch garaży jest obecnie wyłączona w ustawieniach sprzedawcy. Zapisany układ możesz oglądać lub zmienić na jeden garaż.</p>}
      <div className="grid grid-cols-2 gap-3">
        {[false,true].map(enabled => <button key={String(enabled)} disabled={isReadOnly || (enabled && !enabledFeature)} aria-pressed={Boolean(config.assembly)===enabled} onClick={()=>toggle(enabled)} className={`min-h-28 rounded-xl border-2 p-3 text-left ${Boolean(config.assembly)===enabled ? 'border-[var(--theme)] bg-orange-50' : 'border-zinc-200 bg-zinc-50'}`}>
          <div aria-hidden="true" className="mb-3 flex h-8 items-end justify-center gap-1">
            <span className="h-8 w-8 rounded-t-md border-2 border-zinc-700 bg-zinc-200" />
            {enabled && <><span className="h-6 w-7 border-t-4 border-zinc-700 border-x-2"/><span className="h-8 w-8 rounded-t-md border-2 border-zinc-700 bg-zinc-200"/></>}
          </div>
          <span className="block text-sm font-bold">{enabled ? 'Dwa garaże + wiata' : 'Jeden garaż'}</span>
        </button>)}
      </div>
      {config.assembly && <>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
          <div className="mb-3 flex items-center justify-between gap-2 text-sm font-bold"><span>Wiata pomiędzy garażami</span><EditableDimension label="Wiata środkowa — szerokość" value={layout.gap} min={200} max={600} readOnly={isReadOnly} onChange={setGap}/></div>
          {!isReadOnly && <input aria-label="Wiata środkowa — szerokość" type="range" min={200} max={600} step={1} value={layout.gap} onChange={event=>setGap(Number(event.target.value))} className="w-full" />}
          <p className="mt-2 text-xs leading-relaxed text-zinc-600">Długość: {layout.middleLength} cm, według krótszego garażu. {hasSharedAssemblyRoof(config) ? 'Wysokość dopasowana do wspólnego dachu.' : 'Wysokość dopasowana do niższego garażu.'} Cena według obecnej stawki za m² wiaty.</p>
        </div>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Wybierz garaż do ustawienia">
          {([0,1] as const).map(index=><button key={index} aria-pressed={activeGarage===index} onClick={()=>onSelect(index)} className={`min-h-12 rounded-xl border p-3 text-sm font-bold ${activeGarage===index ? 'bg-zinc-900 text-white border-zinc-900':'bg-white border-zinc-300'}`}>Garaż {index+1} · {index ? 'prawy':'lewy'}</button>)}
        </div>
        <p className="text-sm text-zinc-600">Poniżej ustawiasz <strong>garaż {activeGarage+1}</strong>. Cena obejmuje cały układ.</p>
        <p className="text-xs text-zinc-500">Łączna szerokość: {layout.width} cm. Fronty garaży są ustawione w jednej linii. {hasSharedAssemblyRoof(config) ? 'Jeden wspólny dach i wysokość okapu nad całym układem. Wykończenie dachu wybierasz przy garażu 1.' : 'Wiata środkowa ma taki sam typ dachu jak garaże.'}</p>
      </>}
    </div>
  </section>;
}
