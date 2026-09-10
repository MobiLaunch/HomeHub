import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useLive<T>(url: string, refreshIntervalMs = 45_000) {
  return useSWR<T>(url, fetcher, {
    refreshInterval: refreshIntervalMs,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
}
