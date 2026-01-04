'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  RefreshCw,
  Key,
  Copy,
  Check,
  Trash2,
  Bot,
  Cloud,
  MessageSquare,
  GitBranch,
  Database,
  Activity,
  MapPin,
  HelpCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ChevronsUpDown,
  Filter,
  Eye,
  Coins,
  Cpu,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Category definitions
const CATEGORIES = {
  ai: { label: 'AI / LLM', icon: Bot, range: [100, 299] },
  cloud: { label: 'Cloud', icon: Cloud, range: [300, 399] },
  communication: { label: 'Communication', icon: MessageSquare, range: [400, 499] },
  source: { label: 'Source Control', icon: GitBranch, range: [500, 599] },
  database: { label: 'Database', icon: Database, range: [600, 699] },
  monitoring: { label: 'Monitoring', icon: Activity, range: [700, 799] },
  maps: { label: 'Maps', icon: MapPin, range: [800, 899] },
  other: { label: 'Other', icon: HelpCircle, range: [900, 999] },
} as const;

// Status definitions
const STATUS_CONFIG = {
  1: { label: 'Valid', color: 'text-success', bg: 'bg-success/10', icon: CheckCircle2 },
  7: { label: 'No Credits', color: 'text-warning', bg: 'bg-warning/10', icon: AlertCircle },
  0: { label: 'Invalid', color: 'text-destructive', bg: 'bg-destructive/10', icon: XCircle },
  '-99': { label: 'Unverified', color: 'text-muted-foreground', bg: 'bg-muted', icon: Clock },
  6: { label: 'Error', color: 'text-destructive', bg: 'bg-destructive/10', icon: XCircle },
} as const;

// Status filter options
const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status', icon: Key },
  { value: '1', label: 'Valid', icon: CheckCircle2 },
  { value: '7', label: 'No Credits', icon: AlertCircle },
  { value: '-99', label: 'Unverified', icon: Clock },
  { value: '0', label: 'Invalid', icon: XCircle },
] as const;

// Provider filter options (grouped by category)
const PROVIDER_FILTER_OPTIONS = [
  { value: 'all', label: 'All Providers', category: 'all' },
  // AI / LLM
  { value: '100', label: 'OpenAI', category: 'AI / LLM' },
  { value: '120', label: 'Anthropic', category: 'AI / LLM' },
  { value: '130', label: 'Google AI', category: 'AI / LLM' },
  { value: '140', label: 'HuggingFace', category: 'AI / LLM' },
  { value: '150', label: 'Cohere', category: 'AI / LLM' },
  { value: '160', label: 'Groq', category: 'AI / LLM' },
  { value: '170', label: 'Mistral AI', category: 'AI / LLM' },
  { value: '180', label: 'OpenRouter', category: 'AI / LLM' },
  { value: '190', label: 'Perplexity', category: 'AI / LLM' },
  { value: '200', label: 'Replicate', category: 'AI / LLM' },
  { value: '210', label: 'Stability AI', category: 'AI / LLM' },
  { value: '220', label: 'Together AI', category: 'AI / LLM' },
  { value: '230', label: 'Fireworks AI', category: 'AI / LLM' },
  { value: '240', label: 'xAI', category: 'AI / LLM' },
  { value: '250', label: 'ElevenLabs', category: 'AI / LLM' },
  { value: '260', label: 'AI21', category: 'AI / LLM' },
  { value: '270', label: 'Anyscale', category: 'AI / LLM' },
  { value: '280', label: 'DeepSeek', category: 'AI / LLM' },
  { value: '290', label: 'Azure OpenAI', category: 'AI / LLM' },
  // Cloud
  { value: '300', label: 'Cloudflare', category: 'Cloud' },
  { value: '310', label: 'DigitalOcean', category: 'Cloud' },
  { value: '320', label: 'Vercel', category: 'Cloud' },
  // Communication
  { value: '400', label: 'Slack', category: 'Communication' },
  { value: '410', label: 'SendGrid', category: 'Communication' },
  { value: '420', label: 'Twilio', category: 'Communication' },
  { value: '430', label: 'Mailgun', category: 'Communication' },
  { value: '440', label: 'Discord', category: 'Communication' },
  // Source Control
  { value: '500', label: 'GitHub', category: 'Source Control' },
  { value: '510', label: 'GitLab', category: 'Source Control' },
  // Database
  { value: '600', label: 'Supabase', category: 'Database' },
  { value: '610', label: 'PlanetScale', category: 'Database' },
  // Monitoring
  { value: '700', label: 'Sentry', category: 'Monitoring' },
  { value: '710', label: 'Datadog', category: 'Monitoring' },
  // Maps
  { value: '800', label: 'Mapbox', category: 'Maps' },
  // Other
  { value: '900', label: 'AWS Bedrock', category: 'Other' },
] as const;

