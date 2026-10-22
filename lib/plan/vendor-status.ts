import { VENDOR_STATUSES, type VendorStatus } from "./constants";

/** Whether a status counts as secured: booked or further along. */
export function isSecured(status: VendorStatus): boolean {
  return VENDOR_STATUSES.indexOf(status) >= VENDOR_STATUSES.indexOf("booked");
}
