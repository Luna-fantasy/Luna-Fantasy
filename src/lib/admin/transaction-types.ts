// Unified transaction type display info for admin dashboard

interface TransactionTypeInfo {
  label: string;
  icon: string;
  color: string;
}

const TYPE_MAP: Record<string, TransactionTypeInfo> = {
  // Economy — gains (success/green)
  lunari_added:              { label: 'Lunari Added',       icon: '\uD83D\uDCB0', color: 'admin-badge-success' },
  bank_daily:                { label: 'Daily Reward',       icon: '\uD83E\uDE99', color: 'admin-badge-success' },
  bank_salary:               { label: 'Salary',             icon: '\uD83D\uDCB0', color: 'admin-badge-success' },
  bank_vip:                  { label: 'VIP Reward',         icon: '\uD83D\uDC51', color: 'admin-badge-warning' },
  game_win:                  { label: 'Game Win',           icon: '\uD83C\uDFC6', color: 'admin-badge-success' },
  trade_win:                 { label: 'Trade Win',          icon: '\uD83D\uDCC8', color: 'admin-badge-success' },
  swap_received:             { label: 'Swap Received',      icon: '\uD83D\uDD04', color: 'admin-badge-success' },
  stripe_purchase:           { label: 'Premium',            icon: '\u2B50',        color: 'admin-badge-success' },

  // Economy — losses (red)
  lunari_spent:              { label: 'Lunari Spent',       icon: '\uD83D\uDCB8', color: 'red' },
  game_loss:                 { label: 'Game Loss',          icon: '\uD83C\uDFB2', color: 'red' },
  trade_loss:                { label: 'Trade Loss',         icon: '\uD83D\uDCC9', color: 'red' },

  // Banking (cyan)
  bank_loan_taken:           { label: 'Loan Taken',         icon: '\uD83C\uDFE6', color: 'cyan' },
  bank_loan_repaid:          { label: 'Loan Repaid',        icon: '\u2705',        color: 'admin-badge-success' },
  bank_loan_partial_repaid:  { label: 'Loan Partial',       icon: '\uD83C\uDFE6', color: 'cyan' },
  bank_investment_deposit:   { label: 'Investment',         icon: '\uD83D\uDCCA', color: 'cyan' },
  bank_investment_withdraw:  { label: 'Inv. Withdraw',      icon: '\uD83D\uDCCA', color: 'cyan' },
  bank_insurance:            { label: 'Insurance',          icon: '\uD83D\uDEE1\uFE0F', color: 'cyan' },
  bank_debt_paid:            { label: 'Debt Paid',          icon: '\u2705',        color: 'admin-badge-success' },

  // Shops (warning/gold)
  luckbox_spend:             { label: 'Luckbox',            icon: '\uD83C\uDCCF', color: 'admin-badge-purple' },
  stonebox_spend:            { label: 'Stone Box',          icon: '\uD83D\uDC8E', color: 'cyan' },
  ticket_spend:              { label: 'Tickets',            icon: '\uD83C\uDFAB', color: 'admin-badge-warning' },
  mells_purchase:            { label: 'Mells Shop',         icon: '\uD83D\uDED2', color: 'gold' },
  seluna_purchase:           { label: 'Seluna',             icon: '\uD83C\uDF19', color: 'admin-badge-warning' },
  brimor_purchase:           { label: 'Brimor',             icon: '\uD83D\uDED2', color: 'admin-badge-warning' },
  refund:                    { label: 'Refund',             icon: '\u21A9\uFE0F', color: 'admin-badge-warning' },

  // Marketplace (green/muted)
  marketplace_buy:           { label: 'Market Buy',         icon: '\uD83D\uDED2', color: 'admin-badge-success' },
  marketplace_sell:          { label: 'Market Sell',        icon: '\uD83D\uDCB0', color: 'admin-badge-success' },

  // Transfers
  transfer_send:             { label: 'Transfer',           icon: '\u27A1\uFE0F', color: 'admin-badge-muted' },
  transfer_receive:          { label: 'Received',           icon: '\u2B05\uFE0F', color: 'admin-badge-success' },

  // Cards (purple)
  card_pull:                 { label: 'Card Pull',          icon: '\uD83C\uDCCF', color: 'admin-badge-purple' },
  card_luckbox:              { label: 'Card Luckbox',       icon: '\uD83C\uDCCF', color: 'admin-badge-purple' },
  card_seluna:               { label: 'Card Seluna',        icon: '\uD83C\uDF19', color: 'admin-badge-purple' },
  card_sell:                 { label: 'Card Sold',          icon: '\uD83D\uDCB0', color: 'admin-badge-purple' },
  card_buy:                  { label: 'Card Bought',        icon: '\uD83D\uDED2', color: 'admin-badge-purple' },
  card_auction:              { label: 'Card Auction',       icon: '\uD83D\uDD28', color: 'admin-badge-purple' },
  card_swap:                 { label: 'Card Swap',          icon: '\uD83D\uDD04', color: 'admin-badge-purple' },
  card_gift:                 { label: 'Card Gift',          icon: '\uD83C\uDF81', color: 'admin-badge-purple' },

  // Stones (cyan/blue)
  stone_chest:               { label: 'Stone Chest',        icon: '\uD83D\uDC8E', color: 'cyan' },
  stone_seluna:              { label: 'Stone Seluna',       icon: '\uD83C\uDF19', color: 'cyan' },
  stone_sell:                { label: 'Stone Sold',         icon: '\uD83D\uDCB0', color: 'cyan' },
  stone_buy:                 { label: 'Stone Bought',       icon: '\uD83D\uDED2', color: 'cyan' },
  stone_auction:             { label: 'Stone Auction',      icon: '\uD83D\uDD28', color: 'cyan' },
  stone_swap:                { label: 'Stone Swap',         icon: '\uD83D\uDD04', color: 'cyan' },
  stone_gift:                { label: 'Stone Gift',         icon: '\uD83C\uDF81', color: 'cyan' },
  stone_forbidden_gift:      { label: 'Forbidden Gift',     icon: '\uD83D\uDD25', color: 'red' },

  // Admin
  admin_credit:              { label: 'Admin Credit',       icon: '\uD83D\uDC51', color: 'admin-badge-success' },
  admin_debit:               { label: 'Admin Debit',        icon: '\uD83D\uDC51', color: 'red' },
  admin_refund:              { label: 'Admin Refund',       icon: '\u21A9\uFE0F', color: 'admin-badge-warning' },
  admin_reversal:            { label: 'Admin Reversal',     icon: '\u21A9\uFE0F', color: 'admin-badge-warning' },
  reserve_withdrawal:        { label: 'Reserve Withdraw',   icon: '\uD83C\uDFE6', color: 'gold' },
};

