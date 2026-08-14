export type CatalogPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function catalogQueryFromSearchParams(searchParams: CatalogPageSearchParams) {
  const params = await searchParams;
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  const page = Number(value("page") ?? "1");
  return {
    search: value("search") ?? "",
    page: Number.isFinite(page) && page > 0 ? page : 1
  };
}
