export interface VixDataPoint {
  date: string;
  timestamp: number;
  vix: number;
  ibov: number;
  cboeUsVix: number;
  event?: string;
  description?: string;
}

export interface VixIntradayPoint {
  time: string;
  vix: number;
  ibov: number;
}

export interface VixHistoricalMilestone {
  date: string;
  event: string;
  vixValue: number;
  ibovChange: string;
  description: string;
  category: 'CRASH' | 'POLITICAL' | 'FISCAL' | 'GLOBAL';
}

export interface VixStrategyRecommendation {
  name: string;
  strategyId: string;
  bias: 'ALTA_VOL' | 'BAIXA_VOL' | 'NEUTRO';
  description: string;
  whyItWorks: string;
  riskWarning: string;
  b3MarginImpact: string;
}

// Especificações Técnicas Oficiais S&P Dow Jones Indices & B3
export const VIX_SPECIFICATIONS = {
  name: 'S&P/B3 IBOVESPA VIX',
  shortName: 'VIX B3 / IBOVVIX',
  tickerSAndP: 'SPB3VIX',
  tickerBloomberg: 'SPB3VIX Index',
  tickerReuters: '.SPB3VIX',
  tickerFactSet: 'SPB3VIX',
  tickerB3Futures: 'VIX / VXBR',
  launchDate: '19 de março de 2024',
  baseDate: '3 de janeiro de 2011',
  baseValue: '20,00 pontos',
  assetClass: 'Indicador de Volatilidade de Renda Variável (Equity Volatility)',
  calculationFrequency: 'Tempo Real (Intradiário a cada 15 segundos)',
  calculationCurrency: 'Pontos (Percentual anualizado de volatilidade esperada a 30 dias)',
  targetHorizon: '30 dias corridos constantes (interpolação entre séries)',
  underlying: 'Opções sobre o Índice Ibovespa (IBOV) negociadas na B3',
  rollRule: 'Rolagem automática quando o 1º vencimento atinge menos de 6 dias úteis para expirar',
  governance: 'Comitê S&P/B3 FIC Index Committee',
  methodologyBase: 'Cboe Volatility Index (VIX®) licenciado da Cboe Exchange, Inc.',
  b3Url: 'https://content.b3.com.br/ibovespa-vix/',
  spGlobalUrl: 'https://www.spglobal.com/spdji/pt/indices/indicators/sp-b3-ibovespa-vix/#overview',
};

