import { Client, Databases, Query } from 'node-appwrite';

// Constants
const DATABASE_ID = 'main';
const COLLECTIONS = {
  API_KEYS: 'api_keys',
};

const VERIFICATION_BATCH_SIZE = 50;
const VERIFICATION_CONCURRENT = 10;
const MAX_VALID_KEYS = 50;

// API endpoints for verification
const API_ENDPOINTS = {
  OpenAI: 'https://api.openai.com/v1/models',
  Anthropic: 'https://api.anthropic.com/v1/messages',
  Google: 'https://generativelanguage.googleapis.com/v1beta/models',
  Groq: 'https://api.groq.com/openai/v1/models',
  Mistral: 'https://api.mistral.ai/v1/models',
  Cohere: 'https://api.cohere.ai/v1/models',
  Together: 'https://api.together.xyz/v1/models',
  Fireworks: 'https://api.fireworks.ai/inference/v1/models',
  Perplexity: 'https://api.perplexity.ai/chat/completions',
  OpenRouter: 'https://openrouter.ai/api/v1/credits',
  DeepSeek: 'https://api.deepseek.com/v1/models',
  xAI: 'https://api.x.ai/v1/models',
  HuggingFace: 'https://huggingface.co/api/whoami-v2',
  Replicate: 'https://api.replicate.com/v1/account',
};

// Run tasks with concurrency limit
async function runWithConcurrency(items, limit, fn) {
  const results = [];
  const executing = [];

  for (let i = 0; i < items.length; i++) {
    const promise = fn(items[i], i).then((result) => {
      results[i] = result;
    });

    const e = promise.then(() => {
      executing.splice(executing.indexOf(e), 1);
    });
    executing.push(e);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

// Verify a single API key
async function verifyKey(key, apiType) {
  const endpoint = API_ENDPOINTS[apiType];
  if (!endpoint) {
    return { valid: false, reason: 'Unknown provider' };
  }

  try {
    const headers = {};
    let url = endpoint;
    let method = 'GET';
    let body = null;

    // Set up request based on provider
    switch (apiType) {
      case 'OpenAI':
      case 'Groq':
      case 'Mistral':
      case 'Together':
      case 'Fireworks':
      case 'DeepSeek':
      case 'xAI':
        headers['Authorization'] = `Bearer ${key}`;
        break;

      case 'Anthropic':
        headers['x-api-key'] = key;
        headers['anthropic-version'] = '2023-06-01';
        headers['Content-Type'] = 'application/json';
        method = 'POST';
        body = JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        });
        break;

      case 'Google':
        url = `${endpoint}?key=${key}`;
        break;

      case 'Cohere':
        headers['Authorization'] = `Bearer ${key}`;
        break;

      case 'OpenRouter':
        headers['Authorization'] = `Bearer ${key}`;
        break;

      case 'Perplexity':
        headers['Authorization'] = `Bearer ${key}`;
        headers['Content-Type'] = 'application/json';
        method = 'POST';
        body = JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{ role: 'user', content: 'Hi' }],
        });
        break;

      case 'HuggingFace':
        headers['Authorization'] = `Bearer ${key}`;
        break;

      case 'Replicate':
        headers['Authorization'] = `Token ${key}`;
        break;

      default:
        headers['Authorization'] = `Bearer ${key}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));

      // Check for credits/balance
      if (apiType === 'OpenRouter' && data.credits !== undefined) {
        if (data.credits <= 0) {
          return { valid: true, noCredits: true, credits: 0 };
        }
        return { valid: true, credits: data.credits };
      }

      return { valid: true };
    }

    // Handle specific error codes
    if (response.status === 401 || response.status === 403) {
      return { valid: false, reason: 'Invalid key' };
    }

    if (response.status === 429) {
      return { valid: true, reason: 'Rate limited (key is valid)' };
    }

    if (response.status === 402) {
      return { valid: true, noCredits: true, reason: 'No credits' };
    }

    return { valid: false, reason: `HTTP ${response.status}` };

  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

// Main function
export default async ({ req, res, log, error }) => {
  const startTime = Date.now();
  log('Scheduled verifier starting...');

  try {
    // Initialize Appwrite client
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const databases = new Databases(client);

    // Check current valid key count
    const validKeysResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.API_KEYS,
      [Query.equal('status', 'Valid'), Query.limit(1)]
    );
    const currentValidCount = validKeysResult.total;

    if (currentValidCount >= MAX_VALID_KEYS) {
      log(`At capacity: ${currentValidCount}/${MAX_VALID_KEYS} valid keys`);
      return res.json({
        success: true,
        message: 'At capacity',
        validCount: currentValidCount,
      });
    }

    // Get unverified keys
    const unverifiedResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.API_KEYS,
      [
        Query.equal('status', 'Unverified'),
        Query.limit(VERIFICATION_BATCH_SIZE),
      ]
    );

    const keys = unverifiedResult.documents;
    if (!keys.length) {
      log('No unverified keys to process');
      return res.json({
        success: true,
        message: 'No unverified keys',
        verified: 0,
      });
    }

    log(`Verifying ${keys.length} keys (max ${VERIFICATION_CONCURRENT} concurrent)`);

    // Stats
    let verified = 0;
    let valid = 0;
    let invalid = 0;
    let validNoCredits = 0;
    let errors = 0;

    // Process keys in parallel
    await runWithConcurrency(keys, VERIFICATION_CONCURRENT, async (keyDoc) => {
      try {
        const result = await verifyKey(keyDoc.apiKey, keyDoc.apiType);
        verified++;

        const now = new Date().toISOString();
        let newStatus;
        let updateData = { lastVerifiedUtc: now };

        if (result.valid) {
          if (result.noCredits) {
            newStatus = 'ValidNoCredits';
            validNoCredits++;
            log(`${keyDoc.apiType}: ValidNoCredits`);
          } else {
            // Check if we're at capacity
            if (valid + currentValidCount >= MAX_VALID_KEYS) {
              newStatus = 'Unverified'; // Keep as unverified
              log(`${keyDoc.apiType}: Valid but at capacity`);
            } else {
              newStatus = 'Valid';
              valid++;
              log(`${keyDoc.apiType}: Valid`);
            }
          }
        } else {
          newStatus = 'Invalid';
          invalid++;
          updateData.errorCount = (keyDoc.errorCount || 0) + 1;
          log(`${keyDoc.apiType}: Invalid - ${result.reason}`);
        }

        updateData.status = newStatus;

        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.API_KEYS,
          keyDoc.$id,
          updateData
        );

      } catch (err) {
        errors++;
        error(`Failed to verify ${keyDoc.apiType}: ${err.message}`);
      }
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const summary = {
      success: true,
      duration: `${duration}s`,
      verified,
      valid,
      invalid,
      validNoCredits,
      errors,
      currentValidCount: currentValidCount + valid,
    };

    log(`Verifier complete: ${JSON.stringify(summary)}`);
    return res.json(summary);

  } catch (err) {
    error(`Verifier failed: ${err.message}`);
    return res.json({ success: false, error: err.message });
  }
};
