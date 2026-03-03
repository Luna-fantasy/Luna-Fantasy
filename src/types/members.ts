export interface MemberListItem {
  discordId: string;
  name: string;
  username: string;
  image: string | null;
  joinedAt: string | null;
  level: number;
  lunari: number;
  cardCount: number;
}

export interface MembersResponse {
  members: MemberListItem[];
  total: number;
  page: number;
  totalPages: number;
}
