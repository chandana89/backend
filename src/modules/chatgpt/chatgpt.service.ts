import { Injectable} from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ChatGPTService {
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor() {
    this.apiKey = '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';
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