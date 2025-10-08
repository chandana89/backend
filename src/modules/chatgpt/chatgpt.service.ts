import { Injectable} from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ChatGPTService {
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor() {
    this.apiKey = process.env.OPEN_API_KEY || '';
    this.apiUrl = 'https://api.openai.com/v1/conversations';
  }

  public async generateResponse(prompt: string) {
    const data = {
        prompt: prompt,
        max_tokens: 150,
        n: 1,
        stop: null,
        temperature: 1,
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    return axios.post(this.apiUrl, data, { headers: headers });
  }
}