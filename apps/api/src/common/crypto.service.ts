import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { BUSINESS_RULES } from '@vintage/shared';

@Injectable()
export class CryptoService {
  private getAesKey(): Buffer {
    const raw = process.env.DATA_ENCRYPTION_KEY?.trim();
    if (raw && /^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    if (process.env.NODE_ENV === 'production' && !raw) {
      throw new Error('DATA_ENCRYPTION_KEY must be configured in production');
    }
    return crypto
      .createHash('sha256')
      .update(raw || 'vintage-aesthetics-dev-encryption-key')
      .digest();
  }

  private getQrSecret(): string {
    const secret = process.env.QR_HMAC_SECRET?.trim();
    if (process.env.NODE_ENV === 'production' && !secret) {
      throw new Error('QR_HMAC_SECRET must be configured in production');
    }
    return secret || 'vintage-aesthetics-dev-qr-secret';
  }

  private getIpnSecret(): string {
    const secret =
      process.env.IPN_HMAC_SECRET?.trim() ||
      process.env.JWT_REFRESH_SECRET?.trim();
    if (process.env.NODE_ENV === 'production' && !secret) {
      throw new Error('IPN_HMAC_SECRET must be configured in production');
    }
    return secret || 'vintage-aesthetics-dev-ipn-secret';
  }

  encryptAes256Gcm(plaintext: string): string {
    const key = this.getAesKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decryptAes256Gcm(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new Error('Invalid encrypted payload format');
    }
    const [, ivHex, authTagHex, cipherHex] = parts;
    const key = this.getAesKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(cipherHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  signQrPassToken(
    userId: string,
    now: Date = new Date(),
  ): { token: string; expiresAt: string } {
    const bucketSeconds = BUSINESS_RULES.QR_BUCKET_SECONDS;
    const bucket = Math.floor(now.getTime() / 1000 / bucketSeconds);
    const expiresAt = new Date((bucket + 1) * bucketSeconds * 1000).toISOString();
    const hmac = crypto
      .createHmac('sha256', this.getQrSecret())
      .update(`${userId}.${bucket}`)
      .digest('hex')
      .slice(0, 16);

    return {
      token: `VA1.${userId}.${bucket}.${hmac}`,
      expiresAt,
    };
  }

  verifyQrPassToken(
    token: string,
    now: Date = new Date(),
  ): { valid: boolean; userId?: string } {
    if (!token || typeof token !== 'string') {
      return { valid: false };
    }
    const parts = token.trim().split('.');
    if (parts.length !== 4 || parts[0] !== 'VA1') {
      return { valid: false };
    }
    const [, userId, bucketStr, providedSig] = parts;
    if (!userId || !providedSig || providedSig.length !== 16) {
      return { valid: false };
    }

    const bucket = Number(bucketStr);
    if (!Number.isInteger(bucket) || bucket <= 0) {
      return { valid: false };
    }

    const currentBucket = Math.floor(
      now.getTime() / 1000 / BUSINESS_RULES.QR_BUCKET_SECONDS,
    );
    // Accept current or adjacent (±1) 60s bucket to tolerate minor clock skew
    if (Math.abs(currentBucket - bucket) > 1) {
      return { valid: false };
    }

    const expectedSig = crypto
      .createHmac('sha256', this.getQrSecret())
      .update(`${userId}.${bucket}`)
      .digest('hex')
      .slice(0, 16);

    const providedBuf = Buffer.from(providedSig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (providedBuf.length !== expectedBuf.length) {
      return { valid: false };
    }
    if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return { valid: false };
    }

    return { valid: true, userId };
  }

  signIpnPayload(gatewayRef: string, amountBdt: number, status: string): string {
    const canonical = `${gatewayRef}:${Number(amountBdt).toFixed(2)}:${status}`;
    return crypto
      .createHmac('sha256', this.getIpnSecret())
      .update(canonical)
      .digest('hex');
  }

  verifyIpnSignature(
    gatewayRef: string,
    amountBdt: number,
    status: string,
    signature: string,
  ): boolean {
    if (!signature || typeof signature !== 'string') {
      return false;
    }
    const expected = this.signIpnPayload(gatewayRef, amountBdt, status);
    const providedBuf = Buffer.from(signature.trim(), 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  }

  normalizeEmail(email: string): string {
    return email.normalize('NFKC').trim().toLowerCase();
  }

  normalizePhone(phone: string): string {
    const cleaned = phone.normalize('NFKC').trim().replace(/[\s\-()]/g, '');
    if (/^01\d{9}$/.test(cleaned)) {
      return `+88${cleaned}`;
    }
    if (/^8801\d{9}$/.test(cleaned)) {
      return `+${cleaned}`;
    }
    return cleaned;
  }

  normalizePromoCode(code: string): string {
    return code.normalize('NFKC').trim().toUpperCase();
  }
}
