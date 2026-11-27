import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { UploadSanitizerService } from './upload-sanitizer.service';

@Global()
@Module({
  providers: [CryptoService, UploadSanitizerService],
  exports: [CryptoService, UploadSanitizerService],
})
export class CommonModule {}
