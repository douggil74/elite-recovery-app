/**
 * Case Intelligence Store
 * Persistent storage for AI and user modifications to case data.
 * This is the bridge between the chat AI and the brief/export pages.
 * When the user says "add this address" or "remove gas stations",
 * the AI emits action blocks that get parsed and applied here.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Types ---

export interface IntelAddress {
  id: string;
  address: string;
  type: 'anchor' | 'work' | 'family' | 'associate' | 'transient' | 'other';
  important: boolean;
  note?: string;
  addedAt: string;
  source: 'ai' | 'user' | 'document';
}

export interface IntelContact {
  id: string;
  name: string;
  relationship: string;
  phone?: string;
  address?: string;
  note?: string;
  important: boolean;
  addedAt: string;
  source: 'ai' | 'user' | 'document';
}

export interface IntelVehicle {
  id: string;
  description: string;
  plate?: string;
  vin?: string;
  note?: string;
  addedAt: string;
  source: 'ai' | 'user' | 'document';
}

export interface IntelNote {
  id: string;
  text: string;
  addedAt: string;
  source: 'ai' | 'user';
}

export interface CaseIntel {
  caseId: string;
  // User/AI-curated addresses (important ones, manually added)
  addresses: IntelAddress[];
  // User/AI-curated contacts
  contacts: IntelContact[];
  // User/AI-curated vehicles
  vehicles: IntelVehicle[];
  // Investigation notes from chat
  notes: IntelNote[];
  // Patterns to exclude from reports (gas stations, truck stops, etc.)
  excludePatterns: string[];
  // Custom warnings/flags
  customFlags: string[];
  // Wanted poster overrides (AI or user-editable)
  posterOverrides?: {
    description?: string;    // Physical description, distinguishing marks
    lastSeen?: string;       // Last seen location/date/circumstances
    additionalInfo?: string; // Any extra text for the poster
    contactName?: string;    // Contact name on poster
    contactPhone?: string;   // Contact phone on poster
    charges?: string;        // Charges text (semicolon-separated)
  };
  // Timestamp
  updatedAt: string;
}

// --- Storage ---

const STORAGE_KEY = (id: string) => `case_intel_${id}`;

let nextId = Date.now();
function uid(): string {
  return `intel_${nextId++}`;
}

export async function loadCaseIntel(caseId: string): Promise<CaseIntel> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY(caseId));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[CaseIntel] Load error:', e);
  }
  return {
    caseId,
    addresses: [],
    contacts: [],
    vehicles: [],
    notes: [],
    excludePatterns: [],
    customFlags: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function saveCaseIntel(intel: CaseIntel): Promise<void> {
  intel.updatedAt = new Date().toISOString();
  try {
    await AsyncStorage.setItem(STORAGE_KEY(intel.caseId), JSON.stringify(intel));
  } catch (e) {
    console.warn('[CaseIntel] Save error:', e);
  }
}

// --- Action Types ---

export type IntelAction =
  | { type: 'ADD_ADDRESS'; address: string; addressType?: string; note?: string; important?: boolean }
  | { type: 'REMOVE_ADDRESS'; address: string }
  | { type: 'MARK_IMPORTANT'; address: string }
  | { type: 'ADD_CONTACT'; name: string; relationship?: string; phone?: string; address?: string; note?: string }
  | { type: 'REMOVE_CONTACT'; name: string }
  | { type: 'ADD_VEHICLE'; description: string; plate?: string; vin?: string; note?: string }
  | { type: 'ADD_NOTE'; text: string }
  | { type: 'ADD_FLAG'; text: string }
  | { type: 'EXCLUDE_PATTERN'; pattern: string }
  | { type: 'CLEAR_EXCLUSIONS' }
  | { type: 'SET_POSTER_DESCRIPTION'; text: string }
  | { type: 'SET_POSTER_LAST_SEEN'; text: string }
  | { type: 'SET_POSTER_ADDITIONAL_INFO'; text: string };

// --- Validation Helpers ---

// Reject contact names that are obviously not people (Delvepoint column headers, data labels, etc.)
const INVALID_CONTACT_NAMES = new Set([
  'reference code', 'transactions authorized', 'transactions', 'arbitral proceedings',
  'arbitral', 'dates seen', 'carrier location', 'carrier', 'carrier type',
  'source', 'status', 'type', 'date', 'address', 'phone', 'email',
  'name', 'description', 'notes', 'note', 'unknown', 'n/a', 'none',
  'tbd', 'pending', 'record', 'report', 'search', 'result', 'results',
  'contact plus', 'contact plus search', 'standard comprehensive',
  'comprehensive report', 'data', 'field', 'value', 'key', 'id',
  'account', 'number', 'code', 'location', 'date of birth', 'dob',
  'ssn', 'social security', 'driver license', 'expiration', 'issue date',
  'employer', 'occupation', 'income', 'education', 'property', 'bankruptcy',
  'lien', 'judgment', 'filing', 'case number', 'court', 'county',
  'state', 'country', 'zip', 'city', 'apt', 'unit', 'suite',
  'recent address record', 'address record', 'current address',
  // Bail bond industry terms
  'as surety', 'as indemnitor', 'as cosigner', 'as agent', 'as principal',
  'surety', 'indemnitor', 'principal', 'obligee',
  'bail bonds', 'bail bond', 'bonding company', 'bonding',
  // Government / institutional
  'texas county', 'parish court', 'district court', 'municipal court',
  'police department', 'sheriff', 'sheriffs office',
  // Generic roles (without names)
  'mother', 'father', 'spouse', 'wife', 'husband', 'brother', 'sister',
  'friend', 'neighbor', 'landlord', 'reference', 'cosigner', 'bondsman',
]);

// Words that indicate the "name" is actually a business or institution, not a person
const BUSINESS_KEYWORDS = [
  'bail bonds', 'bail bond', 'bonding', 'insurance', 'surety',
  'company', 'corp', 'corporation', 'inc', 'llc', 'ltd',
  'county', 'parish', 'court', 'department', 'office', 'agency',
  'bank', 'financial', 'services', 'solutions',
  'church', 'school', 'university', 'hospital',
];

function isValidContactName(name: string): boolean {
  if (!name || name.trim().length < 3) return false;
  if (name.trim().length > 60) return false;

  const lower = name.trim().toLowerCase();

  // Reject known non-person terms
  if (INVALID_CONTACT_NAMES.has(lower)) return false;

  // Reject if contains business/institution keywords
  if (BUSINESS_KEYWORDS.some(kw => lower.includes(kw))) return false;

  // Reject "As [Role]" patterns (e.g. "As Surety", "As Indemnitor")
  if (/^as\s+\w+$/i.test(name.trim())) return false;

  // Reject names starting with common non-person prefixes
  if (/^(call|contact|the|a|an)\s/i.test(name.trim())) return false;

  // Reject form template text patterns
  if (/circle one|check if|fill in|enter here|indicate|if yes|if no|n\/a/i.test(name)) return false;

  // Reject names with slashes (template choices like "YES / NO")
  if (name.includes('/')) return false;

  // Reject names that are all uppercase single words (likely headers)
  if (name === name.toUpperCase() && !name.includes(' ')) return false;

  // Reject if no vowels (not a real name)
  if (!/[aeiou]/i.test(name)) return false;

  // Reject if contains common data patterns
  if (/^\d+$/.test(name.trim())) return false; // all numbers
  if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(name.trim()) === false && name.split(' ').length === 1) {
    // Single word - only allow if it looks like a name (capitalized)
    if (lower === name.trim()) return false; // all lowercase single word
  }

  return true;
}

// Normalize address for deduplication (strip extra spaces, standardize)
function normalizeAddress(addr: string): string {
  return addr.toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ', ')
    .replace(/\./g, '')
    .replace(/\b(apt|unit|ste|suite|#)\s*/gi, 'apt ')
    .trim();
}

