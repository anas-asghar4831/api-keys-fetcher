// Application limits
export const MAX_VALID_KEYS = 50;

// Timing constants (in milliseconds)
export const VERIFICATION_DELAY_MS = 1000;
export const SEARCH_DELAY_MS = 5000;
export const GITHUB_PAGE_DELAY_MS = 6000;

// Batch sizes
export const VERIFICATION_BATCH_SIZE = 15;        // keys per API call (must complete in 30s)
export const VERIFICATION_CONCURRENT = 5;         // parallel verifications within a batch
export const SCRAPER_BATCH_SIZE = 100;

// Parallel scraping config
export const MAX_CONCURRENT_QUERIES = 3;  // max simultaneous query searches (to avoid rate limits)
export const MAX_CONCURRENT_FILES = 20;   // max simultaneous file fetches
export const MAX_FILES_PER_QUERY = 50;    // files per query (reduced for parallel queries)

// HTTP settings
export const DEFAULT_TIMEOUT_MS = 30000;
export const DEFAULT_MAX_RETRIES = 3;

// GitHub API limits
export const GITHUB_MAX_RESULTS_PER_PAGE = 100;
export const GITHUB_MAX_PAGES = 10;            // GitHub limit: can't access beyond 1000 results

// Appwrite collection IDs
export const COLLECTIONS = {
  API_KEYS: 'api_keys',
  REPO_REFERENCES: 'repo_references',
  SEARCH_QUERIES: 'search_queries',
  SEARCH_PROVIDER_TOKENS: 'search_provider_tokens',
  APPLICATION_SETTINGS: 'application_settings',
} as const;

// Default search queries for seeding (17 total - matches .NET version)
export const DEFAULT_SEARCH_QUERIES = [
  // OpenAI patterns
  'sk-proj-',
  'sk-or-v1-',
  'sk-',
  'OPENAI_API_KEY',
  'openai.api_key',
  'chatgpt api key',
  'gpt-4 api key',
  // Anthropic patterns
  'sk-ant-api',
  'ANTHROPIC_API_KEY',
  'anthropic_api_key',
  'claude api key',
  // Google patterns
  'AIzaSy',
  'GOOGLE_API_KEY',
  'gemini_api_key',
  // Other AI patterns
  'r8_',
  'fw_',
  'hf_',
  // Generic
  'AI_API_KEY',
];

// API endpoints for providers (matching .NET version)
export const API_ENDPOINTS = {
  OPENAI: 'https://api.openai.com/v1/models',
  ANTHROPIC: 'https://api.anthropic.com/v1/messages',
  GOOGLE: 'https://generativelanguage.googleapis.com/v1beta/models',
  GITHUB: 'https://api.github.com/user',
  GITLAB: 'https://gitlab.com/api/v4/user',
  SLACK: 'https://slack.com/api/auth.test',
  SENDGRID: 'https://api.sendgrid.com/v3/user/profile',
  DISCORD: 'https://discord.com/api/v10/users/@me',
  VERCEL: 'https://api.vercel.com/v2/user',
  DIGITALOCEAN: 'https://api.digitalocean.com/v2/account',
  CLOUDFLARE: 'https://api.cloudflare.com/client/v4/user/tokens/verify',
  HUGGINGFACE: 'https://huggingface.co/api/whoami-v2',
  REPLICATE: 'https://api.replicate.com/v1/account', // Fixed: was /models
  GROQ: 'https://api.groq.com/openai/v1/models',
  MISTRAL: 'https://api.mistral.ai/v1/models',
  COHERE: 'https://api.cohere.ai/v1/models',
  TOGETHER: 'https://api.together.xyz/v1/models',
  FIREWORKS: 'https://api.fireworks.ai/inference/v1/models',
  PERPLEXITY: 'https://api.perplexity.ai/chat/completions',
  OPENROUTER: 'https://openrouter.ai/api/v1/credits', // Fixed: was /auth/key
  DEEPSEEK: 'https://api.deepseek.com/v1/models', // Fixed: added /v1
  XAI: 'https://api.x.ai/v1/models',
  ELEVENLABS: 'https://api.elevenlabs.io/v1/user',
  AI21: 'https://api.ai21.com/studio/v1/models',
  STABILITY: 'https://api.stability.ai/v1/engines/list', // Fixed: was /user/account
  ANYSCALE: 'https://api.endpoints.anyscale.com/v1/models',
  SUPABASE: 'https://api.supabase.com/v1/projects',
  PLANETSCALE: 'https://api.planetscale.com/v1/organizations',
  SENTRY: 'https://sentry.io/api/0/',
  DATADOG: 'https://api.datadoghq.com/api/v1/validate',
  MAPBOX: 'https://api.mapbox.com/tokens/v2',
  TWILIO: 'https://api.twilio.com/2010-04-01/Accounts',
  MAILGUN: 'https://api.mailgun.net/v3/domains',
} as const;
