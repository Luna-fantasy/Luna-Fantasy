import assert from 'node:assert/strict';
import test from 'node:test';

const adapter = await import('../src/app/admin/ops/logData.ts').catch(() => ({}));

test('renders the log payload returned by the VPS agent without terminal colour escapes', () => {
  assert.equal(typeof adapter.readAgentLogs, 'function', 'agent log normalization is required');
  assert.equal(adapter.readAgentLogs({ logs: '\u001b[31merror\u001b[39m\n' }), 'error\n');
});

test('continues to support line arrays and separate stdout and stderr', () => {
  assert.equal(typeof adapter.readAgentLogs, 'function', 'agent log normalization is required');
  assert.equal(adapter.readAgentLogs({ lines: ['one', 'two'] }), 'one\ntwo');
  assert.equal(adapter.readAgentLogs({ out: 'ready', err: 'error' }), 'ready\nerror');
});
