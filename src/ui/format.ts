/** Date-only source values stay date-only; timestamps are always presented in KST. */
export function formatKst(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value} (KST 기준일)`;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "기준일 미확인";
  return (
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date) + " KST"
  );
}
