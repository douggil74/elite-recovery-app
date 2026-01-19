import { useState, useEffect, useCallback } from 'react';
import {
  getCase,
  updateCase as dbUpdateCase,
  getReportsForCase,
  createReport as dbCreateReport,
} from '@/lib/database';
import { audit } from '@/lib/audit';
import { savePdfToCase, pickPdfDocument } from '@/lib/storage';
import { analyzeReport, analyzeMultipleReportsWithAI, generateRecoveryBrief } from '@/lib/analyzer';
import { getSettings } from '@/lib/storage';
import type { Case, Report, ParsedReport, RecoveryBrief } from '@/types';

export interface UseCaseReturn {
  caseData: Case | null;
  reports: Report[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateCase: (updates: Partial<Pick<Case, 'name' | 'notes' | 'attestationAccepted'>>) => Promise<void>;
  uploadPdf: () => Promise<{ success: boolean; report?: Report; error?: string }>;
  analyzeText: (text: string) => Promise<{ success: boolean; data?: ParsedReport; error?: string }>;
  analyzeMultipleReports: (reports: { label: string; text: string; relationship: string }[]) => Promise<{ success: boolean; error?: string }>;
  getBrief: () => RecoveryBrief | null;
}

export function useCase(caseId: string): UseCaseReturn {
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!caseId) return;

    try {
      setIsLoading(true);
      setError(null);

      const [fetchedCase, fetchedReports] = await Promise.all([
        getCase(caseId),
        getReportsForCase(caseId),
      ]);

      setCaseData(fetchedCase);
      setReports(fetchedReports);

      if (fetchedCase) {
        await audit('report_viewed', {
          caseId,
          caseName: fetchedCase.name,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load case');
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateCase = useCallback(
    async (updates: Partial<Pick<Case, 'name' | 'notes' | 'attestationAccepted'>>) => {
      if (!caseId) return;

      await dbUpdateCase(caseId, updates);
      await audit('case_updated', {
        caseId,
        caseName: caseData?.name,
        additionalInfo: Object.keys(updates).join(', '),
      });
      await refresh();
    },
    [caseId, caseData?.name, refresh]
  );

  const uploadPdf = useCallback(async (): Promise<{
    success: boolean;
    report?: Report;
    error?: string;
  }> => {
    if (!caseId || !caseData) {
      return { success: false, error: 'No case selected' };
    }

    // Pick PDF file
    const pickResult = await pickPdfDocument();
    if (!pickResult.success || !pickResult.uri) {
      return { success: false, error: pickResult.error || 'No file selected' };
    }

    try {
      // Save PDF to case directory
      const filename = pickResult.name || `report-${Date.now()}.pdf`;
      const savedPath = await savePdfToCase(pickResult.uri, caseId, filename, pickResult.data);

      // Log the upload
      await audit('pdf_uploaded', {
        caseId,
        caseName: caseData.name,
        fileName: filename,
      });

      // For now, return a placeholder - PDF text extraction will be done by backend
      // or user can paste text manually
      return {
        success: true,
        report: undefined, // Will be created after text extraction
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to upload PDF',
      };
    }
  }, [caseId, caseData]);

  const analyzeText = useCallback(
    async (
      text: string
    ): Promise<{ success: boolean; data?: ParsedReport; error?: string }> => {
      if (!caseId || !caseData) {
        return { success: false, error: 'No case selected' };
      }

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return { success: false, error: 'No text provided for analysis' };
      }

      try {
        // Get settings for API key
        const settings = await getSettings();

        // Analyze the text
        const result = await analyzeReport(text, {
          useAI: !!settings.openaiApiKey,
          apiKey: settings.openaiApiKey,
        });

        if (!result.success || !result.data) {
          return { success: false, error: result.error || 'Analysis failed' };
        }

        // Save the report
        const report = await dbCreateReport(caseId, result.data);

        // Log the analysis
        await audit('report_parsed', {
          caseId,
          caseName: caseData.name,
          additionalInfo: `Method: ${result.data.parseMethod}`,
        });

        await refresh();

        return { success: true, data: result.data };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Analysis failed',
        };
      }
    },
    [caseId, caseData, refresh]
  );

  const analyzeMultipleReports = useCallback(
    async (
      reportEntries: { label: string; text: string; relationship: string }[]
    ): Promise<{ success: boolean; error?: string }> => {
      if (!caseId || !caseData) {
        return { success: false, error: 'No case selected' };
      }

      try {
        const settings = await getSettings();

        if (!settings.openaiApiKey) {
          return { success: false, error: 'OpenAI API key required for multi-report analysis' };
        }

        const result = await analyzeMultipleReportsWithAI(reportEntries, settings.openaiApiKey);

        if (!result.success || !result.data) {
          return { success: false, error: result.error || 'Analysis failed' };
        }

        // Save the combined report
        await dbCreateReport(caseId, result.data);

        await audit('report_parsed', {
          caseId,
          caseName: caseData.name,
          additionalInfo: `Multi-report analysis: ${reportEntries.length} reports`,
        });

        await refresh();

        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Analysis failed',
        };
      }
    },
    [caseId, caseData, refresh]
  );

  const getBrief = useCallback((): RecoveryBrief | null => {
    if (!caseData || reports.length === 0) return null;

    const latestReport = reports[0];
    if (!latestReport?.parsedData) return null;

    return generateRecoveryBrief(latestReport.parsedData, caseData.name);
  }, [caseData, reports]);

  return {
    caseData,
    reports,
    isLoading,
    error,
    refresh,
    updateCase,
    uploadPdf,
    analyzeText,
    analyzeMultipleReports,
    getBrief,
  };
}
