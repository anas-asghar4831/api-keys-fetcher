import {
  IApiKeyProvider,
  ApiTypeEnum,
  ProviderCategory,
  ProviderMetadata,
} from './types';

// AI Providers
import { OpenAIProvider } from './ai/openai';
import { AnthropicProvider } from './ai/anthropic';
import { GoogleProvider } from './ai/google';
import { GroqProvider } from './ai/groq';
import { MistralProvider } from './ai/mistral';
import { CohereProvider } from './ai/cohere';
import { HuggingFaceProvider } from './ai/huggingface';
import { ReplicateProvider } from './ai/replicate';
import { TogetherProvider } from './ai/together';
import { FireworksProvider } from './ai/fireworks';
import { PerplexityProvider } from './ai/perplexity';
import { OpenRouterProvider } from './ai/openrouter';
import { DeepSeekProvider } from './ai/deepseek';
import { XAIProvider } from './ai/xai';
import { ElevenLabsProvider } from './ai/elevenlabs';
import { AI21Provider } from './ai/ai21';
import { AnyscaleProvider } from './ai/anyscale';
import { StabilityProvider } from './ai/stability';
import { AzureOpenAIProvider } from './ai/azure-openai';
import { AWSBedrockProvider } from './ai/aws-bedrock';

// Cloud Providers
import { CloudflareProvider } from './cloud/cloudflare';
import { DigitalOceanProvider } from './cloud/digitalocean';
import { VercelProvider } from './cloud/vercel';

// Source Control
import { GitHubProvider } from './sourcecontrol/github';
import { GitLabProvider } from './sourcecontrol/gitlab';

// Communication Providers
import { SlackProvider } from './communication/slack';
import { SendGridProvider } from './communication/sendgrid';
import { TwilioProvider } from './communication/twilio';
import { MailgunProvider } from './communication/mailgun';
import { DiscordProvider } from './communication/discord';

// Database Providers
import { SupabaseProvider } from './database/supabase';
import { PlanetScaleProvider } from './database/planetscale';

// Monitoring Providers
import { SentryProvider } from './monitoring/sentry';
import { DatadogProvider } from './monitoring/datadog';

// Maps Providers
import { MapboxProvider } from './maps/mapbox';

/**
 * All registered providers (35 total)
 */
const ALL_PROVIDERS: IApiKeyProvider[] = [
  // AI Providers (20)
  new OpenAIProvider(),
  new AnthropicProvider(),
  new GoogleProvider(),
  new GroqProvider(),
  new MistralProvider(),
  new CohereProvider(),
  new HuggingFaceProvider(),
  new ReplicateProvider(),
  new TogetherProvider(),
  new FireworksProvider(),
  new PerplexityProvider(),
  new OpenRouterProvider(),
  new DeepSeekProvider(),
  new XAIProvider(),
  new ElevenLabsProvider(),
  new AI21Provider(),
  new AnyscaleProvider(),
  new StabilityProvider(),
  new AzureOpenAIProvider(),
  new AWSBedrockProvider(),

  // Cloud Providers (3)
  new CloudflareProvider(),
  new DigitalOceanProvider(),
  new VercelProvider(),

  // Source Control (2)
  new GitHubProvider(),
  new GitLabProvider(),

  // Communication (5)
  new SlackProvider(),
  new SendGridProvider(),
  new TwilioProvider(),
  new MailgunProvider(),
  new DiscordProvider(),

  // Database (2)
  new SupabaseProvider(),
  new PlanetScaleProvider(),

  // Monitoring (2)
  new SentryProvider(),
  new DatadogProvider(),

  // Maps (1)
  new MapboxProvider(),
];

/**
 * Provider Registry - Central access point for all API key providers
 */
