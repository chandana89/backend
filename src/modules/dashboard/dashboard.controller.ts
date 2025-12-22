import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller()
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  public async getBio() {
    const bio = await this.dashboardService.GetBio();
    return {details: bio};
  }
}