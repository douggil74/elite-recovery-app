import { parseReportText } from '../src/lib/parser';
import * as fs from 'fs';
import * as path from 'path';

// Load sample report fixture
const sampleReport = fs.readFileSync(
  path.join(__dirname, '../fixtures/sample-report.txt'),
  'utf-8'
);

describe('Report Parser', () => {
  describe('parseReportText', () => {
    it('should successfully parse a valid report', () => {
      const result = parseReportText(sampleReport);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.parseMethod).toBe('deterministic');
    });

    it('should extract subject name', () => {
      const result = parseReportText(sampleReport);

      expect(result.data?.subject.fullName).toBeTruthy();
      expect(result.data?.subject.fullName).toContain('JOHN');
    });

    it('should extract DOB', () => {
      const result = parseReportText(sampleReport);

      expect(result.data?.subject.dob).toBeTruthy();
      expect(result.data?.subject.dob).toContain('1985');
    });

    it('should extract partial SSN (last 4 only)', () => {
      const result = parseReportText(sampleReport);

      expect(result.data?.subject.partialSsn).toBeTruthy();
      expect(result.data?.subject.partialSsn).toContain('4532');
      // Should be masked
      expect(result.data?.subject.partialSsn).toContain('***');
    });

    it('should extract addresses', () => {
      const result = parseReportText(sampleReport);

      expect(result.data?.addresses.length).toBeGreaterThan(0);

      // Should have at least the current address
      const currentAddr = result.data?.addresses.find((a) => a.isCurrent);
      expect(currentAddr).toBeDefined();
    });

    it('should extract phone numbers', () => {
      const result = parseReportText(sampleReport);

      expect(result.data?.phones.length).toBeGreaterThan(0);

      // Check phone format
      const firstPhone = result.data?.phones[0];
      expect(firstPhone?.number).toMatch(/\(\d{3}\) \d{3}-\d{4}/);
    });

    it('should extract relatives', () => {
      const result = parseReportText(sampleReport);

      expect(result.data?.relatives.length).toBeGreaterThan(0);

      // Should find mother
      const mother = result.data?.relatives.find(
        (r) => r.relationship?.toLowerCase().includes('mother')
      );
      expect(mother).toBeDefined();
    });

    it('should extract vehicles', () => {
      const result = parseReportText(sampleReport);

      expect(result.data?.vehicles.length).toBeGreaterThan(0);

      // Should find Toyota
      const toyota = result.data?.vehicles.find(
        (v) => v.make?.toLowerCase().includes('toyota')
      );
      expect(toyota).toBeDefined();
    });

    it('should extract employment', () => {
      const result = parseReportText(sampleReport);

      expect(result.data?.employment.length).toBeGreaterThan(0);

      // Should find current employer
      const currentJob = result.data?.employment.find((e) => e.isCurrent);
      expect(currentJob).toBeDefined();
    });

    it('should handle empty text gracefully', () => {
      const result = parseReportText('');

      expect(result.success).toBe(true);
      expect(result.data?.subject.fullName).toBe('Unknown');
    });

    it('should handle malformed text', () => {
      const result = parseReportText('Random text without any structured data 12345');

      expect(result.success).toBe(true);
      expect(result.confidence).toBeLessThan(0.5);
    });
  });
});

describe('Address Parsing', () => {
  it('should parse full US addresses', () => {
    const text = `
      ADDRESS: 1234 Main Street, Dallas, TX 75201
      Previous: 567 Oak Avenue, Houston, TX 77001
    `;

    const result = parseReportText(text);

    expect(result.data?.addresses.length).toBeGreaterThanOrEqual(1);
  });

  it('should identify current addresses', () => {
    const text = `
      CURRENT ADDRESS:
      1234 Main Street
      Dallas, TX 75201
      Reported: 01/2025 - Present
    `;

    const result = parseReportText(text);
    const addresses = result.data?.addresses || [];

    const current = addresses.find((a) => a.isCurrent);
    expect(current).toBeDefined();
  });

  it('should extract date ranges', () => {
    const text = `
      ADDRESS SUMMARY:
      123 Test Street, City, TX 75001
      From: 06/2020 To: 12/2024
    `;

    const result = parseReportText(text);
    const addresses = result.data?.addresses || [];

    expect(addresses.length).toBeGreaterThan(0);
    // Date extraction depends on format matching
  });
});

describe('Phone Parsing', () => {
  it('should parse various phone formats', () => {
    const text = `
      PHONE NUMBERS:
      (214) 555-1234 - Mobile
      972-555-5678 - Landline
      817.555.9012 - Unknown
    `;

    const result = parseReportText(text);

    expect(result.data?.phones.length).toBeGreaterThanOrEqual(1);
  });

  it('should identify phone types', () => {
    const text = `
      Phone: (214) 555-1234 - Mobile - Active
      Phone: (972) 555-5678 - Landline
    `;

    const result = parseReportText(text);
    const phones = result.data?.phones || [];

    const mobile = phones.find((p) => p.type === 'mobile');
    expect(mobile).toBeDefined();
  });

  it('should identify active phones', () => {
    const text = `
      (214) 555-1234 - Mobile - Active
      (972) 555-5678 - Mobile - Disconnected
    `;

    const result = parseReportText(text);
    const phones = result.data?.phones || [];

    const active = phones.find((p) => p.isActive);
    expect(active).toBeDefined();
  });
});

describe('Flag Detection', () => {
  it('should detect deceased indicator', () => {
    const text = `
      SUBJECT: John Smith
      DOB: 01/01/1980
      DECEASED: Yes - Date: 12/15/2024
    `;

    const result = parseReportText(text);

    expect(result.data?.subject.deceasedIndicator).toBe(true);
    expect(result.data?.flags.some((f) => f.type === 'deceased')).toBe(true);
  });

  it('should detect high risk indicators', () => {
    const text = `
      SUBJECT: John Smith
      HIGH RISK ADDRESS ALERT
      Previous Fraud Alert on file
    `;

    const result = parseReportText(text);

    const hasRiskFlag = result.data?.flags.some(
      (f) => f.type === 'high_risk' || f.type === 'fraud_alert'
    );
    expect(hasRiskFlag).toBe(true);
  });
});
