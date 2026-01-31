import { useState, useEffect, useCallback } from 'react';
import {
  getCase,
  updateCase as dbUpdateCase,
  getReportsForCase,
  createReport as dbCreateReport,
} from '@/lib/database';
import { audit } from '@/lib/audit';
import { savePdfToCase, pickPdfDocument } from '@/lib/storage';
import { analyzeReport, analyzeMultipleReportsWithAI, generateRecoveryBrief, smartAnalyze, isBailBondDocument } from '@/lib/analyzer';
import { getSettings } from '@/lib/storage';
import type { Case, Report, ParsedReport, RecoveryBrief } from '@/types';

export interface UseCaseReturn {
  caseData: Case | null;
  reports: Report[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateCase: (updates: Partial<Pick<Case, 'name' | 'notes' | 'attestationAccepted' | 'primaryTarget'>>) => Promise<void>;
  uploadPdf: () => Promise<{ success: boolean; report?: Report; error?: string }>;
  analyzeText: (text: string) => Promise<{ success: boolean; data?: ParsedReport; error?: string; isAssociateDocument?: boolean }>;
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
    async (updates: Partial<Pick<Case, 'name' | 'notes' | 'attestationAccepted' | 'primaryTarget'>>) => {
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
    ): Promise<{ success: boolean; data?: ParsedReport; error?: string; isAssociateDocument?: boolean }> => {
      if (!caseId || !caseData) {
        return { success: false, error: 'No case selected' };
      }

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return { success: false, error: 'No text provided for analysis' };
      }

      try {
        // Get API keys from settings
        const settings = await getSettings();
        const anthropicKey = settings.anthropicApiKey;
        const openaiKey = settings.openaiApiKey;

        console.log('Anthropic Key present:', !!anthropicKey);
        console.log('OpenAI Key present:', !!openaiKey);
        console.log('Primary target on case:', caseData.primaryTarget?.fullName || 'NOT SET');

        let result: { success: boolean; data?: ParsedReport; error?: string; isAssociateDocument?: boolean };
        let isAssociateDocument = false;

        // Prefer Claude (Anthropic) for bail document analysis
        if (anthropicKey && anthropicKey.startsWith('sk-ant-')) {
          const docType = isBailBondDocument(text) ? 'bail bond' : 'skip-trace';
          console.log(`Using Claude for ${docType} analysis`);

          try {
            // Import and use Claude analyzer directly
            const { analyzeBailDocument } = await import('@/lib/bail-document-analyzer');

            // Pass primary target context if we have one (for associate document detection)
            const claudeResult = await analyzeBailDocument(
              text,
              anthropicKey,
              caseData.primaryTarget || undefined
            );

            if (claudeResult.success && claudeResult.report) {
              result = { success: true, data: claudeResult.report };
              isAssociateDocument = claudeResult.isAssociateDocument || false;

              // If this is the FIRST document (no primary target set), lock in the subject as primary target
              if (!caseData.primaryTarget && claudeResult.report.subject?.fullName && claudeResult.report.subject.fullName !== 'Unknown') {
                const subj = claudeResult.report.subject;
                console.log('Setting primary target:', subj.fullName);
                await dbUpdateCase(caseId, {
                  primaryTarget: {
                    fullName: subj.fullName,
                    dob: subj.dob,
                    aliases: subj.aliases,
                    height: subj.height,
                    weight: subj.weight,
                    race: subj.race,
                    sex: subj.sex,
                    hairColor: subj.hairColor,
                    eyeColor: subj.eyeColor,
                  },
                });
              }
            } else {
              result = { success: false, error: claudeResult.error };
            }
          } catch (claudeError: any) {
            console.error('Claude analyze error:', claudeError);
            return {
              success: false,
              error: `Claude Error: ${claudeError?.message || 'Connection failed. Check your Anthropic API key in Settings.'}`
            };
          }
        } else if (openaiKey && openaiKey.startsWith('sk-')) {
          // Fallback to OpenAI
          console.log('Using OpenAI for analysis');
          try {
            result = await smartAnalyze(text, openaiKey);
            // OpenAI path doesn't have primary target support yet - set target from first doc
            if (!caseData.primaryTarget && result.success && result.data?.subject?.fullName && result.data.subject.fullName !== 'Unknown') {
              const subj = result.data.subject;
              await dbUpdateCase(caseId, {
                primaryTarget: {
                  fullName: subj.fullName,
                  dob: subj.dob,
                  aliases: subj.aliases,
                  height: subj.height,
                  weight: subj.weight,
                  race: subj.race,
                  sex: subj.sex,
                  hairColor: subj.hairColor,
                  eyeColor: subj.eyeColor,
                },
              });
            }
          } catch (aiError: any) {
            console.error('OpenAI error:', aiError);
            return {
              success: false,
              error: `OpenAI Error: ${aiError?.message || 'Connection failed.'}`
            };
          }
        } else {
          // No valid API key - try backend proxy
          console.log('No valid API key, using backend proxy');
          try {
            result = await analyzeReport(text, {
              useAI: true,
              useBackend: true,
            });
          } catch (backendError: any) {
            console.error('Backend error:', backendError);
            return {
              success: false,
              error: `No API key configured. Add your Anthropic or OpenAI API key in Settings.`
            };
          }
        }

        if (!result.success || !result.data) {
          return { success: false, error: result.error || 'Analysis failed' };
        }

        // Save the report
        const report = await dbCreateReport(caseId, result.data);

        // Enrich case with charges/bond from report if not already set
        try {
          const caseUpdates: Record<string, any> = {};
          const recs = result.data.recommendations || [];

          // Extract charges from recommendations (e.g., "Charge: THEFT")
          if (!caseData.charges?.length) {
            const chargeRecs = recs
              .filter((r: string) => r.startsWith('Charge:'))
              .map((r: string) => r.replace('Charge: ', '').trim())
              .filter(Boolean);
            if (chargeRecs.length > 0) caseUpdates.charges = chargeRecs;
          }

          // Extract bond amount from recommendations (e.g., "Total Bond: $50,000")
          if (!caseData.bondAmount) {
            const bondRec = recs.find((r: string) => r.includes('Total Bond'));
            if (bondRec) {
              const match = bondRec.match(/\$([\d,]+)/);
              if (match) {
                const amount = parseInt(match[1].replace(/,/g, ''), 10);
                if (amount > 0) caseUpdates.bondAmount = amount;
              }
            }
          }

          if (Object.keys(caseUpdates).length > 0) {
            console.log('Enriching case with report data:', Object.keys(caseUpdates));
            await dbUpdateCase(caseId, caseUpdates);
          }
        } catch (enrichErr) {
          console.warn('Case enrichment failed (non-critical):', enrichErr);
        }

        // Log the analysis
        await audit('report_parsed', {
          caseId,
          caseName: caseData.name,
          additionalInfo: `Method: ${result.data.parseMethod}${isAssociateDocument ? ' (Associate Document)' : ''}`,
        });

        await refresh();

        return { success: true, data: result.data, isAssociateDocument };
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