// Provider names mapping
const PROVIDER_NAMES: Record<number, string> = {
  100: 'OpenAI',
  120: 'Anthropic',
  130: 'Google AI',
  140: 'HuggingFace',
  150: 'Cohere',
  160: 'Groq',
  170: 'Mistral AI',
  180: 'OpenRouter',
  190: 'Perplexity',
  200: 'Replicate',
  210: 'Stability AI',
  220: 'Together AI',
  230: 'Fireworks AI',
  240: 'xAI',
  250: 'ElevenLabs',
  260: 'AI21',
  270: 'Anyscale',
  280: 'DeepSeek',
  290: 'Azure OpenAI',
  300: 'Cloudflare',
  310: 'DigitalOcean',
  320: 'Vercel',
  400: 'Slack',
  410: 'SendGrid',
  420: 'Twilio',
  430: 'Mailgun',
  440: 'Discord',
  500: 'GitHub',
  510: 'GitLab',
  600: 'Supabase',
  610: 'PlanetScale',
  700: 'Sentry',
  710: 'Datadog',
  800: 'Mapbox',
  900: 'AWS Bedrock',
};

interface ApiKey {
  $id: string;
  apiKey: string;
  status: number;
  apiType: number;
  firstFoundUtc: string;
  lastCheckedUtc?: string;
}

interface KeyDetailsResponse {
  status: 'success' | 'error';
  isValid: boolean;
  hasCredits: boolean;
  creditBalance?: number;
  creditUsed?: number;
  models: { modelId: string; displayName?: string; modelGroup?: string }[];
  provider?: string;
  apiType?: number;
  lastChecked?: string;
  error?: string;
}

function getCategory(apiType: number): keyof typeof CATEGORIES {
  for (const [key, config] of Object.entries(CATEGORIES)) {
    if (apiType >= config.range[0] && apiType <= config.range[1]) {
      return key as keyof typeof CATEGORIES;
    }
  }
  return 'other';
}

