import { Injectable } from '@nestjs/common';

@Injectable()
export class DashboardService {

  constructor(){}

  public async GetBio(): Promise<string> {
    return `I'm Naga Chandana Mudusu!`;
  }
}
