// ============================================
// OPENAI PROVIDER - Fallback Option
// ============================================

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Generate text using OpenAI API
 */
export async function openaiGenerate(
  messages: OpenAIMessage[],
  apiKey: string,
  options: OpenAIOptions = {}
): Promise<string> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 400,
  } = options;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Test if the API key is valid
 */
export async function testOpenAIConnection(apiKey: string): Promise<boolean> {
  try {
    const result = await openaiGenerate(
      [{ role: 'user', content: 'Say "ok"' }],
      apiKey,
      { maxTokens: 5 }
    );
    return result.length > 0;
  } catch {
    return false;
  }
}