// --- Action Application ---

export function applyAction(intel: CaseIntel, action: IntelAction): { intel: CaseIntel; description: string } {
  const updated = { ...intel };

  switch (action.type) {
    case 'ADD_ADDRESS': {
      // Normalize and deduplicate
      const normalized = normalizeAddress(action.address);
      const exists = updated.addresses.some(a => {
        const existingNorm = normalizeAddress(a.address);
        return existingNorm === normalized ||
               existingNorm.includes(normalized.slice(0, 25)) ||
               normalized.includes(existingNorm.slice(0, 25));
      });
      if (!exists) {
        updated.addresses = [...updated.addresses, {
          id: uid(),
          address: action.address,
          type: (action.addressType as IntelAddress['type']) || 'other',
          important: action.important ?? true,
          note: action.note,
          addedAt: new Date().toISOString(),
          source: 'ai',
        }];
      }
      return { intel: updated, description: `Added address: ${action.address}` };
    }

    case 'REMOVE_ADDRESS': {
      const pattern = action.address.toLowerCase();
      const before = updated.addresses.length;
      updated.addresses = updated.addresses.filter(
        a => !a.address.toLowerCase().includes(pattern)
      );
      const removed = before - updated.addresses.length;
      return { intel: updated, description: removed > 0 ? `Removed ${removed} address(es) matching "${action.address}"` : `No addresses matched "${action.address}"` };
    }

    case 'MARK_IMPORTANT': {
      const pattern = action.address.toLowerCase();
      updated.addresses = updated.addresses.map(a =>
        a.address.toLowerCase().includes(pattern) ? { ...a, important: true } : a
      );
      return { intel: updated, description: `Marked "${action.address}" as important` };
    }

    case 'ADD_CONTACT': {
      // Validate contact name - reject data headers and junk
      if (!isValidContactName(action.name)) {
        console.warn('[CaseIntel] Rejected invalid contact name:', action.name);
        return { intel: updated, description: `Skipped invalid contact: ${action.name}` };
      }

      const exists = updated.contacts.some(
        c => c.name.toLowerCase() === action.name.toLowerCase()
      );
      if (!exists) {
        updated.contacts = [...updated.contacts, {
          id: uid(),
          name: action.name,
          relationship: action.relationship || 'unknown',
          phone: action.phone,
          address: action.address,
          note: action.note,
          important: true,
          addedAt: new Date().toISOString(),
          source: 'ai',
        }];
      }
      return { intel: updated, description: `Added contact: ${action.name} (${action.relationship || 'unknown'})` };
    }

    case 'REMOVE_CONTACT': {
      const pattern = action.name.toLowerCase();
      updated.contacts = updated.contacts.filter(
        c => !c.name.toLowerCase().includes(pattern)
      );
      return { intel: updated, description: `Removed contact: ${action.name}` };
    }

    case 'ADD_VEHICLE': {
      updated.vehicles = [...updated.vehicles, {
        id: uid(),
        description: action.description,
        plate: action.plate,
        vin: action.vin,
        note: action.note,
        addedAt: new Date().toISOString(),
        source: 'ai',
      }];
      return { intel: updated, description: `Added vehicle: ${action.description}` };
    }

    case 'ADD_NOTE': {
      updated.notes = [...updated.notes, {
        id: uid(),
        text: action.text,
        addedAt: new Date().toISOString(),
        source: 'ai',
      }];
      return { intel: updated, description: `Added note` };
    }

    case 'ADD_FLAG': {
      if (!updated.customFlags.includes(action.text)) {
        updated.customFlags = [...updated.customFlags, action.text];
      }
      return { intel: updated, description: `Added flag: ${action.text}` };
    }

    case 'EXCLUDE_PATTERN': {
      if (!updated.excludePatterns.includes(action.pattern.toLowerCase())) {
        updated.excludePatterns = [...updated.excludePatterns, action.pattern.toLowerCase()];
      }
      return { intel: updated, description: `Excluding: ${action.pattern}` };
    }

    case 'CLEAR_EXCLUSIONS': {
      updated.excludePatterns = [];
      return { intel: updated, description: 'Cleared all exclusion patterns' };
    }

    case 'SET_POSTER_DESCRIPTION': {
      updated.posterOverrides = { ...updated.posterOverrides, description: action.text };
      return { intel: updated, description: 'Updated wanted poster description' };
    }

    case 'SET_POSTER_LAST_SEEN': {
      updated.posterOverrides = { ...updated.posterOverrides, lastSeen: action.text };
      return { intel: updated, description: 'Updated wanted poster last seen info' };
    }

    case 'SET_POSTER_ADDITIONAL_INFO': {
      updated.posterOverrides = { ...updated.posterOverrides, additionalInfo: action.text };
      return { intel: updated, description: 'Updated wanted poster additional info' };
    }

    default:
      return { intel: updated, description: 'Unknown action' };
  }
}

