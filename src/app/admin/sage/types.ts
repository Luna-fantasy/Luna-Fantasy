export interface SageSettings {
  provider?: 'google' | 'openrouter';
  google_model?: string;
  openrouter_model?: string;
  enable_search?: boolean;
  enable_image_generation?: boolean;
  image_generation_model?: string;
  sage_prefix?: string[];
  owner_role_ids?: string[];
  image_gen_roles?: string[];
  channel_context_limit?: number;
  thread_history_limit?: number;
  thread_slowmode?: number;
  panel_title?: string;
  panel_description?: string;
  panel_image?: string;
}

export interface PrivilegedRole {
  id: string;
  title: string;
  name: string;
}

export interface KnownRole {
  id: string;
  name: string;
}

export interface SagePrivileges {
  lunarianAccess: boolean;
  lunarianRoleId: string;
  privilegedRoles: PrivilegedRole[];
  allKnownRoles: KnownRole[];
}

export interface SageHelpOfferTemplates {
  mastermind: string[];
  privileged: string[];
  lunarian: string[];
  default: string[];
}

export interface SageGreetingTemplates {
  arabic: string[];
  english: string[];
}

export interface SageReactionEmojis {
  luna: string;
  question: string;
  greeting: string;
  excitement: string;
  [k: string]: string;
}

export interface SageChannelReference {
  channelId: string;
  name: string;
  description: string;
}

export interface SageLiveChat {
  autoJoinEnabled: boolean;
  reactionsEnabled: boolean;
  periodicCheckIn: boolean;
  mastermindOnly: boolean;
  liveChatChannels: string[];
  reactionProbability: number;
  autoJoinCooldownMinutes: number;
  checkInInterval: number;
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
  helpOfferTemplates: SageHelpOfferTemplates;
  greetingTemplates: SageGreetingTemplates;
  reactionEmojis: SageReactionEmojis;
  channelReferences: SageChannelReference[];
}

export interface SageSnapshot {
  settings: SageSettings;
  systemPrompt: string;
  lore: string;
  privileges: SagePrivileges;
  liveChat: SageLiveChat;
}

/** Settings/prompt/lore/privileges hit `/api/admin/config/sage`; liveChat sections hit a different route */
export const SETTINGS_SECTIONS = [
  'provider', 'google_model', 'openrouter_model',
  'enable_search', 'enable_image_generation', 'image_generation_model',
  'sage_prefix', 'owner_role_ids', 'image_gen_roles', 'channel_context_limit',
  'system_prompt', 'lore_text',
  'privileged_roles', 'lunarian_role_id', 'lunarian_access', 'all_known_roles',
] as const;

export const LIVE_CHAT_SECTIONS = [
  'autoJoinEnabled', 'reactionsEnabled', 'periodicCheckIn', 'mastermindOnly',
  'reactionProbability', 'autoJoinCooldownMinutes', 'checkInInterval', 'liveChatChannels',
  'aiCooldownSeconds', 'reactionCooldownSeconds', 'userReactionLimit', 'userReactionWindowMinutes',
  'userHelpOfferCooldownMinutes', 'userGreetingCooldownMinutes', 'greetingCooldownSeconds',
  'helpOfferCooldownSeconds', 'unansweredQuestionDelaySeconds',
  'lunaKeywords', 'helpOfferTemplates', 'greetingTemplates', 'reactionEmojis', 'channelReferences',
] as const;

export type SettingsSection = typeof SETTINGS_SECTIONS[number];
export type LiveChatSection = typeof LIVE_CHAT_SECTIONS[number];
