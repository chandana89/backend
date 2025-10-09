import { Injectable} from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';


@Injectable()
export class ChatGPTService {
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor() {
    this.apiKey = process.env.OPEN_API_KEY || '';
    this.apiUrl = 'https://api.openai.com/v1/responses';
  }

  public async GenerateResponse(prompt: string) {
    const data = {
        model: "gpt-4.1",
        input: prompt
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    return axios.post(this.apiUrl, data, { headers: headers });
  }

  public async UploadFile(asic: Express.Multer.File) {
    const formData = new FormData();
    formData.append('file', asic.buffer, asic.originalname);
    formData.append('purpose', 'assistants');

    const headers = {
      ...formData.getHeaders(),
      Authorization: `Bearer ${this.apiKey}`,
    };

    const response = await axios.post('https://api.openai.com/v1/files', formData, { headers });
    const beneficialOwners = await this.ExtractBeneficialOwner(response.data.id)
    return beneficialOwners; 
  }

  public async ExtractBeneficialOwner(fileId: String) {
   const data = {
        model: "gpt-5",
        input: [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_file",
                        "file_id": fileId
                    },
                    {
                        "type": "input_text",
                        "text": "Extract beneficial owners"
                    }
                ]
            }
        ]
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    const res = await axios.post('https://api.openai.com/v1/responses', data, { headers: headers });
    return res.data;
  }

  public async ExtractBeneficialOwnerUsingURL(fileURL: String) {
   const data = {
        model: "gpt-5",
        input: [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_file",
                        "file_url": fileURL
                    },
                    {
                        "type": "input_text",
                        "text": "Extract beneficial owners"
                    }
                ]
            }
        ]
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    const res = await axios.post('https://api.openai.com/v1/responses', data, { headers: headers });
    return res.data;
  }
}