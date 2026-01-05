# Scheduled Scraper Function

Appwrite Function that triggers the API key scraper on a schedule.

## Setup

### 1. Generate a CRON_SECRET

```bash
openssl rand -base64 32
```

### 2. Add to your Next.js environment

Add to your `.env` (and Vercel/hosting environment):

```
CRON_SECRET=your-generated-secret
```

### 3. Deploy to Appwrite

#### Option A: Appwrite CLI

```bash
# Install Appwrite CLI
npm install -g appwrite-cli

# Login
appwrite login

# Init project (if not already)
appwrite init project

# Deploy function
appwrite deploy function
```

#### Option B: Appwrite Console (Manual)

1. Go to **Appwrite Console** → **Functions** → **Create Function**
2. Select **Node.js 18.0** runtime
3. Upload the `functions/scheduled-scraper` folder
4. Set entrypoint: `src/main.ts`

### 4. Configure Environment Variables

In Appwrite Console → Your Function → **Settings** → **Variables**:

| Variable | Value | Required |
|----------|-------|----------|
| `APP_URL` | `https://your-app.vercel.app` | Yes |
| `CRON_SECRET` | Your generated secret | Yes |
| `APPWRITE_ENDPOINT` | `https://cloud.appwrite.io/v1` | No |
| `APPWRITE_API_KEY` | Your API key | No |
| `APPWRITE_DATABASE_ID` | `unsecured-api-keys` | No |

### 5. Set Schedule

In Appwrite Console → Your Function → **Settings** → **Schedule**:

| Schedule | Cron Expression |
|----------|-----------------|
| Every hour | `0 * * * *` |
| Every 6 hours | `0 */6 * * *` |
| Daily at midnight UTC | `0 0 * * *` |
| Every 12 hours | `0 */12 * * *` |

Recommended: `0 */6 * * *` (every 6 hours)

### 6. Test

Click **Execute now** in the Appwrite Console to test the function.

## Logs

View execution logs in Appwrite Console → Your Function → **Executions**