export const ProviderRegistry = {
  /**
   * Get all registered providers
   */
  getAllProviders(): IApiKeyProvider[] {
    return ALL_PROVIDERS;
  },

  /**
   * Get providers enabled for scraping
   */
  getScraperProviders(): IApiKeyProvider[] {
    return ALL_PROVIDERS.filter((p) => p.metadata.scraperUse);
  },

  /**
   * Get providers enabled for verification
   */
  getVerifierProviders(): IApiKeyProvider[] {
    return ALL_PROVIDERS.filter((p) => p.metadata.verificationUse);
  },

  /**
   * Get providers that should be displayed in UI
   */
  getDisplayProviders(): IApiKeyProvider[] {
    return ALL_PROVIDERS.filter((p) => p.metadata.displayInUI);
  },

  /**
   * Get provider by API type enum
   */
  getProviderByType(type: ApiTypeEnum): IApiKeyProvider | undefined {
    return ALL_PROVIDERS.find((p) => p.apiType === type);
  },

  /**
   * Get providers by category
   */
  getProvidersByCategory(category: ProviderCategory): IApiKeyProvider[] {
    return ALL_PROVIDERS.filter((p) => p.metadata.category === category);
  },

  /**
   * Find providers whose regex patterns match the given API key
   */
  findMatchingProviders(apiKey: string): IApiKeyProvider[] {
    return ALL_PROVIDERS.filter((p) =>
      p.regexPatterns.some((pattern) => pattern.test(apiKey))
    );
  },

  /**
   * Get provider names mapped to their types
   */
  getProviderNameMap(): Map<ApiTypeEnum, string> {
    const map = new Map<ApiTypeEnum, string>();
    for (const provider of ALL_PROVIDERS) {
      map.set(provider.apiType, provider.providerName);
    }
    return map;
  },

  /**
   * Get all categories with their providers
   */
  getProvidersByCategories(): Map<ProviderCategory, IApiKeyProvider[]> {
    const map = new Map<ProviderCategory, IApiKeyProvider[]>();

    for (const provider of ALL_PROVIDERS) {
      const category = provider.metadata.category;
      const existing = map.get(category) || [];
      existing.push(provider);
      map.set(category, existing);
    }

    return map;
  },

  /**
   * Get total count of providers
   */
  getProviderCount(): number {
    return ALL_PROVIDERS.length;
  },

  /**
   * Check if a provider type is registered
   */
  hasProvider(type: ApiTypeEnum): boolean {
    return ALL_PROVIDERS.some((p) => p.apiType === type);
  },

  /**
   * Get all regex patterns from all providers (for comprehensive scraping)
   */
  getAllPatterns(): { provider: IApiKeyProvider; pattern: RegExp }[] {
    const patterns: { provider: IApiKeyProvider; pattern: RegExp }[] = [];

    for (const provider of ALL_PROVIDERS) {
      if (provider.metadata.scraperUse) {
        for (const pattern of provider.regexPatterns) {
          patterns.push({ provider, pattern });
        }
      }
    }

    return patterns;
  },

  /**
   * Extract all API keys from text using all provider patterns
   */
  extractKeysFromText(
    text: string
  ): { key: string; provider: IApiKeyProvider }[] {
    const results: { key: string; provider: IApiKeyProvider }[] = [];
    const seenKeys = new Set<string>();

    for (const provider of ALL_PROVIDERS) {
      if (!provider.metadata.scraperUse) continue;

      for (const pattern of provider.regexPatterns) {
        const regex = new RegExp(pattern.source, 'g');
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
          const key = match[0];
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            results.push({ key, provider });
          }
        }
      }
    }

    return results;
  },
};

/**
 * Export all providers for direct use
 */
export {
  // AI
  OpenAIProvider,
  AnthropicProvider,
  GoogleProvider,
  GroqProvider,
  MistralProvider,
  CohereProvider,
  HuggingFaceProvider,
  ReplicateProvider,
  TogetherProvider,
  FireworksProvider,
  PerplexityProvider,
  OpenRouterProvider,
  DeepSeekProvider,
  XAIProvider,
  ElevenLabsProvider,
  AI21Provider,
  AnyscaleProvider,
  StabilityProvider,
  AzureOpenAIProvider,
  AWSBedrockProvider,
  // Cloud
  CloudflareProvider,
  DigitalOceanProvider,
  VercelProvider,
  // Source Control
  GitHubProvider,
  GitLabProvider,
  // Communication
  SlackProvider,
  SendGridProvider,
  TwilioProvider,
  MailgunProvider,
  DiscordProvider,
  // Database
  SupabaseProvider,
  PlanetScaleProvider,
  // Monitoring
  SentryProvider,
  DatadogProvider,
  // Maps
  MapboxProvider,
};

/**
 * Type for provider constructor
 */
export type ProviderConstructor = new () => IApiKeyProvider;

/**
 * Provider metadata helper
 */
export function createProviderMetadata(
  options: Partial<ProviderMetadata> = {}
): ProviderMetadata {
  return {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.Unknown,
    notifyOwnerDirectly: false,
    ...options,
  };
}
