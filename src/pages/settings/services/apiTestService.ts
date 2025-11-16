import { toast } from 'sonner';

interface APITestResult {
  success: boolean;
  message: string;
  error?: string;
}

class APITestService {
  /**
   * Test DeepSeek API connection
   */
  async testDeepSeek(apiKey: string): Promise<APITestResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        message: 'کلید API وارد نشده',
      };
    }

    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10,
        }),
      });

      if (response.ok) {
        return {
          success: true,
          message: 'اتصال موفق - کلید API معتبر است',
        };
      } else {
        const errorData = await response.json();
        return {
          success: false,
          message: 'کلید API نامعتبر است',
          error: errorData.error?.message || 'Unknown error',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'خطا در اتصال به DeepSeek API',
        error: error.message,
      };
    }
  }

  /**
   * Test Google Sheets API access
   */
  async testGoogleSheets(apiKey: string, sheetId: string): Promise<APITestResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        message: 'کلید Google API وارد نشده',
      };
    }

    if (!sheetId || sheetId.trim().length === 0) {
      return {
        success: false,
        message: 'Sheet ID وارد نشده',
      };
    }

    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${apiKey}`;
      const response = await fetch(url);

      if (response.ok) {
        return {
          success: true,
          message: 'اتصال موفق - دسترسی به Google Sheets تایید شد',
        };
      } else {
        const errorData = await response.json();
        return {
          success: false,
          message: 'خطا در دسترسی به Google Sheets',
          error: errorData.error?.message || 'Invalid API key or Sheet ID',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'خطا در اتصال به Google Sheets API',
        error: error.message,
      };
    }
  }
}

export const apiTestService = new APITestService();
