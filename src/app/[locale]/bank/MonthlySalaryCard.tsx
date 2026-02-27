'use client';

import { useTranslations } from 'next-intl';
import type { RoleClassification } from '@/types/bank';
import { STAFF_ROLES, SPECIAL_ROLES, BOOSTER_ROLE_ID } from '@/lib/bank/bank-config';

interface MonthlySalaryCardProps {
  roles: RoleClassification;
  locale: 'en' | 'ar';
}

const STAFF_ROLE_NAMES: Record<string, { en: string; ar: string }> = {
  '1416510580038041621': { en: 'Mastermind', ar: 'العقل المدبر' },
  '1416555884141613126': { en: 'Luna Sentinel', ar: 'حارس لونا' },
  '1416556873758277826': { en: 'Luna Guardian', ar: 'حامي لونا' },
  '1416546769474682951': { en: 'Luna Knight', ar: 'فارس لونا' },
  '1417164354058719303': { en: 'Luna Wizard', ar: 'ساحر لونا' },
  '1418318823592820836': { en: 'Luna Healer', ar: 'معالج لونا' },
};

const SPECIAL_ROLE_NAMES: Record<string, { en: string; ar: string; desc?: { en: string; ar: string } }> = {
  '1417160274447827086': { en: 'Luna Noble', ar: 'نبيل لونا', desc: { en: 'Founders of Luna', ar: 'المؤسسين في عالم لونا' } },
  '1427759046697422859': { en: 'Trickster', ar: 'المحتال', desc: { en: 'Full Cards collection', ar: 'مجموعة كاملة من البطاقات' } },
  '1458898769343942798': { en: 'Luna Chosen', ar: 'مختار لونا', desc: { en: 'Full Moonstones collection', ar: 'مجموعة كاملة من أحجار القمر' } },
  [BOOSTER_ROLE_ID]: { en: 'Luna Booster', ar: 'معزز لونا', desc: { en: 'Discord Nitro Boosters', ar: 'معززي نيترو ديسكورد' } },
};

export function MonthlySalaryCard({ roles, locale }: MonthlySalaryCardProps) {
  const t = useTranslations('bankPage');
  const userRoleSet = new Set(roles.roleIds);
  const hasEligibleRole = roles.isStaff || roles.isSpecial || roles.isBooster;

  return (
    <div className="salary-card monthly-salary-card">
      <div className="salary-card-header">
        <span className="salary-card-title">{t('salary.monthly.title')}</span>
      </div>
      <p className="salary-desc">{t('salary.monthly.desc')}</p>
      <div className="salary-amount">
        <span className="salary-value">80,000</span>
        <span className="salary-currency">{t('currency')}</span>
      </div>

      <div className="eligible-roles">
        {/* Staff Roles */}
        <div className="roles-category">
          <div className="roles-category-title">{t('salary.monthly.staffRoles')}</div>
          <div className="roles-list">
            {Object.entries(STAFF_ROLE_NAMES).map(([roleId, names]) => {
              const hasRole = userRoleSet.has(roleId);
              return (
                <span key={roleId} className={`role-badge ${hasRole ? 'role-has' : 'role-locked'}`}>
                  <span className={`role-status-icon ${hasRole ? 'check' : 'lock'}`}></span>
                  {names[locale]}
                </span>
              );
            })}
          </div>
        </div>

        {/* Special Roles */}
        <div className="roles-category">
          <div className="roles-category-title">{t('salary.monthly.specialRoles')}</div>
          <div className="roles-list special-roles-list">
            {Object.entries(SPECIAL_ROLE_NAMES).map(([roleId, data]) => {
              const hasRole = userRoleSet.has(roleId);
              return (
                <div key={roleId} className="role-badge-wrapper">
                  <span className={`role-badge special ${hasRole ? 'role-has' : 'role-locked'}`}>
                    <span className={`role-status-icon ${hasRole ? 'check' : 'lock'}`}></span>
                    {data[locale]}
                  </span>
                  {data.desc && (
                    <span className="role-description">{data.desc[locale]}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {hasEligibleRole ? (
          <a
            href="https://discord.com/channels/1243327880478462032/1450597284600615062"
            target="_blank"
            rel="noopener noreferrer"
            className="section-action-btn monthly-claim-btn"
          >
            {t('dashboard.claimOnDiscord')}
          </a>
        ) : (
          <div className="roles-tip monthly-ineligible">
            {t('dashboard.noEligibleRole')}
          </div>
        )}
      </div>
    </div>
  );
}