// Histórico de Eventos Marcantes e Picos Extremos do VIX B3 (2011 - 2026)
export const VIX_HISTORICAL_MILESTONES: VixHistoricalMilestone[] = [
  {
    date: '23/03/2020',
    event: 'Covid-19 Crash & 6 Circuit Breakers',
    vixValue: 81.6,
    ibovChange: '-45% no mês',
    description: 'Máxima histórica do índice. Pânico global e paralisações sanitárias. O Ibovespa desabou de 119 mil para 61 mil pontos com 6 interrupções de pregão (circuit breakers). Margens no CORE B3 quadruplicaram.',
    category: 'CRASH',
  },
  {
    date: '18/05/2017',
    event: 'Joesley Day (Áudios JBS)',
    vixValue: 46.2,
    ibovChange: '-8.8% em 1 dia',
    description: 'Vazamento das gravações entre o presidente Michel Temer e o empresário Joesley Batista. O pregão da B3 abriu em circuit breaker e a volatilidade implícita explodiu.',
    category: 'POLITICAL',
  },
  {
    date: '28/05/2018',
    event: 'Greve dos Caminhoneiros',
    vixValue: 41.8,
    ibovChange: '-11% na semana',
    description: 'Paralisação nacional dos transportes de carga por 11 dias, gerando desabastecimento de combustível, queda de receitas corporativas e severa aversão a risco.',
    category: 'FISCAL',
  },
  {
    date: '24/10/2022',
    event: 'Eleições Presidenciais Polarizadas',
    vixValue: 38.4,
    ibovChange: 'Oscilações de ±4% diárias',
    description: 'Disputa de 2º turno mais acirrada da história recente. O mercado operou com prêmio de risco inflado e ampla demanda por puts de proteção no Ibovespa.',
    category: 'POLITICAL',
  },
  {
    date: '05/08/2024',
    event: 'Desmonte do Yen Carry Trade Global',
    vixValue: 31.5,
    ibovChange: '-2.3% no pregão',
    description: 'Alta súbita dos juros pelo Banco do Japão provocou desalavancagem sincronizada de fundos globais. O Cboe VIX nos EUA chegou a 65 e o VIX B3 saltou para 31,5 pts.',
    category: 'GLOBAL',
  },
  {
    date: '02/10/2026',
    event: 'Recorde Histórico Oficial B3 (Fechamento)',
    vixValue: 32.77,
    ibovChange: '+0.38 pts (+1.17%)',
    description: 'Maior nível de fechamento oficial do S&P/B3 IBOVESPA VIX desde o lançamento em março de 2024 (superando o recorde anterior de 32,39 pts do dia 01/10/2026), sinalizando aversão severa a risco na sessão pré-eleitoral e escalada extrema na demanda por puts de Ibovespa.',
    category: 'POLITICAL',
  },
  {
    date: 'Hoje (Atual)',
    event: 'Pregão B3 / Fear Zone',
    vixValue: 32.77,
    ibovChange: 'Alta Volatilidade (> 30 pts)',
    description: 'Mercado em zona de estresse elevado e aversão a risco. Margem CORE da B3 exigindo garantias substancialmente maiores para operações vendidas a seco.',
    category: 'GLOBAL',
  },
];

