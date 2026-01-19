import { rankAddresses, rankPhones } from '../src/lib/parser/ranker';
import type { ParsedAddress, ParsedPhone, ParsedVehicle, ParsedEmployment } from '../src/types';

describe('Address Ranker', () => {
  const mockAddresses: ParsedAddress[] = [
    {
      address: '123 Old Street',
      fullAddress: '123 Old Street, Dallas, TX 75201',
      city: 'Dallas',
      state: 'TX',
      zip: '75201',
      fromDate: '01/2018',
      toDate: '12/2020',
      confidence: 0,
      reasons: [],
      isCurrent: false,
    },
    {
      address: '456 New Avenue',
      fullAddress: '456 New Avenue, Dallas, TX 75202',
      city: 'Dallas',
      state: 'TX',
      zip: '75202',
      fromDate: '01/2024',
      toDate: 'Current',
      confidence: 0,
      reasons: [],
      isCurrent: true,
    },
    {
      address: '789 Middle Road',
      fullAddress: '789 Middle Road, Plano, TX 75024',
      city: 'Plano',
      state: 'TX',
      zip: '75024',
      fromDate: '01/2021',
      toDate: '12/2023',
      confidence: 0,
      reasons: [],
      isCurrent: false,
    },
  ];

  const mockPhones: ParsedPhone[] = [];
  const mockVehicles: ParsedVehicle[] = [];
  const mockEmployment: ParsedEmployment[] = [];

  it('should rank current address highest', () => {
    const ranked = rankAddresses(mockAddresses, mockPhones, mockVehicles, mockEmployment);

    expect(ranked[0].isCurrent).toBe(true);
    expect(ranked[0].fullAddress).toContain('456 New Avenue');
  });

  it('should rank recent addresses higher than old addresses', () => {
    const ranked = rankAddresses(mockAddresses, mockPhones, mockVehicles, mockEmployment);

    // 2024 should be before 2020
    const newIndex = ranked.findIndex((a) => a.fullAddress.includes('New Avenue'));
    const oldIndex = ranked.findIndex((a) => a.fullAddress.includes('Old Street'));

    expect(newIndex).toBeLessThan(oldIndex);
  });

  it('should assign confidence scores', () => {
    const ranked = rankAddresses(mockAddresses, mockPhones, mockVehicles, mockEmployment);

    ranked.forEach((addr) => {
      expect(addr.confidence).toBeGreaterThanOrEqual(0);
      expect(addr.confidence).toBeLessThanOrEqual(1);
    });
  });

  it('should add reasons for ranking', () => {
    const ranked = rankAddresses(mockAddresses, mockPhones, mockVehicles, mockEmployment);

    const current = ranked.find((a) => a.isCurrent);
    expect(current?.reasons.length).toBeGreaterThan(0);
  });

  it('should boost address confidence when linked to vehicle', () => {
    const vehicles: ParsedVehicle[] = [
      {
        year: '2021',
        make: 'Toyota',
        model: 'Camry',
        registeredAddress: '456 New Avenue, Dallas, TX 75202',
      },
    ];

    const ranked = rankAddresses(mockAddresses, mockPhones, vehicles, mockEmployment);
    const linkedAddr = ranked.find((a) => a.fullAddress.includes('New Avenue'));

    expect(linkedAddr?.linkedSignals).toContain('vehicle');
    expect(linkedAddr?.reasons).toContain('Linked to vehicle registration');
  });

  it('should boost address confidence when linked to employment', () => {
    const employment: ParsedEmployment[] = [
      {
        employer: 'ABC Company',
        address: '789 Middle Road, Plano, TX 75024',
        isCurrent: true,
      },
    ];

    const ranked = rankAddresses(mockAddresses, mockPhones, mockVehicles, employment);
    const linkedAddr = ranked.find((a) => a.fullAddress.includes('Middle Road'));

    expect(linkedAddr?.linkedSignals).toContain('employment');
  });

  it('should handle empty address list', () => {
    const ranked = rankAddresses([], mockPhones, mockVehicles, mockEmployment);

    expect(ranked).toHaveLength(0);
  });
});

describe('Phone Ranker', () => {
  const mockPhones: ParsedPhone[] = [
    {
      number: '(214) 555-1111',
      type: 'landline',
      confidence: 0,
      isActive: false,
      lastSeen: '2020',
    },
    {
      number: '(214) 555-2222',
      type: 'mobile',
      confidence: 0,
      isActive: true,
      lastSeen: 'Current',
    },
    {
      number: '(214) 555-3333',
      type: 'mobile',
      confidence: 0,
      isActive: false,
      lastSeen: '2023',
    },
  ];

  const mockAddresses: ParsedAddress[] = [];

  it('should rank active phones highest', () => {
    const ranked = rankPhones(mockPhones, mockAddresses);

    expect(ranked[0].isActive).toBe(true);
  });

  it('should rank mobile phones higher than landlines', () => {
    const ranked = rankPhones(mockPhones, mockAddresses);

    // Both active mobile and inactive mobile should be above inactive landline
    const mobileIndices = ranked
      .map((p, i) => ({ type: p.type, index: i }))
      .filter((p) => p.type === 'mobile')
      .map((p) => p.index);

    const landlineIndex = ranked.findIndex((p) => p.type === 'landline');

    mobileIndices.forEach((mobileIdx) => {
      expect(mobileIdx).toBeLessThan(landlineIndex);
    });
  });

  it('should assign confidence scores', () => {
    const ranked = rankPhones(mockPhones, mockAddresses);

    ranked.forEach((phone) => {
      expect(phone.confidence).toBeGreaterThanOrEqual(0);
      expect(phone.confidence).toBeLessThanOrEqual(1);
    });
  });

  it('should rank by recency', () => {
    const ranked = rankPhones(mockPhones, mockAddresses);

    // Current should be before 2020
    const currentIndex = ranked.findIndex((p) => p.lastSeen === 'Current');
    const oldIndex = ranked.findIndex((p) => p.lastSeen === '2020');

    expect(currentIndex).toBeLessThan(oldIndex);
  });

  it('should handle empty phone list', () => {
    const ranked = rankPhones([], mockAddresses);

    expect(ranked).toHaveLength(0);
  });
});

describe('Recency Scoring', () => {
  it('should give highest score to current/present dates', () => {
    const addresses: ParsedAddress[] = [
      {
        address: '123 Test',
        fullAddress: '123 Test, City, TX 75001',
        toDate: 'Current',
        confidence: 0,
        reasons: [],
      },
      {
        address: '456 Test',
        fullAddress: '456 Test, City, TX 75002',
        toDate: '2020',
        confidence: 0,
        reasons: [],
      },
    ];

    const ranked = rankAddresses(addresses, [], [], []);

    expect(ranked[0].toDate).toBe('Current');
    expect(ranked[0].confidence).toBeGreaterThan(ranked[1].confidence);
  });

  it('should handle various date formats', () => {
    const addresses: ParsedAddress[] = [
      {
        address: '123 Test',
        fullAddress: '123 Test, City, TX 75001',
        toDate: '12/2025',
        confidence: 0,
        reasons: [],
      },
      {
        address: '456 Test',
        fullAddress: '456 Test, City, TX 75002',
        toDate: '01/01/2020',
        confidence: 0,
        reasons: [],
      },
    ];

    const ranked = rankAddresses(addresses, [], [], []);

    // More recent date should rank higher
    expect(ranked[0].fullAddress).toContain('123 Test');
  });
});
