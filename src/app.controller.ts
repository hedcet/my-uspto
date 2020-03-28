import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { AppService } from './app.service';
import { RequestDto } from './request.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  get() {
    return { status: 200 };
  }

  @Post('request')
  async request(@Body() payload: RequestDto = {}) {
    return this.appService.request(payload);
  }

  @Get('response')
  async response(@Query('id') id: string = '') {
    return id;
  }
}
