export function FeedbackBanner({
  error,
  notice,
}: {
  error?: string;
  notice?: string;
}) {
  if (!error && !notice) {
    return null;
  }

  return (
    <div
      className={`rounded-[22px] border px-4 py-3 text-sm ${
        error
          ? "border-[rgba(168,106,97,0.28)] bg-[rgba(168,106,97,0.08)] text-[var(--danger)]"
          : "border-[rgba(93,143,108,0.28)] bg-[rgba(93,143,108,0.08)] text-[var(--success)]"
      }`}
    >
      {error ?? notice}
    </div>
  );
}
