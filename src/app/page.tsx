"use client";

import React, { useState, UIEvent, useEffect, useRef, useCallback } from 'react';
import { GarageConfig, WallFace } from '@/types';
import ConfigPanel from '@/components/ConfigPanel';
import CarportConfigPanel from '@/components/CarportConfigPanel';
import PergolaConfigPanel from '@/components/PergolaConfigPanel';
import TrashConfigPanel from '@/components/TrashConfigPanel';
import { v4 as uuidv4 } from 'uuid';
import dynamic from 'next/dynamic';
import { Eye, X } from 'lucide-react';
import Script from 'next/script';

const ModelViewer = 'model-viewer' as any;

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center h-full w-full bg-zinc-900 text-[var(--theme,orange)]">
    <div className="w-12 h-12 border-4 border-current border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Wczytywanie środowiska 3D...</p>
  </div>
);

const CanvasArea = dynamic(() => import('@/components/CanvasArea'), { ssr: false, loading: LoadingFallback });
const CarportCanvasArea = dynamic(() => import('@/components/CarportCanvasArea'), { ssr: false, loading: LoadingFallback });
const PergolaCanvasArea = dynamic(() => import('@/components/PergolaCanvasArea'), { ssr: false, loading: LoadingFallback });
const TrashCanvasArea = dynamic(() => import('@/components/TrashCanvasArea'), { ssr: false, loading: LoadingFallback });

const DEFAULT_RAL_9006_ID = 'ral-9006';

const findRal9006Id = (colors: Array<{ id?: string; label?: string }> = []) => {
  const ral9006 = colors.find(color => `${color.id || ''} ${color.label || ''}`.toLowerCase().includes('9006'));
  return ral9006?.id || DEFAULT_RAL_9006_ID;
};

const applyDefaultRal9006 = (config: GarageConfig, colorId: string): GarageConfig => ({
  ...config,
  wallColor: colorId,
  roofColor: colorId,
  gateColor: colorId,
  doorColor: colorId,
  windowColor: colorId,
  cornerFlashingColor: colorId,
  roofFlashingColor: colorId,
  gutterColor: colorId,
  carportBaseColor: colorId,
  carportInsertColor: colorId,
});

const INITIAL_CONFIG: GarageConfig = {
  width: 300, length: 500, height: 210,
  roofType: 'dual-slope', gutters: false,
  elements: [{ id: uuidv4(), type: 'gate', wall: 'front', x: 0, y: 0, width: 250, height: 200, clearanceHeight: 190, gateType: 'up-and-over', hingeSide: 'left', profile: 'pionowe-t7' }],
  applyColorToAll: false,
  removeFoil: false,
  roofColor: DEFAULT_RAL_9006_ID, roofProfile: 'pionowe-t7',
  wallColor: DEFAULT_RAL_9006_ID, wallProfile: 'pionowe-t7',
  gateColor: DEFAULT_RAL_9006_ID, gateProfile: 'pionowe-t7',
  doorColor: DEFAULT_RAL_9006_ID, doorProfile: 'pionowe-t7',
  cornerFlashingColor: DEFAULT_RAL_9006_ID,
  roofFlashingColor: DEFAULT_RAL_9006_ID,
  gutterColor: DEFAULT_RAL_9006_ID,
  windowColor: DEFAULT_RAL_9006_ID,
  carportBaseColor: DEFAULT_RAL_9006_ID,
  carportInsertColor: DEFAULT_RAL_9006_ID,
};

const FALLBACK_DATA = {
  storeUrl: "https://gard-house.pl", themeColor: "#ea580c",
  baseConfig: { w: 300, l: 500, h: 210, p: 5000 },
  pricing: { 
    sqm_t: 'fixed', sqm_v: 150, door_t: 'fixed', door_v: 500, window_t: 'fixed', window_v: 300, skylight_t: 'fixed', skylight_v: 150, 
    wood_t: 'pct', wood_v: 15, gutter_t: 'pct', gutter_v: 5, flash_corner_t: 'fixed', flash_corner_v: 100, flash_roof_t: 'fixed', flash_roof_v: 100
  },
  addons: [], colors: []
};

const CONFIG_STEPS = [
  { id: 1, label: 'Dach' },
  { id: 2, label: 'Wymiary' },
  { id: 3, label: 'Bramy i Okna' },
  { id: 4, label: 'Opcje i Kolory' }
];

