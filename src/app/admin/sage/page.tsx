'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ConfigSection from '../components/ConfigSection';
import NumberInput from '../components/NumberInput';
import SaveDeployBar from '../components/SaveDeployBar';
import { useUnsavedWarning } from '../hooks/useUnsavedWarning';
import BotBadge from '../components/BotBadge';
import ToggleSwitch from '../components/ToggleSwitch';
import RolePicker from '../components/RolePicker';
import DataTable, { Column } from '../components/DataTable';
import AdminLightbox from '../components/AdminLightbox';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';

// -- Types (Sage config) --

interface PrivilegedRole {
  id: string;
  title: string;
  name: string;
}

interface KnownRole {
  id: string;
  name: string;
}

interface SageSettings {
  provider: 'google' | 'openrouter';
  googleModel: string;
  openrouterModel: string;
  webSearch: boolean;
  imageGeneration: boolean;
  imageGenerationModel: string;
  imageGenRoles: string[];
  sagePrefixes: string[];
  ownerRoleIds: string[];
  channelContextLimit: number;
}

interface SagePrivileges {
  lunarianAccess: boolean;
  lunarianRoleId: string;
  privilegedRoles: PrivilegedRole[];
  allKnownRoles: KnownRole[];
}

// -- Types (Live Chat) --

interface HelpOfferTemplates {
  mastermind: string[];
  privileged: string[];
  lunarian: string[];
  default: string[];
}

interface GreetingTemplates {
  arabic: string[];
  english: string[];
}

interface ReactionEmojis {
  luna: string;
  question: string;
  greeting: string;
  excitement: string;
}

interface ChannelReference {
  channelId: string;
  name: string;
  description: string;
}

interface LiveChatConfig {
  autoJoinEnabled: boolean;
  reactionsEnabled: boolean;
  periodicCheckIn: boolean;
  mastermindOnly: boolean;
  reactionProbability: number;
  autoJoinCooldownMinutes: number;
  checkInInterval: number;
  liveChatChannels: string[];
  aiCooldownSeconds: number;
  reactionCooldownSeconds: number;
  userReactionLimit: number;
  userReactionWindowMinutes: number;
  userHelpOfferCooldownMinutes: number;
  userGreetingCooldownMinutes: number;
  greetingCooldownSeconds: number;
  helpOfferCooldownSeconds: number;
  unansweredQuestionDelaySeconds: number;
  lunaKeywords: string[];
  helpOfferTemplates: HelpOfferTemplates;
  greetingTemplates: GreetingTemplates;
  reactionEmojis: ReactionEmojis;
  channelReferences: ChannelReference[];
}

interface MemoryFact {
  text: string;
  setBy: string;
  setByRole: string;
  setAt: string;
  expiresAt?: string | null;
}

interface UserMemoryDoc {
  userId: string;
  facts: MemoryFact[];
}

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parentName: string;
}

interface ChannelOverride {
  channelId: string;
  autoJoin: boolean;
  reactions: boolean;
}

interface ActivityEntry {
  _id: string;
  time: string;
  channelId: string;
  type: 'keyword' | 'reaction' | 'periodic' | 'unanswered_question';
  reason: string;
  action: string;
  responsePreview: string;
}

// -- Defaults --

const DEFAULT_SETTINGS: SageSettings = {
  provider: 'google',
  googleModel: 'gemini-2.5-flash',
  openrouterModel: 'anthropic/claude-3.5-sonnet:online',
  webSearch: false,
  imageGeneration: false,
  imageGenerationModel: 'gemini-2.5-flash-image',
  imageGenRoles: [],
  sagePrefixes: ['سيج', 'sage'],
  ownerRoleIds: [],
  channelContextLimit: 50,
};

const DEFAULT_PRIVILEGES: SagePrivileges = {
  lunarianAccess: false,
  lunarianRoleId: '',
  privilegedRoles: [],
  allKnownRoles: [],
};

const DEFAULT_LIVE_CONFIG: LiveChatConfig = {
  autoJoinEnabled: true,
  reactionsEnabled: true,
  periodicCheckIn: true,
  mastermindOnly: false,
  reactionProbability: 0.3,
  autoJoinCooldownMinutes: 3,
  checkInInterval: 20,
  liveChatChannels: [],
  aiCooldownSeconds: 8,
  reactionCooldownSeconds: 30,
  userReactionLimit: 3,
  userReactionWindowMinutes: 5,
  userHelpOfferCooldownMinutes: 2,
  userGreetingCooldownMinutes: 5,
  greetingCooldownSeconds: 60,
  helpOfferCooldownSeconds: 30,
  unansweredQuestionDelaySeconds: 60,
  lunaKeywords: [
    'لونا', 'القمر', 'اللوناري', 'العقل المدبر', 'الحارس', 'الفارس',
    'النبيل', 'لونفور', 'الحراس', 'الفرسان', 'النبلاء',
    'كايل', 'ميلونا', 'زولدار', 'سيلونا', 'بريمور', 'كورين',
    'فانتاسي', 'قراند فانتاسي', 'حرب الفصائل', 'أحجار القمر', 'بطاقات لونا',
    'luna', 'lunarian', 'mastermind', 'sentinel', 'guardian', 'knight',
    'noble', 'lunvor', 'kael', 'meluna', 'zoldar', 'seluna', 'primor',
    'fantasy', 'faction war', 'moon stones', 'luna cards',
  ],
  helpOfferTemplates: {
    mastermind: [
      "سيدي العقل المدبر، عندي تفاصيل عن هالموضوع لو تحب أشرحلك 🌙",
      "سيدي العقل المدبر، أقدر أفيدك بهذا لو تبي 🌙",
      "سيدي العقل المدبر، عندي معلومات عن هذا، تبي أوضحلك؟ 🌙",
    ],
    privileged: [
      "عندي تفاصيل عن هالموضوع لو تبي أشرحلك 🌙",
      "أقدر أساعدك بهذا، تبي؟ 🌙",
      "عندي معلومات عن هذا لو تحب أوضحلك 🌙",
    ],
    lunarian: [
      "أقدر أشرحلك عن هذا، تبي؟ 🌙",
      "تبي أفيدك؟ أعرف كثير عن هالموضوع 🌙",
      "عندي تفاصيل عن هذا لو تبي يا اللوناري 🌙",
    ],
    default: [
      "عندي معلومات عن هالموضوع لو تبي أفيدك 🌙",
      "أقدر أساعدك بهذا، تبي أشرحلك؟ 🌙",
      "تبي أفيدك بهذا؟ 🌙",
    ],
  },
  greetingTemplates: {
    arabic: [
      "وعليكم السلام 👋",
      "هلا وغلا 👋",
      "أهلاً! 👋",
      "حياك الله 👋",
    ],
    english: [
      "Hey! 👋",
      "Hello! 👋",
      "Hi there! 👋",
    ],
  },
  reactionEmojis: {
    luna: "🌙",
    question: "🤔",
    greeting: "👋",
    excitement: "🔥",
  },
  channelReferences: [],
};

type Tab = 'settings' | 'system_prompt' | 'lore' | 'privileges' | 'live_chat' | 'memories' | 'activity';

// -- Helpers --

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

// -- Component --

