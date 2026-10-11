import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import Button from "./Button";
import Card from "./Card";
import ManagerPicker from "./ManagerPicker";
import SegmentedControl from "./SegmentedControl";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "terminated", label: "Left" },
];

const EMAIL = /^\S+@\S+\.\S+$/;

function isRealDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function check(values) {
  const errors = {};
  if (!values.employeeId.trim()) errors.employeeId = "Employee ID is required.";
  if (!values.firstName.trim()) errors.firstName = "First name is required.";
  if (!values.lastName.trim()) errors.lastName = "Last name is required.";
  if (!EMAIL.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (!isRealDate(values.hireDate.trim())) errors.hireDate = "Use the format YYYY-MM-DD, e.g. 2026-03-15.";
  return errors;
}

// Empty optional fields are sent as null so editing can clear them.
const orNull = (text) => text.trim() || null;

function Field({ label, error, ...inputProps }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, error && styles.inputError]}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

// Shared by "New employee" and "Edit employee". `initial` is the saved employee when editing.
export default function EmployeeForm({ initial, managers, submitLabel, submitting, error, serverErrors, onSubmit }) {
  const [values, setValues] = useState({
    employeeId: initial?.employeeId ?? "",
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    department: initial?.department ?? "",
    position: initial?.position ?? "",
    hireDate: initial?.hireDate ? initial.hireDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    status: initial?.status ?? "active",
    managerId: initial?.managerId ?? null,
  });
  const [errors, setErrors] = useState({});

  const set = (key) => (value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Local problems show first; after the server replies, its per-field messages fill the gaps.
  const fieldError = (key) => errors[key] ?? serverErrors?.[key];

  const handleSubmit = () => {
    const found = check(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit({
      employeeId: values.employeeId.trim(),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      phone: orNull(values.phone),
      department: orNull(values.department),
      position: orNull(values.position),
      hireDate: values.hireDate.trim(),
      status: values.status,
      managerId: values.managerId,
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Card title="Basic details">
          <Field
            label="Employee ID"
            value={values.employeeId}
            onChangeText={set("employeeId")}
            error={fieldError("employeeId")}
            placeholder="EMP-001"
            autoCapitalize="characters"
          />
          <Field
            label="First name"
            value={values.firstName}
            onChangeText={set("firstName")}
            error={fieldError("firstName")}
            autoCapitalize="words"
          />
          <Field
            label="Last name"
            value={values.lastName}
            onChangeText={set("lastName")}
            error={fieldError("lastName")}
            autoCapitalize="words"
          />
          <Field
            label="Email"
            value={values.email}
            onChangeText={set("email")}
            error={fieldError("email")}
            placeholder="name@company.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Field
            label="Phone (optional)"
            value={values.phone}
            onChangeText={set("phone")}
            error={fieldError("phone")}
            keyboardType="phone-pad"
          />
        </Card>

        <Card title="Job">
          <Field
            label="Department (optional)"
            value={values.department}
            onChangeText={set("department")}
            error={fieldError("department")}
            autoCapitalize="words"
          />
          <Field
            label="Position (optional)"
            value={values.position}
            onChangeText={set("position")}
            error={fieldError("position")}
            autoCapitalize="words"
          />
          <Field
            label="Hire date"
            value={values.hireDate}
            onChangeText={set("hireDate")}
            error={fieldError("hireDate")}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
          <View style={styles.field}>
            <Text style={styles.label}>Status</Text>
            <SegmentedControl options={STATUS_OPTIONS} value={values.status} onChange={set("status")} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Manager (optional)</Text>
            <ManagerPicker value={values.managerId} options={managers} onChange={set("managerId")} />
            {fieldError("managerId") ? <Text style={styles.error}>{fieldError("managerId")}</Text> : null}
          </View>
        </Card>

        {error ? <Text style={styles.formError}>{error}</Text> : null}

        <Button title={submitLabel} onPress={handleSubmit} loading={submitting} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  field: { marginTop: spacing.md, gap: spacing.xs },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13 },
  formError: { color: colors.danger, fontSize: 14, textAlign: "center" },
});
