export function guessCountryCodeFromAddress(address?: { country?: string | null; isoCountryCode?: string | null } | null): string | undefined {
  if (address?.isoCountryCode) {
    const code = address.isoCountryCode.trim().toUpperCase();
    if (code) return code;
  }
  if (!address?.country) return undefined;
  const raw = address.country.trim();
  const lower = raw.toLowerCase();
  const map: Record<string, string> = {
    brasil: 'BR',
    brazil: 'BR',
    'united states': 'US',
    'united states of america': 'US',
    usa: 'US',
    argentina: 'AR',
    chile: 'CL',
    colombia: 'CO',
    peru: 'PE',
    portugal: 'PT',
    espanha: 'ES',
    spain: 'ES',
    franca: 'FR',
    france: 'FR',
    alemanha: 'DE',
    germany: 'DE',
    italia: 'IT',
    italy: 'IT',
    'reino unido': 'GB',
    'united kingdom': 'GB',
    uk: 'GB',
    canada: 'CA',
    canadá: 'CA',
    mexico: 'MX',
    'méxico': 'MX',
    japan: 'JP',
    japao: 'JP',
    japón: 'JP',
    jp: 'JP',
    china: 'CN',
    cn: 'CN',
    'coreia do sul': 'KR',
    'south korea': 'KR',
    kr: 'KR',
    india: 'IN',
    in: 'IN'
  };
  return map[lower];
}