export default function SagePage() {
  const [tab, setTab] = useState<Tab>('settings');

  // === Sage config state ===
  const [settings, setSettings] = useState<SageSettings>({ ...DEFAULT_SETTINGS });
  const [settingsOriginal, setSettingsOriginal] = useState<SageSettings>({ ...DEFAULT_SETTINGS });
  const [systemPrompt, setSystemPrompt] = useState('');
  const [systemPromptOriginal, setSystemPromptOriginal] = useState('');
  const [loreText, setLoreText] = useState('');
  const [loreTextOriginal, setLoreTextOriginal] = useState('');
  const [privileges, setPrivileges] = useState<SagePrivileges>({ ...DEFAULT_PRIVILEGES });
  const [privilegesOriginal, setPrivilegesOriginal] = useState<SagePrivileges>({ ...DEFAULT_PRIVILEGES });
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // === Live Chat config state ===
  const [liveConfig, setLiveConfig] = useState<LiveChatConfig>({ ...DEFAULT_LIVE_CONFIG });
  const [liveConfigOriginal, setLiveConfigOriginal] = useState<LiveChatConfig>({ ...DEFAULT_LIVE_CONFIG });
  const [liveConfigLoading, setLiveConfigLoading] = useState(true);
  const [liveSaving, setLiveSaving] = useState(false);

  // Memories state
  const [memoryDocs, setMemoryDocs] = useState<UserMemoryDoc[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memorySearch, setMemorySearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newFactText, setNewFactText] = useState('');
  const [newFactExpiry, setNewFactExpiry] = useState('');
  const [addingFact, setAddingFact] = useState(false);
  const [deletingFactIdx, setDeletingFactIdx] = useState<number | null>(null);

  // Channels state
  const [channels, setChannels] = useState<ChannelOverride[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelAutoJoin, setNewChannelAutoJoin] = useState(true);
  const [newChannelReactions, setNewChannelReactions] = useState(true);
  const [savingChannels, setSavingChannels] = useState(false);

  // Activity state
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityTypeFilter, setActivityTypeFilter] = useState('');
  const [activityChannelFilter, setActivityChannelFilter] = useState('');
  const activityRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { toast } = useToast();

  // Discord guild channels for the channel picker
  const [guildChannels, setGuildChannels] = useState<DiscordChannel[]>([]);
  useEffect(() => {
    fetch('/api/admin/discord/guild')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.channels) {
          // Only text channels (type 0) and announcement channels (type 5)
          setGuildChannels(data.channels.filter((c: DiscordChannel) => c.type === 0 || c.type === 5));
        }
      })
      .catch(() => {});
  }, []);

  // ===========================
  // Sage config fetch/save
  // ===========================

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config/sage');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const s = data.sections || {};

      const settingsData: SageSettings = {
        provider: s.provider ?? DEFAULT_SETTINGS.provider,
        googleModel: s.google_model ?? DEFAULT_SETTINGS.googleModel,
        openrouterModel: s.openrouter_model ?? DEFAULT_SETTINGS.openrouterModel,
        webSearch: s.enable_search ?? DEFAULT_SETTINGS.webSearch,
        imageGeneration: s.enable_image_generation ?? DEFAULT_SETTINGS.imageGeneration,
        imageGenerationModel: s.image_generation_model ?? DEFAULT_SETTINGS.imageGenerationModel,
        imageGenRoles: s.image_gen_roles ?? DEFAULT_SETTINGS.imageGenRoles,
        sagePrefixes: s.sage_prefix ?? DEFAULT_SETTINGS.sagePrefixes,
        ownerRoleIds: s.owner_role_ids ?? DEFAULT_SETTINGS.ownerRoleIds,
        channelContextLimit: s.channel_context_limit ?? DEFAULT_SETTINGS.channelContextLimit,
      };
      setSettings(settingsData);
      setSettingsOriginal(settingsData);

      if (s.system_prompt !== undefined) {
        const prompt = typeof s.system_prompt === 'string' ? s.system_prompt : '';
        setSystemPrompt(prompt);
        setSystemPromptOriginal(prompt);
      }

      if (s.lore_text !== undefined) {
        const lore = typeof s.lore_text === 'string' ? s.lore_text : '';
        setLoreText(lore);
        setLoreTextOriginal(lore);
      }

      const privData: SagePrivileges = {
        lunarianAccess: s.lunarian_access ?? DEFAULT_PRIVILEGES.lunarianAccess,
        lunarianRoleId: s.lunarian_role_id ?? DEFAULT_PRIVILEGES.lunarianRoleId,
        privilegedRoles: s.privileged_roles ?? DEFAULT_PRIVILEGES.privilegedRoles,
        allKnownRoles: s.all_known_roles ?? DEFAULT_PRIVILEGES.allKnownRoles,
      };
      setPrivileges(privData);
      setPrivilegesOriginal(privData);
    } catch {
      toast('Failed to load Sage config. Try refreshing.', 'error');
    } finally {
      setConfigLoading(false);
    }
  }, [toast]);

  // ===========================
  // Live Chat config fetch/save
  // ===========================

  const fetchLiveConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sage-live-chat/config');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const c: LiveChatConfig = {
        autoJoinEnabled: data.autoJoinEnabled ?? DEFAULT_LIVE_CONFIG.autoJoinEnabled,
        reactionsEnabled: data.reactionsEnabled ?? DEFAULT_LIVE_CONFIG.reactionsEnabled,
        periodicCheckIn: data.periodicCheckIn ?? DEFAULT_LIVE_CONFIG.periodicCheckIn,
        mastermindOnly: data.mastermindOnly ?? DEFAULT_LIVE_CONFIG.mastermindOnly,
        reactionProbability: data.reactionProbability ?? DEFAULT_LIVE_CONFIG.reactionProbability,
        autoJoinCooldownMinutes: data.autoJoinCooldownMinutes ?? DEFAULT_LIVE_CONFIG.autoJoinCooldownMinutes,
        checkInInterval: data.checkInInterval ?? DEFAULT_LIVE_CONFIG.checkInInterval,
        liveChatChannels: data.liveChatChannels ?? DEFAULT_LIVE_CONFIG.liveChatChannels,
        aiCooldownSeconds: data.aiCooldownSeconds ?? DEFAULT_LIVE_CONFIG.aiCooldownSeconds,
        reactionCooldownSeconds: data.reactionCooldownSeconds ?? DEFAULT_LIVE_CONFIG.reactionCooldownSeconds,
        userReactionLimit: data.userReactionLimit ?? DEFAULT_LIVE_CONFIG.userReactionLimit,
        userReactionWindowMinutes: data.userReactionWindowMinutes ?? DEFAULT_LIVE_CONFIG.userReactionWindowMinutes,
        userHelpOfferCooldownMinutes: data.userHelpOfferCooldownMinutes ?? DEFAULT_LIVE_CONFIG.userHelpOfferCooldownMinutes,
        userGreetingCooldownMinutes: data.userGreetingCooldownMinutes ?? DEFAULT_LIVE_CONFIG.userGreetingCooldownMinutes,
        greetingCooldownSeconds: data.greetingCooldownSeconds ?? DEFAULT_LIVE_CONFIG.greetingCooldownSeconds,
        helpOfferCooldownSeconds: data.helpOfferCooldownSeconds ?? DEFAULT_LIVE_CONFIG.helpOfferCooldownSeconds,
        unansweredQuestionDelaySeconds: data.unansweredQuestionDelaySeconds ?? DEFAULT_LIVE_CONFIG.unansweredQuestionDelaySeconds,
        lunaKeywords: data.lunaKeywords ?? DEFAULT_LIVE_CONFIG.lunaKeywords,
        helpOfferTemplates: data.helpOfferTemplates ?? DEFAULT_LIVE_CONFIG.helpOfferTemplates,
        greetingTemplates: data.greetingTemplates ?? DEFAULT_LIVE_CONFIG.greetingTemplates,
        reactionEmojis: data.reactionEmojis ?? DEFAULT_LIVE_CONFIG.reactionEmojis,
        channelReferences: data.channelReferences ?? DEFAULT_LIVE_CONFIG.channelReferences,
      };
      setLiveConfig(c);
      setLiveConfigOriginal(c);
    } catch {
      toast('Failed to load live chat config.', 'error');
    } finally {
      setLiveConfigLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfig();
    fetchLiveConfig();
  }, [fetchConfig, fetchLiveConfig]);

  // Change detection — Sage config
  const settingsChanged = JSON.stringify(settings) !== JSON.stringify(settingsOriginal);
  const systemPromptChanged = systemPrompt !== systemPromptOriginal;
  const loreChanged = loreText !== loreTextOriginal;
  const privilegesChanged = JSON.stringify(privileges) !== JSON.stringify(privilegesOriginal);
  const sageHasChanges = settingsChanged || systemPromptChanged || loreChanged || privilegesChanged;

  // Change detection — Live Chat config
  const liveConfigChanged = JSON.stringify(liveConfig) !== JSON.stringify(liveConfigOriginal);

  const hasChanges = sageHasChanges || liveConfigChanged;
  useUnsavedWarning(hasChanges);

  // Save Sage config — sends individual field PUTs
  async function saveSageConfig() {
    setSaving(true);
    const toSave: Array<{ section: string; value: any }> = [];
    const saved: string[] = [];
    try {
      if (settingsChanged) {
        if (settings.provider !== settingsOriginal.provider)
          toSave.push({ section: 'provider', value: settings.provider });
        if (settings.googleModel !== settingsOriginal.googleModel)
          toSave.push({ section: 'google_model', value: settings.googleModel });
        if (settings.openrouterModel !== settingsOriginal.openrouterModel)
          toSave.push({ section: 'openrouter_model', value: settings.openrouterModel });
        if (settings.webSearch !== settingsOriginal.webSearch)
          toSave.push({ section: 'enable_search', value: settings.webSearch });
        if (settings.imageGeneration !== settingsOriginal.imageGeneration)
          toSave.push({ section: 'enable_image_generation', value: settings.imageGeneration });
        if (settings.imageGenerationModel !== settingsOriginal.imageGenerationModel)
          toSave.push({ section: 'image_generation_model', value: settings.imageGenerationModel });
        if (JSON.stringify(settings.imageGenRoles) !== JSON.stringify(settingsOriginal.imageGenRoles))
          toSave.push({ section: 'image_gen_roles', value: settings.imageGenRoles });
        if (JSON.stringify(settings.sagePrefixes) !== JSON.stringify(settingsOriginal.sagePrefixes))
          toSave.push({ section: 'sage_prefix', value: settings.sagePrefixes });
        if (JSON.stringify(settings.ownerRoleIds) !== JSON.stringify(settingsOriginal.ownerRoleIds))
          toSave.push({ section: 'owner_role_ids', value: settings.ownerRoleIds });
        if (settings.channelContextLimit !== settingsOriginal.channelContextLimit)
          toSave.push({ section: 'channel_context_limit', value: settings.channelContextLimit });

      }
      if (systemPromptChanged) {
        toSave.push({ section: 'system_prompt', value: systemPrompt });
      }
      if (loreChanged) {
        toSave.push({ section: 'lore_text', value: loreText });
      }
      if (privilegesChanged) {
        if (privileges.lunarianAccess !== privilegesOriginal.lunarianAccess)
          toSave.push({ section: 'lunarian_access', value: privileges.lunarianAccess });
        if (privileges.lunarianRoleId !== privilegesOriginal.lunarianRoleId)
          toSave.push({ section: 'lunarian_role_id', value: privileges.lunarianRoleId });
        if (JSON.stringify(privileges.privilegedRoles) !== JSON.stringify(privilegesOriginal.privilegedRoles))
          toSave.push({ section: 'privileged_roles', value: privileges.privilegedRoles });
        if (JSON.stringify(privileges.allKnownRoles) !== JSON.stringify(privilegesOriginal.allKnownRoles))
          toSave.push({ section: 'all_known_roles', value: privileges.allKnownRoles });
      }

      for (const { section, value } of toSave) {
        const res = await fetch('/api/admin/config/sage', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body: JSON.stringify({ section, value }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to save ${section}`);
        }
        saved.push(section);
      }

      if (settingsChanged) setSettingsOriginal({ ...settings });
      if (systemPromptChanged) setSystemPromptOriginal(systemPrompt);
      if (loreChanged) setLoreTextOriginal(loreText);
      if (privilegesChanged) setPrivilegesOriginal(JSON.parse(JSON.stringify(privileges)));

      toast('Saved! Changes take effect within 30 seconds.', 'success');
    } catch (err: any) {
      const msg = saved.length > 0
        ? `Saved ${saved.length} of ${toSave.length} fields, then failed: ${err.message}. Click Save again to retry.`
        : err.message;
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  // Save Live Chat config
  async function saveLiveConfig() {
    setLiveSaving(true);
    const savedOriginal: Record<string, any> = { ...liveConfigOriginal };
    try {
      const fields: Array<{ section: keyof LiveChatConfig; value: any }> = [];
      for (const key of Object.keys(liveConfig) as Array<keyof LiveChatConfig>) {
        if (JSON.stringify(liveConfig[key]) !== JSON.stringify(liveConfigOriginal[key])) {
          fields.push({ section: key, value: liveConfig[key] });
        }
      }
      for (const { section, value } of fields) {
        const res = await fetch('/api/admin/sage-live-chat/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
          body: JSON.stringify({ section, value }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to save ${section}`);
        }
        savedOriginal[section] = value;
      }
      setLiveConfigOriginal({ ...liveConfig });
      toast('Config saved successfully.', 'success');
    } catch (err: any) {
      setLiveConfigOriginal(savedOriginal as LiveChatConfig);
      toast(err.message, 'error');
    } finally {
      setLiveSaving(false);
    }
  }

  // Discard helpers
  function discardSettings() {
    setSettings({ ...settingsOriginal });
  }

  function discardSystemPrompt() {
    setSystemPrompt(systemPromptOriginal);
  }

  function discardLore() {
    setLoreText(loreTextOriginal);
  }

  function discardPrivileges() {
    setPrivileges(JSON.parse(JSON.stringify(privilegesOriginal)));
  }

  function discardLiveConfig() {
    setLiveConfig({ ...liveConfigOriginal });
  }

  // Privileged roles helpers
  function addPrivilegedRole() {
    setPrivileges({
      ...privileges,
      privilegedRoles: [...privileges.privilegedRoles, { id: '', title: '', name: '' }],
    });
  }

  function removePrivilegedRole(index: number) {
    setPrivileges({
      ...privileges,
      privilegedRoles: privileges.privilegedRoles.filter((_, i) => i !== index),
    });
  }

  function updatePrivilegedRole(index: number, field: keyof PrivilegedRole, value: string) {
    const updated = [...privileges.privilegedRoles];
    updated[index] = { ...updated[index], [field]: value };
    setPrivileges({ ...privileges, privilegedRoles: updated });
  }

  // System prompt character count
  const promptLen = systemPrompt.length;
  const promptWarning = promptLen > 8000 ? 'red' : promptLen > 4000 ? 'yellow' : null;

  // ===========================
  // Memories
  // ===========================

  const fetchMemories = useCallback(async () => {
    setMemoriesLoading(true);
    try {
      const params = new URLSearchParams();
      if (memorySearch.trim()) params.set('search', memorySearch.trim());
      const res = await fetch(`/api/admin/sage-live-chat/memories?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: UserMemoryDoc[] = await res.json();
      setMemoryDocs(Array.isArray(data) ? data : []);
    } catch {
      toast('Failed to load user memories.', 'error');
    } finally {
      setMemoriesLoading(false);
    }
  }, [memorySearch, toast]);

  useEffect(() => {
    if (tab === 'memories') fetchMemories();
  }, [tab, fetchMemories]);

  const selectedUserFacts = memoryDocs.find(d => d.userId === selectedUserId)?.facts ?? [];

  function openUserFacts(userId: string) {
    setSelectedUserId(userId);
    setNewFactText('');
    setNewFactExpiry('');
  }

  async function addFact() {
    if (!selectedUserId || !newFactText.trim()) return;
    setAddingFact(true);
    try {
      const body: any = { userId: selectedUserId, text: newFactText.trim() };
      if (newFactExpiry) body.expiresAt = new Date(newFactExpiry).toISOString();
      const res = await fetch('/api/admin/sage-live-chat/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add fact');
      }
      toast('Fact added.', 'success');
      setNewFactText('');
      setNewFactExpiry('');
      await fetchMemories();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setAddingFact(false);
    }
  }

  async function deleteFact(factIndex: number) {
    if (!selectedUserId) return;
    setDeletingFactIdx(factIndex);
    try {
      const res = await fetch('/api/admin/sage-live-chat/memories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ userId: selectedUserId, factIndex }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete fact');
      }
      toast('Fact deleted.', 'success');
      await fetchMemories();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setDeletingFactIdx(null);
    }
  }

  // ===========================
  // Channels
  // ===========================

  const fetchChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const res = await fetch('/api/admin/sage-live-chat/channels');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const overrides = data.channelOverrides ?? {};
      const arr: ChannelOverride[] = Object.entries(overrides).map(([id, o]: [string, any]) => ({
        channelId: id,
        autoJoin: o.autoJoin ?? true,
        reactions: o.reactions ?? true,
      }));
      setChannels(arr);
    } catch {
      toast('Failed to load channel overrides.', 'error');
    } finally {
      setChannelsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (tab === 'live_chat') fetchChannels();
  }, [tab, fetchChannels]);

  async function addChannelOverride() {
    if (!newChannelId.trim()) return;
    setSavingChannels(true);
    try {
      const res = await fetch('/api/admin/sage-live-chat/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ channelId: newChannelId.trim(), overrides: { autoJoin: newChannelAutoJoin, reactions: newChannelReactions } }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save channel override');
      }
      setNewChannelId('');
      setNewChannelAutoJoin(true);
      setNewChannelReactions(true);
      toast('Channel override added.', 'success');
      await fetchChannels();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSavingChannels(false);
    }
  }

  async function removeChannelOverride(channelId: string) {
    setSavingChannels(true);
    try {
      const res = await fetch('/api/admin/sage-live-chat/channels', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove channel override');
      }
      toast('Channel override removed.', 'success');
      await fetchChannels();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSavingChannels(false);
    }
  }

  // ===========================
  // Activity Log
  // ===========================

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const params = new URLSearchParams({ page: String(activityPage), limit: '20' });
      if (activityTypeFilter) params.set('type', activityTypeFilter);
      if (activityChannelFilter && /^\d{17,20}$/.test(activityChannelFilter)) params.set('channel', activityChannelFilter);
      const res = await fetch(`/api/admin/sage-live-chat/activity-log?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setActivity(data.items ?? []);
      setActivityTotal(data.total ?? 0);
    } catch {
      toast('Failed to load activity log.', 'error');
    } finally {
      setActivityLoading(false);
    }
  }, [activityPage, activityTypeFilter, activityChannelFilter, toast]);

  useEffect(() => {
    if (tab === 'activity') fetchActivity();
  }, [tab, fetchActivity]);

  // Auto-refresh activity every 30 seconds
  useEffect(() => {
    if (tab === 'activity') {
      activityRefreshRef.current = setInterval(fetchActivity, 30000);
      return () => {
        if (activityRefreshRef.current) clearInterval(activityRefreshRef.current);
      };
    }
    if (activityRefreshRef.current) clearInterval(activityRefreshRef.current);
  }, [tab, fetchActivity]);

  // ===========================
  // Column definitions
  // ===========================

  const memoryColumns: Column<{ userId: string; factsCount: number }>[] = [
    { key: 'userId', label: 'User ID', sortable: true },
    { key: 'factsCount', label: 'Facts', sortable: true },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <button
          className="admin-btn admin-btn-ghost admin-btn-sm"
          onClick={() => openUserFacts(row.userId)}
        >
          View / Manage
        </button>
      ),
    },
  ];

  const channelColumns: Column<ChannelOverride>[] = [
    { key: 'channelId', label: 'Channel ID', sortable: true },
    {
      key: 'autoJoin',
      label: 'Auto-Join',
      sortable: false,
      render: (row) => (
        <span style={{ color: row.autoJoin ? '#34d399' : 'var(--text-muted)' }}>
          {row.autoJoin ? 'On' : 'Off'}
        </span>
      ),
    },
    {
      key: 'reactions',
      label: 'Reactions',
      sortable: false,
      render: (row) => (
        <span style={{ color: row.reactions ? '#34d399' : 'var(--text-muted)' }}>
          {row.reactions ? 'On' : 'Off'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (row) => (
        <button
          className="admin-btn admin-btn-danger admin-btn-sm"
          onClick={() => removeChannelOverride(row.channelId)}
          disabled={savingChannels}
        >
          Remove
        </button>
      ),
    },
  ];

  const activityColumns: Column<ActivityEntry>[] = [
    {
      key: 'time',
      label: 'Time',
      sortable: false,
      render: (row) => <span style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{formatDate(row.time)}</span>,
    },
    { key: 'channelId', label: 'Channel', sortable: false },
    {
      key: 'type',
      label: 'Type',
      sortable: false,
      render: (row) => (
        <span style={{
          fontSize: '11px',
          padding: '2px 8px',
          borderRadius: '4px',
          background: row.type === 'keyword' ? 'rgba(59,130,246,0.15)' :
            row.type === 'reaction' ? 'rgba(168,85,247,0.15)' :
            row.type === 'periodic' ? 'rgba(52,211,153,0.15)' :
            'rgba(251,191,36,0.15)',
          color: row.type === 'keyword' ? '#60a5fa' :
            row.type === 'reaction' ? '#a855f7' :
            row.type === 'periodic' ? '#34d399' :
            '#fbbf24',
        }}>
          {row.type}
        </span>
      ),
    },
    { key: 'reason', label: 'Reason', sortable: false },
    { key: 'action', label: 'Action', sortable: false },
    {
      key: 'responsePreview',
      label: 'Response',
      sortable: false,
      render: (row) => (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '200px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.responsePreview || '-'}
        </span>
      ),
    },
  ];

  // ===========================
  // Render
  // ===========================

  if (configLoading || liveConfigLoading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">🧙</span> Luna Sage</h1>
          <p className="admin-page-subtitle">Complete management for Luna Sage — settings, AI, live chat, and security</p>
        </div>
        <SkeletonCard count={4} />
        <SkeletonTable rows={4} />
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">🧙</span> Luna Sage</h1>
        <p className="admin-page-subtitle">Complete management for Luna Sage — settings, AI, live chat, and security</p>
      </div>

      {/* Status overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div className="admin-stat-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Provider</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {settings.provider === 'google' ? 'Google Gemini' : 'OpenRouter'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
            {settings.provider === 'google' ? settings.googleModel : settings.openrouterModel}
          </div>
        </div>
        <div className="admin-stat-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Web Search</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: settings.webSearch ? '#34d399' : 'var(--text-muted)' }}>
            {settings.webSearch ? 'Enabled' : 'Disabled'}
          </div>
        </div>
        <div className="admin-stat-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Image Generation</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: settings.imageGeneration ? '#34d399' : 'var(--text-muted)' }}>
            {settings.imageGeneration ? 'Enabled' : 'Disabled'}
          </div>
          {settings.imageGeneration && settings.provider !== 'google' && (
            <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '2px' }}>Google only</div>
          )}
        </div>
        <div className="admin-stat-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Privileged Roles</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {privileges.privilegedRoles.length}
          </div>
          <div style={{ fontSize: '11px', color: privileges.lunarianAccess ? '#34d399' : 'var(--text-muted)', marginTop: '2px' }}>
            Lunarian: {privileges.lunarianAccess ? 'On' : 'Off'}
          </div>
        </div>
        <div className="admin-stat-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Auto-Join</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: liveConfig.autoJoinEnabled ? '#34d399' : 'var(--text-muted)' }}>
            {liveConfig.autoJoinEnabled ? 'Enabled' : 'Disabled'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Cooldown: {liveConfig.autoJoinCooldownMinutes}m
          </div>
        </div>
        <div className="admin-stat-card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Reactions</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: liveConfig.reactionsEnabled ? '#34d399' : 'var(--text-muted)' }}>
            {liveConfig.reactionsEnabled ? 'Enabled' : 'Disabled'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Probability: {Math.round(liveConfig.reactionProbability * 100)}%
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'settings' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
        <button
          className={`admin-tab ${tab === 'system_prompt' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('system_prompt')}
        >
          System Prompt
          {systemPromptChanged && <span style={{ marginLeft: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-legendary)', display: 'inline-block' }} />}
        </button>
        <button
          className={`admin-tab ${tab === 'lore' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('lore')}
        >
          World Lore
          {loreChanged && <span style={{ marginLeft: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-legendary)', display: 'inline-block' }} />}
        </button>
        <button
          className={`admin-tab ${tab === 'privileges' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('privileges')}
        >
          Privileges
        </button>
        <button
          className={`admin-tab ${tab === 'live_chat' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('live_chat')}
        >
          Live Chat
          {liveConfigChanged && <span style={{ marginLeft: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-legendary)', display: 'inline-block' }} />}
        </button>
        <button
          className={`admin-tab ${tab === 'memories' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('memories')}
        >
          User Memories
        </button>
        <button
          className={`admin-tab ${tab === 'activity' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('activity')}
        >
          Activity Log
        </button>
      </div>

      {/* ============================== */}
      {/* Settings Tab                   */}
      {/* ============================== */}
      {tab === 'settings' && (
        <>
          <ConfigSection title="AI Provider" description="Which AI service to use for responses">
            <div style={{ marginBottom: '12px' }}>
              <label className="admin-number-input-label">🔵 Provider</label>
              <select
                className="admin-number-input"
                value={settings.provider}
                onChange={(e) => setSettings({ ...settings, provider: e.target.value as 'google' | 'openrouter' })}
                style={{ width: '100%', maxWidth: '300px', cursor: 'pointer' }}
              >
                <option value="google">Google (Gemini)</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              <div className="admin-number-input-wrap">
                <label className="admin-number-input-label">
                  🤖 Google Model
                  {settings.provider === 'google' && <span style={{ marginLeft: 6, fontSize: '10px', color: '#34d399' }}>active</span>}
                </label>
                <input
                  type="text"
                  className="admin-number-input"
                  value={settings.googleModel}
                  onChange={(e) => setSettings({ ...settings, googleModel: e.target.value })}
                  placeholder="gemini-2.5-flash"
                  style={{ width: '100%', opacity: settings.provider === 'google' ? 1 : 0.5 }}
                />
                <span className="admin-number-input-desc">Model ID for Google Gemini API</span>
              </div>
              <div className="admin-number-input-wrap">
                <label className="admin-number-input-label">
                  🤖 OpenRouter Model
                  {settings.provider === 'openrouter' && <span style={{ marginLeft: 6, fontSize: '10px', color: '#34d399' }}>active</span>}
                </label>
                <input
                  type="text"
                  className="admin-number-input"
                  value={settings.openrouterModel}
                  onChange={(e) => setSettings({ ...settings, openrouterModel: e.target.value })}
                  placeholder="anthropic/claude-3.5-sonnet:online"
                  style={{ width: '100%', opacity: settings.provider === 'openrouter' ? 1 : 0.5 }}
                />
                <span className="admin-number-input-desc">Model ID for OpenRouter API</span>
              </div>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ToggleSwitch
                label="⚡ Web Search"
                checked={settings.webSearch}
                onChange={(v) => setSettings({ ...settings, webSearch: v })}
              />
              <ToggleSwitch
                label="⚡ Image Generation"
                checked={settings.imageGeneration}
                onChange={(v) => setSettings({ ...settings, imageGeneration: v })}
              />
              {settings.imageGeneration && (
                <div style={{ marginLeft: '16px', paddingLeft: '12px', borderLeft: '2px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Image generation and web search cannot be used simultaneously per request.
                    Search is used by default; image generation activates when users ask to create images.
                  </span>
                  {settings.provider !== 'google' && (
                    <span style={{ fontSize: '12px', color: '#f59e0b' }}>
                      Image generation only works with Google provider. Switch provider to use this feature.
                    </span>
                  )}
                  <div className="admin-number-input-wrap" style={{ marginTop: '4px' }}>
                    <label className="admin-number-input-label">🤖 Image Gen Model</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={settings.imageGenerationModel}
                      onChange={(e) => setSettings({ ...settings, imageGenerationModel: e.target.value })}
                      placeholder="gemini-2.5-flash-image"
                      style={{ width: '100%', maxWidth: '300px' }}
                    />
                    <span className="admin-number-input-desc">Model used for image generation requests</span>
                  </div>
                  <RolePicker
                    label="🛡️ Image Gen Roles"
                    description="Roles allowed to generate images. Empty = all Sage users can generate."
                    value={settings.imageGenRoles}
                    onChange={(v) => setSettings({ ...settings, imageGenRoles: v as string[] })}
                    multi
                  />
                </div>
              )}
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <ConfigSection title="Bot Configuration" description="Sage prefix triggers and owner role permissions">
            <div className="admin-form-group">
              <label className="admin-number-input-label">✏️ Sage Prefixes</label>
              <input
                type="text"
                className="admin-input"
                value={settings.sagePrefixes.join(', ')}
                onChange={(e) => setSettings({ ...settings, sagePrefixes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="سيج, sage"
                style={{ width: '100%', maxWidth: '400px' }}
              />
              <span className="admin-number-input-desc">Text prefixes that trigger Sage responses (e.g. !sage, سيج)</span>
            </div>
            <RolePicker
              label="🛡️ Owner Roles"
              description="Roles with full admin access to Sage commands (!setai, etc.)"
              value={settings.ownerRoleIds}
              onChange={(v) => setSettings({ ...settings, ownerRoleIds: v as string[] })}
              multi
            />
            <BotBadge bot="sage" />
          </ConfigSection>

          <ConfigSection title="Context" description="How much conversation history Sage reads when responding">
            <NumberInput
              label="Channel Context"
              value={settings.channelContextLimit}
              onChange={(v) => setSettings({ ...settings, channelContextLimit: v })}
              min={0}
              max={100}
              description="Number of recent channel messages included as context when Sage is triggered (0 = none)"
            />
          </ConfigSection>

          <SaveDeployBar
            hasChanges={settingsChanged}
            saving={saving}
            onSave={saveSageConfig}
            onDiscard={discardSettings}
            projectName="Sage"
          />
        </>
      )}

      {/* ============================== */}
      {/* System Prompt Tab              */}
      {/* ============================== */}
      {tab === 'system_prompt' && (
        <>
          {/* Variable reference guide */}
          <div className="admin-stat-card" style={{ marginBottom: 16, padding: '16px 20px', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>How the System Prompt Works</strong>
            Your prompt is sent as the base instruction to the AI model. The bot automatically appends the following context to every request:
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>
                <code style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>[CONTEXT_INFO]</code>
                <span style={{ marginLeft: 8 }}>User identity: REQUESTER_ID, REQUESTER_NAME, REQUESTER_ROLE, REQUESTER_TITLE, IS_LUNARIAN</span>
              </div>
              <div>
                <code style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>[CHANNEL_HISTORY]</code>
                <span style={{ marginLeft: 8 }}>Last 50 messages from the channel (for prefix/mention triggers)</span>
              </div>
              <div>
                <code style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>[USER_MESSAGE]</code>
                <span style={{ marginLeft: 8 }}>The actual user question/request</span>
              </div>
            </div>
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Also appended: Mastermind role indicator + Luna world lore data (~800 lines). Keep your prompt structured and concise for best results.
            </div>
          </div>

          <ConfigSection title="System Prompt" description="The system prompt sent to the AI model with every conversation">
            <div style={{ position: 'relative' }}>
              <textarea
                className="admin-number-input"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Enter the system prompt for Luna Sage..."
                style={{
                  width: '100%',
                  minHeight: '400px',
                  resize: 'vertical',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  padding: '12px',
                }}
              />
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{promptLen.toLocaleString()} characters</span>
                  {promptWarning === 'yellow' && (
                    <span style={{ color: '#f59e0b', fontSize: '11px' }}>
                      Long prompt — AI may deprioritize later instructions
                    </span>
                  )}
                  {promptWarning === 'red' && (
                    <span style={{ color: '#f43f5e', fontSize: '11px' }}>
                      Very long prompt — combined with lore data (~800 lines), this may exceed model limits or reduce compliance
                    </span>
                  )}
                </div>
                {systemPromptChanged && (
                  <span style={{ color: 'var(--accent-legendary)' }}>Unsaved changes</span>
                )}
              </div>
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <SaveDeployBar
            hasChanges={systemPromptChanged}
            saving={saving}
            onSave={saveSageConfig}
            onDiscard={discardSystemPrompt}
            projectName="Sage"
          />
        </>
      )}

      {/* ============================== */}
      {/* World Lore Tab                 */}
      {/* ============================== */}
      {tab === 'lore' && (
        <>
          <div className="admin-stat-card" style={{ marginBottom: 16, padding: '16px 20px', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>How Lore Works</strong>
            The lore text below is appended to every AI request as pinned context. Sage uses it to answer questions about the Luna world, characters, factions, merchants, games, and economy.
            If this field is empty, Sage falls back to the built-in lore file in the bot code.
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Format: Markdown headings (## Category, ### Sub-item) work best. Arabic text is fully supported.
            </div>
          </div>

          <ConfigSection title="Luna World Lore" description="Complete world-building data injected into every Sage AI prompt">
            <div style={{ position: 'relative' }}>
              <textarea
                className="admin-number-input"
                value={loreText}
                onChange={(e) => setLoreText(e.target.value)}
                placeholder="# Luna World - خريطة عالم لونا&#10;&#10;## قصة لونا&#10;..."
                style={{
                  width: '100%',
                  minHeight: '500px',
                  resize: 'vertical',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  padding: '12px',
                }}
                dir="auto"
              />
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{loreText.length.toLocaleString()} characters</span>
                  {loreText.length > 50000 && (
                    <span style={{ color: '#f59e0b', fontSize: '11px' }}>
                      Large lore — may increase AI token usage significantly
                    </span>
                  )}
                </div>
                {loreChanged && (
                  <span style={{ color: 'var(--accent-legendary)' }}>Unsaved changes</span>
                )}
              </div>
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <SaveDeployBar
            hasChanges={loreChanged}
            saving={saving}
            onSave={saveSageConfig}
            onDiscard={discardLore}
            projectName="Sage"
          />
        </>
      )}

      {/* ============================== */}
      {/* Privileges Tab                 */}
      {/* ============================== */}
      {tab === 'privileges' && (
        <>
          <ConfigSection title="Lunarian Access" description="Allow regular Lunarian members to use Sage">
            <ToggleSwitch
              label="Enable Lunarian Access"
              checked={privileges.lunarianAccess}
              onChange={(v) => setPrivileges({ ...privileges, lunarianAccess: v })}
            />
            <RolePicker
              label="Lunarian Role"
              description="The Discord role for Lunarian community members"
              value={privileges.lunarianRoleId}
              onChange={(v) => setPrivileges({ ...privileges, lunarianRoleId: v as string })}
            />
            <BotBadge bot="sage" />
          </ConfigSection>

          <div className="admin-stat-card" style={{ marginBottom: 16, padding: '16px 20px', fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 10 }}>How Sage Addresses Users</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>
                <span style={{ color: 'var(--accent-legendary)', fontWeight: 600 }}>Mastermind</span>
                {privileges.privilegedRoles[0]?.title && (
                  <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontStyle: 'italic' }} dir="auto">&quot;{privileges.privilegedRoles[0].title}&quot;</span>
                )}
                <span style={{ marginLeft: 8 }}>— Full expressive/deferential tone, must answer everything</span>
              </div>
              <div>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Privileged</span>
                {privileges.privilegedRoles.length > 1 && (
                  <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    ({privileges.privilegedRoles.slice(1).map(r => r.name).filter(Boolean).join(', ') || 'other roles'})
                  </span>
                )}
                <span style={{ marginLeft: 8 }}>— Strict neutral tone, addressed with their title</span>
              </div>
              <div>
                <span style={{ color: 'var(--common)', fontWeight: 600 }}>Lunarian</span>
                <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontStyle: 'italic' }} dir="auto">&quot;يا اللوناري،&quot;</span>
                <span style={{ marginLeft: 8 }}>— Friendly tone, gets follow-up Luna topic suggestions</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Default</span>
                <span style={{ marginLeft: 8 }}>— Concise, factual, no honorifics</span>
              </div>
            </div>
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
              The system prompt controls this behavior. Each role&apos;s &quot;Title&quot; field below is the Arabic honorific Sage uses when addressing that user.
            </div>
          </div>

          <ConfigSection title="Privileged Roles" description="Roles with elevated access to Sage. First role = highest priority (Mastermind). Order matters.">
            {privileges.privilegedRoles.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0', lineHeight: 1.6 }}>
                No privileged roles configured. Add roles to enable title-based addressing.
                The first role added will be treated as the Mastermind (highest privilege).
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {privileges.privilegedRoles.map((role, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr 1fr 1fr auto',
                      gap: '8px',
                      alignItems: 'end',
                      padding: '12px',
                      background: index === 0 ? 'rgba(255, 213, 79, 0.04)' : 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                      border: index === 0 ? '1px solid rgba(255, 213, 79, 0.15)' : '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: index === 0 ? 'rgba(255, 213, 79, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                      color: index === 0 ? 'var(--accent-legendary)' : 'var(--text-muted)',
                      alignSelf: 'center',
                    }}>
                      {index + 1}
                    </div>
                    <RolePicker
                      label={index === 0 ? 'Role (Mastermind)' : 'Role'}
                      value={role.id}
                      onChange={(v) => updatePrivilegedRole(index, 'id', v as string)}
                      compact
                    />
                    <div className="admin-number-input-wrap">
                      <label className="admin-number-input-label">Title (Arabic honorific)</label>
                      <input
                        type="text"
                        className="admin-number-input"
                        value={role.title}
                        onChange={(e) => updatePrivilegedRole(index, 'title', e.target.value)}
                        placeholder="سيدي العقل المدبر"
                        style={{ width: '100%' }}
                        dir="auto"
                      />
                    </div>
                    <div className="admin-number-input-wrap">
                      <label className="admin-number-input-label">Name</label>
                      <input
                        type="text"
                        className="admin-number-input"
                        value={role.name}
                        onChange={(e) => updatePrivilegedRole(index, 'name', e.target.value)}
                        placeholder="Role name"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <button
                      className="admin-btn admin-btn-ghost"
                      onClick={() => removePrivilegedRole(index)}
                      style={{ padding: '6px 12px', fontSize: '12px', color: '#f43f5e', alignSelf: 'center' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: '12px' }}>
              <button
                className="admin-btn admin-btn-ghost"
                onClick={addPrivilegedRole}
                style={{ fontSize: '13px' }}
              >
                + Add Role
              </button>
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <ConfigSection title="All Known Roles" description="All known roles in priority order (highest first). Used to show role names in channel context sent to AI.">
            {privileges.allKnownRoles.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px 0', lineHeight: 1.6 }}>
                No known roles configured. These roles help Sage identify users in channel history
                (e.g. &quot;[نبيل لونا المكرم] asked about...&quot;). Add them from highest to lowest priority.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {privileges.allKnownRoles.map((role, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr 1fr auto',
                      gap: '8px',
                      alignItems: 'end',
                      padding: '10px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: 'var(--text-muted)',
                      alignSelf: 'center',
                    }}>
                      {index + 1}
                    </div>
                    <RolePicker
                      label="Role"
                      value={role.id}
                      onChange={(v) => {
                        const copy = [...privileges.allKnownRoles];
                        copy[index] = { ...copy[index], id: v as string };
                        setPrivileges({ ...privileges, allKnownRoles: copy });
                      }}
                      compact
                    />
                    <div className="admin-number-input-wrap">
                      <label className="admin-number-input-label">Name</label>
                      <input
                        type="text"
                        className="admin-input"
                        value={role.name}
                        onChange={(e) => {
                          const copy = [...privileges.allKnownRoles];
                          copy[index] = { ...copy[index], name: e.target.value };
                          setPrivileges({ ...privileges, allKnownRoles: copy });
                        }}
                      />
                    </div>
                    <button
                      className="admin-btn admin-btn-ghost"
                      onClick={() => setPrivileges({ ...privileges, allKnownRoles: privileges.allKnownRoles.filter((_, i) => i !== index) })}
                      style={{ padding: '6px 12px', fontSize: '12px', color: '#f43f5e', alignSelf: 'center' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: '12px' }}>
              <button
                className="admin-btn admin-btn-ghost"
                onClick={() => setPrivileges({ ...privileges, allKnownRoles: [...privileges.allKnownRoles, { id: '', name: '' }] })}
                style={{ fontSize: '13px' }}
              >
                + Add Role
              </button>
            </div>
            <BotBadge bot="sage" />
          </ConfigSection>

          <SaveDeployBar
            hasChanges={privilegesChanged}
            saving={saving}
            onSave={saveSageConfig}
            onDiscard={discardPrivileges}
            projectName="Sage"
          />
        </>
      )}

      {/* ============================== */}
      {/* Live Chat Tab (with channels)  */}
      {/* ============================== */}
      {tab === 'live_chat' && (
        <>
          <ConfigSection title="Access Control" description="Emergency kill switch — restrict all Sage interactions to Masterminds only.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ToggleSwitch
                label="Mastermind-only mode"
                checked={liveConfig.mastermindOnly}
                onChange={(v) => setLiveConfig({ ...liveConfig, mastermindOnly: v })}
              />
              {liveConfig.mastermindOnly && (
                <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(244,63,94,0.12)', color: '#f43f5e', fontSize: '13px', fontWeight: 500 }}>
                  Only Masterminds can interact with Sage. All other users are blocked from prefix, mention, and live chat.
                </div>
              )}
            </div>
          </ConfigSection>

          <ConfigSection title="Active Channels" description="Sage is ONLY active in these channels. Prefix commands, mentions, and live chat all require a channel to be listed here. If empty, Sage is completely disabled.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {liveConfig.liveChatChannels.length === 0 && (
                <div style={{ padding: '12px', borderRadius: '6px', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', fontSize: '13px' }}>
                  No channels configured — Sage is completely disabled everywhere.
                </div>
              )}
              {liveConfig.liveChatChannels.map((chId, i) => {
                const ch = guildChannels.find(c => c.id === chId);
                return (
                  <div key={chId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '16px' }}>#</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {ch ? ch.name : chId}
                      </div>
                      {ch && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ch.parentName}</div>}
                    </div>
                    <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{chId}</code>
                    <button
                      className="admin-btn admin-btn-danger admin-btn-sm"
                      onClick={() => setLiveConfig({ ...liveConfig, liveChatChannels: liveConfig.liveChatChannels.filter((_, j) => j !== i) })}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <select
                  className="admin-input"
                  style={{ width: '320px' }}
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !liveConfig.liveChatChannels.includes(val)) {
                      setLiveConfig({ ...liveConfig, liveChatChannels: [...liveConfig.liveChatChannels, val] });
                    }
                  }}
                >
                  <option value="">Select a channel...</option>
                  {guildChannels
                    .filter(c => !liveConfig.liveChatChannels.includes(c.id))
                    .map(c => (
                      <option key={c.id} value={c.id}>#{c.name} ({c.parentName})</option>
                    ))
                  }
                </select>
              </div>
            </div>
          </ConfigSection>

          <ConfigSection title="Auto-Join" description="Sage automatically joins active conversations">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <ToggleSwitch
                label="Auto-join enabled"
                checked={liveConfig.autoJoinEnabled}
                onChange={(v) => setLiveConfig({ ...liveConfig, autoJoinEnabled: v })}
              />
              <NumberInput
                label="Auto-join cooldown"
                description="Minutes between auto-joins (1-5)"
                value={liveConfig.autoJoinCooldownMinutes}
                onChange={(v) => setLiveConfig({ ...liveConfig, autoJoinCooldownMinutes: v })}
                min={1}
                max={5}
              />
            </div>
          </ConfigSection>

          <ConfigSection title="Reactions" description="Sage reacts to messages with emoji">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <ToggleSwitch
                label="Reactions enabled"
                checked={liveConfig.reactionsEnabled}
                onChange={(v) => setLiveConfig({ ...liveConfig, reactionsEnabled: v })}
              />
              <NumberInput
                label="Reaction probability"
                description={`Chance of reacting to a message (10-50%). Currently: ${Math.round(liveConfig.reactionProbability * 100)}%`}
                value={Math.round(liveConfig.reactionProbability * 100)}
                onChange={(v) => setLiveConfig({ ...liveConfig, reactionProbability: v / 100 })}
                min={10}
                max={50}
              />
            </div>
          </ConfigSection>

          <ConfigSection title="Periodic Check-In" description="Sage periodically checks in on quiet channels">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <ToggleSwitch
                label="Periodic check-in enabled"
                checked={liveConfig.periodicCheckIn}
                onChange={(v) => setLiveConfig({ ...liveConfig, periodicCheckIn: v })}
              />
              <NumberInput
                label="Check-in interval"
                description="Number of messages between check-ins (10-30)"
                value={liveConfig.checkInInterval}
                onChange={(v) => setLiveConfig({ ...liveConfig, checkInInterval: v })}
                min={10}
                max={30}
              />
            </div>
          </ConfigSection>

          <ConfigSection title="Cooldowns" description="Fine-tune all timing values for Sage's live chat behavior. Changes take effect within 30 seconds.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              <NumberInput
                label="AI Cooldown"
                description="Seconds between AI responses per user (1-30)"
                value={liveConfig.aiCooldownSeconds}
                onChange={(v) => setLiveConfig({ ...liveConfig, aiCooldownSeconds: v })}
                min={1}
                max={30}
              />
              <NumberInput
                label="Reaction Cooldown"
                description="Seconds between reactions per channel (5-120)"
                value={liveConfig.reactionCooldownSeconds}
                onChange={(v) => setLiveConfig({ ...liveConfig, reactionCooldownSeconds: v })}
                min={5}
                max={120}
              />
              <NumberInput
                label="User Reaction Limit"
                description="Max reactions per user within the window (1-20)"
                value={liveConfig.userReactionLimit}
                onChange={(v) => setLiveConfig({ ...liveConfig, userReactionLimit: v })}
                min={1}
                max={20}
              />
              <NumberInput
                label="Reaction Window"
                description="Minutes for the user reaction limit window (1-30)"
                value={liveConfig.userReactionWindowMinutes}
                onChange={(v) => setLiveConfig({ ...liveConfig, userReactionWindowMinutes: v })}
                min={1}
                max={30}
              />
              <NumberInput
                label="Help Offer Cooldown (per user)"
                description="Minutes between help offers to the same user (1-10)"
                value={liveConfig.userHelpOfferCooldownMinutes}
                onChange={(v) => setLiveConfig({ ...liveConfig, userHelpOfferCooldownMinutes: v })}
                min={1}
                max={10}
              />
              <NumberInput
                label="Greeting Cooldown (per user)"
                description="Minutes between greetings to the same user (1-30)"
                value={liveConfig.userGreetingCooldownMinutes}
                onChange={(v) => setLiveConfig({ ...liveConfig, userGreetingCooldownMinutes: v })}
                min={1}
                max={30}
              />
              <NumberInput
                label="Greeting Cooldown (per channel)"
                description="Seconds between greetings in the same channel (10-300)"
                value={liveConfig.greetingCooldownSeconds}
                onChange={(v) => setLiveConfig({ ...liveConfig, greetingCooldownSeconds: v })}
                min={10}
                max={300}
              />
              <NumberInput
                label="Help Offer Cooldown (per channel)"
                description="Seconds between help offers in the same channel (10-300)"
                value={liveConfig.helpOfferCooldownSeconds}
                onChange={(v) => setLiveConfig({ ...liveConfig, helpOfferCooldownSeconds: v })}
                min={10}
                max={300}
              />
              <NumberInput
                label="Unanswered Question Delay"
                description="Seconds to wait before answering unanswered questions (15-300)"
                value={liveConfig.unansweredQuestionDelaySeconds}
                onChange={(v) => setLiveConfig({ ...liveConfig, unansweredQuestionDelaySeconds: v })}
                min={15}
                max={300}
              />
            </div>
          </ConfigSection>

          <ConfigSection title="Luna Keywords" description="Words that trigger Sage reactions and help offers. Sage watches for these in live chat messages.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {liveConfig.lunaKeywords.map((kw, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: '#60a5fa',
                    fontSize: '13px',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                  }}
                  dir="auto"
                >
                  {kw}
                  <button
                    onClick={() => setLiveConfig({ ...liveConfig, lunaKeywords: liveConfig.lunaKeywords.filter((_, j) => j !== i) })}
                    style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1 }}
                    title="Remove keyword"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                className="admin-input"
                placeholder="Add keyword..."
                id="newLunaKeyword"
                style={{ width: '220px' }}
                dir="auto"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value.trim();
                    if (val && !liveConfig.lunaKeywords.includes(val) && liveConfig.lunaKeywords.length < 100) {
                      setLiveConfig({ ...liveConfig, lunaKeywords: [...liveConfig.lunaKeywords, val] });
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => {
                  const input = document.getElementById('newLunaKeyword') as HTMLInputElement;
                  const val = input?.value.trim();
                  if (val && !liveConfig.lunaKeywords.includes(val) && liveConfig.lunaKeywords.length < 100) {
                    setLiveConfig({ ...liveConfig, lunaKeywords: [...liveConfig.lunaKeywords, val] });
                    input.value = '';
                  }
                }}
              >
                Add
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
              {liveConfig.lunaKeywords.length}/100 keywords
            </div>
          </ConfigSection>

          <ConfigSection title="Response Templates" description="Predefined responses Sage uses for greetings and help offers. Grouped by role/language.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Greeting Templates */}
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>Greeting Templates</div>
                {(['arabic', 'english'] as const).map((lang) => (
                  <div key={lang} style={{ marginBottom: '12px' }}>
                    <label className="admin-number-input-label" style={{ textTransform: 'capitalize' }}>{lang}</label>
                    <textarea
                      className="admin-number-input"
                      value={(liveConfig.greetingTemplates[lang] ?? []).join('\n')}
                      onChange={(e) => {
                        const lines = e.target.value.split('\n').filter(l => l.trim());
                        setLiveConfig({
                          ...liveConfig,
                          greetingTemplates: { ...liveConfig.greetingTemplates, [lang]: lines },
                        });
                      }}
                      placeholder={`One template per line (${lang})`}
                      style={{ width: '100%', minHeight: '80px', resize: 'vertical', fontSize: '13px', lineHeight: '1.6' }}
                      dir="auto"
                    />
                  </div>
                ))}
              </div>

              {/* Help Offer Templates */}
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>Help Offer Templates</div>
                {(['mastermind', 'privileged', 'lunarian', 'default'] as const).map((role) => (
                  <div key={role} style={{ marginBottom: '12px' }}>
                    <label className="admin-number-input-label" style={{ textTransform: 'capitalize' }}>
                      {role === 'mastermind' ? 'Mastermind' : role === 'privileged' ? 'Privileged' : role === 'lunarian' ? 'Lunarian' : 'Default'}
                    </label>
                    <textarea
                      className="admin-number-input"
                      value={(liveConfig.helpOfferTemplates[role] ?? []).join('\n')}
                      onChange={(e) => {
                        const lines = e.target.value.split('\n').filter(l => l.trim());
                        setLiveConfig({
                          ...liveConfig,
                          helpOfferTemplates: { ...liveConfig.helpOfferTemplates, [role]: lines },
                        });
                      }}
                      placeholder={`One template per line (${role} role)`}
                      style={{ width: '100%', minHeight: '80px', resize: 'vertical', fontSize: '13px', lineHeight: '1.6' }}
                      dir="auto"
                    />
                  </div>
                ))}
              </div>
            </div>
          </ConfigSection>

          <ConfigSection title="Reaction Emojis" description="Emojis Sage uses when reacting to messages in live chat.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {(['luna', 'question', 'greeting', 'excitement'] as const).map((key) => (
                <div key={key} className="admin-number-input-wrap">
                  <label className="admin-number-input-label" style={{ textTransform: 'capitalize' }}>
                    {key === 'luna' ? 'Luna Keywords' : key === 'question' ? 'Questions' : key === 'greeting' ? 'Greetings' : 'Excitement'}
                  </label>
                  <input
                    type="text"
                    className="admin-number-input"
                    value={liveConfig.reactionEmojis[key] ?? ''}
                    onChange={(e) => setLiveConfig({
                      ...liveConfig,
                      reactionEmojis: { ...liveConfig.reactionEmojis, [key]: e.target.value },
                    })}
                    style={{ width: '80px', fontSize: '20px', textAlign: 'center' }}
                    maxLength={10}
                  />
                </div>
              ))}
            </div>
          </ConfigSection>

          {/* Channel References — Sage will mention these channels when relevant */}
          <ConfigSection title="Channel References" description="Sage will mention these channels when a user asks about a related topic. For example, if a user asks about cards, Sage will point them to the cards shop channel.">
            {(liveConfig.channelReferences ?? []).map((ref, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '8px', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div style={{ minWidth: '180px', flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Channel</label>
                  <select
                    className="admin-input"
                    value={ref.channelId}
                    onChange={(e) => {
                      const updated = [...liveConfig.channelReferences];
                      const selected = guildChannels.find(c => c.id === e.target.value);
                      updated[idx] = { ...updated[idx], channelId: e.target.value, name: updated[idx].name || (selected ? `#${selected.name}` : '') };
                      setLiveConfig({ ...liveConfig, channelReferences: updated });
                    }}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select channel...</option>
                    {guildChannels.map(ch => (
                      <option key={ch.id} value={ch.id}>
                        #{ch.name} {ch.parentName ? `(${ch.parentName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ minWidth: '140px', flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Display Name</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="e.g. Card Shop"
                    value={ref.name}
                    onChange={(e) => {
                      const updated = [...liveConfig.channelReferences];
                      updated[idx] = { ...updated[idx], name: e.target.value };
                      setLiveConfig({ ...liveConfig, channelReferences: updated });
                    }}
                    style={{ width: '100%' }}
                    maxLength={100}
                  />
                </div>
                <div style={{ minWidth: '200px', flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>When to mention (description)</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="e.g. Cards, collecting, trading, Kael Vandar"
                    value={ref.description}
                    onChange={(e) => {
                      const updated = [...liveConfig.channelReferences];
                      updated[idx] = { ...updated[idx], description: e.target.value };
                      setLiveConfig({ ...liveConfig, channelReferences: updated });
                    }}
                    style={{ width: '100%' }}
                    maxLength={200}
                  />
                </div>
                <button
                  className="admin-btn admin-btn-danger admin-btn-sm"
                  onClick={() => {
                    const updated = liveConfig.channelReferences.filter((_, i) => i !== idx);
                    setLiveConfig({ ...liveConfig, channelReferences: updated });
                  }}
                  title="Remove"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="admin-btn admin-btn-ghost admin-btn-sm"
              onClick={() => {
                setLiveConfig({
                  ...liveConfig,
                  channelReferences: [...(liveConfig.channelReferences ?? []), { channelId: '', name: '', description: '' }],
                });
              }}
            >
              + Add Channel Reference
            </button>
          </ConfigSection>

          {/* Channel Overrides section within Live Chat tab */}
          {channelsLoading ? (
            <SkeletonTable rows={4} />
          ) : (
            <DataTable
              title="Channel Overrides"
              columns={channelColumns}
              data={channels}
              pageSize={20}
            />
          )}

          <ConfigSection title="Add Channel Override" description="Set per-channel auto-join and reaction toggles">
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Channel ID</label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="e.g. 1234567890123456"
                  value={newChannelId}
                  onChange={(e) => setNewChannelId(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <ToggleSwitch label="Auto-Join" checked={newChannelAutoJoin} onChange={setNewChannelAutoJoin} />
              <ToggleSwitch label="Reactions" checked={newChannelReactions} onChange={setNewChannelReactions} />
              <button
                className={`admin-btn admin-btn-primary admin-btn-sm ${savingChannels ? 'admin-btn-loading' : ''}`}
                onClick={addChannelOverride}
                disabled={savingChannels || !newChannelId.trim()}
              >
                {savingChannels ? 'Saving...' : 'Add Override'}
              </button>
            </div>
          </ConfigSection>

          <SaveDeployBar
            hasChanges={liveConfigChanged}
            saving={liveSaving}
            onSave={saveLiveConfig}
            onDiscard={discardLiveConfig}
            projectName="Sage Live Chat"
          />
        </>
      )}

      {/* ============================== */}
      {/* User Memories Tab              */}
      {/* ============================== */}
      {tab === 'memories' && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="admin-input"
                placeholder="Filter by user ID..."
                value={memorySearch}
                onChange={(e) => setMemorySearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchMemories(); }}
                style={{ width: '280px', maxWidth: '100%' }}
              />
              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={fetchMemories} disabled={memoriesLoading}>
                {memoriesLoading ? 'Loading...' : 'Search'}
              </button>
            </div>
          </div>

          {memoriesLoading && memoryDocs.length === 0 ? (
            <SkeletonTable rows={5} />
          ) : (
            <DataTable
              title="User Memories"
              columns={memoryColumns}
              data={memoryDocs.map(d => ({ userId: d.userId, factsCount: d.facts?.length ?? 0 }))}
              pageSize={20}
            />
          )}

          {/* User facts modal */}
          <AdminLightbox
            isOpen={selectedUserId !== null}
            onClose={() => setSelectedUserId(null)}
            title={`Facts for ${selectedUserId}`}
            size="lg"
          >
            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '16px' }}>
              {selectedUserFacts.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No facts recorded</div>
              ) : (
                <table className="admin-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Fact</th>
                      <th style={{ textAlign: 'left' }}>Set By</th>
                      <th style={{ textAlign: 'left' }}>Set At</th>
                      <th style={{ textAlign: 'left' }}>Expires</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUserFacts.map((fact, idx) => {
                      const expired = isExpired(fact.expiresAt);
                      return (
                        <tr key={idx} style={expired ? { opacity: 0.45 } : undefined}>
                          <td style={{ fontSize: '13px', maxWidth: '220px', wordBreak: 'break-word' }}>
                            {fact.text}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {fact.setBy}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatDate(fact.setAt)}
                          </td>
                          <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {expired ? (
                              <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(244,63,94,0.15)', color: '#f43f5e', fontSize: '10px', fontWeight: 600 }}>
                                Expired
                              </span>
                            ) : fact.expiresAt ? (
                              <span style={{ color: 'var(--text-muted)' }}>{formatDate(fact.expiresAt)}</span>
                            ) : '-'}
                          </td>
                          <td>
                            <button
                              className="admin-btn admin-btn-danger admin-btn-sm"
                              onClick={() => deleteFact(idx)}
                              disabled={deletingFactIdx === idx}
                            >
                              {deletingFactIdx === idx ? '...' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Add fact form */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>Add Fact</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Fact text</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="Enter a fact about this user..."
                    value={newFactText}
                    onChange={(e) => setNewFactText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newFactText.trim()) addFact(); }}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Expiry (optional)</label>
                  <input
                    type="datetime-local"
                    className="admin-input"
                    value={newFactExpiry}
                    onChange={(e) => setNewFactExpiry(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <button
                  className={`admin-btn admin-btn-primary admin-btn-sm ${addingFact ? 'admin-btn-loading' : ''}`}
                  onClick={addFact}
                  disabled={addingFact || !newFactText.trim()}
                >
                  {addingFact ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          </AdminLightbox>
        </>
      )}

      {/* ============================== */}
      {/* Activity Log Tab               */}
      {/* ============================== */}
      {tab === 'activity' && (
        <>
          <div className="admin-filters" style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="admin-input"
              value={activityTypeFilter}
              onChange={(e) => { setActivityTypeFilter(e.target.value); setActivityPage(1); }}
              style={{ width: '180px', cursor: 'pointer' }}
            >
              <option value="">All Types</option>
              <option value="keyword">Keyword</option>
              <option value="reaction">Reaction</option>
              <option value="periodic">Periodic</option>
              <option value="unanswered_question">Unanswered Question</option>
            </select>
            <input
              type="text"
              className="admin-input"
              placeholder="Filter by channel ID..."
              value={activityChannelFilter}
              onChange={(e) => { setActivityChannelFilter(e.target.value); setActivityPage(1); }}
              style={{ width: '200px' }}
            />
            <button
              className="admin-btn admin-btn-ghost admin-btn-sm"
              onClick={fetchActivity}
              disabled={activityLoading}
            >
              {activityLoading ? 'Loading...' : 'Refresh'}
            </button>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Auto-refreshes every 30s</span>
          </div>

          {activityLoading && activity.length === 0 ? (
            <SkeletonTable rows={6} />
          ) : (
            <DataTable
              title="Activity Log"
              columns={activityColumns}
              data={activity}
              pageSize={20}
              totalItems={activityTotal}
              currentPage={activityPage}
              onPageChange={setActivityPage}
              serverPagination
            />
          )}
        </>
      )}
    </>
  );
}
