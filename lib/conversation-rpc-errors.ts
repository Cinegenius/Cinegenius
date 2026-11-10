type RpcError = {code?: unknown; message?: unknown} | null | undefined;
type PublicFailure = {key: string; status: number};

// Legacy RPCs use P0001 for every known failure. These exact protocol strings
// select catalog keys only; database text is never returned or logged.
const CREATE_FAILURES = new Map<string, PublicFailure>([
  ["Der Gruppenname muss 1 bis 80 Zeichen lang sein.", {key: "System.m_027e01fb54de", status: 400}],
  ["Ersteller fehlt.", {key: "System.requestFailed", status: 400}],
  ["Wähle 1 bis 49 weitere Mitglieder aus.", {key: "System.m_286903b7c95b", status: 400}],
  ["Mindestens ein ausgewähltes Profil ist nicht verfügbar.", {key: "System.m_c720b974c036", status: 400}],
]);
const MANAGE_FAILURES = new Map<string, PublicFailure>([
  ["Gruppe nicht gefunden.", {key: "System.m_5e38bf9cacea", status: 404}],
  ["Du bist kein aktives Gruppenmitglied.", {key: "System.groupMemberInactive", status: 400}],
  ["Du bist der letzte Admin. Füge zuerst ein weiteres Mitglied hinzu, bevor du die Gruppe verlässt.", {key: "System.groupLastAdminLeave", status: 400}],
  ["Nur Gruppenadmins dürfen diese Aktion ausführen.", {key: "System.m_5dbac5f6146d", status: 403}],
  ["Der Gruppenname muss 1 bis 80 Zeichen lang sein.", {key: "System.m_027e01fb54de", status: 400}],
  ["Mitglied ist ungültig.", {key: "System.m_d1d8af738c94", status: 400}],
  ["Profil ist nicht verfügbar.", {key: "System.m_87f41d11f8cb", status: 400}],
  ["Mitglied ist bereits in der Gruppe.", {key: "System.groupMemberAlreadyPresent", status: 400}],
  ["Zum Verlassen nutze die Gruppenfunktion „Gruppe verlassen“.", {key: "System.groupLeaveOwnAction", status: 400}],
  ["Mitglied nicht gefunden.", {key: "System.m_a8e5f4f1aff8", status: 404}],
  ["Der letzte Admin kann nicht entfernt werden.", {key: "System.groupLastAdminRemove", status: 400}],
  ["Aktion nicht unterstützt.", {key: "System.m_5b077741e504", status: 400}],
]);

export function groupRpcFailure(error: RpcError, operation: "create" | "manage"): PublicFailure {
  const failures = operation === "create" ? CREATE_FAILURES : MANAGE_FAILURES;
  if ((error?.code === "P0001" || error?.code === undefined) && typeof error?.message === "string") {
    const known = failures.get(error.message);
    if (known) return known;
  }
  if (error?.code === "42501") return {key: "System.m_cd2f7b0a21cd", status: 403};
  if (error?.code === "P0002") return {key: operation === "manage" ? "System.m_5e38bf9cacea" : "System.m_c720b974c036", status: 404};
  // Preserve the existing generic RPC-failure HTTP contract; never echo details.
  return {key: "System.requestFailed", status: 400};
}
