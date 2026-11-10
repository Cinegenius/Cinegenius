export type SupportTemplateTarget = {
  editUrl: string;
  firstName: string | null;
  missingFields: string[];
  listingTitle: string | null;
  targetLabel: string;
  companyName: string | null;
};

export const SUPPORT_PLACEHOLDER_KEYS = new Set([
  "Vorname", "fehlendeAngaben", "Bearbeitungslink", "Inserattitel", "Firmenname",
]);

export function fillSupportTemplate(body: string, target: SupportTemplateTarget, origin: string): string {
  const values: Record<string, string> = {
    Vorname: target.firstName ?? "",
    fehlendeAngaben: target.missingFields.join(", "),
    Bearbeitungslink: new URL(target.editUrl, origin).toString(),
    Inserattitel: target.listingTitle ?? target.targetLabel,
    Firmenname: target.companyName ?? target.targetLabel,
  };
  const filled = body.replace(/\{\{([^}]+)\}\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? values[key] : match,
  );
  return target.firstName ? filled : filled.replace(/(Hallo|Hello|Hola|Ciao|Dobrý den|Kedves|Hej|Dag|Beste)\s+,/g, "$1,").replace(/Hallo\s+bei/g, "Hallo, bei");
}

export function validateSupportTemplateBody(body: string, translate?: (key: string, values?: Record<string, string>) => string): string | null {
  if (typeof body !== "string" || body.trim().length < 1 || body.length > 5000) {
    return translate ? translate("ServerCopy.s_a7e71b0fe03c") : "Der Nachrichtentext muss 1 bis 5.000 Zeichen lang sein.";
  }
  const tokens = [...body.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]);
  const unknown = tokens.find((token) => !SUPPORT_PLACEHOLDER_KEYS.has(token));
  return unknown ? translate ? translate("ServerCopy.s_95f2e9c24c54", { token: "{{" + unknown + "}}" }) : "Unbekannter Platzhalter: {{" + unknown + "}}" : null;
}