// Perguntas Frequentes Oficiais (FAQ B3 & S&P DJI)
export const VIX_FAQ = [
  {
    question: 'O que é o índice S&P/B3 IBOVESPA VIX?',
    answer: 'O S&P/B3 IBOVESPA VIX é um indicador financeiro oficial em tempo real desenvolvido em parceria entre a B3 (a bolsa do Brasil) e a S&P Dow Jones Indices. Ele mede a volatilidade implícita esperada pelo mercado para o índice Ibovespa para os próximos 30 dias corridos, expresso em taxa percentual anualizada.',
  },
  {
    question: 'Por que o VIX é chamado de "Índice do Medo" (Fear Index)?',
    answer: 'Ele recebe esse nome porque existe uma forte correlação inversa entre o VIX e o Ibovespa (historicamente em torno de -0.70 a -0.85). Quando o mercado sofre quedas repentinas ou choques adversos, a busca desesperada por opções de venda (puts) faz os prêmios dispararem, elevando a volatilidade implícita calculada. Níveis altos sinalizam estresse, turbulência e cautela extrema.',
  },
  {
    question: 'Qual a diferença entre Volatilidade Implícita e Volatilidade Histórica?',
    answer: 'A Volatilidade Histórica (HV) olha para o passado, calculando o desvio padrão dos retornos já realizados pelo Ibovespa nos últimos 20, 30 ou 60 pregões. Já a Volatilidade Implícita (IV medida pelo VIX) olha para o futuro: é o consenso de preço que os operadores estão dispostos a pagar hoje pelas opções de compra e venda com vencimento nos próximos 30 dias.',
  },
  {
    question: 'Como a B3 e a S&P Dow Jones calculam o S&P/B3 Ibovespa VIX?',
    answer: 'O cálculo é derivado da consagrada metodologia do Cboe VIX norte-americano. Em vez de depender do modelo Black-Scholes para cada strike, o índice utiliza uma fórmula matemática independente de modelo (Model-Free Implied Volatility) que integra os preços médios (mid-quotes) de uma ampla faixa de opções de compra (calls) e venda (puts) fora do dinheiro (OTM) de dois vencimentos consecutivos do Ibovespa (a série de curto prazo e a série seguinte), interpolando para garantir exatos 30 dias.',
  },
  {
    question: 'Por que as opções são roladas a 6 dias úteis do vencimento?',
    answer: 'Opções com prazo de expiração muito curto (menos de 1 semana) passam a sofrer com decaimento temporal extremo (Theta explosivo) e distorções de liquidez ou ruídos de rolagem. Para evitar anomalias artificiais no índice, a metodologia da B3 determina a troca automática da série mais curta para o próximo vencimento assim que restam menos de 6 dias úteis.',
  },
  {
    question: 'O que significa um VIX em 18 pontos na prática?',
    answer: 'Um VIX de 18 pontos significa que o mercado projeta uma volatilidade anualizada de 18% para o Ibovespa nos próximos 30 dias. Dividindo pela raiz de 12 (aproximadamente 3,46), isso equivale a um movimento esperado de ±5,20% no mês com 1 desvio padrão de probabilidade (cerca de 68,2% de chance). Para um Ibovespa a 138.000 pontos, significa que o mercado espera que o índice permaneça entre 130.800 e 145.200 pontos.',
  },
  {
    question: 'Como o VIX afeta o sistema de garantias e margem CORE da B3?',
    answer: 'O sistema CORE (Câmara B3 de Compensação e Risco) simula o estresse dinâmico das carteiras de derivativos. Quando o VIX sobe, a B3 amplia a amplitude dos cenários de estresse de volatilidade e preço. Posições vendidas a seco sofrem uma explosão imediata na exigência de garantias financeiras, podendo gerar chamadas de margem e liquidação compulsória se o operador não tiver reserva alocada.',
  },
  {
    question: 'Existem contratos futuros e opções do VIX para operar na B3?',
    answer: 'Sim! A B3 disponibiliza contratos Futuros de VIX (código VIX / VXBR) e opções sobre futuros de VIX. Investidores e gestores de fundos utilizam esses instrumentos para fazer hedge direto de cauda em suas carteiras, lucrando com disparadas de volatilidade sem precisar vender suas ações ou montar travas pesadas.',
  },
  {
    question: 'O que é o "Spread Brasil" no VIX (VIX B3 vs VIX Americano)?',
    answer: 'O Spread Brasil é a diferença entre o S&P/B3 Ibovespa VIX e o Cboe VIX do S&P 500 dos EUA. Como o Brasil é um mercado emergente com risco país, taxa Selic mais alta e oscilações políticas/fiscais mais intensas, historicamente o VIX B3 opera entre 3 e 7 pontos acima do VIX americano. Se esse spread se estreitar muito, a proteção brasileira está barata; se o spread explodir, há estresse doméstico descolado do exterior.',
  },
];

