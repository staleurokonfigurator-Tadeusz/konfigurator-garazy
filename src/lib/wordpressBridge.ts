import type { GarageConfig } from '@/types';
import type { OfferCustomer } from '@/lib/offerPdf';

export const WORDPRESS_MESSAGE_VERSION = 2;

export interface CheckoutMessage {
  action: 'konfigurator_checkout';
  version: typeof WORDPRESS_MESSAGE_VERSION;
  config: GarageConfig;
  estimatedPrice: number;
  price: number;
  thumbnail: string;
}

export interface WordPressOfferResult {
  id: number;
  offerNumber: string;
  verifiedPrice: number;
  publicUrl: string;
}

const parseAllowedOrigins = () =>
  (process.env.NEXT_PUBLIC_WORDPRESS_ORIGINS || 'https://konfigurator.staleuro.pl')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

export function getTrustedParentOrigin(storeUrl?: string): string | null {
  try {
    if (!storeUrl) return null;
    const url = new URL(storeUrl);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return null;

    const configuredOrigins = parseAllowedOrigins();
    if (configuredOrigins.length > 0 && !configuredOrigins.includes(url.origin)) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function postCheckoutToWordPress(message: CheckoutMessage, targetOrigin: string) {
  if (window.parent === window) {
    throw new Error('Konfigurator nie jest osadzony w WordPressie.');
  }

  window.parent.postMessage(message, targetOrigin);
}

export function createOfferInWordPress(input: {
  config: GarageConfig;
  customer: OfferCustomer;
  estimatedPrice: number;
  storeUrl?: string;
  arModel: Blob;
}): Promise<WordPressOfferResult> {
  const targetOrigin = getTrustedParentOrigin(input.storeUrl);
  if (!targetOrigin || window.parent === window) {
    return Promise.reject(new Error('Panel ofert musi być otwarty z uwierzytelnionej strony WordPress.'));
  }

  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', handleResponse);
      reject(new Error('WordPress nie odpowiedział na żądanie utworzenia oferty.'));
    }, 20_000);

    const handleResponse = (event: MessageEvent) => {
      if (event.origin !== targetOrigin || event.source !== window.parent) return;
      if (event.data?.action !== 'konfigurator_offer_created' || event.data?.requestId !== requestId) return;

      window.clearTimeout(timeout);
      window.removeEventListener('message', handleResponse);

      if (!event.data.ok) {
        reject(new Error(event.data.message || 'WordPress odrzucił zapis oferty.'));
        return;
      }

      const offer = event.data.offer as WordPressOfferResult;
      if (!offer || !Number.isFinite(Number(offer.verifiedPrice)) || !offer.offerNumber) {
        reject(new Error('WordPress zwrócił nieprawidłową odpowiedź oferty.'));
        return;
      }

      resolve({
        id: Number(offer.id),
        offerNumber: String(offer.offerNumber),
        verifiedPrice: Number(offer.verifiedPrice),
        publicUrl: String(offer.publicUrl || ''),
      });
    };

    window.addEventListener('message', handleResponse);
    window.parent.postMessage({
      action: 'konfigurator_create_offer',
      version: WORDPRESS_MESSAGE_VERSION,
      requestId,
      config: input.config,
      customer: input.customer,
      estimatedPrice: input.estimatedPrice,
      arModel: input.arModel,
    }, targetOrigin);
  });
}

