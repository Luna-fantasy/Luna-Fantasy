const VPS_AGENT_URL = process.env.VPS_AGENT_URL ?? '';
const VPS_AGENT_KEY = process.env.VPS_AGENT_KEY || '';

interface AgentFetchOptions {
  method?: string;
  body?: any;
  timeout?: number;
}

interface AgentResponse<T = any> {
  ok: boolean;
  status: number;
  data: T;
}

/**
 * Fetch helper for the VPS agent. Adds Bearer auth and handles timeouts.
 */
export async function agentFetch<T = any>(
  path: string,
  options: AgentFetchOptions = {}
): Promise<AgentResponse<T>> {
  const { method = 'GET', body, timeout = 15000 } = options;

  if (!VPS_AGENT_URL) {
    return { ok: false, status: 0, data: { error: 'VPS_AGENT_URL not configured' } as any };
  }

  if (!VPS_AGENT_KEY) {
    return { ok: false, status: 0, data: { error: 'VPS_AGENT_KEY not configured' } as any };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${VPS_AGENT_URL}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${VPS_AGENT_KEY}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: data as T };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, status: 0, data: { error: 'Request timed out' } as any };
    }
    return { ok: false, status: 0, data: { error: err.message } as any };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check if VPS agent is reachable.
 */
export async function isAgentOnline(): Promise<boolean> {
  const res = await agentFetch('/health', { timeout: 5000 });
  return res.ok;
}
