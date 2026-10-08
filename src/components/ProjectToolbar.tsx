'use client';

import { useState, useEffect, useRef } from 'react';
import type { GarageConfig } from '@/types';
import { parseProjectFile, readSavedProjects, type SavedProject } from '@/lib/projectStorage';

export default function ProjectToolbar({config,storageKey,onLoad,onReset,draftError}: {
  config: GarageConfig; storageKey: string; onLoad: (config: GarageConfig) => void; onReset: () => void; draftError: boolean;
}) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [resetPending, setResetPending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      // Read the browser's project library after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjects(readSavedProjects(window.localStorage, storageKey));
    } catch { setMessage('Zapisywanie w przeglądarce jest niedostępne. Możesz pobrać projekt do pliku.'); }
  }, [storageKey]);

  const makeProject = (): SavedProject => ({version:1,id:crypto.randomUUID(),name:name.trim() || `Garaż ${config.width / 100} × ${config.length / 100} m`,savedAt:new Date().toISOString(),config});
  const save = () => {
    if (projects.length >= 50) { setMessage('Zapisano już 50 projektów. Pobierz kolejny projekt do pliku.'); return; }
    const project = makeProject();
    const next = [project, ...projects];
    try {
      window.localStorage.setItem(storageKey + ':saved', JSON.stringify(next));
      setProjects(next); setSelected(project.id); setMessage('Projekt zapisany w tej przeglądarce.');
    } catch { setMessage('Nie udało się zapisać projektu w przeglądarce. Pobierz go do pliku.'); }
  };
  const download = () => {
    const project = makeProject();
    const url = URL.createObjectURL(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}));
    const link = document.createElement('a'); link.href=url; link.download=`garaz-${config.width}x${config.length}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  return <section className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-zinc-900">
    <h2 className="font-bold">Twój projekt</h2>
    <p className="mt-1 text-xs text-zinc-600">Bieżący projekt wraca po odświeżeniu strony. Nazwane projekty przechowujemy w tej przeglądarce; plik możesz przenieść na inne urządzenie.</p>
    <label className="mt-3 block text-xs font-semibold">Nazwa projektu<input maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Np. Garaż przy domu" className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm" /></label>
    <div className="mt-2 flex flex-wrap gap-2">
      <button onClick={save} className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-bold text-white">Zapisz projekt</button>
      <button onClick={download} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold">Pobierz projekt</button>
      <button onClick={()=>fileInput.current?.click()} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold">Otwórz plik</button>
      <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Plik projektu garażu" className="hidden" onChange={async e=>{
        const input=e.currentTarget; const file=input.files?.[0]; if(!file)return;
        try {
          if(file.size>250000)throw new Error('Plik projektu jest zbyt duży.');
          const project=parseProjectFile(await file.text()); onLoad(project.config);setName(project.name);setMessage('Wczytano projekt z pliku.');
        } catch {setMessage('Nie udało się wczytać pliku. Wybierz plik JSON zapisany przez konfigurator.');} finally {input.value='';}
      }} />
    </div>
    {projects.length>0 && <div className="mt-3 flex items-end gap-2"><label className="min-w-0 flex-1 text-xs font-semibold">Zapisane projekty<select value={selected} onChange={e=>setSelected(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm"><option value="">Wybierz projekt...</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label><button disabled={!selected} onClick={()=>{const project=projects.find(p=>p.id===selected);if(project){onLoad(project.config);setName(project.name);setMessage('Wczytano zapisany projekt.');}}} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">Wczytaj</button></div>}
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {resetPending ? <><span className="text-xs">Zresetować bieżący projekt? Zapisane projekty pozostaną.</span><button onClick={()=>{onReset();setResetPending(false);setName('');setSelected('');setMessage('Przywrócono ustawienia początkowe.');}} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white">Potwierdź reset</button><button onClick={()=>setResetPending(false)} className="text-xs underline">Anuluj</button></> : <button onClick={()=>setResetPending(true)} className="text-xs font-semibold text-zinc-600 underline">Resetuj projekt</button>}
    </div>
    {(message || draftError) && <p role="status" className="mt-2 text-xs">{draftError ? 'Automatyczny zapis jest niedostępny. Pobierz projekt do pliku, aby go zachować.' : message}</p>}
  </section>;
}
