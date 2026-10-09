/**
 * Heuristic check for things that look private before they're stored as a
 * memory. It can't be perfect — it only decides whether to show an extra
 * "this looks sensitive" confirmation. Nothing leaves the device either way.
 */
export interface SensitivityCheck {
  sensitive: boolean;
  reasons: string[];
}

const KEYWORDS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(password|passcode|passwd|pin code|pin number|\bpin\b)/i, reason: 'a password or PIN' },
  { pattern: /\b(social security|ssn|passport|driver'?s licen[cs]e|national id)\b/i, reason: 'an ID number' },
  { pattern: /\b(credit card|debit card|card number|cvv|iban|routing number|account number|bank)\b/i, reason: 'banking details' },
  {
    pattern: /\b(diagnos\w*|medication|prescription|therapy|therapist|depress\w*|anxiety disorder|hiv|pregnan\w*)\b/i,
    reason: 'health information',
  },
  { pattern: /\b(my address is|i live at|home address)\b/i, reason: 'an address' },
];

const PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /[\w.+-]+@[\w-]+\.[\w.]+/, reason: 'an email address' },
  { pattern: /(?:\+?\d[\s-]?){9,}/, reason: 'a long number (phone, card or ID)' },
];

export function checkSensitive(text: string): SensitivityCheck {
  const reasons: string[] = [];
  for (const { pattern, reason } of [...KEYWORDS, ...PATTERNS]) {
    if (pattern.test(text) && !reasons.includes(reason)) reasons.push(reason);
  }
  return { sensitive: reasons.length > 0, reasons };
}
