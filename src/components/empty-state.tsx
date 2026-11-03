import Link from "@/components/release-provider";
export function EmptyState({
  title,
  description,
  action = true,
}: {
  title: string;
  description: string;
  action?: boolean;
}) {
  return (
    <section className="empty panel" aria-label={title}>
      <span className="empty-icon" aria-hidden="true">
        ◇
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <Link className="button secondary" href="/players">
          선수 탐색으로 이동
        </Link>
      )}
    </section>
  );
}