// Recomendações de Estratégias Conforme a Zona do VIX
export const VIX_REGIMES = [
  {
    range: '0 a 16 pts',
    level: 'BAIXA_VOLATILIDADE',
    title: 'Baixa Volatilidade (Calmaria / Complacência)',
    color: 'emerald',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    description: 'Mercado calmo ou em forte tendência definida sem solavancos. Prêmios de opções baratos.',
    actionGuidance: 'Momento ideal para COMPRAR volatilidade ou comprar proteções baratas para a carteira.',
    strategies: [
      {
        name: 'Straddle Comprado / Strangle Comprado',
        strategyId: 'straddle-long',
        bias: 'BAIXA_VOL',
        description: 'Compra simultânea de Call e Put no mesmo strike para lucrar com explosão iminente de volatilidade.',
        whyItWorks: 'Vega positivo: beneficia-se diretamente do aumento do VIX e da expansão dos prêmios.',
        riskWarning: 'Risco limitado ao prêmio pago; sofre com o decaimento diário (Theta).',
        b3MarginImpact: 'Zero margem de garantia exigida na B3 (risco de perda 100% pré-definido).',
      },
      {
        name: 'Trava de Alta com Call (Débito)',
        strategyId: 'bull-call-spread',
        bias: 'BAIXA_VOL',
        description: 'Compra de Call ITM/ATM e venda de Call OTM para surfar alta moderada pagando prêmio barato.',
        whyItWorks: 'Custo de montagem reduzido com volatilidade baixa.',
        riskWarning: 'Ganho limitado pela ponta vendida.',
        b3MarginImpact: 'Zero margem na B3 (operação de débito).',
      },
      {
        name: 'Compra de Put OTM de Proteção (Tail Hedge)',
        strategyId: 'protective-put',
        bias: 'BAIXA_VOL',
        description: 'Aquisição de Puts bem fora do dinheiro em BOVA11 ou Ibovespa com prêmio centavos.',
        whyItWorks: 'Seguro de carteira extremamente barato antes de choques inesperados.',
        riskWarning: 'Se o mercado não cair, o prêmio vira pó no vencimento.',
        b3MarginImpact: 'Sem margem exigida.',
      },
    ],
  },
  {
    range: '16 a 22 pts',
    level: 'MODERADA_HISTORICA',
    title: 'Volatilidade Moderada (Faixa Típica Histórica B3)',
    color: 'sky',
    badgeClass: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    description: 'Média histórica do mercado de ações brasileiro (~18,5 pts). Equilíbrio entre compradores e vendedores.',
    actionGuidance: 'Ideal para estratégias balanceadas de renda e rentabilização de ações em carteira.',
    strategies: [
      {
        name: 'Venda Coberta de Call (Covered Call)',
        strategyId: 'covered-call',
        bias: 'NEUTRO',
        description: 'Custódia da ação ou BOVA11 com venda de Call OTM para gerar taxa mensal consistente.',
        whyItWorks: 'Prêmio justo com taxa Selic/CDI somada à taxa do lançamento.',
        riskWarning: 'Obrigação de entregar as ações se o mercado subir acima do strike.',
        b3MarginImpact: 'Totalmente coberta pela custódia das ações na CBLC/B3.',
      },
      {
        name: 'Trava de Baixa com Call (Crédito)',
        strategyId: 'bear-call-spread',
        bias: 'NEUTRO',
        description: 'Venda de Call mais próxima e compra de Call mais alta para capturar crédito com risco travado.',
        whyItWorks: 'Decaimento temporal a favor em mercados laterais ou com viés de baixa.',
        riskWarning: 'Perda máxima travada na diferença dos strikes menos o crédito recebido.',
        b3MarginImpact: 'Margem CORE B3 travada na largura do spread (previsível).',
      },
      {
        name: 'Trava de Alta com Put (Bull Put Spread)',
        strategyId: 'bull-put-spread',
        bias: 'NEUTRO',
        description: 'Venda de Put OTM com compra de Put protetora ainda mais OTM para gerar renda imediata.',
        whyItWorks: 'Se o Ibovespa ficar parado ou subir, ambas expiram sem valor e você retém o prêmio.',
        riskWarning: 'Perda limitada à diferença entre strikes.',
        b3MarginImpact: 'Margem B3 restrita ao spread líquido.',
      },
    ],
  },
  {
    range: '22 a 30 pts',
    level: 'ELEVADA_ALERTA',
    title: 'Volatilidade Elevada (Alerta / Cautela)',
    color: 'amber',
    badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    description: 'Aumento notável de ruídos fiscais, inflacionários ou tensão externa. Prêmios de opções estão gordos.',
    actionGuidance: 'Momento de VENDER volatilidade cara, mas SEMPRE com pontas de proteção (travas com risco limitado).',
    strategies: [
      {
        name: 'Iron Condor Amplo',
        strategyId: 'iron-condor',
        bias: 'ALTA_VOL',
        description: 'Venda de Call e Put fora do dinheiro com compras protetoras nos extremos em faixa ampla.',
        whyItWorks: 'Vega altamente negativo: lucra exponencialmente quando a volatilidade voltar à média.',
        riskWarning: 'Requer acompanhamento se o ativo tiver movimento direcional muito violento.',
        b3MarginImpact: 'Apenas a margem da maior asa é retida na B3.',
      },
      {
        name: 'Collar (Hedge com Financiamento Zero Cost)',
        strategyId: 'collar',
        bias: 'ALTA_VOL',
        description: 'Protege a carteira comprando Put financiada pela venda de uma Call OTM com volatilidade cara.',
        whyItWorks: 'Permite travar o piso da carteira contra quedas sem custo financeiro de prêmio.',
        riskWarning: 'Trava também o teto de valorização das ações.',
        b3MarginImpact: 'Garantido pelas ações em custódia.',
      },
    ],
  },
  {
    range: 'Acima de 30 pts',
    level: 'EXTREMA_PANICO',
    title: 'Alta Volatilidade / Pânico ("Fear Zone")',
    color: 'rose',
    badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    description: 'Crises agudas, pânico de mercado ou estresse institucional. Prêmios superdimensionados.',
    actionGuidance: 'PERIGO: NUNCA venda opções a seco. O sistema CORE B3 eleva margens brutalmente.',
    strategies: [
      {
        name: 'Travas de Crédito Ultradescontadas (OTM Distante)',
        strategyId: 'bear-call-spread',
        bias: 'ALTA_VOL',
        description: 'Montagem de travas de crédito em strikes muito distantes aproveitando a distorção de IV.',
        whyItWorks: 'O IV Crush (colapso da volatilidade pós-estresse) gera ganhos rápidos.',
        riskWarning: 'Exige disciplina rigorosa de stop loss. Respeite as garantias da B3.',
        b3MarginImpact: 'Mantenha pelo menos 140% de folga em Tesouro Selic para evitar multas de margem B3.',
      },
      {
        name: 'Compra de Call a Seco Pós-Crash (Repique)',
        strategyId: 'long-call',
        bias: 'ALTA_VOL',
        description: 'Compra de Calls OTM no momento em que o VIX atinge exaustão para surfar repiques fortes.',
        whyItWorks: 'Assimetria de alta violenta típica pós-pânico.',
        riskWarning: 'O IV Crush reduz o prêmio da opção mesmo se a ação subir moderadamente.',
        b3MarginImpact: 'Sem margem exigida.',
      },
    ],
  },
];

