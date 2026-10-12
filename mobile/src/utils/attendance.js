// The four counts shown above an attendance list.
export const ATTENDANCE_SUMMARY = ["PRESENT", "LATE", "ABSENT", "ON_LEAVE"];

// One line under a name: what happened that day.
export function describeRecord(record) {
  switch (record.status) {
    case "PRESENT":
    case "LATE":
      return `In ${record.checkIn} · Out ${record.checkOut ?? "—"}`;
    case "ON_LEAVE":
      return "Approved leave";
    case "ABSENT":
      return "No check-in";
    case "NOT_IN":
      return `Shift starts ${record.shift.start}`;
    default:
      return "No shift";
  }
}
