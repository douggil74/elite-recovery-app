import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllCases,
  createCase as dbCreateCase,
  deleteCase as dbDeleteCase,
  cleanupExpiredCases,
  getReportsForCase,
} from '@/lib/database';
import { audit } from '@/lib/audit';
import { deleteCaseDirectory } from '@/lib/storage';
import { syncCase, deleteSyncedCase, isSyncEnabled } from '@/lib/sync';
import type { Case, CasePurpose } from '@/types';
import type { CaseStatus } from '@/components/CaseCard';

export interface CaseWithStats extends Case {
  status: CaseStatus;
  addressCount: number;
  phoneCount: number;
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
    notes?: string
  ) => Promise<Case>;
  deleteCase: (id: string) => Promise<void>;
}

export function useCases(): UseCasesReturn {
  const [cases, setCases] = useState<CaseWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Cleanup expired cases first
      await cleanupExpiredCases();

      // Fetch all cases
      const allCases = await getAllCases();

      // Fetch stats for each case
      const casesWithStats: CaseWithStats[] = await Promise.all(
        allCases.map(async (c) => {
          try {
            const reports = await getReportsForCase(c.id);
            const latestReport = reports[0];
            const addressCount = latestReport?.parsedData?.addresses?.length || 0;
            const phoneCount = latestReport?.parsedData?.phones?.length || 0;

            let status: CaseStatus = 'new';
            if (latestReport) {
              status = addressCount > 0 || phoneCount > 0 ? 'has_data' : 'new';
            }

            return { ...c, status, addressCount, phoneCount };
          } catch {
            return { ...c, status: 'new' as CaseStatus, addressCount: 0, phoneCount: 0 };
          }
        })
      );

      setCases(casesWithStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createCase = useCallback(
    async (
      name: string,
      purpose: CasePurpose,
      internalCaseId?: string,
      notes?: string
    ): Promise<Case> => {
      const newCase = await dbCreateCase(name, purpose, internalCaseId, notes);

      await audit('case_created', {
        caseId: newCase.id,
        caseName: name,
        additionalInfo: `Purpose: ${purpose}`,
      });

      // Sync to cloud
      const cloudEnabled = await isSyncEnabled();
      if (cloudEnabled) {
        await syncCase(newCase);
      }

      await refresh();
      return newCase;
    },
    [refresh]
  );

  const deleteCase = useCallback(
    async (id: string) => {
      const caseToDelete = cases.find((c) => c.id === id);

      // Delete from database (cascade deletes reports)
      await dbDeleteCase(id);

      // Delete associated files
      await deleteCaseDirectory(id);

      // Clear chat and photo from AsyncStorage
      await AsyncStorage.removeItem(`case_chat_${id}`);
      await AsyncStorage.removeItem(`case_photo_${id}`);

      // Delete from cloud
      const cloudEnabled = await isSyncEnabled();
      if (cloudEnabled) {
        await deleteSyncedCase(id);
      }

      // Log audit
      await audit('case_deleted', {
        caseId: id,
        caseName: caseToDelete?.name,
      });

      await refresh();
    },
    [cases, refresh]
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
