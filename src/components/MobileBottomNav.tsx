import React from 'react';
import {
  Calendar,
  TrendingUp,
  Cpu,
  Layers,
  Flame,
  BookOpen,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'simulator' | 'catalog' | 'scenarios' | 'roll' | 'academy' | 'vix';
  setActiveTab: (tab: 'simulator' | 'catalog' | 'scenarios' | 'roll' | 'academy' | 'vix') => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const navItems: Array<{
    id: 'simulator' | 'catalog' | 'scenarios' | 'roll' | 'academy' | 'vix';
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    {
      id: 'roll',
      label: 'Rolagem',
      shortLabel: 'Rolagem',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: 'simulator',
      label: 'Simulador',
      shortLabel: 'Simular',
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      id: 'scenarios',
      label: 'Cenários',
      shortLabel: 'Cenários',
      icon: <Cpu className="w-4 h-4" />,
    },
    {
      id: 'catalog',
      label: 'Catálogo',
      shortLabel: 'Catálogo',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      id: 'vix',
      label: 'VIX B3',
      shortLabel: 'VIX B3',
      icon: <Flame className="w-4 h-4 text-rose-400" />,
      badge: '32,77',
    },
    {
      id: 'academy',
      label: 'Academy',
      shortLabel: 'Academy',
      icon: <BookOpen className="w-4 h-4" />,
    },
  ];

  return (
    <nav
      aria-label="Navegação Principal Mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800/90 backdrop-blur-xl px-1 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom,0px))] shadow-2xl"
    >
      <div className="grid grid-cols-6 gap-0.5 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center min-h-[48px] py-1 px-0.5 rounded-xl transition cursor-pointer select-none active:scale-95 ${
                isActive
                  ? 'text-emerald-400 font-bold bg-emerald-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.badge && (
                <span className="absolute -top-1 right-0.5 text-[8px] font-mono font-black px-1 rounded bg-rose-500 text-white shadow-sm leading-tight animate-pulse">
                  {item.badge}
                </span>
              )}
              <div className={`${isActive ? 'scale-110 text-emerald-400' : ''} transition-transform`}>
                {item.icon}
              </div>
              <span className="text-[9.5px] mt-0.5 tracking-tight leading-none truncate max-w-full">
                {item.shortLabel}
              </span>
              {isActive && (
                <div className="w-3.5 h-0.5 bg-emerald-400 rounded-full mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
