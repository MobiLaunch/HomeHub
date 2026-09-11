import useSWR from "swr";

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request to ${url} failed with ${res.status}`);
  }
  return res.json();
}

export function useLive<T>(url: string, refreshIntervalMs = 45_000) {
  return useSWR<T>(url, fetcher, {
    refreshInterval: refreshIntervalMs,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
}
