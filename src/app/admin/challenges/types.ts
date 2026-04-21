export type ChallengeStatus = 'active' | 'closed' | 'cancelled' | 'scheduled';
export type ChallengeType = 'image' | 'text' | 'link';

export interface Entry {
  userId: string;
  username: string;
  avatar: string | null;
  imageUrl?: string;
  content?: string;
  submittedAt: string;
}

export interface Vote {
  voterId: string;
  voterName: string;
  voterAvatar: string | null;
  voterAccountAge: number;
  votedForUserId: string;
  votedForUsername: string;
  votedAt: string;
  flagged: boolean;
  flagReason: string | null;
}

export interface RewardTier {
  rank: number;
  amount: number;
}

export interface Reward {
  type: 'lunari';
  tiers: RewardTier[];
}

export interface Challenge {
  _id: string;
  name: string;
  description?: string;
  type: ChallengeType;
  status: ChallengeStatus;
  guildId?: string;
  submissionChannelId?: string;
  votingChannelId?: string;
  entryCount: number;
  voteCount: number;
  flaggedVoteCount: number;
  entries: Entry[];
  votes?: Vote[];
  reward?: Reward;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  votingExpiresAt?: string;
  closedAt?: string;
  closedBy?: string;
  closedByName?: string | null;
}

export interface Ranking extends Entry {
  votes: number;
  rank: number;
}

export interface DetailResponse {
  challenge: Omit<Challenge, 'entries' | 'votes'>;
  entries: Entry[];
  votes: Vote[];
  rankings: Ranking[];
}

export interface ListStats {
  total: number;
  active: number;
  closed: number;
  cancelled: number;
  totalEntries: number;
  totalVotes: number;
}

export interface HoFWinner {
  winnerUserId: string;
  winnerUsername: string;
  winnerImageUrl?: string | null;
  challengeId?: string;
  challengeName: string;
  challengeType?: string;
  voteCount: number;
  totalParticipants: number;
  totalVotes?: number;
  closedAt: string;
  reward?: { rank: number; amount: number };
}

export interface ListResponse {
  activeChallenge: Challenge | null;
  challenges: Challenge[];
  total: number;
  page: number;
  limit: number;
  stats: ListStats;
  hallOfFame: HoFWinner[];
}

export interface ChallengeTemplate {
  id: string;
  name: string;
  type: ChallengeType;
  description?: string;
  reward1st?: number;
  reward2nd?: number;
  reward3rd?: number;
  duration?: number; // hours
  createdBy: string;
  createdAt: string;
}

export interface ChannelOption {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string;
  position: number;
}

export interface ChallengeConfig {
  hallOfFameChannelId: string | null;
  minJoinAgeMs: number;
  minAccountAgeMs: number;
  suspiciousVoteThreshold: number;
  maxGuildVotesPerSec: number;
  cmdCooldownMs: number;
  voteChangeWindowMs: number;
  updateIntervalMs: number;
  maxTopEntriesShown: number;
}

export type ChallengeAction = 'close' | 'cancel' | 'remove_entry' | 'remove_vote';

export interface CreateBody {
  name: string;
  description?: string;
  type: ChallengeType;
  submissionChannelId: string;
  votingChannelId: string;
  logChannelId?: string;
  reward1st?: number;
  reward2nd?: number;
  reward3rd?: number;
  duration?: number;
  scheduledAt?: string;
}
