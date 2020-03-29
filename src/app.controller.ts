import {
  Body,
  CacheInterceptor,
  Controller,
  Get,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';

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
    return await this.appService.request(payload);
  }

  @Get('response')
  async response(@Query('_id') _id: string = '') {
    return await this.appService.response(_id);
  }

  @Get('correspondent')
  @UseInterceptors(CacheInterceptor)
  async correspondent(@Query('_id') _id: string = '') {
    return await this.appService.correspondent(_id);
  }
}
