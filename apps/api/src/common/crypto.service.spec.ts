import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    service = new CryptoService();
  });

  it('encrypts and decrypts AES-256-GCM payloads with random IVs', () => {
    const plaintext = JSON.stringify({
      hasHeartCondition: false,
      fitnessGoal: 'Hypertrophy',
    });
    const cipherA = service.encryptAes256Gcm(plaintext);
    const cipherB = service.encryptAes256Gcm(plaintext);

    expect(cipherA).not.toBe(cipherB);
    expect(cipherA.startsWith('v1:')).toBe(true);
    expect(service.decryptAes256Gcm(cipherA)).toBe(plaintext);
    expect(service.decryptAes256Gcm(cipherB)).toBe(plaintext);
  });

  it('fails closed when AES-256-GCM ciphertext or authTag is tampered', () => {
    const cipher = service.encryptAes256Gcm('sensitive-parq-note');
    const parts = cipher.split(':');
    parts[3] = 'ff' + parts[3].slice(2);
    expect(() => service.decryptAes256Gcm(parts.join(':'))).toThrow();
  });

  it('signs and verifies rotating 60s QR pass tokens within ±1 bucket window', () => {
    const userId = '30000000-0000-4000-8000-000000000006';
    const t0 = new Date('2026-11-27T10:00:15.000Z');
    const { token } = service.signQrPassToken(userId, t0);

    expect(token.startsWith(`VA1.${userId}.`)).toBe(true);
    expect(service.verifyQrPassToken(token, t0)).toEqual({
      valid: true,
      userId,
    });

    // Previous bucket (within +60s) remains valid
    const tPlus60 = new Date(t0.getTime() + 60_000);
    expect(service.verifyQrPassToken(token, tPlus60)).toEqual({
      valid: true,
      userId,
    });

    // Expired after 2+ buckets (+130s)
    const tExpired = new Date(t0.getTime() + 130_000);
    expect(service.verifyQrPassToken(token, tExpired)).toEqual({
      valid: false,
    });

    // Tampered token fails
    expect(service.verifyQrPassToken(`${token}tamper`, t0)).toEqual({
      valid: false,
    });
  });

  it('signs and verifies IPN payloads with timing-safe HMAC', () => {
    const sig = service.signIpnPayload('GW-REF-1001', 3500, 'CLEARED');
    expect(
      service.verifyIpnSignature('GW-REF-1001', 3500, 'CLEARED', sig),
    ).toBe(true);
    expect(
      service.verifyIpnSignature('GW-REF-1001', 100, 'CLEARED', sig),
    ).toBe(false);
  });

  it('normalizes email, phone, and NFKC promo codes', () => {
    expect(service.normalizeEmail('  Admin@VintageAesthetics.GYM ')).toBe(
      'admin@vintageaesthetics.gym',
    );
    expect(service.normalizePhone('01711-234567')).toBe('+8801711234567');
    expect(service.normalizePromoCode(' ＥＩＤ２０ ')).toBe('EID20');
  });
});