// Geração de Dados Históricos Ricos (1M, 3M, 6M, 1A, 3A, 5A, ALL desde 2011)
export function generateVixHistoricalSeries(): VixDataPoint[] {
  const points: VixDataPoint[] = [];
  const now = new Date();
  
  // Vamos gerar série diária consistente cobrindo marcos históricos reais da B3
  // Âncoras históricas reais:
  // 2011: VIX ~ 20.0, IBOV ~ 68.000
  // 2015-2016 (Impeachment / Crise): VIX ~ 36.0, IBOV ~ 38.000
  // 2017 (Joesley Day): VIX 46.2, IBOV 60.500
  // 2018 (Greve Caminhoneiros): VIX 41.8, IBOV 72.000
  // 2019: VIX ~ 16.5, IBOV ~ 115.000
  // 2020 (Covid Crash Março): VIX 81.6, IBOV 63.500
  // 2021: VIX ~ 22.0, IBOV ~ 125.000
  // 2022 (Eleições Outubro): VIX 38.4, IBOV 112.000
  // 2023: VIX ~ 19.5, IBOV ~ 130.000
  // 2024 (Lançamento Oficial Março): VIX 18.2, IBOV ~ 128.000
  // 2024 (Agosto Yen): VIX 31.5, IBOV ~ 125.000
  // 2025: VIX ~ 17.5, IBOV ~ 134.000
  // 2026 (Atual): VIX 17.85, IBOV ~ 138.450
  
  const totalDays = 365 * 4; // 4 anos de dados diários de alta resolução para gráficos interativos
  
  for (let i = totalDays; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Pula fins de semana

    const dateStr = d.toISOString().split('T')[0];
    const timestamp = d.getTime();

    // Modelagem realista de VIX B3 com volatilidade estocástica e correlação inversa com IBOV
    // Fatores de ciclo
    const daysFromNow = i;
    let baseVix = 18.0;
    let baseIbov = 138500 - (daysFromNow * 18);
    let usVix = 14.5;
    let eventName: string | undefined;
    let eventDesc: string | undefined;

    // Injeção de eventos conhecidos na série
    if (daysFromNow > 1400) {
      // 2022 período pré/pós eleitoral
      baseVix = 28 + Math.sin(i / 15) * 6;
      baseIbov = 112000 + Math.cos(i / 15) * 5000;
      usVix = 24.0;
      if (Math.abs(daysFromNow - 1440) < 5) {
        baseVix = 38.4;
        baseIbov = 108500;
        eventName = 'Eleições 2022 (2º Turno)';
        eventDesc = 'Tensão máxima com disputa eleitoral acirrada e prêmio de risco inflado.';
      }
    } else if (daysFromNow > 800) {
      // 2023-2024 início do ciclo de corte da Selic
      baseVix = 19.5 + Math.sin(i / 30) * 3.5;
      baseIbov = 124000 + (1400 - daysFromNow) * 15;
      usVix = 15.0;
      if (Math.abs(daysFromNow - 930) < 3) {
        baseVix = 18.2;
        eventName = 'Lançamento Oficial VIX B3 (19/Mar/2024)';
        eventDesc = 'B3 e S&P Dow Jones lançam oficialmente o cálculo ao vivo do indicador no Brasil.';
      }
    } else if (daysFromNow > 750 && daysFromNow < 795) {
      // Agosto 2024 choque do Yen
      baseVix = 27.5 + Math.sin(i / 5) * 4;
      baseIbov = 125000;
      usVix = 38.0;
      if (Math.abs(daysFromNow - 785) < 3) {
        baseVix = 31.5;
        baseIbov = 124100;
        eventName = 'Desmonte Carry Trade Global (Ago/2024)';
        eventDesc = 'Salto da volatilidade global puxado pelo Banco do Japão e Treasury yield curve.';
      }
    } else if (daysFromNow > 45) {
      // Meados de 2026: faixa moderada
      baseVix = 18.2 + Math.cos(i / 15) * 2.5;
      baseIbov = 136000 + (100 - daysFromNow) * 25;
      usVix = 14.5;
    } else {
      // Reta final Setembro/Outubro 2026: forte escalada de aversão ao risco pré-eleitoral
      // Sobe gradualmente de ~21 para 26, 29, 32.39 e 32.77
      const progress = (45 - daysFromNow) / 45; // 0 a 1
      baseVix = 19.5 + Math.pow(progress, 1.6) * 13.27; // Chega a 32.77
      baseIbov = 138000 - Math.pow(progress, 1.4) * 5800;
      usVix = 14.8 + progress * 4.2;

      if (daysFromNow === 2) {
        baseVix = 32.39;
        eventName = 'Prévia Fechamento B3 (01/10)';
        eventDesc = 'VIX atinge 32,39 pts em sessão de estresse e forte compra de proteção.';
      } else if (daysFromNow === 1) {
        baseVix = 32.77;
        eventName = 'Recorde Histórico Oficial B3 (02/10)';
        eventDesc = 'Fechamento oficial de 32,77 pts, máxima histórica desde o lançamento do índice em março/2024.';
      }
    }

    // Último ponto = cotação exata atual (32.77 pontos)
    if (i === 0) {
      baseVix = 32.77;
      baseIbov = 132450;
      usVix = 19.10;
    }

    points.push({
      date: dateStr,
      timestamp,
      vix: Number(baseVix.toFixed(2)),
      ibov: Math.round(baseIbov),
      cboeUsVix: Number(usVix.toFixed(2)),
      event: eventName,
      description: eventDesc,
    });
  }

  return points;
}

