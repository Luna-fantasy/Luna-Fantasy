import { strict as assert } from 'node:assert';
import test from 'node:test';
import { canChooseLoanTier, loanQuote } from '../src/lib/bank/loan-quote';

test('the loan preview retains the tier rate and rounds only the interest', () => {
  assert.deepEqual(loanQuote(5_000, 0.1275), { interest: 637, repayment: 5_637 });
  assert.deepEqual(loanQuote(10_000, 0.085), { interest: 850, repayment: 10_850 });
  assert.deepEqual(loanQuote(137, 0), { interest: 0, repayment: 137 });
});

test('ordinary tiers require their own level and passport tiers require a passport', () => {
  const tier = { level: 8, amount: 5_000, interest: 0.1275, duration: 259_200_000 };
  assert.equal(canChooseLoanTier(tier, 7, true), false);
  assert.equal(canChooseLoanTier(tier, 8, false), true);
  assert.equal(canChooseLoanTier({ ...tier, passport_required: true }, 0, true), true);
  assert.equal(canChooseLoanTier({ ...tier, passport_required: true }, 20, false), false);
  assert.equal(canChooseLoanTier(undefined, 0, true), false);
});