export default function Home() {
  const [config, setConfig] = useState<GarageConfig>(INITIAL_CONFIG);
  const [appData, setAppData] = useState<any>(null);
  const [selectedWall, setSelectedWall] = useState<WallFace>('front');
  const [activeStep, setActiveStep] = useState(1);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [activeDimId, setActiveDimId] = useState<string | null>(null);
  const [wpAdminUrl, setWpAdminUrl] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [isOfferMode, setIsOfferMode] = useState(false);

  const [isGeneratingAR, setIsGeneratingAR] = useState<boolean>(false);
  const [arBlobUrl, setArBlobUrl] = useState<string | null>(null);
  const offerExportRef = useRef<{ resolve: (blob: Blob) => void; reject: (error: Error) => void } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const initDataRaw = params.get('init_data');
    const savedConfigBase64 = params.get('load_config');
    const storeUrl = params.get('store_url');
    // Stan zależy od parametrów strony osadzającej i musi zostać odczytany po hydracji.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOfferMode(params.get('offer_mode') === '1');

    if (storeUrl) {
      const decodedStoreUrl = decodeURIComponent(storeUrl).replace(/\/$/, "");
      setStoreUrl(decodedStoreUrl);
      setWpAdminUrl(`${decodedStoreUrl}/wp-admin/admin.php?page=garage-orders`);
    }

    if (initDataRaw) {
      try {
        const decodedJson = decodeURIComponent(escape(window.atob(decodeURIComponent(initDataRaw))));
        const payload = JSON.parse(decodedJson);
        setAppData(payload);
        if (!savedConfigBase64) {
          const ral9006Id = findRal9006Id(payload.colors);
          setConfig(prev => applyDefaultRal9006({
            ...prev,
            width: payload.baseConfig.w,
            length: payload.baseConfig.l,
            height: payload.baseConfig.h,
          }, ral9006Id));
        }
      } catch (e: any) { setAppData(FALLBACK_DATA); }
    } else if (!savedConfigBase64) {
      setAppData(FALLBACK_DATA);
    }

    if (savedConfigBase64) {
      try {
        const decodedJson = decodeURIComponent(escape(window.atob(decodeURIComponent(savedConfigBase64))));
        const parsedConfig = JSON.parse(decodedJson);
        
        setConfig(parsedConfig);
        setIsReadOnly(true);
      } catch (e) { 
        console.error("Błąd dekodowania BIM:", e); 
      }
    }
  }, []); 

  useEffect(() => () => {
    if (arBlobUrl) URL.revokeObjectURL(arBlobUrl);
  }, [arBlobUrl]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollableHeight = target.scrollHeight - target.clientHeight;
    if (scrollableHeight <= 0) return;
    const scrollPercentage = target.scrollTop / scrollableHeight;
    if (scrollPercentage < 0.20) setActiveStep(1);
    else if (scrollPercentage < 0.45) setActiveStep(2);
    else if (scrollPercentage < 0.70) setActiveStep(3);
    else setActiveStep(4);
  };

  const handleExportAR = useCallback((url: string) => {
    setIsGeneratingAR(false);
    if (offerExportRef.current) {
      const pending = offerExportRef.current;
      offerExportRef.current = null;
      if (!url) {
        pending.reject(new Error('Nie udało się wyeksportować modelu AR.'));
        return;
      }
      fetch(url)
        .then(response => response.blob())
        .then(blob => pending.resolve(blob))
        .catch(() => pending.reject(new Error('Nie udało się odczytać modelu AR.')))
        .finally(() => URL.revokeObjectURL(url));
      return;
    }
    if (url) {
      setArBlobUrl(previousUrl => {
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return url;
      });
    } else {
      alert("Wystąpił błąd podczas przygotowywania modelu AR. Odśwież stronę i spróbuj ponownie.");
    }
  }, []);

  const requestOfferARExport = useCallback(() => new Promise<Blob>((resolve, reject) => {
    if (offerExportRef.current) {
      reject(new Error('Eksport modelu AR jest już uruchomiony.'));
      return;
    }
    offerExportRef.current = { resolve, reject };
    setIsGeneratingAR(true);
    window.setTimeout(() => {
      if (!offerExportRef.current) return;
      offerExportRef.current = null;
      setIsGeneratingAR(false);
      reject(new Error('Eksport modelu AR przekroczył limit czasu.'));
    }, 45_000);
  }), []);

  if (!appData) return <div className="flex h-screen items-center justify-center bg-zinc-900"><div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full"></div></div>;

  return (
    <>
      {arBlobUrl && <Script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js" strategy="afterInteractive" />}

      {arBlobUrl && (
        <div className="fixed inset-0 z-[999999] bg-zinc-900 flex flex-col">
          <button onClick={() => setArBlobUrl(null)} className="absolute top-6 right-6 z-10 bg-white p-3 rounded-full shadow-lg hover:bg-zinc-200 transition-colors">
            <X size={24} className="text-zinc-900" />
          </button>
          <ModelViewer
            src={arBlobUrl}
            ar="true"
            ar-modes="webxr scene-viewer quick-look"
            camera-controls="true"
            auto-rotate="true"
            shadow-intensity="1.5"
            environment-image="neutral"
            exposure="1"
            style={{ width: '100%', height: '100%' }}
          >
            <button slot="ar-button" className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-[var(--theme)] text-white px-8 py-4 rounded-full font-bold shadow-2xl text-lg flex items-center gap-2 border-2 border-white/20">
              <Eye size={20} /> Zobacz na żywo w skali 1:1
            </button>
          </ModelViewer>
        </div>
      )}

      <main className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-zinc-50" style={{ '--theme': appData.themeColor } as React.CSSProperties}>
        <div className={`w-full relative bg-zinc-900 shadow-inner ${isReadOnly ? 'md:w-[65%] h-full' : 'h-[40vh] md:h-full md:w-[60%]'}`}>
          {appData?.activeType === 'carport' ? (
            <CarportCanvasArea config={config} selectedWall={selectedWall} colors={appData?.colors || []} isGeneratingAR={isGeneratingAR} onExportAR={handleExportAR} />
          ) : appData?.activeType === 'pergola' ? (
            <PergolaCanvasArea config={config} selectedWall={selectedWall} colors={appData?.colors || []} isGeneratingAR={isGeneratingAR} onExportAR={handleExportAR} />
          ) : appData?.activeType === 'trash' ? (
            <TrashCanvasArea config={config} selectedWall={selectedWall} activeDimId={activeDimId} colors={appData?.colors || []} isGeneratingAR={isGeneratingAR} onExportAR={handleExportAR} />
          ) : (
            <CanvasArea 
              config={config} 
              selectedWall={selectedWall} 
              colors={appData?.colors || []} 
              activeDimId={activeDimId}
              isGeneratingAR={isGeneratingAR}
              onExportAR={handleExportAR}
            />
          )}
          {isReadOnly && (
            <div className="absolute top-6 left-6 pointer-events-none z-10">
              <div className="bg-zinc-900/90 backdrop-blur-md px-6 py-4 rounded-2xl border border-zinc-800 shadow-2xl">
                <h1 className="text-2xl font-black text-white tracking-tight uppercase">Podgląd Produkcyjny <span className="text-[var(--theme)]">3D</span></h1>
                <p className="text-zinc-400 text-sm mt-1">Rozwiń sekcje w panelu i kliknij ikonę oka przy elemencie, by sprawdzić wymiary.</p>
              </div>
            </div>
          )}
          {isGeneratingAR && (
            <div className="absolute inset-0 bg-zinc-900/90 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white">
              <div className="animate-spin w-16 h-16 border-4 border-[var(--theme)] border-t-transparent rounded-full mb-6"></div>
              <h2 className="text-2xl font-black uppercase tracking-widest">Generowanie Pakietu AR</h2>
              <p className="text-zinc-400 mt-2 text-sm max-w-sm text-center">Kompresja geometrii i mapowanie tekstur. Prosimy o chwilę cierpliwości...</p>
            </div>
          )}
        </div>

        <div className={`w-full flex flex-col bg-white border-l border-zinc-200 shadow-[-4px_0_25px_rgba(0,0,0,0.05)] relative z-10 ${isReadOnly ? 'md:w-[35%] h-full' : 'h-[60vh] md:h-full md:w-[40%]'}`}>
          
          {/* WSKAŹNIK KROKÓW */}
          {!isReadOnly && (
            <div className="p-4 bg-white border-b border-zinc-100 hidden md:block">
              <div className="flex items-center justify-between relative">
                <div className="absolute top-1/2 left-0 w-full h-[2px] bg-zinc-100 -z-10 -translate-y-1/2" />
                {CONFIG_STEPS.map((step, idx) => (
                  <div key={step.id} className="flex flex-col items-center gap-1 z-10">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${activeStep >= step.id ? 'bg-[var(--theme)] text-white shadow-md shadow-[var(--theme)]/20' : 'bg-zinc-200 text-zinc-500'}`}>
                      {step.id}
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${activeStep >= step.id ? 'text-zinc-800' : 'text-zinc-400'}`}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar scroll-smooth" onScroll={handleScroll}>
            {appData?.activeType === 'carport' ? (
              <CarportConfigPanel config={config} setConfig={setConfig} appData={appData} />
            ) : appData?.activeType === 'pergola' ? (
              <PergolaConfigPanel config={config} setConfig={setConfig} appData={appData} />
            ) : appData?.activeType === 'trash' ? (
              <TrashConfigPanel config={config} setConfig={setConfig} selectedWall={selectedWall} setSelectedWall={setSelectedWall} appData={appData} isGeneratingAR={isGeneratingAR} setIsGeneratingAR={setIsGeneratingAR} />
            ) : (
              <ConfigPanel 
                config={config} 
                setConfig={setConfig} 
                selectedWall={selectedWall} 
                setSelectedWall={setSelectedWall} 
                appData={appData} 
                isGeneratingAR={isGeneratingAR} 
                setIsGeneratingAR={setIsGeneratingAR} 
                isReadOnly={isReadOnly}
                isOfferMode={isOfferMode}
                storeUrl={storeUrl || appData?.storeUrl}
                requestARExport={requestOfferARExport}
                activeDimId={activeDimId} 
                setActiveDimId={setActiveDimId}
              />
            )}
          </div>

          {isReadOnly && (
            <div className="pt-4 border-t border-zinc-200 bg-white">
              <a href={wpAdminUrl || "#"} className="w-full flex justify-center items-center py-4 font-bold bg-zinc-950 text-white hover:bg-zinc-900 transition-colors">
                ← Wróć do zamówień
              </a>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