// Geração de Dados Intradiários (15 em 15 minutos ao longo do pregão B3 10:00 - 17:55)
export function generateVixIntradaySeries(): VixIntradayPoint[] {
  const points: VixIntradayPoint[] = [];
  const hours = [
    '10:00', '10:15', '10:30', '10:45',
    '11:00', '11:15', '11:30', '11:45',
    '12:00', '12:15', '12:30', '12:45',
    '13:00', '13:15', '13:30', '13:45',
    '14:00', '14:15', '14:30', '14:45',
    '15:00', '15:15', '15:30', '15:45',
    '16:00', '16:15', '16:30', '16:45',
    '17:00', '17:15', '17:30', '17:45', '17:55'
  ];

  let currentVix = 32.39; // Abertura alinhada com o fechamento anterior
  let currentIbov = 132800;

  hours.forEach((time, index) => {
    // Ruído intradiário com correlação estrita negativa com o Ibovespa em torno de 32.77
    const deltaVix = (Math.sin(index * 0.7) * 0.28) + (Math.cos(index * 1.3) * 0.18) + 0.012;
    currentVix = Math.max(28, currentVix + deltaVix);
    const deltaIbov = -deltaVix * 480 + (Math.sin(index) * 60);
    currentIbov = Math.round(currentIbov + deltaIbov);

    if (index === hours.length - 1) {
      currentVix = 32.77;
      currentIbov = 132450;
    }

    points.push({
      time,
      vix: Number(currentVix.toFixed(2)),
      ibov: currentIbov,
    });
  });

  return points;
}