function KeyCard({
  apiKey,
  onDelete,
  onCopy,
  onVerify,
  onViewDetails
}: {
  apiKey: ApiKey;
  onDelete: (id: string) => void;
  onCopy: (key: string) => void;
  onVerify: (id: string) => void;
  onViewDetails: (key: ApiKey) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const status = STATUS_CONFIG[apiKey.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG['-99'];
  const StatusIcon = status.icon;
  const providerName = PROVIDER_NAMES[apiKey.apiType] || 'Unknown';
  const isUnverified = apiKey.status === -99;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(apiKey.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setVerifying(true);
    await onVerify(apiKey.$id);
    setVerifying(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(apiKey.$id);
  };

  const maskedKey = apiKey.apiKey.substring(0, 12) + '...' + apiKey.apiKey.substring(apiKey.apiKey.length - 4);

  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-primary/10 hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => onViewDetails(apiKey)}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={cn('p-2 rounded-md', status.bg)}>
          <Key className={cn('h-4 w-4', status.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{providerName}</span>
            <Badge variant="outline" className={cn('text-xs', status.color, status.bg)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          <code className="text-xs text-muted-foreground font-mono">{maskedKey}</code>
        </div>
      </div>
      <div className="flex items-center gap-1 ml-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => { e.stopPropagation(); onViewDetails(apiKey); }}
          title="View details"
        >
          <Eye className="h-4 w-4" />
        </Button>
        {isUnverified && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary hover:text-primary"
            onClick={handleVerify}
            disabled={verifying}
            title="Verify key"
          >
            {verifying ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  keys,
  onDelete,
  onCopy,
  onVerify,
  onViewDetails
}: {
  category: keyof typeof CATEGORIES;
  keys: ApiKey[];
  onDelete: (id: string) => void;
  onCopy: (key: string) => void;
  onVerify: (id: string) => void;
  onViewDetails: (key: ApiKey) => void;
}) {
  const config = CATEGORIES[category];
  const Icon = config.icon;

  if (keys.length === 0) return null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-medium">{config.label}</CardTitle>
          <Badge variant="secondary" className="ml-auto">{keys.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {keys.map((key) => (
          <KeyCard
            key={key.$id}
            apiKey={key}
            onDelete={onDelete}
            onCopy={onCopy}
            onVerify={onVerify}
            onViewDetails={onViewDetails}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function KeysView() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [providerFilterOpen, setProviderFilterOpen] = useState(false);
  const [stats, setStats] = useState<{ total: number; valid: number; invalid: number; unverified: number } | null>(null);

  // Key details dialog state
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [keyDetails, setKeyDetails] = useState<KeyDetailsResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const selectedStatusFilter = useMemo(
    () => STATUS_FILTER_OPTIONS.find((opt) => opt.value === statusFilter) || STATUS_FILTER_OPTIONS[0],
    [statusFilter]
  );

  const selectedProviderFilter = useMemo(
    () => PROVIDER_FILTER_OPTIONS.find((opt) => opt.value === providerFilter) || PROVIDER_FILTER_OPTIONS[0],
    [providerFilter]
  );

  // Group providers by category for the dropdown
  const providersByCategory = useMemo(() => {
    const groups: Record<string, typeof PROVIDER_FILTER_OPTIONS[number][]> = {};
    PROVIDER_FILTER_OPTIONS.forEach((opt) => {
      if (opt.category === 'all') return;
      if (!groups[opt.category]) groups[opt.category] = [];
      groups[opt.category].push(opt);
    });
    return groups;
  }, []);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      params.set('limit', '500');

      const response = await fetch(`/api/keys?${params}`);
      const data = await response.json();
      setKeys(data.keys || []);
    } catch (error) {
      console.error('Failed to load keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/keys?action=stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  useEffect(() => {
    loadKeys();
    loadStats();
  }, [statusFilter]);

  // Filter keys by provider (client-side)
  const filteredKeys = useMemo(() => {
    if (providerFilter === 'all') return keys;
    return keys.filter((k) => k.apiType === parseInt(providerFilter, 10));
  }, [keys, providerFilter]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/keys?id=${id}`, { method: 'DELETE' });
      setKeys(keys.filter((k) => k.$id !== id));
      loadStats();
    } catch (error) {
      console.error('Failed to delete key:', error);
    }
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
  };

  const handleVerify = async (id: string) => {
    try {
      const response = await fetch(`/api/verifier?id=${id}`, { method: 'POST' });
      const result = await response.json();
      if (result.status === 'success') {
        // Update the key status in local state
        setKeys(keys.map((k) =>
          k.$id === id ? { ...k, status: result.newStatus } : k
        ));
        loadStats();
      }
    } catch (error) {
      console.error('Failed to verify key:', error);
    }
  };

  const handleViewDetails = async (key: ApiKey) => {
    setSelectedKey(key);
    setDetailsDialogOpen(true);
    setDetailsLoading(true);
    setKeyDetails(null);

    try {
      const response = await fetch(`/api/keys/details?id=${key.$id}`);
      const data = await response.json();
      setKeyDetails(data);
    } catch (error) {
      console.error('Failed to load key details:', error);
      setKeyDetails({
        status: 'error',
        isValid: false,
        hasCredits: false,
        models: [],
        error: 'Failed to load details',
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleReverify = async () => {
    if (!selectedKey) return;
    setDetailsLoading(true);
    try {
      const response = await fetch(`/api/verifier?id=${selectedKey.$id}`, { method: 'POST' });
      const result = await response.json();
      if (result.status === 'success') {
        setKeys(keys.map((k) =>
          k.$id === selectedKey.$id ? { ...k, status: result.newStatus } : k
        ));
        setSelectedKey({ ...selectedKey, status: result.newStatus });
        loadStats();
        // Reload details after reverification
        handleViewDetails({ ...selectedKey, status: result.newStatus });
      }
    } catch (error) {
      console.error('Failed to reverify key:', error);
    }
    setDetailsLoading(false);
  };

  // Group keys by category (using filtered keys)
  const keysByCategory = Object.keys(CATEGORIES).reduce((acc, cat) => {
    acc[cat as keyof typeof CATEGORIES] = filteredKeys.filter(
      (k) => getCategory(k.apiType) === cat
    );
    return acc;
  }, {} as Record<keyof typeof CATEGORIES, ApiKey[]>);

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <Key className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Valid</span>
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
              <div className="text-2xl font-bold text-success">{stats.valid}</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Invalid</span>
                <XCircle className="h-4 w-4 text-destructive" />
              </div>
              <div className="text-2xl font-bold text-destructive">{stats.invalid}</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Unverified</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{stats.unverified}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Provider Filter */}
          <Popover open={providerFilterOpen} onOpenChange={setProviderFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={providerFilterOpen}
                className="w-[200px] justify-between hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
              >
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{selectedProviderFilter.label}</span>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0">
              <Command>
                <CommandInput placeholder="Search provider..." />
                <CommandList className="max-h-[300px]">
                  <CommandEmpty>No provider found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="All Providers"
                      onSelect={() => {
                        setProviderFilter('all');
                        setProviderFilterOpen(false);
                      }}
                    >
                      <Key className={cn('mr-2 h-4 w-4', providerFilter === 'all' && 'text-primary')} />
                      <span>All Providers</span>
                      {providerFilter === 'all' && (
                        <Check className="ml-auto h-4 w-4 text-primary" />
                      )}
                    </CommandItem>
                  </CommandGroup>
                  {Object.entries(providersByCategory).map(([category, providers]) => (
                    <CommandGroup key={category} heading={category}>
                      {providers.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.label}
                          onSelect={() => {
                            setProviderFilter(option.value);
                            setProviderFilterOpen(false);
                          }}
                        >
                          <span className={cn('mr-2', providerFilter === option.value && 'text-primary')}>
                            {option.label}
                          </span>
                          {providerFilter === option.value && (
                            <Check className="ml-auto h-4 w-4 text-primary" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Status Filter */}
          <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={statusFilterOpen}
                className="w-[160px] justify-between hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
              >
                <div className="flex items-center gap-2">
                  <selectedStatusFilter.icon className="h-4 w-4" />
                  <span>{selectedStatusFilter.label}</span>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[160px] p-0">
              <Command>
                <CommandInput placeholder="Search status..." />
                <CommandList>
                  <CommandEmpty>No status found.</CommandEmpty>
                  <CommandGroup>
                    {STATUS_FILTER_OPTIONS.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => {
                          setStatusFilter(option.value);
                          setStatusFilterOpen(false);
                        }}
                      >
                        <option.icon className={cn('mr-2 h-4 w-4', statusFilter === option.value && 'text-primary')} />
                        <span>{option.label}</span>
                        {statusFilter === option.value && (
                          <Check className="ml-auto h-4 w-4 text-primary" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Show filtered count */}
          {(providerFilter !== 'all' || statusFilter !== 'all') && (
            <Badge variant="secondary" className="ml-2">
              {filteredKeys.length} keys
            </Badge>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={loadKeys} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Keys by Category */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredKeys.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No API keys found</p>
            <p className="text-sm">
              {keys.length > 0
                ? 'Try adjusting your filters'
                : 'Run the scraper to discover keys'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(keysByCategory).map(([category, categoryKeys]) => (
            <CategorySection
              key={category}
              category={category as keyof typeof CATEGORIES}
              keys={categoryKeys}
              onDelete={handleDelete}
              onCopy={handleCopy}
              onVerify={handleVerify}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

      {/* Key Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Key Details
            </DialogTitle>
            <DialogDescription>
              {selectedKey && PROVIDER_NAMES[selectedKey.apiType]} API Key
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : keyDetails ? (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  className={cn(
                    keyDetails.isValid
                      ? 'text-success bg-success/10'
                      : 'text-destructive bg-destructive/10'
                  )}
                >
                  {keyDetails.isValid ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {keyDetails.isValid ? 'Valid' : 'Invalid'}
                </Badge>
              </div>

              {/* Credits (if available) */}
              {keyDetails.creditBalance !== undefined && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-warning" />
                    <span className="text-sm text-muted-foreground">Credits</span>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      'font-semibold',
                      keyDetails.hasCredits ? 'text-success' : 'text-destructive'
                    )}>
                      ${keyDetails.creditBalance.toFixed(4)}
                    </div>
                    {keyDetails.creditUsed !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        Used: ${keyDetails.creditUsed.toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Has Credits Badge (when no balance info) */}
              {keyDetails.creditBalance === undefined && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-warning" />
                    <span className="text-sm text-muted-foreground">Credits</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      keyDetails.hasCredits
                        ? 'text-success bg-success/10'
                        : 'text-destructive bg-destructive/10'
                    )}
                  >
                    {keyDetails.hasCredits ? 'Available' : 'No Credits'}
                  </Badge>
                </div>
              )}

              {/* Models */}
              {keyDetails.models.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Cpu className="h-4 w-4" />
                    <span>Available Models ({keyDetails.models.length})</span>
                  </div>
                  <ScrollArea className="h-48 rounded-md border p-2">
                    <div className="space-y-1">
                      {keyDetails.models.map((model) => (
                        <div
                          key={model.modelId}
                          className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">
                              {model.displayName || model.modelId}
                            </div>
                            {model.modelGroup && (
                              <div className="text-xs text-muted-foreground">
                                {model.modelGroup}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Error message */}
              {keyDetails.error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {keyDetails.error}
                </div>
              )}

              {/* Last Checked */}
              {keyDetails.lastChecked && (
                <div className="text-xs text-muted-foreground text-center">
                  Last checked: {new Date(keyDetails.lastChecked).toLocaleString()}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleReverify}
                  disabled={detailsLoading}
                >
                  {detailsLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Re-verify
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (selectedKey) {
                      navigator.clipboard.writeText(selectedKey.apiKey);
                    }
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Key
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
