import { AssetData } from '../types';

export const IBOVESPA_ASSETS: AssetData[] = [
  {
    ticker: 'PETR4',
    companyName: 'Petrobras PN',
    sector: 'Petróleo e Gás',
    spotPrice: 48.20,
    ivCurrent: 0.28,
    ivPercentile: 52,
    defaultCallSeries: 'J (Out)',
    defaultPutSeries: 'V (Out)',
  },
  {
    ticker: 'VALE3',
    companyName: 'Vale ON',
    sector: 'Mineração e Siderurgia',
    spotPrice: 72.48,
    ivCurrent: 0.25,
    ivPercentile: 45,
    defaultCallSeries: 'J (Out)',
    defaultPutSeries: 'V (Out)',
  },
  {
    ticker: 'BOVA11',
    companyName: 'iShares Ibovespa ETF',
    sector: 'Índice de Mercado',
    spotPrice: 184.20,
    ivCurrent: 0.17,
    ivPercentile: 38,
    defaultCallSeries: 'J (Out)',
    defaultPutSeries: 'V (Out)',
  },
  {
    ticker: 'ITUB4',
    companyName: 'Itaú Unibanco PN',
    sector: 'Financeiro / Bancos',
    spotPrice: 43.32,
    ivCurrent: 0.21,
    ivPercentile: 40,
    defaultCallSeries: 'J (Out)',
    defaultPutSeries: 'V (Out)',
  },
  {
    ticker: 'BBDC4',
    companyName: 'Bradesco PN',
    sector: 'Financeiro / Bancos',
    spotPrice: 18.37,
    ivCurrent: 0.26,
    ivPercentile: 58,
    defaultCallSeries: 'J (Out)',
    defaultPutSeries: 'V (Out)',
  },
  {
    ticker: 'BBAS3',
    companyName: 'Banco do Brasil ON',
    sector: 'Financeiro / Bancos',
    spotPrice: 22.55,
    ivCurrent: 0.24,
    ivPercentile: 48,
    defaultCallSeries: 'J (Out)',
    defaultPutSeries: 'V (Out)',
  },
  {
    ticker: 'MGLU3',
    companyName: 'Magazine Luiza ON',
    sector: 'Varejo / E-commerce',
    spotPrice: 9.80,
    ivCurrent: 0.62,
    ivPercentile: 82,
    defaultCallSeries: 'J (Out)',
    defaultPutSeries: 'V (Out)',
  },
  {
    ticker: 'WEGE3',
    companyName: 'WEG ON',
    sector: 'Bens Industriais',
    spotPrice: 54.20,
    ivCurrent: 0.22,
    ivPercentile: 34,
    defaultCallSeries: 'J (Out)',
    defaultPutSeries: 'V (Out)',
  },
  {
    ticker: 'PRIO3',
    companyName: 'PRIO ON',
    sector: 'Petróleo Independente',
    spotPrice: 42.10,
    ivCurrent: 0.35,
    ivPercentile: 65,
    defaultCallSeries: 'J (Out)',
    defaultPutSeries: 'V (Out)',
  },
  {
    ticker: 'ABEV3',
    companyName: 'Ambev ON',
    sector: 'Bebidas e Consumo',
    spotPrice: 12.80,
    ivCurrent: 0.19,
    ivPercentile: 30,
    defaultCallSeries: 'J (Out)',
    defaultPutSeries: 'V (Out)',
  }
];

export interface B3MonthLetter {
  month: string;
  monthName: string;
  monthNumber: number;
  callLetter: string;
  putLetter: string;
}

export const B3_EXPIRATION_LETTERS: B3MonthLetter[] = [
  { month: 'Janeiro', monthName: 'Janeiro', monthNumber: 1, callLetter: 'A', putLetter: 'M' },
  { month: 'Fevereiro', monthName: 'Fevereiro', monthNumber: 2, callLetter: 'B', putLetter: 'N' },
  { month: 'Março', monthName: 'Março', monthNumber: 3, callLetter: 'C', putLetter: 'O' },
  { month: 'Abril', monthName: 'Abril', monthNumber: 4, callLetter: 'D', putLetter: 'P' },
  { month: 'Maio', monthName: 'Maio', monthNumber: 5, callLetter: 'E', putLetter: 'Q' },
  { month: 'Junho', monthName: 'Junho', monthNumber: 6, callLetter: 'F', putLetter: 'R' },
  { month: 'Julho', monthName: 'Julho', monthNumber: 7, callLetter: 'G', putLetter: 'S' },
  { month: 'Agosto', monthName: 'Agosto', monthNumber: 8, callLetter: 'H', putLetter: 'T' },
  { month: 'Setembro', monthName: 'Setembro', monthNumber: 9, callLetter: 'I', putLetter: 'U' },
  { month: 'Outubro', monthName: 'Outubro', monthNumber: 10, callLetter: 'J', putLetter: 'V' },
  { month: 'Novembro', monthName: 'Novembro', monthNumber: 11, callLetter: 'K', putLetter: 'W' },
  { month: 'Dezembro', monthName: 'Dezembro', monthNumber: 12, callLetter: 'L', putLetter: 'X' },
];
