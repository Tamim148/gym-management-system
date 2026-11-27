import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

export type UploadCategory = 'kyc' | 'equipment';

export interface SanitizedUploadResult {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
  mimeType: 'image/webp';
}

const MAX_BYTES: Record<UploadCategory, number> = {
  kyc: 3 * 1024 * 1024,
  equipment: 5 * 1024 * 1024,
};

@Injectable()
export class UploadSanitizerService {
  private readonly baseUploadDir = path.resolve(process.cwd(), 'uploads');

  async sanitizeAndSave(
    buffer: Buffer,
    options: { category: UploadCategory; branchId?: string },
  ): Promise<SanitizedUploadResult> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }

    const maxBytes = MAX_BYTES[options.category];
    if (buffer.length > maxBytes) {
      throw new BadRequestException(
        `File exceeds maximum allowed size (${Math.round(maxBytes / (1024 * 1024))} MB)`,
      );
    }

    if (!this.hasAllowedImageMagicBytes(buffer)) {
      throw new BadRequestException(
        'Invalid or unsupported file signature. Only JPEG, PNG, and WebP images are permitted.',
      );
    }

    let sanitizedBuffer: Buffer;
    try {
      sanitizedBuffer = await sharp(buffer)
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Failed to process uploaded image');
    }

    const fileId = crypto.randomUUID();
    const safeBranchId = (options.branchId || 'global').replace(
      /[^a-zA-Z0-9_-]/g,
      '',
    );

    const relativePath =
      options.category === 'kyc'
        ? path.posix.join('kyc', safeBranchId, `${fileId}.webp`)
        : path.posix.join('equipment', `${fileId}.webp`);

    const absolutePath = this.resolveSafePath(relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, sanitizedBuffer);

    return {
      relativePath,
      absolutePath,
      sizeBytes: sanitizedBuffer.length,
      mimeType: 'image/webp',
    };
  }

  resolveSafePath(relativePath: string): string {
    const normalized = path.posix
      .normalize(relativePath)
      .replace(/^(\.\.(\/|\\|$))+/, '');
    const resolved = path.resolve(this.baseUploadDir, normalized);
    if (!resolved.startsWith(this.baseUploadDir + path.sep)) {
      throw new BadRequestException('Invalid upload storage path');
    }
    return resolved;
  }

  async deleteIfExists(relativePath: string | null | undefined): Promise<void> {
    if (!relativePath) {
      return;
    }
    try {
      const target = this.resolveSafePath(relativePath);
      await fs.unlink(target);
    } catch {
      // Ignore missing file on cleanup
    }
  }

  hasAllowedImageMagicBytes(buffer: Buffer): boolean {
    if (buffer.length < 12) {
      return false;
    }

    // Explicitly block SVG / XML / HTML text payloads
    const head = buffer.subarray(0, 128).toString('utf8').trimStart().toLowerCase();
    if (
      head.startsWith('<svg') ||
      head.startsWith('<?xml') ||
      head.startsWith('<!doctype') ||
      head.startsWith('<html') ||
      head.startsWith('<script')
    ) {
      return false;
    }

    // JPEG: FF D8 FF
    const isJpeg =
      buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    // WebP: RIFF....WEBP
    const isWebp =
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50;

    return isJpeg || isPng || isWebp;
  }
}
