import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import {
  getAllCases,
  createCase as dbCreateCase,
  deleteCase as dbDeleteCase,
  cleanupExpiredCases,
  pendingDeletes,
  CreateCaseOptions,
} from '@/lib/database';
import { getCurrentUserId } from '@/lib/auth-state';
import { audit } from '@/lib/audit';
import { deleteCaseDirectory } from '@/lib/storage';
import { isSyncEnabled, subscribeToAllCases } from '@/lib/sync';
import type { Case, CasePurpose } from '@/types';
import type { CaseStatus } from '@/components/CaseCard';

export interface CaseWithStats extends Case {
  status: CaseStatus;
  addressCount: number;
  phoneCount: number;
  mugshotUrl?: string;
}

export interface UseCasesReturn {
  cases: CaseWithStats[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCase: (
    name: string,
    purpose: CasePurpose,
    internalCaseId?: string,
    notes?: string,
    ftaScore?: number,
    ftaRiskLevel?: 'LOW RISK' | 'MODERATE RISK' | 'HIGH RISK' | 'VERY HIGH RISK',
    options?: Partial<CreateCaseOptions>
  ) => Promise<Case>;
  deleteCase: (id: string) => Promise<void>;
}

// Lightweight case list — no extra Firestore reads per case
function toCaseWithStats(c: Case): CaseWithStats {
  return {
    ...c,
    status: 'new' as CaseStatus,
    addressCount: 0,
    phoneCount: 0,
    mugshotUrl: c.mugshotUrl || undefined,
  };
}

export function useCases(): UseCasesReturn {
  const [cases, setCases] = useState<CaseWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const subscribedForUid = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Cleanup expired cases in background (never block)
      cleanupExpiredCases().catch(() => {});

      // Fetch cases from Firestore — cache-first, timeout protected
      const allCases = await getAllCases();
      // Filter out any cases with pending deletes so they don't reappear
      setCases(allCases.filter(c => !pendingDeletes.has(c.id)).map(toCaseWithStats));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setIsLoading(false);
    }

    // Set up real-time subscription in background — never blocks loading
    try {
      const uid = getCurrentUserId();
      if (uid && uid !== subscribedForUid.current) {
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
        const syncEnabled = await isSyncEnabled();
        if (syncEnabled) {
          subscribedForUid.current = uid;
          unsubRef.current = subscribeToAllCases((cloudCases) => {
            setCases(cloudCases.filter(c => !pendingDeletes.has(c.id)).map(toCaseWithStats));
          });
        }
      }
    } catch {
      // Subscription setup failed — non-critical
    }
  }, []);

  useEffect(() => {
    refresh();

    // On web: refresh when the tab becomes visible again after being backgrounded.
    // The Firestore WebSocket gets throttled/closed in background tabs, so data
    // can be stale when the user returns. This gives immediate fresh-from-cache data.
    let handleVisibility: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          console.log('[useCases] Tab visible — refreshing');
          refresh().catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      if (handleVisibility) {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
        subscribedForUid.current = null;
      }
    };
  }, [refresh]);

  const createCase = useCallback(
    async (
      name: string,
      purpose: CasePurpose,
      internalCaseId?: string,
      notes?: string,
      ftaScore?: number,
      ftaRiskLevel?: 'LOW RISK' | 'MODERATE RISK' | 'HIGH RISK' | 'VERY HIGH RISK',
      options?: Partial<CreateCaseOptions>
    ): Promise<Case> => {
      // createCase in database.ts writes directly to Firestore
      const newCase = await dbCreateCase(name, purpose, internalCaseId, notes, ftaScore, ftaRiskLevel, options);

      // Non-blocking: audit and refresh in background so navigation isn't delayed
      audit('case_created', {
        caseId: newCase.id,
        caseName: name,
        additionalInfo: `Purpose: ${purpose}`,
      }).catch(() => {});
      refresh().catch(() => {});

      return newCase;
    },
    [refresh]
  );

  const deleteCase = useCallback(
    async (id: string) => {
      const caseToDelete = cases.find((c) => c.id === id);

      // OPTIMISTIC UPDATE - Remove from UI immediately
      setCases(prev => prev.filter(c => c.id !== id));

      // Delete from Firestore (handles subcollections) and local files in parallel
      Promise.all([
        dbDeleteCase(id),
        deleteCaseDirectory(id),
      ]).catch(err => console.error('Delete error:', err));

      audit('case_deleted', {
        caseId: id,
        caseName: caseToDelete?.name,
      }).catch(() => {});
    },
    [cases]
  );

  return {
    cases,
    isLoading,
    error,
    refresh,
    createCase,
    deleteCase,
  };
}
