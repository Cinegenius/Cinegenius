type NamedDirectoryEntry = {
  id: string;
  name: string;
};

export function compareCreatorNames(
  left: NamedDirectoryEntry,
  right: NamedDirectoryEntry,
  locale = "de",
) {
  const byName = left.name.localeCompare(right.name, locale, {
    sensitivity: "base",
    numeric: true,
  });

  return byName || left.id.localeCompare(right.id, locale, { numeric: true });
}
