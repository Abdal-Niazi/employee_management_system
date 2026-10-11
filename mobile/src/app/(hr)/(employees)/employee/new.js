import { useRouter } from "expo-router";
import { useState } from "react";
import { createEmployee, getAllEmployees } from "../../../../api/hr";
import EmployeeForm from "../../../../components/EmployeeForm";
import { ErrorState, LoadingState } from "../../../../components/States";
import { useAsync } from "../../../../hooks/useAsync";
import { describeSaveError } from "../../../../utils/errors";

export default function NewEmployeeScreen() {
  const router = useRouter();
  // The existing employees, so a manager can be picked.
  const { status, data, error, reload } = useAsync(getAllEmployees);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState({ message: "", fields: {} });

  if (status === "loading") return <LoadingState />;
  if (status === "error") return <ErrorState error={error} onRetry={reload} />;

  const handleSubmit = async (payload) => {
    setSaving(true);
    setProblem({ message: "", fields: {} });
    try {
      const employee = await createEmployee(payload);
      // Replace this screen, so Back from the new employee goes to the list.
      router.replace(`/employee/${employee.id}`);
    } catch (err) {
      setProblem(describeSaveError(err));
      setSaving(false);
    }
  };

  return (
    <EmployeeForm
      managers={data.filter((e) => e.status !== "terminated")}
      submitLabel="Add employee"
      submitting={saving}
      error={problem.message}
      serverErrors={problem.fields}
      onSubmit={handleSubmit}
    />
  );
}
