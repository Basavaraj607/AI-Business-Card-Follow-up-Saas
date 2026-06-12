// utils/ai-parser.ts

export interface ParsedContact {
  id?: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  website: string;
  linkedin: string;
  notes?: string;
  preferredTone?: string;
  [key: string]: any;
}

/**
 * Parses raw OCR text from a business card using a local regex fallback.
 * Direct client-side Gemini API calls have been removed to prevent API key exposure.
 */
export async function parseCardText(ocrText: string): Promise<ParsedContact> {
  return regexParseCardText(ocrText);
}

/**
 * Regex-based fallback parser for extracting contact details in the browser.
 */
function regexParseCardText(text: string): ParsedContact {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const contact: ParsedContact = {
    name: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    website: '',
    linkedin: '',
  };

  // 1. Extract Email
  const emailRegex = /[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/i;
  for (const line of lines) {
    const match = line.match(emailRegex);
    if (match) {
      contact.email = match[0];
      break;
    }
  }

  // 2. Extract Phone
  // Matches typical business card formats: +1 (234) 567-8901, 123-456-7890, etc.
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  for (const line of lines) {
    const match = line.match(phoneRegex);
    if (match) {
      contact.phone = match[0];
      break;
    }
  }

  // 3. Extract Website / URL
  const webRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,6})(?:\/[^\s]*)?/i;
  for (const line of lines) {
    if (line.includes('@')) continue; // Skip emails
    const match = line.match(webRegex);
    if (match) {
      contact.website = match[0];
      break;
    }
  }

  // 4. Extract LinkedIn
  const liRegex = /(?:linkedin\.com\/in\/|linkedin\.com\/pub\/)?([a-zA-Z0-9-]{3,100})/i;
  for (const line of lines) {
    if (line.toLowerCase().includes('linkedin')) {
      const match = line.match(liRegex);
      if (match) {
        contact.linkedin = line.startsWith('http') ? line : `https://linkedin.com/in/${match[1]}`;
        break;
      }
    }
  }

  // 5. Deduce Name and Title
  // Look at lines that don't contain emails, websites, or numbers.
  // The first such line is usually the Name, the second might be Title or Company.
  const nameExclusionRegex = /[0-9]|@|\.com|\.org|\.net|\.co|www\.|http|address|street|rd\.|st\.|blvd|suite|floor/i;
  const potentialLines = lines.filter(line => !nameExclusionRegex.test(line));

  if (potentialLines.length > 0) {
    contact.name = potentialLines[0];
  }

  // Job title heuristics (looking for manager, engineer, founder, etc.)
  const titleKeywords = [
    'manager',
    'director',
    'engineer',
    'founder',
    'ceo',
    'cto',
    'cfo',
    'vp',
    'vice president',
    'president',
    'consultant',
    'specialist',
    'developer',
    'architect',
    'designer',
    'lead',
    'head',
  ];
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (titleKeywords.some(keyword => lowerLine.includes(keyword))) {
      contact.title = line;
      break;
    }
  }

  // Fallback title if we found a line below the name
  if (!contact.title && potentialLines.length > 1) {
    contact.title = potentialLines[1];
  }

  // 6. Deduce Company Name
  // Often the company name is in the email domain (e.g. name@acme.com -> Acme)
  if (contact.email) {
    const domain = contact.email.split('@')[1];
    const companyPart = domain.split('.')[0];
    const commonProviders = ['gmail', 'yahoo', 'outlook', 'hotmail', 'aol', 'icloud', 'protonmail', 'zoho'];
    if (!commonProviders.includes(companyPart.toLowerCase())) {
      contact.company = companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
    }
  }

  // Fallback company name if first line matches a company format or we have a third candidate line
  if (!contact.company && potentialLines.length > 2) {
    contact.company = potentialLines[2];
  }

  // Ensure Name is not empty for required validator
  if (!contact.name) {
    contact.name = contact.email ? contact.email.split('@')[0] : 'Scanned Contact';
  }

  return contact;
}
