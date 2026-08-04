import type { DocumentType } from "./application.js";

export function normalizeDocumentNumber(
  _documentType: DocumentType,
  value: string,
): string {
  return value.trim().toUpperCase();
}

export function normalizeHumanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const prefix = trimmed.startsWith("+") ? "+" : "";
  return `${prefix}${trimmed.replace(/\D/g, "")}`;
}

export function normalizeEmail(value: string): string {
  const trimmed = value.trim();
  const separator = trimmed.lastIndexOf("@");
  if (separator < 0) return trimmed;
  return `${trimmed.slice(0, separator)}@${trimmed.slice(separator + 1).toLowerCase()}`;
}

export function normalizeFreeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
