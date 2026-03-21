'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import { E } from '@/components/edit-mode/EditableText';
import { EImg } from '@/components/edit-mode/EditableImage';
import type { MemberListItem, MembersResponse } from '@/types/members';
import LunariIcon from '@/components/LunariIcon';

export default function MembersContent() {
  const t = useTranslations('membersPage');

  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const debouncedSearch = useRef(search);

  // Debounce search input
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      debouncedSearch.current = search;
      setPage(1);
      fetchMembers(1, search, sortBy);
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMembers = useCallback(async (p: number, s: string, sort: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), sort });
      if (s.trim()) params.set('search', s.trim());
      const res = await fetch(`/api/members?${params}`);
      if (res.ok) {
        const data: MembersResponse = await res.json();
        setMembers(data.members);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on page/sort change
  useEffect(() => {
    fetchMembers(page, debouncedSearch.current, sortBy);
  }, [page, sortBy, fetchMembers]);

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    setPage(1);
  };

  return (
    <>
      {/* Hero */}
      <section className="members-hero">
        <div className="members-hero-bg">
          <EImg editId="members-hero-bg" source="r2" src="https://assets.lunarian.app/backgrounds/Members_Hero.png" alt="Members" fill priority className="members-hero-bg-image" />
        </div>
        <h1 className="members-hero-title"><E ns="membersPage" k="title">{t('title')}</E></h1>
        <p className="members-hero-subtitle"><E ns="membersPage" k="subtitle">{t('subtitle')}</E></p>
        {total > 0 && (
          <div className="members-count-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {t('totalMembers', { count: total })}
          </div>
        )}
      </section>

    <div className="wrap">

      {/* Filters */}
      <div className="members-filters">
        <input
          type="text"
          className="members-search"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="members-sort"
          value={sortBy}
          onChange={(e) => handleSortChange(e.target.value)}
        >
          <option value="newest">{t('sort.newest')}</option>
          <option value="oldest">{t('sort.oldest')}</option>
          <option value="level">{t('sort.level')}</option>
          <option value="lunari">{t('sort.lunari')}</option>
          <option value="cards">{t('sort.cards')}</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="members-skeleton-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="member-skeleton">
              <div className="skeleton-avatar" />
              <div className="skeleton-name" />
              <div className="skeleton-username" />
              <div className="skeleton-stats" />
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="members-empty">
          <svg className="members-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          <p><E ns="membersPage" k="noResults">{t('noResults')}</E></p>
        </div>
      ) : (
        <>
          <div className="members-grid">
            {members.map((member) => (
              <Link
                key={member.discordId}
                href={`/profile?discordId=${member.discordId}`}
                className="member-card"
              >
                <div className="member-avatar-wrap">
                  {member.image ? (
                    <Image
                      src={member.image}
                      alt={member.name}
                      width={64}
                      height={64}
                      className="member-avatar"
                    />
                  ) : (
                    <div className="member-avatar-fallback">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {member.level > 0 && (
                    <span className="member-level-badge">{member.level}</span>
                  )}
                </div>
                <span className="member-name">{member.name}</span>
                {member.username && (
                  <span className="member-username">@{member.username}</span>
                )}
                <div className="member-stats">
                  <span className="member-stat">
                    <LunariIcon size={12} />
                    {member.lunari.toLocaleString()}
                  </span>
                  <span className="member-stat">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M2 7h20" />
                    </svg>
                    {member.cardCount}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="members-pagination">
              <button
                className="members-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="members-page-info">
                {page} / {totalPages}
              </span>
              <button
                className="members-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
}
