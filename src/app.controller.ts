import { Controller, Get, Query } from '@nestjs/common';

@Controller()
export class AppController {
  constructor() {}

  @Get()
  get() {
    return { status: 200 };
  }
}
