'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import StatCard from '../components/StatCard';
import DataTable, { type Column } from '../components/DataTable';
import ConfirmModal from '../components/ConfirmModal';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { getCsrfToken } from '../utils/csrf';

// ── Types ──────────────────────────────────────────────────────────────

interface ChallengeEntry {
  userId: string;
  username: string;
  avatar: string | null;
  imageUrl: string;
  submittedAt: string;
}

interface ChallengeVote {
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

interface Challenge {
  _id: string;
  name: string;
  description?: string;
  type: string;
  status: 'active' | 'closed' | 'cancelled' | 'scheduled';
  entryCount: number;
  voteCount: number;
  flaggedVoteCount: number;
  entries: ChallengeEntry[];
  votes?: ChallengeVote[];
  reward?: { type: string; tiers: { rank: number; amount: number }[] };
  createdByName: string;
  createdAt: string;
  votingExpiresAt?: string;
  closedAt?: string;
  closedByName?: string | null;
}

interface HoFWinner {
  challengeName: string;
  winnerUsername: string;
  winnerImageUrl?: string;
  voteCount: number;
  totalParticipants: number;
  closedAt: string;
}

interface Stats { total: number; active: number; closed: number; cancelled: number; totalEntries: number; totalVotes: number; }
interface Channel { id: string; name: string; parentName: string; }

type Tab = 'overview' | 'history' | 'hallOfFame' | 'activity' | 'settings';

interface TextEntry { key: string; value: string; isCustom: boolean; }

const TEXT_CATEGORIES: Record<string, string[]> = {
  'Announcements': ['announce.title', 'announce.body', 'announce.body_with_desc', 'announce.footer'],
  'Voting': ['panel.header', 'panel.waiting', 'panel.vote_format', 'panel.more_entries', 'panel.stats', 'panel.footer', 'panel.selector', 'panel.selector_page', 'panel.selector_capped', 'panel.gallery_btn'],
  'Vote Responses': ['vote.confirmed', 'vote.self_error', 'vote.already_voted', 'vote.invalid_entry', 'vote.rate_limited', 'vote.unavailable'],
  'Anti-Alt': ['antialit.join_too_new', 'antialit.account_too_new', 'antialit.flag_reason', 'antialit.log_title', 'antialit.log_footer'],
  'Submissions': ['submit.images_only', 'submit.already_submitted'],
  'Gallery': ['gallery.title', 'gallery.no_entries'],
  'Results': ['results.title', 'results.no_votes', 'results.vote_total', 'results.participants', 'results.rewards_title', 'results.reward_line'],
  'Hall of Fame': ['hof.title', 'hof.empty', 'hof.entry', 'hof.set_success'],
  'Admin': ['admin.owner_only', 'admin.db_error', 'admin.unknown_cmd', 'admin.missing_params', 'admin.challenge_exists', 'admin.no_active', 'admin.not_participant', 'admin.specify_user', 'admin.specify_channel', 'admin.generic_error', 'admin.panel_post_fail'],
  'Create': ['create.success_title', 'create.success_desc'],
  'Remove': ['remove.success_title', 'remove.success_desc'],
  'Cancel': ['cancel.announce_title', 'cancel.announce_desc', 'cancel.success_title'],
  'Info Fields': ['info.participants', 'info.votes', 'info.submission_ch', 'info.voting_ch', 'info.created', 'info.expires', 'info.flagged', 'info.rewards', 'info.duration', 'info.log_channel'],
  'List': ['list.title', 'list.status_active', 'list.status_closed', 'list.status_cancelled', 'list.no_challenges'],
};

const TEMPLATE_VARS = ['{username}', '{challenge_name}', '{vote_count}', '{entry_count}', '{rank}', '{reward}', '{user_id}', '{channel_id}', '{emoji.cross}', '{emoji.check}', '{emoji.trophy}', '{emoji.party}', '{emoji.lunari}', '{emoji.clock}', '{emoji.warning}', '{emoji.chart}'];

// Mirror of bot TEXT_DEFAULTS — shown as placeholders so admins know the default
const TEXT_DEFAULTS: Record<string, string> = {
  'announce.title': '{emoji.party} تحدٍّ جديد: {challenge_name}',
  'announce.body': '🌙 **أرسل أفضل صورة لديك للمشاركة.**\nيُسمح بصورة واحدة فقط لكل مشارك.',
  'announce.body_with_desc': '{description}\n\n🌙 **أرسل أفضل صورة لديك للمشاركة.**\nيُسمح بصورة واحدة فقط لكل مشارك.',
  'announce.footer': 'بالتوفيق للجميع 🌙',
  'panel.header': '🌙 يسعدني تقديم هذا التحدي — اختاروا المشاركة الأفضل',
  'panel.waiting': '*🌙 الساحة جاهزة — بانتظار أول مشاركة...*',
  'panel.vote_format': '{medal} **{username}** — {vote_count} صوت',
  'panel.more_entries': '*و {count} مشارك آخر...*',
  'panel.stats': '👥 **{entry_count}** مشارك | 🗳️ **{vote_count}** صوت',
  'panel.footer': 'صوت واحد لكل عضو · التصويت لنفسك غير مسموح',
  'panel.selector': '🌙 اختر من تودّ التصويت له...',
  'panel.selector_page': '🌙 اختر من تودّ التصويت له ({page}/{total})...',
  'panel.selector_capped': '🌙 اختر من تودّ التصويت له (أول 25)...',
  'panel.gallery_btn': '📸 تصفح الصور',
  'vote.confirmed': '🌙 تم تسجيل صوتك لصالح **{username}**. شكراً لمشاركتك!',
  'vote.self_error': '{emoji.cross} لا يمكنك التصويت لنفسك.',
  'vote.already_voted': '{emoji.cross} لقد أدليت بصوتك مسبقاً في هذا التحدي.',
  'vote.invalid_entry': '{emoji.cross} مشارك غير موجود.',
  'vote.rate_limited': '{emoji.clock} انتظر قليلاً قبل التصويت مرة أخرى.',
  'vote.unavailable': '{emoji.cross} التحدي غير متاح.',
  'antialit.join_too_new': '{emoji.clock} يجب أن تكون عضواً في السيرفر لمدة ساعة على الأقل للتصويت.',
  'antialit.account_too_new': '🛡️ يجب أن يكون عمر حسابك 7 أيام على الأقل للتصويت.',
  'antialit.flag_reason': '{count} حسابات جديدة صوّتت لنفس المشارك خلال 24 ساعة',
  'antialit.log_title': '🚩 تصويت مشبوه',
  'antialit.log_footer': 'التصويت مسجّل — يمكن إزالته بواسطة /challenge remove',
  'submit.images_only': '📸 عذراً <@{user_id}>، هذه القناة مخصصة للصور فقط.',
  'submit.already_submitted': '{emoji.check} <@{user_id}>، مشاركتك مسجّلة بالفعل. بالتوفيق!',
  'gallery.title': '📸 معرض: {challenge_name}',
  'gallery.no_entries': '{emoji.cross} لا توجد مشاركات.',
  'results.title': '{emoji.trophy} انتهى التحدي — النتائج النهائية: {challenge_name}',
  'results.no_votes': 'لا توجد أصوات.',
  'results.vote_total': '🗳️ إجمالي الأصوات',
  'results.participants': '👥 المشاركين',
  'results.rewards_title': '{emoji.lunari} الجوائز',
  'results.reward_line': '{medal} <@{user_id}> — **{reward}** لوناري',
  'hof.title': '🏛️ قاعة الأبطال',
  'hof.empty': '*لا يوجد أبطال بعد...*',
  'hof.entry': '{medal} **{challenge_name}** — {username} ({vote_count} صوت)',
  'hof.set_success': '{emoji.check} تم تعيين قاعة الأبطال',
  'admin.owner_only': '🔒 عذراً، هذا الأمر مخصص للإدارة فقط.',
  'admin.db_error': '{emoji.cross} قاعدة البيانات غير متصلة.',
  'admin.unknown_cmd': '{emoji.cross} أمر غير معروف.',
  'admin.missing_params': '{emoji.cross} يرجى تحديد جميع الخيارات المطلوبة.',
  'admin.challenge_exists': '{emoji.warning} يوجد تحدي نشط!\n**{challenge_name}**\nاستخدم `/challenge close` أو `/challenge cancel`',
  'admin.no_active': '{emoji.cross} لا يوجد تحدي نشط.',
  'admin.not_participant': '{emoji.cross} المستخدم ليس مشاركاً.',
  'admin.specify_user': '{emoji.cross} حدد المستخدم.',
  'admin.specify_channel': '{emoji.cross} حدد القناة.',
  'admin.generic_error': '{emoji.cross} حدث خطأ.',
  'admin.panel_post_fail': '{emoji.cross} فشل في إرسال لوحة التصويت في <#{channel_id}>',
  'create.success_title': '{emoji.check} تم إعداد التحدي بنجاح',
  'create.success_desc': '**{challenge_name}**\nالتصويت مباشر — يتحدّث تلقائياً مع كل مشاركة جديدة',
  'remove.success_title': '{emoji.check} تم إزالة المشارك',
  'remove.success_desc': 'تم إزالة **{username}** وجميع أصواته من التحدي.',
  'cancel.announce_title': '{emoji.warning} تم إلغاء التحدي',
  'cancel.announce_desc': 'تم إلغاء تحدي **{challenge_name}** بقرار من الإدارة.',
  'cancel.success_title': '{emoji.check} تم إلغاء التحدي',
  'info.participants': '👥 المشاركين',
  'info.votes': '🗳️ الأصوات',
  'info.submission_ch': '📸 الإرسال',
  'info.voting_ch': '🗳️ التصويت',
  'info.created': '📅 تاريخ الإنشاء',
  'info.expires': '{emoji.clock} ينتهي',
  'info.flagged': '🚩 مشبوه',
  'info.rewards': '{emoji.lunari} الجوائز',
  'info.duration': '{emoji.clock} المدة',
  'info.log_channel': '📋 السجل',
  'list.title': '{emoji.chart} سجل التحديات',
  'list.status_active': '🔴 مباشر',
  'list.status_closed': '🏆',
  'list.status_cancelled': '❌',
  'list.no_challenges': '{emoji.cross} لا توجد تحديات.',
};

// ── Page ───────────────────────────────────────────────────────────────

export default function ChallengesPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [active, setActive] = useState<Challenge | null>(null);
  const [history, setHistory] = useState<Challenge[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [hallOfFame, setHallOfFame] = useState<HoFWinner[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ action: string; challengeId: string; userId?: string; label: string } | null>(null);
  const [lightboxEntry, setLightboxEntry] = useState<ChallengeEntry | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState(0);
  const [fetchError, setFetchError] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/challenges?limit=50');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setActive(data.activeChallenge || null);
      setHistory(data.challenges || []);
      setStats(data.stats || null);
      setHallOfFame(data.hallOfFame || []);
      setLastFetchedAt(Date.now());
      setFetchError(false);
    } catch {
      setFetchError(true);
      toast('Failed to load challenges', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch templates on mount
  useEffect(() => {
    fetch('/api/admin/challenges/templates').then(r => r.json()).then(d => setTemplates(d.templates || [])).catch(() => {});
  }, []);

  // Staleness timer — re-render every 5s to keep "Xs ago" accurate
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastFetchedAt > 0) setSecondsAgo(Math.floor((Date.now() - lastFetchedAt) / 1000));
    }, 5000);
    return () => clearInterval(timer);
  }, [lastFetchedAt]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAction = async (action: string, challengeId: string, userId?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/challenges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ action, challengeId, userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast(data.message || 'Success', 'success');
      await fetchData();
    } catch (err: any) {
      toast(err.message || 'Action failed', 'error');
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  // Vote breakdown per entry
  const votesByEntry = useMemo(() => {
    if (!active?.votes) return new Map<string, ChallengeVote[]>();
    const map = new Map<string, ChallengeVote[]>();
    for (const v of active.votes) {
      if (!map.has(v.votedForUserId)) map.set(v.votedForUserId, []);
      map.get(v.votedForUserId)!.push(v);
    }
    return map;
  }, [active?.votes]);

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">🏆</span> Challenges</h1>
          <p className="admin-page-subtitle">Tournament and challenge management</p>
        </div>
        <SkeletonCard count={4} />
      </>
    );
  }

  const historyColumns: Column[] = [
    { key: 'name', label: 'Challenge' },
    { key: 'status', label: 'Status', render: (row: Challenge) => (
      <span className={`admin-badge ${row.status === 'closed' ? 'green' : row.status === 'active' ? 'cyan' : row.status === 'scheduled' ? 'gold' : 'admin-badge-muted'}`}>
        {row.status === 'active' ? 'Live' : row.status === 'closed' ? 'Closed' : row.status === 'scheduled' ? 'Scheduled' : 'Cancelled'}
      </span>
    )},
    { key: 'entryCount', label: 'Entries' },
    { key: 'voteCount', label: 'Votes' },
    { key: 'flaggedVoteCount', label: 'Flagged', render: (row: Challenge) =>
      row.flaggedVoteCount > 0 ? <span style={{ color: '#f43f5e' }}>{row.flaggedVoteCount}</span> : '0'
    },
    { key: 'createdAt', label: 'Created', render: (row: Challenge) => new Date(row.createdAt).toLocaleDateString() },
    { key: 'createdByName', label: 'By' },
  ];

  return (
    <>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="admin-page-title"><span className="emoji-float">🏆</span> Challenges</h1>
          <p className="admin-page-subtitle">Tournament and challenge management</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={() => setShowCreateModal(true)}>
          + Create Challenge
        </button>
      </div>

      {stats && (
        <div className="admin-stats-grid">
          <StatCard label="Total Challenges" value={stats.total} icon="T" color="cyan" />
          <StatCard label="Active" value={stats.active} icon="⚡" color="green" trend={active ? active.name : undefined} />
          <StatCard label="Total Entries" value={stats.totalEntries} icon="👥" color="purple" />
          <StatCard label="Total Votes" value={stats.totalVotes} icon="🗳️" color="gold" />
        </div>
      )}

      {/* Staleness indicator + retry */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: secondsAgo > 30 ? '#fbbf24' : 'var(--text-muted, rgba(255,255,255,0.4))', marginBottom: '4px' }}>
        {lastFetchedAt > 0 && <span>{secondsAgo > 30 ? '⚠ ' : ''}Updated {secondsAgo}s ago</span>}
        {fetchError && (
          <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={fetchData} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
            Retry
          </button>
        )}
      </div>

      <div className="admin-tabs">
        {(['overview', 'activity', 'history', 'hallOfFame', 'settings'] as Tab[]).map(tb => (
          <button key={tb} className={`admin-tab ${tab === tb ? 'admin-tab-active' : ''}`} onClick={() => setTab(tb)}>
            {tb === 'overview' ? (active ? `Live: ${active.name}` : 'Active Challenge')
              : tb === 'activity' ? '🔍 Activity'
              : tb === 'history' ? `History (${history.length})`
              : tb === 'hallOfFame' ? 'Hall of Fame'
              : '⚙️ Settings'}
          </button>
        ))}
      </div>

      {/* ── Active Challenge with Gallery ── */}
      {tab === 'overview' && (active ? (
        <div style={{ marginTop: '1rem' }}>
          <div className="ch-card">
            <div className="ch-header">
              <div>
                <h2 className="ch-title">{active.name}</h2>
                {active.description && <p className="ch-desc">{active.description}</p>}
              </div>
              <span className="admin-badge cyan">Live</span>
            </div>

            <div className="admin-stats-grid" style={{ marginTop: '1rem' }}>
              <StatCard label="Entries" value={active.entryCount} icon="#" color="cyan" />
              <StatCard label="Votes" value={active.voteCount} icon="V" color="purple" />
              {active.flaggedVoteCount > 0 && (
                <StatCard label="Flagged" value={active.flaggedVoteCount} icon="!" color="purple" trendType="negative" trend="Suspicious activity" />
              )}
              {active.reward && (
                <StatCard label="Reward Pool" value={active.reward.tiers.reduce((s, t) => s + t.amount, 0)} icon="L" color="gold" trend={`${active.reward.tiers.length} tier(s)`} />
              )}
            </div>

            {/* Participant Gallery Grid */}
            {active.entries.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3 className="ch-section-title">Participants ({active.entryCount})</h3>
                <div className="ch-gallery">
                  {active.entries.map(entry => {
                    const votes = votesByEntry.get(entry.userId) || [];
                    const flaggedCount = votes.filter(v => v.flagged).length;
                    return (
                      <div key={entry.userId} className="ch-gallery-card" onClick={() => setLightboxEntry(entry)}>
                        <div className="ch-gallery-img-wrap">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={entry.imageUrl} alt={entry.username} className="ch-gallery-img" loading="lazy" />
                          <div className="ch-gallery-votes">{votes.length} votes</div>
                          {flaggedCount > 0 && <div className="ch-gallery-flag">🚩 {flaggedCount}</div>}
                        </div>
                        <div className="ch-gallery-name">{entry.username}</div>
                        <button className="ch-gallery-remove" onClick={(e) => {
                          e.stopPropagation();
                          setConfirmAction({ action: 'remove_entry', challengeId: active._id, userId: entry.userId, label: entry.username });
                        }}>Remove</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {active.entries.length === 0 && (
              <div className="admin-empty" style={{ marginTop: '20px' }}>
                <p className="admin-empty-icon">🌙</p>
                <p>Waiting for participants...</p>
              </div>
            )}

            {/* Vote Distribution Chart */}
            {active.entries.length > 0 && active.voteCount > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3 className="ch-section-title">Vote Distribution</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  {active.entries
                    .map(e => ({ ...e, votes: (votesByEntry.get(e.userId) || []).length }))
                    .sort((a, b) => b.votes - a.votes)
                    .slice(0, 10)
                    .map(e => {
                      const pct = active.voteCount > 0 ? (e.votes / active.voteCount * 100) : 0;
                      const flagged = (votesByEntry.get(e.userId) || []).filter(v => v.flagged).length;
                      return (
                        <div key={e.userId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '100px', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.username}</span>
                          <div style={{ flex: 1, height: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: flagged > 0 ? 'linear-gradient(90deg, #0ea5e9, #f43f5e)' : '#0ea5e9', borderRadius: '4px', transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ width: '60px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}>
                            {e.votes} {flagged > 0 && <span style={{ color: '#f43f5e' }}>({flagged}🚩)</span>}
                          </span>
                        </div>
                      );
                    })
                  }
                </div>
                {active.voteCount > 0 && active.entryCount > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted, rgba(255,255,255,0.5))', display: 'flex', gap: '16px' }}>
                    <span>Avg votes/entry: {(active.voteCount / active.entryCount).toFixed(1)}</span>
                    {active.flaggedVoteCount > 0 && <span>Flagged: {(active.flaggedVoteCount / active.voteCount * 100).toFixed(1)}%</span>}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="ch-actions">
              <button className="admin-btn admin-btn-danger" disabled={actionLoading} onClick={() => setConfirmAction({ action: 'close', challengeId: active._id, label: active.name })}>
                Close Challenge
              </button>
              <button className="admin-btn admin-btn-ghost" disabled={actionLoading} onClick={() => setConfirmAction({ action: 'cancel', challengeId: active._id, label: active.name })}>
                Cancel
              </button>
              <span className="ch-hint">Use bot <code>/challenge close</code> for full results + Lunari rewards</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="admin-empty">
          <p className="admin-empty-icon">🌙</p>
          <p>No active challenge</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.5rem' }}>
            Click &quot;Create Challenge&quot; above or use <code>/challenge create</code> in Discord
          </p>
        </div>
      ))}

      {tab === 'history' && <DataTable title="Challenge History" columns={historyColumns} data={history} pageSize={20} />}

      {tab === 'hallOfFame' && (
        hallOfFame.length > 0 ? (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {hallOfFame.slice().reverse().map((w, i) => (
              <div key={`${w.challengeName}_${w.closedAt}`} className="ch-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '1.5rem' }}>{i === 0 ? '👑' : '🏆'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{w.challengeName}</div>
                  <div className="ch-desc">Winner: <strong>{w.winnerUsername}</strong> — {w.voteCount} votes / {w.totalParticipants} participants</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{new Date(w.closedAt).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-empty"><p className="admin-empty-icon">🏛️</p><p>No champions yet</p></div>
        )
      )}

      {/* ── Activity Tab ── */}
      {tab === 'activity' && active && (
        <ActivityTab challenge={active} />
      )}
      {tab === 'activity' && !active && (
        <div className="admin-empty"><p className="admin-empty-icon">🔍</p><p>No active challenge to monitor</p></div>
      )}

      {/* ── Settings Tab ── */}
      {tab === 'settings' && (
        <SettingsTab toast={toast} />
      )}

      {/* ── Lightbox ── */}
      {lightboxEntry && active && (
        <Lightbox entry={lightboxEntry} votes={votesByEntry.get(lightboxEntry.userId) || []} challengeName={active.name} onClose={() => setLightboxEntry(null)} />
      )}

      {/* ── Create Modal ── */}
      {showCreateModal && <CreateChallengeModal onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); fetchData(); }} toast={toast} templates={templates} />}

      {/* ── Confirm Modal ── */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.action === 'close' ? 'Close Challenge?' : confirmAction.action === 'cancel' ? 'Cancel Challenge?' : `Remove ${confirmAction.label}?`}
          message={confirmAction.action === 'close' ? `End "${confirmAction.label}". Use bot command for rewards.` : confirmAction.action === 'cancel' ? `Cancel "${confirmAction.label}" permanently.` : `Remove ${confirmAction.label} and all their votes.`}
          variant="danger"
          onConfirm={() => handleAction(confirmAction.action, confirmAction.challengeId, confirmAction.userId)}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      <style jsx>{`
        .ch-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 24px; }
        .ch-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
        .ch-title { font-size: 1.25rem; font-weight: 600; margin: 0; }
        .ch-desc { font-size: 0.9rem; color: var(--text-secondary, rgba(255,255,255,0.7)); margin-top: 4px; }
        .ch-section-title { font-size: 0.95rem; font-weight: 600; color: var(--text-secondary, rgba(255,255,255,0.7)); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .ch-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
        .ch-gallery-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; overflow: hidden; cursor: pointer; transition: border-color 0.15s, transform 0.15s; }
        .ch-gallery-card:hover { border-color: rgba(0,191,255,0.3); transform: translateY(-2px); }
        .ch-gallery-img-wrap { position: relative; aspect-ratio: 1; overflow: hidden; }
        .ch-gallery-img { width: 100%; height: 100%; object-fit: cover; }
        .ch-gallery-votes { position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.75); color: #fff; font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; backdrop-filter: blur(4px); }
        .ch-gallery-flag { position: absolute; top: 6px; right: 6px; background: rgba(244,63,94,0.85); color: #fff; font-size: 0.7rem; padding: 2px 6px; border-radius: 8px; }
        .ch-gallery-name { padding: 8px 10px 4px; font-size: 0.85rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ch-gallery-remove { width: 100%; padding: 6px; border: none; background: transparent; color: var(--admin-danger); font-size: 0.75rem; cursor: pointer; opacity: 0; transition: opacity 0.15s; border-top: 1px solid rgba(255,255,255,0.04); }
        .ch-gallery-card:hover .ch-gallery-remove { opacity: 1; }
        .ch-actions { margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 8px; }
        .ch-hint { font-size: 0.8rem; color: var(--text-muted, rgba(255,255,255,0.5)); margin-left: auto; }
      `}</style>
    </>
  );
}

// ── Lightbox Component ─────────────────────────────────────────────────

function Lightbox({ entry, votes, challengeName, onClose }: { entry: ChallengeEntry; votes: ChallengeVote[]; challengeName: string; onClose: () => void }) {
  const flagged = votes.filter(v => v.flagged);

  return (
    <div className="lb-overlay" onClick={onClose}>
      <div className="lb-content" onClick={e => e.stopPropagation()}>
        <button className="lb-close" onClick={onClose}>×</button>

        <div className="lb-layout">
          {/* Image */}
          <div className="lb-image-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.imageUrl} alt={entry.username} className="lb-image" />
          </div>

          {/* Info Panel */}
          <div className="lb-info">
            <h3 className="lb-title">{entry.username}</h3>
            <p className="lb-meta">Challenge: {challengeName}</p>
            <p className="lb-meta">Submitted: {new Date(entry.submittedAt).toLocaleString()}</p>
            <p className="lb-meta">Total Votes: <strong>{votes.length}</strong>{flagged.length > 0 && <span style={{ color: '#f43f5e', marginLeft: '8px' }}>🚩 {flagged.length} flagged</span>}</p>

            <div className="lb-voters-title">Voters ({votes.length})</div>
            <div className="lb-voters">
              {votes.length === 0 && <p className="lb-no-voters">No votes yet</p>}
              {votes.map((v) => (
                <div key={`${v.voterId}_${v.votedAt}`} className={`lb-voter ${v.flagged ? 'lb-voter-flagged' : ''}`}>
                  <div className="lb-voter-avatar">
                    {v.voterAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.voterAvatar} alt="" className="lb-avatar-img" />
                    ) : (
                      <div className="lb-avatar-placeholder">{v.voterName.charAt(0).toUpperCase()}</div>
                    )}
                  </div>
                  <div className="lb-voter-info">
                    <span className="lb-voter-name">{v.voterName}</span>
                    <span className="lb-voter-meta">
                      {v.voterAccountAge >= 0 && (
                        <span className={`lb-age-badge ${v.voterAccountAge < 7 ? 'lb-age-new' : v.voterAccountAge < 30 ? 'lb-age-recent' : 'lb-age-old'}`}>
                          {v.voterAccountAge}d
                        </span>
                      )}
                      {v.flagged && <span className="lb-flag-badge">🚩 {v.flagReason || 'Suspicious'}</span>}
                    </span>
                  </div>
                  <span className="lb-vote-time">{new Date(v.votedAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .lb-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
        .lb-content { background: var(--bg-card, #1a1a2e); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; max-width: 900px; max-height: 90vh; width: 95%; overflow: hidden; position: relative; }
        .lb-close { position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.5); border: none; color: #fff; font-size: 1.5rem; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; }
        .lb-layout { display: flex; max-height: 90vh; }
        .lb-image-wrap { flex: 1; min-width: 0; background: #000; display: flex; align-items: center; justify-content: center; }
        .lb-image { max-width: 100%; max-height: 80vh; object-fit: contain; }
        .lb-info { width: 320px; flex-shrink: 0; padding: 20px; overflow-y: auto; max-height: 90vh; border-left: 1px solid rgba(255,255,255,0.06); }
        .lb-title { font-size: 1.1rem; font-weight: 600; margin: 0 0 8px; }
        .lb-meta { font-size: 0.8rem; color: var(--text-muted, rgba(255,255,255,0.5)); margin: 2px 0; }
        .lb-voters-title { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary, rgba(255,255,255,0.7)); margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .lb-voters { display: flex; flex-direction: column; gap: 6px; }
        .lb-no-voters { font-size: 0.8rem; color: var(--text-muted, rgba(255,255,255,0.5)); }
        .lb-voter { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; background: rgba(255,255,255,0.02); }
        .lb-voter-flagged { background: rgba(244,63,94,0.08); border: 1px solid rgba(244,63,94,0.2); }
        .lb-voter-avatar { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; flex-shrink: 0; }
        .lb-avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .lb-avatar-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,191,255,0.2); color: #00bfff; font-size: 0.75rem; font-weight: 600; }
        .lb-voter-info { flex: 1; min-width: 0; }
        .lb-voter-name { font-size: 0.8rem; font-weight: 500; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lb-voter-meta { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
        .lb-age-badge { font-size: 0.65rem; padding: 1px 5px; border-radius: 8px; }
        .lb-age-new { background: rgba(244,63,94,0.2); color: #f43f5e; }
        .lb-age-recent { background: rgba(251,191,36,0.2); color: #fbbf24; }
        .lb-age-old { background: rgba(74,222,128,0.2); color: #4ade80; }
        .lb-flag-badge { font-size: 0.65rem; color: #f43f5e; }
        .lb-vote-time { font-size: 0.7rem; color: var(--text-muted, rgba(255,255,255,0.5)); flex-shrink: 0; }
        @media (max-width: 768px) { .lb-layout { flex-direction: column; } .lb-info { width: 100%; max-height: 50vh; border-left: none; border-top: 1px solid rgba(255,255,255,0.06); } }
      `}</style>
    </div>
  );
}

// ── Create Challenge Modal ─────────────────────────────────────────────

function CreateChallengeModal({ onClose, onCreated, toast, templates }: { onClose: () => void; onCreated: () => void; toast: (msg: string, type: 'success' | 'error' | 'info') => void; templates?: any[] }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', type: 'image', submissionChannelId: '', votingChannelId: '', logChannelId: '', reward1st: '', reward2nd: '', reward3rd: '', duration: '', scheduledAt: '' });

  useEffect(() => {
    fetch('/api/admin/challenges/channels')
      .then(r => r.json())
      .then(d => setChannels(d.channels || []))
      .catch(() => toast('Failed to load channels', 'error'))
      .finally(() => setLoadingChannels(false));
  }, [toast]);

  const grouped = useMemo(() => {
    const map = new Map<string, Channel[]>();
    for (const ch of channels) {
      if (!map.has(ch.parentName)) map.set(ch.parentName, []);
      map.get(ch.parentName)!.push(ch);
    }
    return map;
  }, [channels]);

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    if (!form.submissionChannelId) { toast('Submission channel is required', 'error'); return; }
    if (!form.votingChannelId) { toast('Voting channel is required', 'error'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          type: form.type || 'image',
          submissionChannelId: form.submissionChannelId,
          votingChannelId: form.votingChannelId,
          logChannelId: form.logChannelId || undefined,
          reward1st: form.reward1st ? parseInt(form.reward1st) : undefined,
          reward2nd: form.reward2nd ? parseInt(form.reward2nd) : undefined,
          reward3rd: form.reward3rd ? parseInt(form.reward3rd) : undefined,
          duration: form.duration ? parseInt(form.duration) : undefined,
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast(data.message || 'Challenge created!', 'success');
      onCreated();
    } catch (err: any) {
      toast(err.message || 'Failed to create', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const channelSelect = (label: string, value: string, onChange: (v: string) => void, required: boolean) => (
    <div className="cm-field">
      <label className="admin-form-label">{label}{required && ' *'}</label>
      <select className="admin-input" value={value} onChange={e => onChange(e.target.value)} disabled={loadingChannels}>
        <option value="">{loadingChannels ? 'Loading channels...' : 'Select channel'}</option>
        {Array.from(grouped.entries()).map(([cat, chs]) => (
          <optgroup key={cat} label={cat}>
            {chs.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );

  return (
    <div className="lb-overlay" onClick={onClose}>
      <div className="cm-modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>Create Challenge</h2>

        {/* Template loader */}
        {templates && templates.length > 0 && (
          <div className="cm-field" style={{ marginBottom: '12px' }}>
            <label className="admin-form-label">Load Template</label>
            <select className="admin-input" onChange={e => {
              const tpl = templates.find((t: any) => t.id === e.target.value);
              if (tpl) setForm(f => ({ ...f, name: tpl.name || f.name, type: tpl.type || 'image', description: tpl.description || '', reward1st: tpl.reward1st != null ? String(tpl.reward1st) : '', reward2nd: tpl.reward2nd != null ? String(tpl.reward2nd) : '', reward3rd: tpl.reward3rd != null ? String(tpl.reward3rd) : '', duration: tpl.duration != null ? String(tpl.duration) : '' }));
            }}>
              <option value="">Select a template...</option>
              {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
            </select>
          </div>
        )}

        <div className="cm-row">
          <div className="cm-field" style={{ flex: 1 }}>
            <label className="admin-form-label">Name *</label>
            <input className="admin-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100} placeholder="Challenge name" />
          </div>
          <div className="cm-field" style={{ width: '120px' }}>
            <label className="admin-form-label">Type</label>
            <select className="admin-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="image">Image</option>
              <option value="text">Text</option>
              <option value="link">Link</option>
            </select>
          </div>
        </div>

        <div className="cm-field">
          <label className="admin-form-label">Description</label>
          <textarea className="admin-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} maxLength={500} rows={2} placeholder="Optional description" />
        </div>

        <div className="cm-row">
          {channelSelect('Submission Channel', form.submissionChannelId, v => setForm(f => ({ ...f, submissionChannelId: v })), true)}
          {channelSelect('Voting Channel', form.votingChannelId, v => setForm(f => ({ ...f, votingChannelId: v })), true)}
        </div>

        {channelSelect('Log Channel (suspicious votes)', form.logChannelId, v => setForm(f => ({ ...f, logChannelId: v })), false)}

        <div className="cm-row">
          <div className="cm-field">
            <label className="admin-form-label">1st Place Reward</label>
            <input className="admin-input" type="number" min="0" value={form.reward1st} onChange={e => setForm(f => ({ ...f, reward1st: e.target.value }))} placeholder="Lunari" />
          </div>
          <div className="cm-field">
            <label className="admin-form-label">2nd Place</label>
            <input className="admin-input" type="number" min="0" value={form.reward2nd} onChange={e => setForm(f => ({ ...f, reward2nd: e.target.value }))} placeholder="Lunari" />
          </div>
          <div className="cm-field">
            <label className="admin-form-label">3rd Place</label>
            <input className="admin-input" type="number" min="0" value={form.reward3rd} onChange={e => setForm(f => ({ ...f, reward3rd: e.target.value }))} placeholder="Lunari" />
          </div>
        </div>

        <div className="cm-row">
          <div className="cm-field">
            <label className="admin-form-label">Duration (hours, optional)</label>
            <input className="admin-input" type="number" min="1" max="168" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="Auto-close after X hours" />
          </div>
          <div className="cm-field">
            <label className="admin-form-label">Schedule for later</label>
            <input className="admin-input" type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button className="admin-btn admin-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="admin-btn admin-btn-primary" onClick={handleSubmit} disabled={submitting || loadingChannels}>
            {submitting ? 'Creating...' : 'Create Challenge'}
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px' }}>
          The bot will pick up the challenge within 60 seconds and post the announcement + voting panel.
        </p>
      </div>

      <style jsx>{`
        .cm-modal { background: var(--bg-card, #1a1a2e); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; max-width: 600px; width: 95%; max-height: 90vh; overflow-y: auto; }
        .cm-field { margin-bottom: 12px; }
        .cm-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
      `}</style>
    </div>
  );
}

// ── Activity Tab ───────────────────────────────────────────────────────

function ActivityTab({ challenge }: { challenge: Challenge }) {
  const votes = challenge.votes || [];
  const entries = challenge.entries || [];
  const [filter, setFilter] = useState<'all' | 'flagged'>('all');

  const flaggedVotes = votes.filter(v => v.flagged);
  const sortedVotes = [...votes].sort((a, b) => new Date(b.votedAt).getTime() - new Date(a.votedAt).getTime());
  const sortedEntries = [...entries].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  const filtered = filter === 'flagged' ? sortedVotes.filter(v => v.flagged) : sortedVotes;

  // Fraud metrics
  const newAccountVotes = votes.filter(v => v.voterAccountAge >= 0 && v.voterAccountAge < 7).length;
  const flaggedPct = votes.length > 0 ? Math.round((flaggedVotes.length / votes.length) * 100) : 0;

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Fraud Metrics */}
      <div className="admin-stats-grid">
        <StatCard label="Total Votes" value={votes.length} icon="🗳️" color="cyan" />
        <StatCard label="Flagged Votes" value={flaggedVotes.length} icon="🚩" color="purple"
          trendType={flaggedVotes.length > 0 ? 'negative' : 'neutral'}
          trend={flaggedPct > 0 ? `${flaggedPct}% of total` : undefined} />
        <StatCard label="New Account Votes" value={newAccountVotes} icon="🛡️" color="gold"
          trendType={newAccountVotes > 2 ? 'negative' : 'neutral'}
          trend="Account age < 7 days" />
        <StatCard label="Entries" value={entries.length} icon="📸" color="green" />
      </div>

      {/* Export Buttons */}
      <div style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
        <a href={`/api/admin/challenges/export?id=${challenge._id}&format=csv`} className="admin-btn admin-btn-ghost admin-btn-sm" download>
          📥 Export CSV
        </a>
        <a href={`/api/admin/challenges/export?id=${challenge._id}&format=json`} className="admin-btn admin-btn-ghost admin-btn-sm" download>
          📥 Export JSON
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Vote Timeline */}
        <div className="ch-card" style={{ padding: '16px', maxHeight: '400px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="ch-section-title" style={{ margin: 0 }}>Vote Timeline</h3>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className={`admin-btn admin-btn-sm ${filter === 'all' ? 'admin-btn-primary' : 'admin-btn-ghost'}`} onClick={() => setFilter('all')}>All</button>
              <button className={`admin-btn admin-btn-sm ${filter === 'flagged' ? 'admin-btn-primary' : 'admin-btn-ghost'}`} onClick={() => setFilter('flagged')}>🚩 Flagged</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>No votes yet</p>}
            {filtered.map((v) => (
              <div key={`${v.voterId}_${v.votedAt}`} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', marginBottom: '4px',
                background: v.flagged ? 'rgba(244,63,94,0.08)' : 'rgba(255,255,255,0.02)',
                border: v.flagged ? '1px solid rgba(244,63,94,0.2)' : '1px solid transparent'
              }}>
                {v.voterAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.voterAvatar} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,191,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#00bfff' }}>
                    {v.voterName.charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.8rem' }}><strong>{v.voterName}</strong> → {v.votedForUsername}</span>
                  {v.flagged && <span style={{ fontSize: '0.65rem', color: '#f43f5e', marginLeft: '6px' }}>🚩</span>}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, rgba(255,255,255,0.5))', flexShrink: 0 }}>
                  {new Date(v.votedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Submission Timeline */}
        <div className="ch-card" style={{ padding: '16px', maxHeight: '400px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <h3 className="ch-section-title" style={{ margin: '0 0 12px' }}>Submission Timeline</h3>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sortedEntries.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>No submissions yet</p>}
            {sortedEntries.map((e) => (
              <div key={e.userId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', marginBottom: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: '4px', objectFit: 'cover' }} loading="lazy" />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{e.username}</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>
                  {new Date(e.submittedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Settings Tab (Text Configuration) ──────────────────────────────────

function SettingsTab({ toast }: { toast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, string>>({});

  // Config state (numeric settings + HoF)
  const [cfg, setCfg] = useState<any>(null);
  const [cfgOrig, setCfgOrig] = useState('');
  const [cfgSaving, setCfgSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);

  useEffect(() => {
    fetch('/api/admin/challenges/texts')
      .then(r => r.json())
      .then(d => setTexts(d.texts || {}))
      .catch(() => toast('Failed to load texts', 'error'))
      .finally(() => setLoading(false));
    // Load challenge config
    fetch('/api/admin/challenges/config')
      .then(r => r.json())
      .then(d => { setCfg(d.config); setCfgOrig(JSON.stringify(d.config)); })
      .catch(() => toast('Failed to load config', 'error'));
    // Load channels for HoF picker
    fetch('/api/admin/challenges/channels')
      .then(r => r.json())
      .then(d => setChannels(d.channels || []))
      .catch(() => {});
  }, [toast]);

  const cfgHasChanges = cfg ? JSON.stringify(cfg) !== cfgOrig : false;

  const handleSaveConfig = async () => {
    if (!cfg || !cfgHasChanges) return;
    setCfgSaving(true);
    try {
      const res = await fetch('/api/admin/challenges/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ config: cfg }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
      setCfgOrig(JSON.stringify(cfg));
      toast('Settings saved! Bot will pick up changes within 60 seconds.', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to save', 'error');
    } finally { setCfgSaving(false); }
  };

  const cfgNum = (key: string, label: string, unit: string, min: number, max: number) => (
    <div className="cm-field" style={{ flex: 1 }}>
      <label className="admin-form-label">{label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({unit})</span></label>
      <input className="admin-input" type="number" min={min} max={max} value={cfg?.[key] ?? ''} onChange={e => setCfg((c: any) => ({ ...c, [key]: Number(e.target.value) }))} />
    </div>
  );

  const toggleCategory = (cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const handleEdit = (key: string, value: string) => {
    setEdits(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveCategory = async (category: string) => {
    const keys = TEXT_CATEGORIES[category] || [];
    const updates: Record<string, string | null> = {};
    for (const key of keys) {
      if (edits[key] !== undefined) {
        updates[key] = edits[key] || null; // empty string = reset to default
      }
    }
    if (Object.keys(updates).length === 0) { toast('No changes to save', 'info'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/challenges/texts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast(data.message || 'Saved!', 'success');
      // Update local state
      setTexts(prev => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(updates)) {
          if (v === null) delete next[k]; else next[k] = v;
        }
        return next;
      });
      setEdits(prev => {
        const next = { ...prev };
        for (const k of Object.keys(updates)) delete next[k];
        return next;
      });
    } catch (err: any) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const groupedChannels = useMemo(() => {
    const map = new Map<string, Channel[]>();
    for (const ch of channels) {
      if (!map.has(ch.parentName)) map.set(ch.parentName, []);
      map.get(ch.parentName)!.push(ch);
    }
    return map;
  }, [channels]);

  if (loading) return <SkeletonCard count={3} />;

  const filteredCategories = Object.entries(TEXT_CATEGORIES).filter(([cat, keys]) =>
    !search || cat.toLowerCase().includes(search.toLowerCase()) || keys.some(k =>
      k.toLowerCase().includes(search.toLowerCase()) || (texts[k] || '').toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div style={{ marginTop: '1rem' }}>

      {/* ── Challenge Config (numeric settings + HoF) ── */}
      {cfg && (
        <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Challenge Settings</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Changes take effect within 60 seconds (bot reads from database).</p>

          {/* Hall of Fame */}
          <div className="admin-config-section" style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>Hall of Fame Channel</h4>
            <select className="admin-input" value={cfg.hallOfFameChannelId || ''} onChange={e => setCfg((c: any) => ({ ...c, hallOfFameChannelId: e.target.value || null }))}>
              <option value="">Not configured</option>
              {Array.from(groupedChannels.entries()).map(([cat, chs]) => (
                <optgroup key={cat} label={cat}>
                  {chs.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Anti-Alt Protection */}
          <div className="admin-config-section" style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>Anti-Alt Protection</h4>
            <div className="cm-row">
              {cfgNum('minJoinAgeMs', 'Min server join age', 'ms — 3600000 = 1hr', 0, 2592000000)}
              {cfgNum('minAccountAgeMs', 'Min account age', 'ms — 604800000 = 7d', 0, 7776000000)}
            </div>
            <div className="cm-row" style={{ marginTop: '8px' }}>
              {cfgNum('suspiciousVoteThreshold', 'Flag threshold', 'new accounts', 2, 20)}
            </div>
          </div>

          {/* Rate Limiting */}
          <div className="admin-config-section" style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>Rate Limiting</h4>
            <div className="cm-row">
              {cfgNum('maxGuildVotesPerSec', 'Votes/sec limit', 'votes/sec', 1, 100)}
              {cfgNum('cmdCooldownMs', 'Command cooldown', 'ms — 5000 = 5s', 0, 60000)}
              {cfgNum('voteChangeWindowMs', 'Vote change window', 'ms — 120000 = 2min', 0, 600000)}
            </div>
          </div>

          {/* Display */}
          <div className="admin-config-section" style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>Display</h4>
            <div className="cm-row">
              {cfgNum('updateIntervalMs', 'Panel refresh', 'ms — 30000 = 30s', 10000, 300000)}
              {cfgNum('maxTopEntriesShown', 'Entries in panel', 'entries', 1, 25)}
            </div>
          </div>

          {cfgHasChanges && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="admin-btn admin-btn-primary" onClick={handleSaveConfig} disabled={cfgSaving}>
                {cfgSaving ? 'Saving...' : 'Save Settings'}
              </button>
              <button className="admin-btn admin-btn-ghost" onClick={() => setCfg(JSON.parse(cfgOrig))}>Discard</button>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '8px 0' }} />
        </div>
      )}

      {/* Text Configuration */}
      {/* Search */}
      <input
        className="admin-input"
        placeholder="Search texts..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: '16px', maxWidth: '400px' }}
      />

      {/* Template Variables */}
      <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, rgba(255,255,255,0.5))', marginRight: '8px' }}>Template vars:</span>
        {TEMPLATE_VARS.map(v => (
          <button key={v} className="admin-btn admin-btn-ghost" style={{ fontSize: '0.7rem', padding: '2px 6px' }}
            onClick={() => {
              // Copy to clipboard
              navigator.clipboard.writeText(v).then(() => toast(`Copied ${v}`, 'info'));
            }}>
            {v}
          </button>
        ))}
      </div>

      {/* Categories */}
      {filteredCategories.map(([category, keys]) => {
        const isOpen = expanded.has(category);
        const hasEdits = keys.some(k => edits[k] !== undefined);

        return (
          <div key={category} className="ch-card" style={{ marginBottom: '8px', padding: 0, overflow: 'hidden' }}>
            <div
              style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: isOpen ? 'rgba(255,255,255,0.02)' : 'transparent' }}
              onClick={() => toggleCategory(category)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem' }}>{isOpen ? '▼' : '▶'}</span>
                <strong style={{ fontSize: '0.9rem' }}>{category}</strong>
                <span className="admin-badge admin-badge-muted">{keys.length}</span>
                {hasEdits && <span className="admin-badge cyan">unsaved</span>}
              </div>
              {isOpen && hasEdits && (
                <button className="admin-btn admin-btn-primary admin-btn-sm" disabled={saving}
                  onClick={(e) => { e.stopPropagation(); handleSaveCategory(category); }}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>

            {isOpen && (
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {keys.filter(k => !search || k.includes(search) || (texts[k] || '').includes(search)).map(key => {
                  const current = edits[key] ?? texts[key] ?? '';
                  const isCustom = !!texts[key];

                  return (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label className="admin-form-label" style={{ margin: 0, fontSize: '0.8rem' }}>
                          <code style={{ fontSize: '0.75rem', opacity: 0.7 }}>{key}</code>
                          {isCustom && <span className="admin-badge cyan" style={{ marginLeft: '6px', fontSize: '0.6rem' }}>custom</span>}
                        </label>
                        {isCustom && (
                          <button className="admin-btn admin-btn-ghost" style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                            onClick={() => handleEdit(key, '')}>
                            Reset
                          </button>
                        )}
                      </div>
                      <textarea
                        className="admin-input"
                        value={current}
                        onChange={e => handleEdit(key, e.target.value)}
                        rows={2}
                        style={{ fontSize: '0.85rem', resize: 'vertical', direction: 'rtl' }}
                        placeholder={TEXT_DEFAULTS[key] || '(no default)'}
                      />
                      {/* Inline preview */}
                      {current && (
                        <div style={{ marginTop: '4px', padding: '6px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-secondary, rgba(255,255,255,0.7))' }}>
                          Preview: {current.replace(/\{emoji\.\w+\}/g, '✨').replace(/\{[^}]+\}/g, (m) => `⌜${m}⌝`)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
