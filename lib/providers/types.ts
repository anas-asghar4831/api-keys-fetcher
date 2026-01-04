// API Status Enum - matches .NET ApiStatusEnum
export enum ApiStatusEnum {
  Unverified = -99,
  Invalid = 0,
  Valid = 1,
  Error = 6,
  ValidNoCredits = 7,
}

// API Type Enum - all 35 providers
export enum ApiTypeEnum {
  Unknown = -99,
  // AI Providers (100-199)
  OpenAI = 100,
  AnthropicClaude = 120,
  GoogleAI = 130,
  HuggingFace = 140,
  Cohere = 150,
  Groq = 160,
  MistralAI = 170,
  OpenRouter = 180,
  PerplexityAI = 190,
  Replicate = 200,
  StabilityAI = 210,
  TogetherAI = 220,
  FireworksAI = 230,
  XAI = 240,
  ElevenLabs = 250,
  AI21 = 260,
  Anyscale = 270,
  DeepSeek = 280,
  AzureOpenAI = 290,
  // Cloud Providers (300-399)
  Cloudflare = 300,
  DigitalOcean = 310,
  Vercel = 320,
  // Communication Providers (400-499)
  Slack = 400,
  SendGrid = 410,
  Twilio = 420,
  Mailgun = 430,
  Discord = 440,
  // Source Control (500-599)
  GitHub = 500,
  GitLab = 510,
  // Database (600-699)
  Supabase = 600,
  PlanetScale = 610,
  // Monitoring (700-799)
  Sentry = 700,
  Datadog = 710,
  // Maps (800-899)
  Mapbox = 800,
  // Special
  AWSBedrock = 900,
}

// Search Provider Enum
export enum SearchProviderEnum {
  Unknown = -99,
  GitHub = 1,
}

// Validation Attempt Status
export enum ValidationAttemptStatus {
  Valid = 'valid',
  Unauthorized = 'unauthorized',
  HttpError = 'http_error',
  NetworkError = 'network_error',
  ProviderSpecificError = 'provider_specific_error',
  Unknown = 'unknown',
}

// Provider Category for grouping
export enum ProviderCategory {
  Unknown = 0,
  AI_LLM = 1,
  CloudInfrastructure = 2,
  SourceControl = 3,
  Communication = 4,
  DatabaseBackend = 5,
  MapsLocation = 6,
  Monitoring = 7,
  Financial = 8,
}

// Model Information from API responses
export interface ModelInfo {
  modelId: string;
  displayName?: string;
  description?: string;
  version?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedMethods?: string[];
  modelGroup?: string;
}

// Provider Metadata for configuration
export interface ProviderMetadata {
  scraperUse: boolean;
  scraperDisabledReason?: string;
  verificationUse: boolean;
  verificationDisabledReason?: string;
  displayInUI: boolean;
  hiddenFromUIReason?: string;
  category: ProviderCategory;
  notifyOwnerDirectly: boolean;
}

// Key Details - extended info about a key
export interface KeyDetails {
  status: 'success' | 'error';
  isValid: boolean;
  hasCredits: boolean;
  creditBalance?: number;
  creditUsed?: number;
  models: ModelInfo[];
  rateLimit?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
    remaining?: number;
  };
  organization?: string;
  error?: string;
}

// API Key Provider Interface
export interface IApiKeyProvider {
  providerName: string;
  apiType: ApiTypeEnum;
  regexPatterns: RegExp[];
  metadata: ProviderMetadata;
  validateKey(apiKey: string): Promise<ValidationResult>;
  getKeyDetails?(apiKey: string): Promise<KeyDetails>;
}

// Validation Result
export interface ValidationResult {
  status: ValidationAttemptStatus;
  httpStatusCode?: number;
  detail?: string;
  availableModels?: ModelInfo[];
  hasCredits?: boolean;
  creditBalance?: number;
}

// Database Models
export interface ApiKey {
  $id?: string;
  apiKey: string;
  status: ApiStatusEnum;
  apiType: ApiTypeEnum;
  searchProvider: SearchProviderEnum;
  lastCheckedUtc?: string;
  firstFoundUtc: string;
  lastFoundUtc: string;
  timesDisplayed: number;
  errorCount: number;
}

export interface RepoReference {
  $id?: string;
  apiKeyId: string;
  repoUrl: string;
  repoOwner?: string;
  repoName?: string;
  repoDescription?: string;
  fileUrl: string;
  fileName?: string;
  filePath?: string;
  fileSha?: string;
  codeContext?: string;
  lineNumber?: number;
  searchQueryId?: string;
  foundUtc: string;
  provider?: string;
  branch?: string;
}

export interface SearchQuery {
  $id?: string;
  query: string;
  isEnabled: boolean;
  searchResultsCount: number;
  lastSearchUtc?: string;
}

export interface SearchProviderToken {
  $id?: string;
  token: string;
  searchProvider: SearchProviderEnum;
  isEnabled: boolean;
  lastUsedUtc?: string;
}

export interface ApplicationSetting {
  $id?: string;
  key: string;
  value: string;
  description?: string;
}

// Scraper Run Status
export type ScraperRunStatus = 'running' | 'complete' | 'error';

// Scraper Run - stores history of scraper executions
export interface ScraperRun {
  $id?: string;
  status: ScraperRunStatus;
  query?: string;
  totalResults?: number;
  processedFiles: number;
  totalFiles: number;
  newKeys: number;
  duplicates: number;
  errors: number;
  events: string; // JSON stringified ScraperEvent[]
  startedAt: string;
  completedAt?: string;
}

// Helper function to get enum name
export function getApiTypeName(type: ApiTypeEnum): string {
  return ApiTypeEnum[type] || 'Unknown';
}

export function getStatusName(status: ApiStatusEnum): string {
  return ApiStatusEnum[status] || 'Unknown';
}

export function getCategoryName(category: ProviderCategory): string {
  const names: Record<ProviderCategory, string> = {
    [ProviderCategory.Unknown]: 'Unknown',
    [ProviderCategory.AI_LLM]: 'AI / LLM',
    [ProviderCategory.CloudInfrastructure]: 'Cloud Infrastructure',
    [ProviderCategory.SourceControl]: 'Source Control',
    [ProviderCategory.Communication]: 'Communication',
    [ProviderCategory.DatabaseBackend]: 'Database',
    [ProviderCategory.MapsLocation]: 'Maps & Location',
    [ProviderCategory.Monitoring]: 'Monitoring',
    [ProviderCategory.Financial]: 'Financial',
  };
  return names[category] || 'Unknown';
}
