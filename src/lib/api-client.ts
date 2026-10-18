export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string;
  [key: string]: any;
}

/**
 * Safely parses any fetch Response into JSON or standardized error object.
 * Prevents HTML/text response crash (e.g. Unexpected token 'T').
 */
export async function readApiResponse<T = any>(res: Response): Promise<ApiResponse<T>> {
  const contentType = res.headers.get('content-type') || '';
  
  let jsonResult: any = null;
  if (contentType.includes('application/json')) {
    try {
      jsonResult = await res.json();
    } catch {
      // JSON parse error fallback
    }
  }

  if (jsonResult) {
    if (!res.ok && jsonResult.success === undefined) {
      jsonResult.success = false;
    }
    return jsonResult;
  }

  const rawText = await res.text().catch(() => '');
  return {
    success: false,
    error: rawText.substring(0, 300) || `Server merespon dengan status ${res.status} (${res.statusText})`,
    status: res.status,
  };
}