/**
 * Get display info for a transaction type.
 * Falls back to smart category detection for unknown types.
 */
export function getTransactionTypeInfo(type: string): TransactionTypeInfo {
  if (TYPE_MAP[type]) return TYPE_MAP[type];

  // Smart fallbacks by keyword
  if (type.startsWith('card_'))  return { label: type.replace(/_/g, ' '), icon: '\uD83C\uDCCF', color: 'admin-badge-purple' };
  if (type.startsWith('stone_')) return { label: type.replace(/_/g, ' '), icon: '\uD83D\uDC8E', color: 'cyan' };
  if (type.startsWith('bank_'))  return { label: type.replace(/_/g, ' '), icon: '\uD83C\uDFE6', color: 'cyan' };
  if (type.startsWith('admin_')) return { label: type.replace(/_/g, ' '), icon: '\uD83D\uDC51', color: 'admin-badge-warning' };
  if (type.includes('spend') || type.includes('debit') || type.includes('loss'))
    return { label: type.replace(/_/g, ' '), icon: '\uD83D\uDCB8', color: 'red' };
  if (type.includes('credit') || type.includes('earn') || type.includes('win') || type.includes('daily'))
    return { label: type.replace(/_/g, ' '), icon: '\uD83D\uDCB0', color: 'admin-badge-success' };

  return { label: type.replace(/_/g, ' '), icon: '\uD83D\uDD39', color: 'cyan' };
}
