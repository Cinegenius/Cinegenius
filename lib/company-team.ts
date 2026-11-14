import { publicTitlesForMember } from "./company-roles";

type PublicMember = {
  id: string;
  status: string;
  title?: string | null;
  public_titles?: string[];
  profile: { display_name: string } | null;
};

// Public functions describe the company. They never confer account permissions.
// Match complete known titles, not substrings (e.g. an assistant to the CEO).
const LEADERSHIP_TITLES = new Set([
  "gründer/in", "gründer", "gründerin", "mitgründer/in", "mitgründer", "mitgründerin",
  "inhaber/in", "inhaber", "inhaberin", "geschäftsführer/in", "geschäftsführer", "geschäftsführerin",
  "geschäftsführung", "founder", "co-founder", "cofounder", "owner", "ceo", "managing director",
]);

function publicFunctionRank(member: PublicMember): number {
  return Math.min(3, ...publicTitlesForMember(member.public_titles, member.title).map(title => {
    const normalized = title.toLocaleLowerCase("de");
    if (LEADERSHIP_TITLES.has(normalized)) return 0;
    if (["abteilungsleitung", "department head"].includes(normalized)) return 1;
    if (["projektleitung", "project lead"].includes(normalized)) return 2;
    return 3;
  }));
}

export function groupPublicCompanyTeam<T extends PublicMember>(members: readonly T[], locale: string) {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const leadership: T[] = [], team: T[] = [];
  for (const member of members) {
    if (member.status !== "accepted" || !member.profile) continue;
    const destination = publicFunctionRank(member) < 3 ? leadership : team;
    destination.push(member);
  }
  // Equal functions stay equal: alphabetical order, independent of join date.
  const compare = (a: T, b: T) => publicFunctionRank(a) - publicFunctionRank(b) || collator.compare(a.profile!.display_name, b.profile!.display_name) || a.id.localeCompare(b.id);
  return { leadership: leadership.sort(compare), team: team.sort(compare) };
}
