"use client";

import { useState } from 'react';
import { FileDown, X } from 'lucide-react';
import type { GarageConfig, WallFace } from '@/types';
import { generateOfferPdf, type OfferCustomer } from '@/lib/offerPdf';
import { createOfferInWordPress } from '@/lib/wordpressBridge';

interface OfferDialogProps {
  config: GarageConfig;
  estimatedPrice: number;
  colors: Array<{ id: string; label?: string }>;
  selectedWall: WallFace;
  setSelectedWall: (wall: WallFace) => void;
  onClose: () => void;
  storeUrl?: string;
  requestARExport?: () => Promise<Blob>;
}

const EMPTY_CUSTOMER: OfferCustomer = {
  brand: 'gardhouse', name: '', company: '', email: '', phone: '', address: '', notes: '', validDays: 14, arUrl: '',
};

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

export default function OfferDialog({ config, estimatedPrice, colors, selectedWall, setSelectedWall, onClose, storeUrl, requestARExport }: OfferDialogProps) {
  const [customer, setCustomer] = useState<OfferCustomer>(EMPTY_CUSTOMER);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const updateCustomer = <K extends keyof OfferCustomer>(key: K, value: OfferCustomer[K]) => {
    setCustomer(previous => ({ ...previous, [key]: value }));
  };

  const captureViews = async () => {
    const views: Partial<Record<WallFace, string>> = {};
    const walls: WallFace[] = ['front', 'right', 'back', 'left'];
    for (const wall of walls) {
      setSelectedWall(wall);
      await wait(900);
      const canvas = document.querySelector('canvas');
      if (canvas) views[wall] = canvas.toDataURL('image/jpeg', 0.82);
    }
    setSelectedWall(selectedWall);
    return views;
  };

  const handleGenerate = async () => {
    setError('');
    if (!customer.name.trim()) {
      setError('Podaj imię i nazwisko klienta lub osoby kontaktowej.');
      return;
    }
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      setError('Adres e-mail ma nieprawidłowy format.');
      return;
    }
    setGenerating(true);
    try {
      // Starsze lub rozpoczęte wcześniej konfiguracje mogły mieć włączoną wiatę,
      // ale bez zapisanej szerokości, mimo że model 3D pokazywał domyślne 300 cm.
      // Ujednolicamy migawkę przed zapisem w WordPressie i przed rysowaniem PDF.
      const offerConfig: GarageConfig = config.hasCarport
        ? {
            ...config,
            carportWidth: config.carportWidth || 300,
            carportSide: config.carportSide || 'right',
          }
        : config;
      const views = await captureViews();
      if (!requestARExport) throw new Error('Eksporter modelu AR jest niedostępny.');
      const arModel = await requestARExport();
      const colorLabels = Object.fromEntries(colors.map(color => [color.id, color.label || color.id]));
      const wordpressOffer = await createOfferInWordPress({ config: offerConfig, customer, estimatedPrice, storeUrl, arModel });
      const finalCustomer = {
        ...customer,
        // QR zawsze wskazuje model GLB zapisany dla tej konkretnej oferty.
        arUrl: wordpressOffer.publicUrl,
      };
      await generateOfferPdf({
        offerNumber: wordpressOffer.offerNumber,
        customer: finalCustomer,
        config: offerConfig,
        estimatedPrice: wordpressOffer.verifiedPrice,
        colorLabels,
        views,
        priceVerified: true,
      });
    } catch (pdfError) {
      console.error(pdfError);
      setError(pdfError instanceof Error ? pdfError.message : 'Nie udało się utworzyć oferty. Spróbuj ponownie.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000000] bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white text-zinc-900 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-6 py-5 backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Panel ofertowy</p>
            <h2 className="mt-1 text-2xl font-black">Przygotuj ofertę PDF</h2>
          </div>
          <button onClick={onClose} disabled={generating} className="rounded-full p-2 hover:bg-zinc-100 disabled:opacity-50" aria-label="Zamknij">
            <X size={22} />
          </button>
        </header>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <label className="text-sm font-bold md:col-span-2">Marka na ofercie
            <select value={customer.brand} onChange={event => updateCustomer('brand', event.target.value as OfferCustomer['brand'])} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal outline-none focus:border-orange-500">
              <option value="gardhouse">Gardhouse</option>
              <option value="staleuro">StalEuro</option>
            </select>
          </label>
          <label className="text-sm font-bold">Klient / osoba kontaktowa
            <input maxLength={120} value={customer.name} onChange={event => updateCustomer('name', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 font-normal outline-none focus:border-orange-500" />
          </label>
          <label className="text-sm font-bold">Firma (opcjonalnie)
            <input maxLength={120} value={customer.company} onChange={event => updateCustomer('company', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 font-normal outline-none focus:border-orange-500" />
          </label>
          <label className="text-sm font-bold">E-mail
            <input type="email" maxLength={160} value={customer.email} onChange={event => updateCustomer('email', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 font-normal outline-none focus:border-orange-500" />
          </label>
          <label className="text-sm font-bold">Telefon
            <input maxLength={40} value={customer.phone} onChange={event => updateCustomer('phone', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 font-normal outline-none focus:border-orange-500" />
          </label>
          <label className="text-sm font-bold md:col-span-2">Adres
            <input maxLength={240} value={customer.address} onChange={event => updateCustomer('address', event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 font-normal outline-none focus:border-orange-500" />
          </label>
          <label className="text-sm font-bold">Ważność oferty
            <select value={customer.validDays} onChange={event => updateCustomer('validDays', Number(event.target.value))} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal outline-none focus:border-orange-500">
              <option value={7}>7 dni</option><option value={14}>14 dni</option><option value={30}>30 dni</option>
            </select>
          </label>
          <label className="text-sm font-bold md:col-span-2">Uwagi do oferty
            <textarea maxLength={1200} rows={4} value={customer.notes} onChange={event => updateCustomer('notes', event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-zinc-300 px-4 py-3 font-normal outline-none focus:border-orange-500" />
          </label>
        </div>

        {error && <p className="mx-6 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}

        <footer className="mt-6 flex flex-col gap-3 border-t border-zinc-200 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div><span className="text-sm text-zinc-500">Numer oferty</span><p className="font-bold">zostanie nadany przez WordPress</p></div>
          <button onClick={handleGenerate} disabled={generating} className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 font-black text-white shadow-lg hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60">
            <FileDown size={20} /> {generating ? 'Tworzę widoki i PDF…' : 'Generuj ofertę PDF'}
          </button>
        </footer>
      </div>
    </div>
  );
}


