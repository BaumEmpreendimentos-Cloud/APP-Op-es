import { OpLabOptionDetail } from '../types';

export interface OpLabQuote {
  symbol: string;
  close: number;
  bid: number;
  ask: number;
  strike?: number;
  spotPrice?: number;
  variation?: number;
  volume?: number;
  financial_volume?: number;
  financialVolume?: number;
  open?: number;
  high?: number;
  low?: number;
  time?: number;
  source?: string;
}

export interface OpLabSearchItem {
  symbol: string;
  type: string;
  description: string;
  full_name?: string;
  close?: number;
  strike?: number;
}

// Client-side cache to make lookups and leg additions instantaneous
const clientCache = new Map<string, { data: any; expiry: number }>();
function getFromClientCache(key: string) {
  const item = clientCache.get(key);
  if (item && item.expiry > Date.now()) return item.data;
  return null;
}
function setInClientCache(key: string, data: any, ttlMs = 45000) {
  clientCache.set(key, { data, expiry: Date.now() + ttlMs });
}

/**
 * Fetch live quote for a single stock or asset
 */
export async function fetchStockQuote(symbol: string): Promise<OpLabQuote | null> {
  const clean = symbol.trim().toUpperCase();
  if (!clean) return null;
  const res = await fetchQuotes([clean]);
  if (res.success && res.data && res.data.length > 0) {
    return res.data[0];
  }
  return null;
}

/**
 * Fetch detailed option data by ticker code
 */
export async function fetchOptionDetails(symbol: string): Promise<{
  success: boolean;
  source: 'oplab_api' | 'b3_parser';
  data: OpLabOptionDetail;
  error?: string;
}> {
  const clean = symbol.trim().toUpperCase();
  if (!clean) {
    throw new Error('Código da opção não informado');
  }

  const cacheKey = `opt:${clean}`;
  const cached = getFromClientCache(cacheKey);
  if (cached) {
    return cached;
  }

  const res = await fetch(`/api/oplab/option/${encodeURIComponent(clean)}`);
  if (!res.ok) {
    throw new Error(`Erro na busca da opção: status ${res.status}`);
  }

  const data = await res.json();
  setInClientCache(cacheKey, data, 45000);
  return data;
}

/**
 * Fetch live quotes for an array of tickers (stocks and options)
 */
export async function fetchQuotes(tickers: string[]): Promise<{
  success: boolean;
  source: string;
  data: OpLabQuote[];
}> {
  if (tickers.length === 0) {
    return { success: true, source: 'none', data: [] };
  }

  const query = encodeURIComponent(tickers.join(','));
  const cacheKey = `quotes:${query}`;
  const cached = getFromClientCache(cacheKey);
  if (cached) {
    return cached;
  }

  const res = await fetch(`/api/oplab/quote?tickers=${query}`);
  if (!res.ok) {
    throw new Error(`Erro ao buscar cotações: status ${res.status}`);
  }

  const data = await res.json();
  setInClientCache(cacheKey, data, 25000);
  return data;
}

/**
 * Search options/stocks autocomplete
 */
export async function searchInstruments(expr: string): Promise<{
  success: boolean;
  data: OpLabSearchItem[];
}> {
  const clean = (expr || '').trim().toUpperCase();
  if (clean.length < 2) {
    return { success: true, data: [] };
  }

  const cacheKey = `search:${clean}`;
  const cached = getFromClientCache(cacheKey);
  if (cached) {
    return cached;
  }

  const res = await fetch(`/api/oplab/search?expr=${encodeURIComponent(clean)}`);
  if (!res.ok) {
    return { success: false, data: [] };
  }

  const data = await res.json();
  setInClientCache(cacheKey, data, 60000);
  return data;
}