// --- Action Parsing from AI Response ---

const ACTION_REGEX = /\[ACTION:(\w+)\](.*?)\[\/ACTION\]/gs;

export function parseActions(aiResponse: string): { cleanText: string; actions: IntelAction[] } {
  const actions: IntelAction[] = [];
  const cleanText = aiResponse.replace(ACTION_REGEX, '').trim();

  let match;
  const regex = new RegExp(ACTION_REGEX.source, 'gs');
  while ((match = regex.exec(aiResponse)) !== null) {
    const actionType = match[1];
    const payload = match[2].trim();

    try {
      const data = JSON.parse(payload);

      switch (actionType) {
        case 'ADD_ADDRESS':
          actions.push({
            type: 'ADD_ADDRESS',
            address: data.address,
            addressType: data.type,
            note: data.note,
            important: data.important,
          });
          break;
        case 'REMOVE_ADDRESS':
          actions.push({ type: 'REMOVE_ADDRESS', address: data.address || data.pattern || payload });
          break;
        case 'MARK_IMPORTANT':
          actions.push({ type: 'MARK_IMPORTANT', address: data.address || payload });
          break;
        case 'ADD_CONTACT':
          actions.push({
            type: 'ADD_CONTACT',
            name: data.name,
            relationship: data.relationship,
            phone: data.phone,
            address: data.address,
            note: data.note,
          });
          break;
        case 'REMOVE_CONTACT':
          actions.push({ type: 'REMOVE_CONTACT', name: data.name || payload });
          break;
        case 'ADD_VEHICLE':
          actions.push({
            type: 'ADD_VEHICLE',
            description: data.description,
            plate: data.plate,
            vin: data.vin,
            note: data.note,
          });
          break;
        case 'ADD_NOTE':
          actions.push({ type: 'ADD_NOTE', text: data.text || payload });
          break;
        case 'ADD_FLAG':
          actions.push({ type: 'ADD_FLAG', text: data.text || payload });
          break;
        case 'EXCLUDE_PATTERN':
          actions.push({ type: 'EXCLUDE_PATTERN', pattern: data.pattern || payload });
          break;
        case 'CLEAR_EXCLUSIONS':
          actions.push({ type: 'CLEAR_EXCLUSIONS' });
          break;
        case 'SET_POSTER_DESCRIPTION':
          actions.push({ type: 'SET_POSTER_DESCRIPTION', text: data.text || payload });
          break;
        case 'SET_POSTER_LAST_SEEN':
          actions.push({ type: 'SET_POSTER_LAST_SEEN', text: data.text || payload });
          break;
        case 'SET_POSTER_ADDITIONAL_INFO':
          actions.push({ type: 'SET_POSTER_ADDITIONAL_INFO', text: data.text || payload });
          break;
      }
    } catch {
      // If JSON parse fails, try to handle as plain text
      switch (actionType) {
        case 'ADD_ADDRESS':
          actions.push({ type: 'ADD_ADDRESS', address: payload, important: true });
          break;
        case 'REMOVE_ADDRESS':
          actions.push({ type: 'REMOVE_ADDRESS', address: payload });
          break;
        case 'MARK_IMPORTANT':
          actions.push({ type: 'MARK_IMPORTANT', address: payload });
          break;
        case 'ADD_CONTACT':
          actions.push({ type: 'ADD_CONTACT', name: payload });
          break;
        case 'ADD_NOTE':
          actions.push({ type: 'ADD_NOTE', text: payload });
          break;
        case 'ADD_FLAG':
          actions.push({ type: 'ADD_FLAG', text: payload });
          break;
        case 'EXCLUDE_PATTERN':
          actions.push({ type: 'EXCLUDE_PATTERN', pattern: payload });
          break;
        case 'SET_POSTER_DESCRIPTION':
          actions.push({ type: 'SET_POSTER_DESCRIPTION', text: payload });
          break;
        case 'SET_POSTER_LAST_SEEN':
          actions.push({ type: 'SET_POSTER_LAST_SEEN', text: payload });
          break;
        case 'SET_POSTER_ADDITIONAL_INFO':
          actions.push({ type: 'SET_POSTER_ADDITIONAL_INFO', text: payload });
          break;
      }
    }
  }

  return { cleanText, actions };
}

