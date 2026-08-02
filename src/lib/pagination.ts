/**
 * Reusable pagination helpers for list endpoints.
 *
 * Every list endpoint should accept `page` / `limit` query params and
 * respond with a consistent `{ data, meta }` envelope:
 *
 *   {
 *     data: T[],
 *     meta: { page, limit, total, next_page, has_more }
 *   }
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  next_page: number | null;
  has_more: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
}

/** Parse and clamp `page` / `limit` from query params. */
export function parsePagination(query: any): ParsedPagination {
  const rawPage = parseInt(query?.page, 10);
  const rawLimit = parseInt(query?.limit, 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;

  return { page, limit, skip: (page - 1) * limit };
}

/** Build the pagination metadata for a known total. */
export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const next_page = page * limit < total ? page + 1 : null;
  return {
    page,
    limit,
    total,
    next_page,
    has_more: next_page !== null,
  };
}

/** Wrap items + meta into the standard paginated envelope. */
export function paginate<T>(data: T[], page: number, limit: number, total: number): PaginatedResponse<T> {
  return { data, meta: buildPaginationMeta(page, limit, total) };
}
