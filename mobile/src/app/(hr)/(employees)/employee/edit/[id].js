import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { getAllEmployees, getEmployee, updateEmployee } from "../../../../../api/hr";
import EmployeeForm from "../../../../../components/EmployeeForm";
import { ErrorState, LoadingState } from "../../../../../components/States";
import { useAsync } from "../../../../../hooks/useAsync";
import { describeSaveError } from "../../../../../utils/errors";

export default function EditEmployeeScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const load = useCallback(async () => {
    const [employee, all] = await Promise.all([getEmployee(id), getAllEmployees()]);
    return { employee, all };
  }, [id]);
  const { status, data, error, reload } = useAsync(load);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState({ message: "", fields: {} });

  if (status === "loading") return <LoadingState />;
  if (status === "error") return <ErrorState error={error} onRetry={reload} />;

  const { employee, all } = data;
  // Not themselves, and not someone who has left (unless they are the current manager).
  const managers = all.filter((e) => e.id !== employee.id && (e.status !== "terminated" || e.id === employee.managerId));

  const handleSubmit = async (payload) => {
    setSaving(true);
    setProblem({ message: "", fields: {} });
    try {
      await updateEmployee(employee.id, payload);
      router.back();
    } catch (err) {
      setProblem(describeSaveError(err));
      setSaving(false);
    }
  };

  return (
    <EmployeeForm
      initial={employee}
      managers={managers}
      submitLabel="Save changes"
      submitting={saving}
      error={problem.message}
      serverErrors={problem.fields}
      onSubmit={handleSubmit}
    />
  );
}
