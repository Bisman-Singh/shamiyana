import type { ReactNode } from "react";

interface NoticeProps {
  tone?: "info" | "error" | "success";
  children: ReactNode;
  action?: ReactNode;
}

/**
 * Inline messages. Errors use role="alert" so they are announced at once;
 * other messages are announced once through the shared live region by
 * whoever shows them. Messages are never only a toast: they sit next to the
 * thing they are about and stay until dismissed or fixed.
 */
export function Notice({ tone = "info", children, action }: Readonly<NoticeProps>) {
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : undefined}>
      <p>{children}</p>
      {action}
    </div>
  );
}