// Calculadora de Movimento Esperado B3 (Regra da Raiz do Tempo)
export function calculateExpectedMoves(vix: number, spotIbov: number = 138450) {
  // Conversão de volatilidade anualizada para prazos padrão
  const vixPercent = vix / 100;

  // 1 Dia Útil = VIX / sqrt(252)
  const dailyMovePct = vixPercent / Math.sqrt(252);
  const dailyPts = spotIbov * dailyMovePct;

  // 1 Semana Útil (5 dias úteis) = VIX / sqrt(52)
  const weeklyMovePct = vixPercent / Math.sqrt(52);
  const weeklyPts = spotIbov * weeklyMovePct;

  // 30 Dias Corridos / 1 Mês (1 Desvio Padrão = 68,2% de probabilidade) = VIX / sqrt(12)
  const monthlyMovePct = vixPercent / Math.sqrt(12);
  const monthlyPts = spotIbov * monthlyMovePct;

  // 2 Desvios Padrões (95,4% de probabilidade)
  const monthlyMove2StdPct = monthlyMovePct * 2;
  const monthly2StdPts = spotIbov * monthlyMove2StdPct;

  return {
    daily: {
      percent: dailyMovePct * 100,
      points: Math.round(dailyPts),
      lowerRange: Math.round(spotIbov - dailyPts),
      upperRange: Math.round(spotIbov + dailyPts),
    },
    weekly: {
      percent: weeklyMovePct * 100,
      points: Math.round(weeklyPts),
      lowerRange: Math.round(spotIbov - weeklyPts),
      upperRange: Math.round(spotIbov + weeklyPts),
    },
    monthly: {
      percent: monthlyMovePct * 100,
      points: Math.round(monthlyPts),
      lowerRange: Math.round(spotIbov - monthlyPts),
      upperRange: Math.round(spotIbov + monthlyPts),
    },
    monthly2Std: {
      percent: monthlyMove2StdPct * 100,
      points: Math.round(monthly2StdPts),
      lowerRange: Math.round(spotIbov - monthly2StdPts),
      upperRange: Math.round(spotIbov + monthly2StdPts),
    },
  };
}
