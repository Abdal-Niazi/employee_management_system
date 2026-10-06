import { request } from "./client";

export async function getEmployees() {
  const { employees } = await request("/api/employees");
  return employees;
}
