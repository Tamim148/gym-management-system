import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BranchScopeGuard } from './branch-scope.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, BranchScopeGuard],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    BranchScopeGuard,
    JwtModule,
  ],
})
export class AuthModule {}
