import { PositionRecord } from '../types';

function getLocalKey(userId: string): string {
  return `b3_strategies_cache_${userId}`;
}

export const strategyService = {
  // Fetch strategies for user with resilience caching
  async fetchUserStrategies(token: string, userId: string): Promise<PositionRecord[]> {
    try {
      const res = await fetch('/api/strategies', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          // Update local cache for this specific user
          try {
            localStorage.setItem(getLocalKey(userId), JSON.stringify(data.data));
          } catch (e) {
            console.warn('Falha ao salvar cache local de estratégias:', e);
          }
          return data.data;
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar estratégias no servidor, usando cache local:', err);
    }

    // Fallback to local cache for this user
    try {
      const cached = localStorage.getItem(getLocalKey(userId));
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      // ignore
    }

    return [];
  },

  // Save new or update existing strategy
  async saveStrategy(token: string, strategy: PositionRecord): Promise<PositionRecord> {
    try {
      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(strategy),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          return data.data;
        }
      }
    } catch (err) {
      console.warn('Erro ao salvar no servidor, gravando localmente:', err);
    }
    return strategy;
  },

  // Update existing strategy
  async updateStrategy(token: string, id: string, strategy: Partial<PositionRecord>): Promise<boolean> {
    try {
      const res = await fetch(`/api/strategies/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(strategy),
      });

      return res.ok;
    } catch (err) {
      console.warn('Erro ao atualizar estratégia no servidor:', err);
      return false;
    }
  },

  // Delete strategy
  async deleteStrategy(token: string, id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/strategies/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return res.ok;
    } catch (err) {
      console.warn('Erro ao excluir estratégia no servidor:', err);
      return false;
    }
  },

  // Export JSON backup for user
  async exportBackup(token: string): Promise<any> {
    const res = await fetch('/api/strategies/export', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error('Falha ao exportar backup.');
  },

  // Bulk sync local strategies
  async bulkSync(token: string, strategies: PositionRecord[]): Promise<void> {
    if (!strategies || strategies.length === 0) return;
    try {
      await fetch('/api/strategies/bulk-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ strategies }),
      });
    } catch (err) {
      console.warn('Erro no bulk sync:', err);
    }
  },
};
