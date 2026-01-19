import { logAudit as dbLogAudit, getAuditLog as dbGetAuditLog, clearAuditLogForCase } from './database';
import type { AuditAction, AuditLogEntry } from '@/types';

// Convenience wrapper for audit logging with structured details

interface AuditContext {
  caseId?: string;
  caseName?: string;
  fieldName?: string;
  fileName?: string;
  exportFormat?: string;
  additionalInfo?: string;
}

export async function audit(
  action: AuditAction,
  context?: AuditContext
): Promise<void> {
  let details: string | undefined;

  if (context) {
    const detailParts: string[] = [];

    if (context.caseName) {
      detailParts.push(`Case: ${context.caseName}`);
    }
    if (context.fieldName) {
      detailParts.push(`Field: ${context.fieldName}`);
    }
    if (context.fileName) {
      detailParts.push(`File: ${context.fileName}`);
    }
    if (context.exportFormat) {
      detailParts.push(`Format: ${context.exportFormat}`);
    }
    if (context.additionalInfo) {
      detailParts.push(context.additionalInfo);
    }

    if (detailParts.length > 0) {
      details = detailParts.join(' | ');
    }
  }

  await dbLogAudit(action, context?.caseId, details);
}

export async function getAuditLog(
  options?: { limit?: number; caseId?: string }
): Promise<AuditLogEntry[]> {
  return dbGetAuditLog(options?.limit || 100, options?.caseId);
}

export async function clearCaseAuditLog(caseId: string): Promise<void> {
  await clearAuditLogForCase(caseId);
}

// Helper to format audit entries for display
export function formatAuditEntry(entry: AuditLogEntry): {
  title: string;
  description: string;
  time: string;
} {
  const actionTitles: Record<AuditAction, string> = {
    case_created: 'Case Created',
    case_updated: 'Case Updated',
    case_deleted: 'Case Deleted',
    pdf_uploaded: 'PDF Uploaded',
    report_parsed: 'Report Analyzed',
    report_viewed: 'Report Viewed',
    field_revealed: 'Field Revealed',
    brief_generated: 'Brief Generated',
    brief_exported: 'Brief Exported',
    journey_created: 'Journey Created',
    case_shared: 'Case Shared',
  };

  const date = new Date(entry.timestamp);
  const time = date.toLocaleString();

  return {
    title: actionTitles[entry.action] || entry.action,
    description: entry.details || '',
    time,
  };
}
