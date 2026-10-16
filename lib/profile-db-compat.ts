export interface ProfileDbError {
  code?: string;
  message?: string;
}

export function isMissingProfileColumn(error: ProfileDbError | null | undefined): boolean {
  return error?.code === "PGRST204" || error?.code === "42703" ||
    /could not find the .* column|column .* does not exist/i.test(error?.message ?? "");
}

export function missingProfileColumnName(error: ProfileDbError | null | undefined): string | null {
  const message = error?.message ?? "";
  const match = message.match(/Could not find the ['"]([^'"]+)['"] column/i)
    ?? message.match(/\bcolumn\s+(?:[\w]+\.)?['"]?([\w]+)['"]?\s+does not exist/i);
  return match?.[1] ?? null;
}

function hasOptionalValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value).some(hasOptionalValue);
  return value !== false && value !== 0;
}

/**
 * Retries a profile operation after removing only an optional column that the
 * connected database does not know yet. Required-column errors still fail.
 */
export async function retryWithoutMissingOptionalProfileColumns<T>(
  initialPayload: Record<string, unknown>,
  optionalColumns: ReadonlySet<string>,
  operation: (payload: Record<string, unknown>) => Promise<{ data: T | null; error: ProfileDbError | null }>,
): Promise<{ data: T | null; error: ProfileDbError | null; unavailableFields: string[] }> {
  let payload = { ...initialPayload };
  const unavailableFields: string[] = [];

  for (let attempt = 0; attempt <= optionalColumns.size; attempt++) {
    const result = await operation(payload);
    if (!result.error) return { ...result, unavailableFields };
    if (!isMissingProfileColumn(result.error)) return { ...result, unavailableFields };

    const missingColumn = missingProfileColumnName(result.error);
    if (!missingColumn || !optionalColumns.has(missingColumn) || !(missingColumn in payload)) {
      return { ...result, unavailableFields };
    }

    if (hasOptionalValue(payload[missingColumn])) unavailableFields.push(missingColumn);
    const nextPayload = { ...payload };
    delete nextPayload[missingColumn];
    payload = nextPayload;
  }

  return {
    data: null,
    error: { message: "Profil konnte wegen nicht verfügbarer Datenbankfelder nicht gespeichert werden." },
    unavailableFields,
  };
}

/** Reads optional columns one by one only when the schema supports them. */
export async function selectOptionalProfileColumns<T extends Record<string, unknown>>(
  columns: readonly string[],
  select: (projection: string) => Promise<{ data: T | null; error: ProfileDbError | null }>,
): Promise<{ data: T | null; error: ProfileDbError | null; unavailableFields: string[] }> {
  let remaining = [...columns];
  const unavailableFields: string[] = [];

  while (remaining.length > 0) {
    const result = await select(remaining.join(", "));
    if (!result.error) return { ...result, unavailableFields };
    if (!isMissingProfileColumn(result.error)) return { ...result, unavailableFields };

    const missingColumn = missingProfileColumnName(result.error);
    if (!missingColumn || !remaining.includes(missingColumn)) {
      return { ...result, unavailableFields };
    }
    unavailableFields.push(missingColumn);
    remaining = remaining.filter((column) => column !== missingColumn);
  }

  return { data: null, error: null, unavailableFields };
}
