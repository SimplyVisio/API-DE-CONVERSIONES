import crypto from 'crypto';

/**
 * Hash data using SHA256 (Meta Requirement)
 */
export const hashData = (data: string | number | null | undefined): string | undefined => {
  if (!data) return undefined;
  return crypto.createHash('sha256').update(String(data).trim()).digest('hex');
};

/**
 * Normalizes email: lowercase, trim
 */
export const normalizeEmail = (email: string | null | undefined): string | undefined => {
  if (!email) return undefined;
  return email.toLowerCase().trim();
};

/**
 * Normalizes phone number to E.164 format
 * Uses country context if available to better handle 10-digit numbers from US vs Mexico
 */
export const normalizePhone = (phone: string | number | null | undefined, countryHint?: string): string | undefined => {
  if (!phone) return undefined;
  
  // Remove all non-digits and non-plus
  let cleaned = String(phone).replace(/[^\d+]/g, '');
  
  if (!cleaned) return undefined;
  
  // Already has country code
  if (cleaned.startsWith('+')) return cleaned;
  
  // Normalize country hint
  const c = countryHint ? countryHint.trim().toLowerCase() : '';

  // 1. USA / Canada Heuristic
  // If country says US/Canada, or if missing country but standard US formatting
  if (c === 'us' || c === 'usa' || c === 'estados unidos' || c === 'united states' || c === 'ca' || c === 'canada') {
    if (cleaned.length === 10) return `+1${cleaned}`;
    if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  }

  // 2. Colombia Heuristic
  if (c === 'co' || c === 'colombia') {
     if (cleaned.length === 10) return `+57${cleaned}`;
  }

  // 3. Mexico Heuristic (Default for this business context)
  // Starts with 52 and has 12 digits (52XXXXXXXXXX)
  if (cleaned.startsWith('52') && cleaned.length === 12) {
    return `+${cleaned}`;
  }
  
  // Mexican number without country code (10 digits)
  if (cleaned.length === 10) {
    return `+52${cleaned}`;
  }
  
  // If > 10 digits, take last 10 and assume MX (fallback)
  if (cleaned.length > 10) {
    return `+52${cleaned.slice(-10)}`;
  }
  
  return undefined; // Invalid
};

/**
 * Extract first and last name
 */
export const extractNames = (fullName: string | null | undefined): { firstName?: string; lastName?: string } => {
  if (!fullName) return {};
  
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return {};
  
  const firstName = parts[0];
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
  
  return { firstName, lastName };
};

/**
 * Normalize city/state
 */
export const normalizeLocation = (loc: string | null | undefined): string | undefined => {
  if (!loc) return undefined;
  return loc.trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Normalize country code to ISO 2-letter
 */
export const normalizeCountry = (country: string | null | undefined): string | undefined => {
  if (!country) return undefined;
  
  const c = country.trim().toLowerCase();
  
  const mapping: Record<string, string> = {
    'mexico': 'mx', 'méxico': 'mx',
    'united states': 'us', 'usa': 'us', 'estados unidos': 'us',
    'canada': 'ca', 'canadá': 'ca',
    'spain': 'es', 'españa': 'es',
    'colombia': 'co', 'argentina': 'ar', 'chile': 'cl',
    'peru': 'pe', 'perú': 'pe', 'brazil': 'br', 'brasil': 'br'
  };
  
  if (c.length === 2) return c;
  return mapping[c] || c.slice(0, 2);
};

/**
 * Generate unique Event ID for deduplication
 */
export const generateEventId = (leadId: string, status: string, conversionDate?: string): string => {
  const dateStr = conversionDate || new Date().toISOString();
  const uniqueString = `${leadId}_${status}_${dateStr}`;
  return crypto.createHash('sha256').update(uniqueString).digest('hex');
};

/**
 * Convert ISO date to Unix Timestamp
 */
export const toUnixTimestamp = (dateStr?: string): number => {
  if (!dateStr) return Math.floor(Date.now() / 1000);
  return Math.floor(new Date(dateStr).getTime() / 1000);
};

export const isTooOld = (dateStr?: string, maxDays: number = 7): boolean => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays > maxDays;
};