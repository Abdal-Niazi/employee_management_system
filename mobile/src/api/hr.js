import { request } from "./client";

// Everything the HR admin screens need from /api/employees (HR admins only).

const PAGE_SIZE = 100; // the API's maximum

// The API pages its list, so keep asking until every employee is loaded.
export async function getAllEmployees() {
  const all = [];

  for (let page = 1; ; page++) {
    const { employees, pagination } = await request(`/api/employees?page=${page}&pageSize=${PAGE_SIZE}`);
    all.push(...employees);
    if (employees.length === 0 || all.length >= pagination.total) return all;
  }
}

export async function getEmployee(id) {
  const { employee } = await request(`/api/employees/${id}`);
  return employee;
}

export async function createEmployee(data) {
  const { employee } = await request("/api/employees", { method: "POST", body: JSON.stringify(data) });
  return employee;
}

export async function updateEmployee(id, data) {
  const { employee } = await request(`/api/employees/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  return employee;
}

export async function deleteEmployee(id) {
  await request(`/api/employees/${id}`, { method: "DELETE" });
}
