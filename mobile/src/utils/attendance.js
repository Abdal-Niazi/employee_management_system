// The counts shown above an attendance list (manager and HR). "Not in yet" only appears while
// someone is still expected today, so the numbers add up to everyone who is expected at work.
const SUMMARY = ["PRESENT", "LATE", "ABSENT", "ON_LEAVE"];

export function summaryKeys(counts) {
  return counts.NOT_IN > 0 ? [...SUMMARY, "NOT_IN"] : SUMMARY;
}

// One line under a name: what happened that day.
export function describeRecord(record, shift) {
  switch (record.status) {
    case "PRESENT":
    case "LATE":
      return `In ${record.checkIn} · Out ${record.checkOut ?? "—"}`;
    case "ON_LEAVE":
      return "Approved leave";
    case "ABSENT":
      return "No check-in";
    case "INACTIVE":
      return "Not active";
    case "NOT_IN":
      return `Shift starts ${shift.start}`;
    default:
      return "No shift";
  }
}
