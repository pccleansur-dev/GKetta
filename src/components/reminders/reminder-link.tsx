"use client";

type ReminderLinkProps = {
  href: string;
  accountId: string;
  customerId: string;
  reminderType: string;
  messagePreview: string;
};

export function ReminderLink({
  href,
  accountId,
  customerId,
  reminderType,
  messagePreview,
}: ReminderLinkProps) {
  function handleClick() {
    void fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, customerId, reminderType, whatsappLink: href, messagePreview }),
    });
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={handleClick}
      className="rounded-full bg-[var(--primary)] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
    >
      Abrir en WhatsApp
    </a>
  );
}
