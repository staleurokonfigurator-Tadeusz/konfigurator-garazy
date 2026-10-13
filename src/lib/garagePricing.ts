import type { GarageConfig } from '@/types';
import { isPirGarage, getPirPricePerM2 } from './garageMaterial';
import { getCarportSides, getCarportSettings, getCarportLayout, getAnchoringPrice, isAnchoringAddon } from './garageExtras';
import { isAddonAvailable, isReinforcedFrameAddon, type PricedAddon } from './garageOptions';
import { getAssemblyLayout } from './garageAssembly';

export interface GaragePricingData {
  pricing?: Record<string, unknown>;
  baseConfig?: { h?: number };
  addons?: PricedAddon[];
  colors?: { id: string; type?: string; price?: unknown }[];
}
const safeNum = (value: unknown) => { const number = Number(value); return Number.isFinite(number) ? number : 0; };
export function calculateGarageUnit(config: GarageConfig, appData: GaragePricingData) {
  const pricing = appData.pricing || {}, customAddons = appData.addons || [], dbColors = appData.colors || [];

    let totalBase = 0; 
    let percentBaseMultiplier = 1;
    const totalFinal = 0;
    let percentFinalMultiplier = 1;

    const isDualSlopeRoof = config.roofType === 'dual-slope' || config.roofType === 'dual-slope-front-back';
    let baseM2Price = isPirGarage(config) ? getPirPricePerM2(pricing.sqm_pir_v) : (isDualSlopeRoof ? safeNum(pricing.sqm_dual_v) : safeNum(pricing.sqm_single_v));
    
    const baseH = safeNum(appData?.baseConfig?.h) || 210;
    const extraHeight = Math.max(0, config.height - baseH);
    const heightIncrements = Math.floor(extraHeight / 10);
    baseM2Price = baseM2Price * (1 + (heightIncrements * 0.10)); 
    
    const area = (config.width / 100) * (config.length / 100);
    totalBase += area * baseM2Price;

    if (config.hasCarport) {
      const carportWidth = getCarportLayout(config).extraWidth;
      const carportArea = (carportWidth / 100) * (config.length / 100);
      totalBase += carportArea * safeNum(pricing.integrated_carport_m2_v);
    }

    if (config.gutters && !isPirGarage(config)) {
      let gutterMeters = 0;
      if (config.roofType === 'dual-slope') gutterMeters = (config.length / 100) * 2;
      else if (config.roofType === 'dual-slope-front-back') gutterMeters = (config.width / 100) * 2;
      else if (config.roofType === 'slope-back' || config.roofType === 'slope-front') gutterMeters = (config.width / 100); 
      else gutterMeters = (config.length / 100);
      totalBase += gutterMeters * safeNum(pricing.gutter_v);
    }

    let includedPirGateAvailable = isPirGarage(config);
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
        const includedGate = includedPirGateAvailable;
        includedPirGateAvailable = false;
        if (!includedGate) {
          if (el.gateType === 'up-and-over') {
            if (el.width === 200) totalBase += safeNum(pricing.gate_up_2x2);
            else if (el.width === 290 || el.width === 300) totalBase += safeNum(pricing.gate_up_3x2);
            else if (el.width === 400) totalBase += safeNum(pricing.gate_up_4x2);
            else if (el.width === 500) totalBase += safeNum(pricing.gate_up_5x2);
          } else if (el.gateType === 'sectional') {
            if (el.width === 300) totalBase += safeNum(pricing.gate_sec_3x2);
            else if (el.width === 400) totalBase += safeNum(pricing.gate_sec_4x2);
            else if (el.width === 500) totalBase += safeNum(pricing.gate_sec_5x2);
          } else if (el.gateType === 'swing') {
            if (el.width === 200) totalBase += safeNum(pricing.gate_double_3x2) - 100; // orientacyjna cena bazowa
            else if (el.width === 300) totalBase += safeNum(pricing.gate_double_3x2);
            else if (el.width === 400) totalBase += safeNum(pricing.gate_double_4x2);
          }
        }
        if (el.hasDoor) {
          totalBase += safeNum(pricing.door_in_gate_v);
        }
      }
      if (el.type === 'door') {
        if (pricing.door_t === 'fixed') totalBase += safeNum(pricing.door_v);
        else if (pricing.door_t === 'pct_base') percentBaseMultiplier += (safeNum(pricing.door_v)/100);
        else percentFinalMultiplier += (safeNum(pricing.door_v)/100);
      }
    });

    if (!isPirGarage(config) && config.extraOptions?.includes('roofTile')) {
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

    const activeColors = [
      config.wallColor, config.roofColor, config.gateColor, 
      config.doorColor, config.windowColor, 
      config.cornerFlashingColor, config.roofFlashingColor, config.gutterColor,
      ...getCarportSides(config).map(side => getCarportSettings(config, side).postColor)
    ];
    const uniqueColors = Array.from(new Set(activeColors));
    let hasWoodColor = false;

    uniqueColors.forEach(cId => {
       const c = dbColors.find((col) => col.id === cId);
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
      const addon = customAddons.find((a) => a.id === addonId);
      if (addon && isAddonAvailable(config, addon)) {
        if (isPirGarage(config) && isReinforcedFrameAddon(addon)) return;
        if (isAnchoringAddon(addon)) { customAddonTotal += getAnchoringPrice(config); return; }
        if (addon.type === 'fixed') customAddonTotal += safeNum(addon.price);
        else if (addon.type === 'pct' || addon.type === 'pct_total') percentFinalMultiplier += (safeNum(addon.price) / 100);
        else if (addon.type === 'pct_base') percentBaseMultiplier += (safeNum(addon.price) / 100);
        else if (addon.type === 'm2') customAddonTotal += area * safeNum(addon.price);
        else if (addon.type === 'mb') customAddonTotal += ((config.width / 100) + (config.length / 100)) * 2 * safeNum(addon.price);
      }
    });

    totalBase = totalBase * percentBaseMultiplier;
    return Math.round((totalBase + totalFinal) * percentFinalMultiplier + customAddonTotal);

}
export function calculateGaragePrice(config: GarageConfig, data: GaragePricingData) {
  const layout = getAssemblyLayout(config);
  const units = layout.second ? [layout.first, layout.second] : [layout.first];
  const base = units.reduce((sum, unit) => sum + calculateGarageUnit(unit, data), 0);
  const middle = layout.gap * layout.middleLength / 10000 * safeNum(data.pricing?.integrated_carport_m2_v);
  return Math.round((base + middle) * 100) / 100;
}
