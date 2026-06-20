export type UpstreamProbe = {
  url: string;
  ok: boolean;
  status?: number;
  error?: string;
};

export async function probeUpstream(baseUrl: string, timeoutMs = 2500): Promise<UpstreamProbe> {
  const url = baseUrl.replace(/\/$/, '');
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { url, ok: res.status < 500, status: res.status };
  } catch (e) {
    return {
      url,
      ok: false,
      error: e instanceof Error ? e.message : 'unreachable',
    };
  }
}
