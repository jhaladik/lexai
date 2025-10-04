/**
 * ARES API Integration
 * Fetches company data from Czech Business Register
 * API Documentation: https://ares.gov.cz/swagger-ui
 */

export interface AresCompanyData {
  ico: string;
  name: string;
  vat_number?: string;
  legal_form?: string;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  is_active: boolean;
  established_date?: string;
}

/**
 * Look up company by IČO (registration number)
 */
export async function lookupCompanyByICO(ico: string): Promise<AresCompanyData | null> {
  try {
    // Clean IČO - remove spaces and non-digits
    const cleanIco = ico.replace(/\D/g, '');

    if (cleanIco.length !== 8) {
      throw new Error('IČO must be 8 digits');
    }

    // ARES API endpoint
    const url = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${cleanIco}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Company not found
      }
      throw new Error(`ARES API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract company information
    const companyData = extractCompanyData(data, cleanIco);

    return companyData;
  } catch (error) {
    console.error('ARES lookup error:', error);
    throw error;
  }
}

/**
 * Extract and normalize company data from ARES response
 */
function extractCompanyData(aresData: any, ico: string): AresCompanyData {
  // ARES response structure varies, handle different cases
  const obchodniJmeno = aresData.obchodniJmeno || '';
  const sidlo = aresData.sidlo || {};
  const dic = aresData.dic || null;
  const pravniForma = aresData.pravniForma?.nazev || null;
  const datumVzniku = aresData.datumVzniku || null;
  const stavSubjektu = aresData.stavSubjektu || 'AKTIVNÍ';

  // Extract address
  const textovaAdresa = sidlo.textovaAdresa || '';
  let street = '';
  let city = '';
  let postalCode = '';

  // Try structured address first
  if (sidlo.nazevObce) {
    city = sidlo.nazevObce;
    street = sidlo.nazevUlice || '';
    if (sidlo.cisloDomovni) {
      street += ` ${sidlo.cisloDomovni}`;
    }
    if (sidlo.cisloOrientacni) {
      street += `/${sidlo.cisloOrientacni}`;
    }
    postalCode = sidlo.psc ? sidlo.psc.toString().replace(/(\d{3})(\d{2})/, '$1 $2') : '';
  } else if (textovaAdresa) {
    // Parse from text address if structured not available
    const parts = textovaAdresa.split(',').map((p: string) => p.trim());
    if (parts.length >= 2) {
      street = parts[0];

      // Try to extract postal code and city
      const lastPart = parts[parts.length - 1];
      const pscMatch = lastPart.match(/(\d{3}\s?\d{2})/);
      if (pscMatch) {
        postalCode = pscMatch[1];
        city = lastPart.replace(pscMatch[1], '').trim();
      } else {
        city = lastPart;
      }
    }
  }

  return {
    ico,
    name: obchodniJmeno,
    vat_number: dic ? `CZ${dic}` : undefined,
    legal_form: pravniForma,
    street,
    city,
    postal_code: postalCode,
    country: 'CZ',
    is_active: stavSubjektu === 'AKTIVNÍ',
    established_date: datumVzniku,
  };
}

/**
 * Validate IČO checksum
 * Czech IČO uses weighted checksum algorithm
 */
export function validateICO(ico: string): boolean {
  const cleanIco = ico.replace(/\D/g, '');

  if (cleanIco.length !== 8) {
    return false;
  }

  // Calculate checksum
  const digits = cleanIco.split('').map(Number);
  const weights = [8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += digits[i] * weights[i];
  }

  const remainder = sum % 11;
  let checksum: number;

  if (remainder === 0) {
    checksum = 1;
  } else if (remainder === 1) {
    checksum = 0;
  } else {
    checksum = 11 - remainder;
  }

  return checksum === digits[7];
}
