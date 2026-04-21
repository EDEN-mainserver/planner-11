// AI API 키 통합 관리 유틸리티
// 저장 위치: localStorage 'eden_ai_keys_v1'
// 형태: [{ id, name, apiKey, model, enabled, custom }, ...]

export const AI_KEYS_STORAGE_KEY = 'eden_ai_keys_v1';

// 프리셋 프로바이더 정의
export const PRESET_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Gemini',
    desc: 'Google AI Studio',
    color: '#4285F4',
    bgColor: '#EFF6FF',
    icon: 'G',
    keyPlaceholder: 'AIza...',
    keyHint: 'aistudio.google.com → API 키 생성',
    models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-2.5-pro',
  },
  {
    id: 'claude',
    name: 'Claude',
    desc: 'Anthropic',
    color: '#D97706',
    bgColor: '#FFFBEB',
    icon: 'C',
    keyPlaceholder: 'sk-ant-...',
    keyHint: 'console.anthropic.com → API Keys',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    defaultModel: 'claude-sonnet-4-6',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    desc: 'ChatGPT / GPT-4',
    color: '#10A37F',
    bgColor: '#F0FDF4',
    icon: 'O',
    keyPlaceholder: 'sk-...',
    keyHint: 'platform.openai.com → API Keys',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    desc: 'Perplexity AI',
    color: '#6366F1',
    bgColor: '#EEF2FF',
    icon: 'P',
    keyPlaceholder: 'pplx-...',
    keyHint: 'perplexity.ai → Settings → API',
    models: ['llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online'],
    defaultModel: 'llama-3.1-sonar-large-128k-online',
  },
  {
    id: 'groq',
    name: 'Groq',
    desc: 'Groq Cloud',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    icon: 'GR',
    keyPlaceholder: 'gsk_...',
    keyHint: 'console.groq.com → API Keys',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
  },
];

export function loadAiKeys() {
  try {
    const saved = JSON.parse(localStorage.getItem(AI_KEYS_STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {}
  return [];
}

export function saveAiKeys(keys) {
  localStorage.setItem(AI_KEYS_STORAGE_KEY, JSON.stringify(keys));
}

// 특정 프로바이더의 API 키 문자열 반환 (없으면 '')
export function getApiKey(providerId) {
  try {
    const keys = JSON.parse(localStorage.getItem(AI_KEYS_STORAGE_KEY) || '[]');
    const entry = keys.find(k => k.id === providerId && k.enabled !== false);
    return entry?.apiKey || '';
  } catch { return ''; }
}

// 특정 프로바이더의 모델 반환
export function getModel(providerId) {
  try {
    const keys = JSON.parse(localStorage.getItem(AI_KEYS_STORAGE_KEY) || '[]');
    const entry = keys.find(k => k.id === providerId);
    if (entry?.model) return entry.model;
  } catch {}
  const preset = PRESET_PROVIDERS.find(p => p.id === providerId);
  return preset?.defaultModel || '';
}
