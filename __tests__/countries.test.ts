import { guessCountryCodeFromAddress } from '../src/geo/countries';

describe('guessCountryCodeFromAddress', () => {
  it('returns uppercase when isoCountryCode is provided', () => {
    expect(guessCountryCodeFromAddress({ isoCountryCode: ' br ' })).toBe('BR');
    expect(guessCountryCodeFromAddress({ isoCountryCode: 'us' })).toBe('US');
  });

  it('derives from country name in Portuguese and English', () => {
    expect(guessCountryCodeFromAddress({ country: 'Brasil' })).toBe('BR');
    expect(guessCountryCodeFromAddress({ country: 'Brazil' })).toBe('BR');
    expect(guessCountryCodeFromAddress({ country: 'United States' })).toBe('US');
    expect(guessCountryCodeFromAddress({ country: 'Portugal' })).toBe('PT');
    expect(guessCountryCodeFromAddress({ country: 'Alemanha' })).toBe('DE');
    expect(guessCountryCodeFromAddress({ country: 'Germany' })).toBe('DE');
    expect(guessCountryCodeFromAddress({ country: 'Japao' })).toBe('JP');
  });

  it('returns undefined when no identifiable country', () => {
    expect(guessCountryCodeFromAddress(undefined)).toBeUndefined();
    expect(guessCountryCodeFromAddress(null)).toBeUndefined();
    expect(guessCountryCodeFromAddress({ country: '' })).toBeUndefined();
  });
});
