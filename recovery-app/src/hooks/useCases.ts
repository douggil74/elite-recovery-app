import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllCases,
  createCase as dbCreateCase,
  deleteCase as dbDeleteCase,
  cleanupExpiredCases,
  getReportsForCase,
  CreateCaseOptions,
} from '@/lib/database';
import { audit } from '@/lib/audit';
import { deleteCaseDirectory } from '@/lib/storage';
import { syncCase, deleteSyncedCase, isSyncEnabled, fetchSyncedCases } from '@/lib/sync';
import { createCase as dbCreateCaseFromCloud } from '@/lib/database';
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

      // Fetch local cases
      let allCases = await getAllCases();

      // If cloud sync is enabled, also pull from Firestore and merge
      const cloudEnabled = await isSyncEnabled();
      if (cloudEnabled) {
        try {
          const cloudCases = await fetchSyncedCases();
          if (cloudCases.length > 0) {
            // Merge cloud cases with local - cloud wins for conflicts
            const localIds = new Set(allCases.map(c => c.id));
            const newFromCloud = cloudCases.filter(c => !localIds.has(c.id));

            // Save new cloud cases to local database
            for (const cloudCase of newFromCloud) {
              try {
                await dbCreateCaseFromCloud(
                  cloudCase.name,
                  cloudCase.purpose || 'bail_recovery',
                  cloudCase.internalCaseId,
                  cloudCase.notes,
                  cloudCase.ftaScore,
                  cloudCase.ftaRiskLevel,
                  { existingId: cloudCase.id, skipSync: true }
                );
              } catch (e) {
                console.warn('Failed to save cloud case locally:', e);
              }
            }

            // Refresh local cases after merge
            if (newFromCloud.length > 0) {
              allCases = await getAllCases();
            }
          }
        } catch (syncErr) {
          console.warn('Cloud sync fetch failed:', syncErr);
          // Continue with local cases
        }
      }

      // Fetch stats and photos for each case
      const casesWithStats: CaseWithStats[] = await Promise.all(
        allCases.map(async (c) => {
          try {
            const [reports, mugshotUrl] = await Promise.all([
              getReportsForCase(c.id),
              AsyncStorage.getItem(`case_photo_${c.id}`),
            ]);
            const latestReport = reports[0];
            const addressCount = latestReport?.parsedData?.addresses?.length || 0;
            const phoneCount = latestReport?.parsedData?.phones?.length || 0;

            let status: CaseStatus = 'new';
            if (latestReport) {
              status = addressCount > 0 || phoneCount > 0 ? 'has_data' : 'new';
            }

            return {
              ...c,
              status,
              addressCount,
              phoneCount,
              mugshotUrl: mugshotUrl || undefined,
            };
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
      notes?: string,
      ftaScore?: number,
      ftaRiskLevel?: 'LOW RISK' | 'MODERATE RISK' | 'HIGH RISK' | 'VERY HIGH RISK',
      options?: Partial<CreateCaseOptions>
    ): Promise<Case> => {
      const newCase = await dbCreateCase(name, purpose, internalCaseId, notes, ftaScore, ftaRiskLevel, options);

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

      // OPTIMISTIC UPDATE - Remove from UI immediately
      setCases(prev => prev.filter(c => c.id !== id));

      // Delete everything in background (don't await)
      Promise.all([
        dbDeleteCase(id),
        deleteCaseDirectory(id),
        AsyncStorage.multiRemove([
          `case_chat_${id}`,
          `case_photo_${id}`,
          `case_squad_${id}`,
          `case_social_${id}`,
          `case_all_photo_intel_${id}`,
          `case_face_${id}`,
        ]),
      ]).catch(err => console.error('Delete cleanup error:', err));

      // Cloud sync and audit in background
      isSyncEnabled().then(enabled => {
        if (enabled) deleteSyncedCase(id).catch(() => {});
      });

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
