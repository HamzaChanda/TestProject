"use client";

/**
 * List view state (search, filters, sort, page, page size) persisted in the URL
 * so reload, back/forward and returning from a detail page restore the view.
 *
 * - Writes use history.replaceState (Next.js keeps useSearchParams in sync and
 *   no server round-trip happens), so typing in search never adds history entries.
 * - Every param is validated: unknown filter values, sort keys, page sizes or
 *   non-numeric pages silently fall back to their defaults.
 * - Params the hook does not own are preserved.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export interface ListStateConfig<F extends string> {
  /** Allowed values per filter; the first entry is the default. `null` = free text (e.g. dates). */
  filters: Record<F, readonly string[] | null>;
  /** Defaults for free-text filters. */
  filterDefaults?: Partial<Record<F, string>>;
  sortKeys: readonly string[];
  defaultSort: { key: string; dir: "asc" | "desc" };
  pageSizes: readonly number[];
}

export interface ListState<F extends string> {
  q: string;
  filters: Record<F, string>;
  sort: { key: string; dir: "asc" | "desc" };
  page: number;
  size: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parse<F extends string>(sp: URLSearchParams, c: ListStateConfig<F>): ListState<F> {
  const filters = {} as Record<F, string>;
  for (const key of Object.keys(c.filters) as F[]) {
    const allowed = c.filters[key];
    const raw = sp.get(key);
    if (allowed) filters[key] = raw !== null && allowed.includes(raw) ? raw : allowed[0];
    else filters[key] = raw !== null && ISO_DATE.test(raw) ? raw : (c.filterDefaults?.[key] ?? "");
  }
  const sortRaw = sp.get("sort") ?? "";
  const [sk, sd] = sortRaw.split(":");
  const sort = c.sortKeys.includes(sk) && (sd === "asc" || sd === "desc") ? { key: sk, dir: sd as "asc" | "desc" } : c.defaultSort;
  const pageN = Number(sp.get("page"));
  const sizeN = Number(sp.get("size"));
  return {
    q: (sp.get("q") ?? "").slice(0, 120),
    filters,
    sort,
    page: Number.isInteger(pageN) && pageN >= 1 && pageN <= 10_000 ? pageN : 1,
    size: c.pageSizes.includes(sizeN) ? sizeN : c.pageSizes[0],
  };
}

function serialize<F extends string>(st: ListState<F>, c: ListStateConfig<F>, base: URLSearchParams) {
  const sp = new URLSearchParams(base);
  const set = (k: string, v: string, def: string) => (v && v !== def ? sp.set(k, v) : sp.delete(k));
  set("q", st.q.trim() ? st.q : "", "");
  for (const key of Object.keys(c.filters) as F[]) {
    const allowed = c.filters[key];
    set(key, st.filters[key], allowed ? allowed[0] : (c.filterDefaults?.[key] ?? ""));
  }
  const s = `${st.sort.key}:${st.sort.dir}`;
  set("sort", s, `${c.defaultSort.key}:${c.defaultSort.dir}`);
  set("page", String(st.page), "1");
  set("size", String(st.size), String(c.pageSizes[0]));
  return sp.toString();
}

export function useListState<F extends string>(config: ListStateConfig<F>) {
  const params = useSearchParams();
  const pathname = usePathname();
  const [state, setState] = useState<ListState<F>>(() => parse(new URLSearchParams(params.toString()), config));
  const lastQs = useRef(params.toString());

  // URL changed from outside (back/forward, a link with params) → adopt it.
  useEffect(() => {
    const qs = params.toString();
    if (qs === lastQs.current) return;
    lastQs.current = qs;
    setState(parse(new URLSearchParams(qs), config));
  }, [params, config]);

  // State changed → write the URL (no new history entry).
  useEffect(() => {
    const qs = serialize(state, config, new URLSearchParams(window.location.search));
    if (qs === lastQs.current) return;
    lastQs.current = qs;
    window.history.replaceState(window.history.state, "", qs ? `${pathname}?${qs}` : pathname);
  }, [state, config, pathname]);

  const setQ = useCallback((q: string) => setState((s) => ({ ...s, q, page: 1 })), []);
  const setFilter = useCallback((key: F, value: string) => setState((s) => ({ ...s, filters: { ...s.filters, [key]: value }, page: 1 })), []);
  const setFilters = useCallback((patch: Partial<Record<F, string>>) => setState((s) => ({ ...s, filters: { ...s.filters, ...patch }, page: 1 })), []);
  const setSort = useCallback((sort: { key: string; dir: "asc" | "desc" }) => setState((s) => ({ ...s, sort, page: 1 })), []);
  const setPage = useCallback((page: number) => setState((s) => ({ ...s, page })), []);
  const setSize = useCallback((size: number) => setState((s) => ({ ...s, size, page: 1 })), []);
  const reset = useCallback(() => setState((s) => ({ ...parse(new URLSearchParams(), config), sort: s.sort, size: s.size })), [config]);

  const isFiltered = useMemo(() => {
    const d = parse(new URLSearchParams(), config);
    return !!state.q.trim() || (Object.keys(config.filters) as F[]).some((k) => state.filters[k] !== d.filters[k]);
  }, [state, config]);

  return { ...state, setQ, setFilter, setFilters, setSort, setPage, setSize, reset, isFiltered };
}
