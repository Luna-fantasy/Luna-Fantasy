export interface HubChannel {
  channelId: string;
  categoryId: string;
  nameTemplate: string;
  defaultUserLimit: number;
  defaultBitrate: number;
}

export interface VoiceSetup {
  hubChannels: HubChannel[];
  vipCategoryId: string;
  logChannelId: string;
  staffRoleIds: string[];
  maxTempRoomsPerUser: number;
  maxVipRoomsPerUser: number;
  gracePeriodMs: number;
  welcomeCooldownMs: number;
  challengesEnabled: boolean;
  challengeIntervalMs: number;
  challengeMinMembers: number;
  auraUpdateIntervalMs: number;
  panelAutoRefreshMs: number;
}

export interface TriviaQuestion {
  q: string;
  answers: string[];
  correct: number;
}

export interface VoiceGamesSettings {
  mathOps: { enabled: string[]; rewardMin: number; rewardMax: number; timeoutMs: number };
  triviaReward: { autoDropMin: number; autoDropMax: number; miniMin: number; miniMax: number };
  triviaTimeoutMs: number;
  triviaSessionSize: number;
  streakBonuses: Record<string, number>;
  quickReact: { rewardMin: number; rewardMax: number; delayMin: number; delayMax: number; timeoutMs: number };
  emojiRaceEmojis: string[];
  sowalefSessionSize: number;
  sowalefDebounceMs: number;
  gameCooldownMs: number;
  endCooldownMs: number;
  auraRewardMultipliers: Record<string, number>;
  bossChallenge: { enabled: boolean; rewardMin: number; rewardMax: number; cooldownHours: number; questionCount: number };
}

export interface VoiceContent {
  welcomeGreetings: string[];
  panelText: string[];
  buttonLabels: Record<string, string>;
  auraTiers?: Record<string, string>;
  auraThresholds?: Record<string, number>;
  auraWeights?: Record<string, number>;
  whisper?: {
    cooldownMs?: number;
    colors?: number[];
    ansiColors?: string[];
    modalTitle?: string;
    modalPlaceholder?: string;
    autoCleanupMs?: number;
  };
  expiryTitles: string[];
}

export interface VoiceAssets {
  panelBannerUrl?: string;
  emojis?: Record<string, string>;
}

export interface MusicTrack {
  key: string;       // R2 key under oracle-music/
  url: string;       // public CDN URL
  title: string;
  sizeBytes?: number;
  contentType?: string;
  uploadedAt: string;
}

export interface VoiceMusic {
  enabled: boolean;
  /**
   * When true (default), Oracle's music manager scans `LunaOracle/Music/` on
   * disk and merges those files with R2 tracks. Flip to false after all local
   * MP3s have been migrated to R2 so Oracle treats R2 as the sole source of
   * truth. Files stay on disk as a rollback safety net either way.
   */
  localEnabled?: boolean;
  tracks: MusicTrack[];
}

export interface VoiceSnapshot {
  setup: VoiceSetup;
  gamesTrivia: TriviaQuestion[];
  gamesSowalef: string[];
  gamesSettings: VoiceGamesSettings;
  content: VoiceContent;
  assets: VoiceAssets;
  music: VoiceMusic;
}

export type VoiceSection =
  | 'setup'
  | 'games_trivia' | 'games_sowalef' | 'games_settings'
  | 'content_welcome' | 'content_panel' | 'content_buttons' | 'content_aura' | 'content_whisper' | 'content_expiry'
  | 'assets' | 'music';

export interface StatsRoom {
  _id: string;         // channelId
  ownerId: string;
  ownerName?: string;
  name: string;
  type: 'temp' | 'vip';
  aura?: { score: number; tier: string; warmth: number; energy: number; loyalty: number; harmony: number };
  stats?: { totalVisitors: number; uniqueVisitors: number; peakMembers: number; totalVoiceMinutes: number };
  isLocked?: boolean;
  isHidden?: boolean;
  createdAt?: string;
  expiresAt?: string;
}

export interface StatsBundle {
  rooms: StatsRoom[];
  totals?: { activeRooms: number; totalUniqueVisitors: number; peakAcrossAll: number };
  hallOfRecords?: { byAura: StatsRoom[]; byVisitors: StatsRoom[] };
  topUsers?: Array<{ userId: string; username?: string; totalVoiceMinutes: number; totalRoomsCreated: number }>;
}
