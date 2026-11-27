import * as fs from 'fs/promises';
import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { UploadSanitizerService } from './upload-sanitizer.service';

describe('UploadSanitizerService', () => {
  let service: UploadSanitizerService;
  const createdFiles: string[] = [];

  beforeEach(() => {
    service = new UploadSanitizerService();
  });

  afterAll(async () => {
    for (const file of createdFiles) {
      await fs.unlink(file).catch(() => undefined);
    }
  });

  it('rejects SVG and HTML payloads even if disguised', async () => {
    const svgBuffer = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      'utf8',
    );
    await expect(
      service.sanitizeAndSave(svgBuffer, {
        category: 'kyc',
        branchId: '10000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toThrow(BadRequestException);

    const htmlBuffer = Buffer.from('<!DOCTYPE html><html></html>', 'utf8');
    await expect(
      service.sanitizeAndSave(htmlBuffer, { category: 'equipment' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects oversized KYC files (>3MB)', async () => {
    const oversized = Buffer.alloc(3 * 1024 * 1024 + 10, 0xff);
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;

    await expect(
      service.sanitizeAndSave(oversized, {
        category: 'kyc',
        branchId: 'branch-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('re-encodes valid PNG images to WebP and strips EXIF metadata', async () => {
    const pngBuffer = await sharp({
      create: {
        width: 120,
        height: 80,
        channels: 3,
        background: { r: 127, g: 17, b: 24 },
      },
    })
      .png()
      .toBuffer();

    const result = await service.sanitizeAndSave(pngBuffer, {
      category: 'kyc',
      branchId: '10000000-0000-4000-8000-000000000001',
    });
    createdFiles.push(result.absolutePath);

    expect(result.relativePath).toMatch(
      /^kyc\/10000000-0000-4000-8000-000000000001\/[0-9a-f-]+\.webp$/,
    );
    expect(result.mimeType).toBe('image/webp');

    const saved = await fs.readFile(result.absolutePath);
    const meta = await sharp(saved).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
  });
});
