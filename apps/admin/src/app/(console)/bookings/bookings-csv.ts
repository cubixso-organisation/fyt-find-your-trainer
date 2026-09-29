import type { BookingRow } from "@/lib/data/queries";
import type { BookingTarget } from "@/lib/data/types";
import { BOOKING_STATUS } from "@/components/ui/status";
import { fmtDateTime } from "@/lib/utils";

/** Human label per booking type. Shared by the table, the calendar and the export. */
export const TARGET_LABEL: Record<BookingTarget, string> = {
  course: "Course demo",
  trainer: "Trainer 1-on-1",
  mentor: "Mentorship",
  consultant: "Consultation",
};

/**
 * Same escaping as the learners and audit exports: quote a field only when it
 * holds a quote, comma or line break, doubling any quotes inside.
 */
function csvEscape(v: string) {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const HEAD = [
  "ref",
  "start_iso",
  "start_ist",
  "end_iso",
  "status",
  "type",
  "listing",
  "learner_name",
  "learner_phone",
  "learner_segment",
  "mode",
  "meet_link",
  "offline_address",
  "cancel_reason",
  "created_iso",
];

export function bookingsCsv(rows: BookingRow[]) {
  const lines = rows.map((r) =>
    [
      r.ref,
      new Date(r.start).toISOString(),
      `${fmtDateTime(r.start)} IST`,
      new Date(r.end).toISOString(),
      BOOKING_STATUS[r.status].label,
      TARGET_LABEL[r.targetType],
      r.targetName,
      r.learnerName,
      r.learnerPhone,
      r.learnerSegment === "corporate" ? "Corporate" : "Student",
      r.mode === "online" ? "Online" : "In person",
      r.meetLink ?? "",
      r.offlineAddress ?? "",
      r.cancelledReason ?? "",
      new Date(r.createdAt).toISOString(),
    ]
      .map(csvEscape)
      .join(","),
  );
  return [HEAD.join(","), ...lines].join("\n");
}

/** Downloads `bookings-YYYY-MM-DD.csv` (IST date). Call from an event handler only. */
export function downloadBookingsCsv(rows: BookingRow[]) {
  const istDate = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bookingsCsv(rows)], { type: "text/csv" }));
  a.download = `bookings-${istDate}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
