import { PositionRecord } from '../types';

function getLocalKey(userId?: string): string {
  const safeId = userId && userId.trim() ? userId.trim() : 'guest';
  return `b3_strategies_cache_${safeId}`;
}

export const strategyService = {
  // Synchronous local read for instant UI hydration on mount (0ms latency)
  getLocalStrategies(userId?: string): PositionRecord[] {
    try {
      const cached = localStorage.getItem(getLocalKey(userId));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler estratégias do localStorage:', e);
    }
    return [];
  },

  // Synchronous local write
  setLocalStrategies(userId: string | undefined, list: PositionRecord[]): void {
    try {
      localStorage.setItem(getLocalKey(userId), JSON.stringify(list));
    } catch (e) {
      console.warn('Erro ao salvar estratégias no localStorage:', e);
    }
  },

  // Fetch strategies for user with robust server-sync and localStorage resilience
  async fetchUserStrategies(token: string, userId: string): Promise<PositionRecord[]> {
    const localList = this.getLocalStrategies(userId);

    // If guest or no token, return local list directly
    if (!token || !userId || userId === 'guest') {
      return localList;
    }

    try {
      const res = await fetch('/api/strategies', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const serverList: PositionRecord[] = data.data;

          // Check if there are local strategies created offline or not yet on server
          const serverIdSet = new Set(serverList.map((s) => s.id));
          const unsyncedLocals = localList.filter((l) => !serverIdSet.has(l.id));

          if (unsyncedLocals.length > 0) {
            // Automatically sync missing local strategies to the server DB
            await this.bulkSync(token, unsyncedLocals);
            const merged = [...unsyncedLocals.map((u) => ({ ...u, userId })), ...serverList];
            this.setLocalStrategies(userId, merged);
            return merged;
          }

          // Update local cache with fresh server data
          this.setLocalStrategies(userId, serverList);
          return serverList;
        }
      }
    } catch (err) {
      console.warn('Erro ao conectar ao servidor de estratégias, mantendo cache local:', err);
    }

    // Always fallback to the local cache if server is unreachable
    return localList;
  },

  // Save new or update existing strategy (writes to localStorage immediately + syncs to server)
  async saveStrategy(token: string, strategy: PositionRecord, userId?: string): Promise<PositionRecord> {
    const effectiveUserId = userId || strategy.userId || 'guest';
    const normalizedStrategy: PositionRecord = {
      ...strategy,
      userId: effectiveUserId,
      lastUpdated: new Date().toISOString(),
    };

    // 1. Immediately update localStorage for instant persistence
    const currentList = this.getLocalStrategies(effectiveUserId);
    const existingIndex = currentList.findIndex((s) => s.id === normalizedStrategy.id);
    let updatedList: PositionRecord[];
    if (existingIndex >= 0) {
      updatedList = [...currentList];
      updatedList[existingIndex] = normalizedStrategy;
    } else {
      updatedList = [normalizedStrategy, ...currentList];
    }
    this.setLocalStrategies(effectiveUserId, updatedList);

    // 2. Persist to server backend if user is authenticated
    if (token && effectiveUserId !== 'guest') {
      try {
        const res = await fetch('/api/strategies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(normalizedStrategy),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            return data.data;
          }
        }
      } catch (err) {
        console.warn('Falha na sincronização com servidor, mas mantida no cache local:', err);
      }
    }

    return normalizedStrategy;
  },

  // Update existing strategy
  async updateStrategy(
    token: string,
    id: string,
    partial: Partial<PositionRecord>,
    userId?: string
  ): Promise<boolean> {
    const effectiveUserId = userId || 'guest';

    // 1. Update localStorage immediately
    const currentList = this.getLocalStrategies(effectiveUserId);
    const updatedList = currentList.map((p) =>
      p.id === id ? { ...p, ...partial, lastUpdated: new Date().toISOString() } : p
    );
    this.setLocalStrategies(effectiveUserId, updatedList);

    // 2. Update server if authenticated
    if (token && effectiveUserId !== 'guest') {
      try {
        const res = await fetch(`/api/strategies/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(partial),
        });
        return res.ok;
      } catch (err) {
        console.warn('Erro ao atualizar estratégia no servidor:', err);
      }
    }

    return true;
  },

  // Delete strategy
  async deleteStrategy(token: string, id: string, userId?: string): Promise<boolean> {
    const effectiveUserId = userId || 'guest';

    // 1. Remove from localStorage immediately
    const currentList = this.getLocalStrategies(effectiveUserId);
    const updatedList = currentList.filter((p) => p.id !== id);
    this.setLocalStrategies(effectiveUserId, updatedList);

    // 2. Remove from server if authenticated
    if (token && effectiveUserId !== 'guest') {
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
      }
    }

    return true;
  },

  // Bulk sync local strategies to server
  async bulkSync(token: string, strategies: PositionRecord[]): Promise<void> {
    if (!strategies || strategies.length === 0 || !token) return;
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

  // Migrate any guest strategies to the user profile when logging in
  async migrateGuestStrategiesToUser(token: string, userId: string): Promise<PositionRecord[]> {
    if (!userId || userId === 'guest') return [];
    const guestList = this.getLocalStrategies('guest');
    if (guestList.length === 0) return [];

    const reassigned = guestList.map((s) => ({
      ...s,
      userId,
      lastUpdated: new Date().toISOString(),
    }));

    // Merge into user's local storage
    const userList = this.getLocalStrategies(userId);
    const userIds = new Set(userList.map((u) => u.id));
    const newItems = reassigned.filter((r) => !userIds.has(r.id));
    const merged = [...newItems, ...userList];
    this.setLocalStrategies(userId, merged);

    // Clear guest storage
    try {
      localStorage.removeItem(getLocalKey('guest'));
    } catch (e) {
      // ignore
    }

    // Sync to server
    if (token && newItems.length > 0) {
      await this.bulkSync(token, newItems);
    }

    return merged;
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
};