// --- Apply All Actions ---

export async function applyActions(
  caseId: string,
  actions: IntelAction[]
): Promise<{ intel: CaseIntel; descriptions: string[] }> {
  let intel = await loadCaseIntel(caseId);
  const descriptions: string[] = [];

  for (const action of actions) {
    const result = applyAction(intel, action);
    intel = result.intel;
    descriptions.push(result.description);
  }

  await saveCaseIntel(intel);
  return { intel, descriptions };
}

// --- Summary for System Prompt ---

export function intelSummary(intel: CaseIntel): string {
  const parts: string[] = [];

  if (intel.addresses.length > 0) {
    const important = intel.addresses.filter(a => a.important);
    const other = intel.addresses.filter(a => !a.important);
    if (important.length > 0) {
      parts.push(`IMPORTANT ADDRESSES (${important.length}):\n${important.map(a => `- ${a.address} [${a.type}]${a.note ? ` (${a.note})` : ''}`).join('\n')}`);
    }
    if (other.length > 0) {
      parts.push(`Other addresses: ${other.map(a => a.address).join('; ')}`);
    }
  }

  if (intel.contacts.length > 0) {
    parts.push(`CONTACTS (${intel.contacts.length}):\n${intel.contacts.map(c => `- ${c.name} (${c.relationship})${c.phone ? ` ${c.phone}` : ''}${c.note ? ` - ${c.note}` : ''}`).join('\n')}`);
  }

  if (intel.vehicles.length > 0) {
    parts.push(`VEHICLES (${intel.vehicles.length}):\n${intel.vehicles.map(v => `- ${v.description}${v.plate ? ` PLATE: ${v.plate}` : ''}`).join('\n')}`);
  }

  if (intel.notes.length > 0) {
    parts.push(`INVESTIGATION NOTES:\n${intel.notes.map(n => `- ${n.text}`).join('\n')}`);
  }

  if (intel.excludePatterns.length > 0) {
    parts.push(`EXCLUDED FROM REPORTS: ${intel.excludePatterns.join(', ')}`);
  }

  if (intel.customFlags.length > 0) {
    parts.push(`FLAGS: ${intel.customFlags.join('; ')}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : '';
}
