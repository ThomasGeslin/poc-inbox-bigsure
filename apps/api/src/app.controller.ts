import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Public so the hosting platform can health-check the service.
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
