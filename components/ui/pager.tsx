import { withQuery } from "@/lib/url";
import { LinkButton } from "./button";

// 一覧は1ページ50件 (6-3). Plain links, so the page works without scripts.
export function Pager({
  basePath,
  page,
  hasNext,
  params = {},
}: {
  basePath: string;
  page: number;
  hasNext: boolean;
  params?: Record<string, string | null | undefined>;
}) {
  if (page <= 1 && !hasNext) return null;
  return (
    <nav
      aria-label="ページ送り"
      className="mt-4 flex items-center justify-end gap-2"
    >
      {page > 1 && (
        <LinkButton
          size="sm"
          href={withQuery(basePath, { ...params, page: page - 1 || null })}
        >
          前へ
        </LinkButton>
      )}
      <span className="text-xs text-muted">{page}ページ</span>
      {hasNext && (
        <LinkButton
          size="sm"
          href={withQuery(basePath, { ...params, page: page + 1 })}
        >
          次へ
        </LinkButton>
      )}
    </nav>
  );
}
