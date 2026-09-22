import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { StrategySimulator } from './components/StrategySimulator';
import { StrategyCatalog } from './components/StrategyCatalog';
import { ScenarioAnalysis } from './components/ScenarioAnalysis';
import { RollManager } from './components/RollManager';
import { Academy } from './components/Academy';
import { AuthModal } from './components/AuthModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OptionLeg, PositionRecord, StrategyTemplate, StrategyPerformancePoint } from './types';
import { IBOVESPA_ASSETS } from './data/ibovAssets';
import { STRATEGIES_CATALOG } from './data/strategiesCatalog';
import { fetchQuotes, OpLabQuote } from './utils/oplabApi';
import { strategyService } from './services/strategyService';
import {
  ShieldCheck,
  CheckCircle2,
  Users,
  Download,
  Upload,
  Lock,
  Sparkles,
} from 'lucide-react';

function AppContent() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'simulator' | 'catalog' | 'scenarios' | 'roll' | 'academy'>('roll');
  const [selectedTicker, setSelectedTicker] = useState<string>('BOVA11');
  const [spotPrice, setSpotPrice] = useState<number>(184.20);
  const [interestRate, setInterestRate] = useState<number>(0.1325); // 13.25% Selic
  const [iv, setIv] = useState<number>(0.17); // 17% IV para BOVA11

  // Live Market Quote State
  const [liveQuoteData, setLiveQuoteData] = useState<OpLabQuote | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState<boolean>(false);

  // Initial default strategy in simulator
  const [legs, setLegs] = useState<OptionLeg[]>([
    {
      id: 'leg-stock-1',
      type: 'STOCK',
      side: 'BUY',
      strike: 184.20,
      premium: 184.20,
      quantity: 100,
      daysToExpiry: 0,
      ticker: 'BOVA11',
      exerciseStyle: 'AMERICAN',
    },
    {
      id: 'leg-call-1',
      type: 'CALL',
      side: 'SELL',
      strike: 191.50,
      premium: 3.20,
      quantity: 100,
      daysToExpiry: 22,
      ticker: 'BOVA11J192',
      exerciseStyle: 'AMERICAN',
    },
  ]);

  // Saved portfolio positions - ISOLATED PER USER
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Load strategies whenever authenticated user changes (STRICT MULTI-USER ISOLATION)
  useEffect(() => {
    if (!user || !token) {
      setPositions([]);
      return;
    }

    let isMounted = true;
    const loadUserStrategies = async () => {
      setIsLoadingPositions(true);
      try {
        const userStrategies = await strategyService.fetchUserStrategies(token, user.id);
        if (isMounted) {
          setPositions(userStrategies);
        }
      } catch (err) {
        console.warn('Erro ao carregar estratégias do usuário:', err);
      } finally {
        if (isMounted) {
          setIsLoadingPositions(false);
        }
      }
    };

    loadUserStrategies();
    return () => {
      isMounted = false;
    };
  }, [user?.id, token]);

  // Synchronized state & database updater for positions
  const handleUpdatePositions = (
    updater: PositionRecord[] | ((prev: PositionRecord[]) => PositionRecord[])
  ) => {
    setPositions((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;

      // Asynchronously synchronize changes to persistent backend for current user
      if (user && token) {
        const nextIds = new Set(next.map((p) => p.id));
        // Identify deletions
        prev.forEach((p) => {
          if (!nextIds.has(p.id)) {
            strategyService.deleteStrategy(token, p.id);
          }
        });

        // Identify additions or updates
        next.forEach((p) => {
          const old = prev.find((o) => o.id === p.id);
          if (!old) {
            strategyService.saveStrategy(token, { ...p, userId: user.id });
          } else if (JSON.stringify(old) !== JSON.stringify(p)) {
            strategyService.updateStrategy(token, p.id, { ...p, userId: user.id });
          }
        });
      }

      return next;
    });
  };

  // Switch to strategy from catalog
  const handleSelectStrategy = (template: StrategyTemplate) => {
    const generated = template.createDefaultLegs(spotPrice, selectedTicker);
    setLegs(generated);
    setActiveTab('simulator');
    showToast(`Estratégia "${template.namePt}" carregada com sucesso!`);
  };

  // Save current strategy to positions with full persistence in server DB
  const handleSavePosition = async (
    name: string,
    notes?: string,
    targetProfit?: number,
    stopLoss?: number
  ) => {
    const initialCash = legs.reduce((acc, leg) => {
      const sign = leg.side === 'SELL' ? 1 : -1;
      return acc + sign * leg.premium * leg.quantity;
    }, 0);

    const initialHistoryPoint: StrategyPerformancePoint = {
      date: new Date().toLocaleDateString('pt-BR'),
      spotPrice,
      strategyValue: initialCash,
      unrealizedPnL: 0,
      roiPercent: 0,
    };

    const newPos: PositionRecord = {
      id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      userId: user?.id,
      name,
      ticker: selectedTicker,
      legs: JSON.parse(JSON.stringify(legs)),
      createdAt: new Date().toISOString(),
      status: 'OPEN',
      spotPriceAtEntry: spotPrice,
      initialNetCashflow: initialCash,
      currentNetValue: initialCash,
      unrealizedPnL: 0,
      targetProfit,
      stopLoss,
      notes: notes || `Estratégia montada em ${selectedTicker} com ${legs.length} pernas.`,
      history: [initialHistoryPoint],
      lastUpdated: new Date().toISOString(),
    };

    if (token && user) {
      await strategyService.saveStrategy(token, newPos);
    }

    setPositions((prev) => [newPos, ...prev]);
    showToast(`Posição "${name}" salva com sucesso no portfólio de ${user?.name || 'sua conta'}!`);
  };

  // Function to fetch live asset quote via OpLab API
  const fetchLiveQuote = async (ticker: string, syncLegs: boolean = false) => {
    setIsFetchingQuote(true);
    try {
      const res = await fetchQuotes([ticker]);
      if (res.success && res.data && res.data.length > 0) {
        const q = res.data[0];
        const livePrice = q.close || q.bid || q.ask || spotPrice;
        setSpotPrice(livePrice);
        setLiveQuoteData(q);

        if (syncLegs) {
          const defaultCoveredCall = STRATEGIES_CATALOG[0].createDefaultLegs(livePrice, ticker);
          setLegs(defaultCoveredCall);
        } else {
          setLegs((prev) =>
            prev.map((leg) => {
              if (leg.type === 'STOCK') {
                return {
                  ...leg,
                  strike: livePrice,
                  premium: livePrice,
                  ticker,
                };
              }
              return leg;
            })
          );
        }

        const varText =
          q.variation !== undefined
            ? ` (${q.variation >= 0 ? '+' : ''}${q.variation.toFixed(2)}%)`
            : '';
        showToast(`Cotação de ${ticker} atualizada em tempo real: R$ ${livePrice.toFixed(2)}${varText}`);
      }
    } catch (err: any) {
      console.warn('Erro ao buscar cotação de mercado:', err);
    } finally {
      setIsFetchingQuote(false);
    }
  };

  // Initial mount: fetch live quote for initial selected ticker (BOVA11)
  useEffect(() => {
    fetchLiveQuote(selectedTicker, false);
  }, []);

  // When user changes ticker in the header: INSTANT update with background live sync
  const handleTickerChange = (newTicker: string) => {
    setSelectedTicker(newTicker);
    const asset = IBOVESPA_ASSETS.find((a) => a.ticker === newTicker);
    const initialSpot = asset ? asset.spotPrice : spotPrice;
    if (asset) {
      setIv(asset.ivCurrent);
      setSpotPrice(initialSpot);
    }
    const defaultCoveredCall = STRATEGIES_CATALOG[0].createDefaultLegs(initialSpot, newTicker);
    setLegs(defaultCoveredCall);
    fetchLiveQuote(newTicker, false);
  };

  // Load a saved position into simulator
  const handleLoadPositionToSimulator = async (pos: PositionRecord) => {
    setLegs(JSON.parse(JSON.stringify(pos.legs)));
    setSelectedTicker(pos.ticker);
    const asset = IBOVESPA_ASSETS.find((a) => a.ticker === pos.ticker);
    if (asset) {
      setSpotPrice(asset.spotPrice);
      setIv(asset.ivCurrent);
    }
    setActiveTab('simulator');
    showToast(`Posição "${pos.name}" carregada no Simulador.`);
    await fetchLiveQuote(pos.ticker, false);
  };

  // Export JSON backup of user strategies
  const handleExportBackup = () => {
    if (!user) return;
    const backupData = {
      exportDate: new Date().toISOString(),
      user: { id: user.id, name: user.name, email: user.email },
      totalStrategies: positions.length,
      strategies: positions,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estrategias-b3-${user.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Backup de ${positions.length} estratégias baixado com sucesso!`);
  };

  // Import JSON backup of user strategies
  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const raw = e.target?.result as string;
        const parsed = JSON.parse(raw);
        const importedList: PositionRecord[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.strategies)
          ? parsed.strategies
          : [];

        if (importedList.length === 0) {
          showToast('Nenhuma estratégia encontrada no arquivo selecionado.');
          return;
        }

        if (token && user) {
          await strategyService.bulkSync(token, importedList);
          const refreshed = await strategyService.fetchUserStrategies(token, user.id);
          setPositions(refreshed);
          showToast(`${importedList.length} estratégias restauradas com sucesso na sua conta!`);
        }
      } catch (err) {
        showToast('Erro ao ler arquivo de backup. Formato JSON inválido.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-400/40 text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden file input for backup restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportBackup}
        accept=".json"
        className="hidden"
      />

      {/* Main App Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedTicker={selectedTicker}
        setSelectedTicker={setSelectedTicker}
        spotPrice={spotPrice}
        setSpotPrice={setSpotPrice}
        interestRate={interestRate}
        setInterestRate={setInterestRate}
        iv={iv}
        setIv={setIv}
        isFetchingQuote={isFetchingQuote}
        liveQuoteData={liveQuoteData}
        onRefreshQuote={() => fetchLiveQuote(selectedTicker, false)}
        onTickerChange={handleTickerChange}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Tab Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'simulator' && (
          <StrategySimulator
            legs={legs}
            setLegs={setLegs}
            spotPrice={spotPrice}
            ticker={selectedTicker}
            iv={iv}
            interestRate={interestRate}
            onSavePosition={handleSavePosition}
            onNavigateToScenarios={() => setActiveTab('scenarios')}
            onNavigateToRoll={() => setActiveTab('roll')}
          />
        )}

        {activeTab === 'catalog' && (
          <StrategyCatalog
            spotPrice={spotPrice}
            ticker={selectedTicker}
            onSelectStrategy={handleSelectStrategy}
          />
        )}

        {activeTab === 'scenarios' && (
          <ScenarioAnalysis
            legs={legs}
            spotPrice={spotPrice}
            ticker={selectedTicker}
            iv={iv}
            interestRate={interestRate}
            onNavigateToRoll={() => setActiveTab('roll')}
          />
        )}

        {activeTab === 'roll' && (
          <RollManager
            legs={legs}
            spotPrice={spotPrice}
            ticker={selectedTicker}
            positions={positions}
            setPositions={handleUpdatePositions}
            onLoadPositionToSimulator={handleLoadPositionToSimulator}
            onApplyRolledLegsToSimulator={(rolledLegs) => {
              setLegs(rolledLegs);
              setActiveTab('simulator');
              showToast('Estratégia rolada carregada no Simulador de Payoff!');
            }}
            interestRate={interestRate}
            iv={iv}
          />
        )}

        {activeTab === 'academy' && <Academy />}
      </main>

      {/* Footer & Brazilian Market Notice */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="space-y-1">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="font-bold text-slate-300">OPÇÕES B3 PRO</span>
              <span>•</span>
              <span>Acesso Individualizado & Portfólio Persistente</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Convenção de 252 dias úteis, precificação com Selic/CDI, modelo Black-Scholes adaptado e estimativa de margem CORE B3.
            </p>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Dados Isolados por Usuário
            </span>
            <span>•</span>
            <span>Vencimento B3: 3ª Sexta-Feira</span>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={(name) => {
          showToast(`Conectado com sucesso como ${name}! Suas estratégias estão carregadas.`);
        }}
        onExportBackup={handleExportBackup}
        onImportBackup={() => fileInputRef.current?.click()}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
