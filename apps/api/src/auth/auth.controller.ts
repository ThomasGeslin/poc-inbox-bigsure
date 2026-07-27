import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  /**
   * Password probe for the frontend gate. Guarded like every other route, so a
   * 204 means the supplied password is valid and a 401 means it is not. Returns
   * no body so it can be called before the user is trusted with any data.
   */
  @Get('check')
  @HttpCode(HttpStatus.NO_CONTENT)
  check(): void {}
}
