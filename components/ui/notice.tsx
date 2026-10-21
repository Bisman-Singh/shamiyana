import type { ReactNode } from "react";

/**
 * Inline messages. Errors use role="alert" so they are announced at once;
 * everything else is a polite status. Messages are never only a toast: they
 * sit next to the thing they are about and stay until dismissed or fixed.
 */
export function Notice({
  tone = "info",
  children,
  action,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <p>{children}</p>
      {action}
    </div>
  );
}
