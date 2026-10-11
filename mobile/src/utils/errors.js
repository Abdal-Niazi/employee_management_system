// Turns an ApiError from a save into one message for the form plus per-field messages.
export function describeSaveError(err) {
  const fields = {};
  for (const { field, message } of err.errors ?? []) {
    if (field && !fields[field]) fields[field] = message;
  }

  let message = err.message;
  if (err.status === 422) message = "Please fix the highlighted fields.";
  if (err.status === 409) message = "An employee with this ID or email already exists.";

  return { message, fields };
}
