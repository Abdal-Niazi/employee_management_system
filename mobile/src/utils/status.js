// Label + colour tone for every status the screens show (HR, manager and employee).
const STATUS = {
  // Employee.status
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  terminated: { label: "Terminated", tone: "danger" },
  // Attendance
  PRESENT: { label: "Present", tone: "success" },
  LATE: { label: "Late", tone: "warning" },
  ABSENT: { label: "Absent", tone: "danger" },
  ON_LEAVE: { label: "On leave", tone: "info" },
  NOT_IN: { label: "Not in yet", tone: "neutral" },
  OFF: { label: "Off", tone: "neutral" },
  // Someone whose employee record isn't active: not expected at work
  INACTIVE: { label: "Inactive", tone: "neutral" },
  // Leave requests
  PENDING: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export function statusInfo(status) {
  return STATUS[status] ?? { label: status ?? "Unknown", tone: "neutral" };
}

export function fullName(employee) {
  return `${employee.firstName} ${employee.lastName}`.trim();
}
