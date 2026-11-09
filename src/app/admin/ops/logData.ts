export interface AgentLogs {
  logs?: string;
  out?: string;
  err?: string;
  lines?: string[];
}

export function readAgentLogs(data: AgentLogs): string {
  const text = Array.isArray(data.lines)
    ? data.lines.join('\n')
    : typeof data.logs === 'string'
      ? data.logs
      : [data.out, data.err].filter(Boolean).join('\n');
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}
