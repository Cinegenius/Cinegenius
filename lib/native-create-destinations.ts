import type { SiteNavigationIcon } from "./site-navigation";

/** Existing guarded forms remain the sole editors and publication gates. */
export const NATIVE_CREATE_DESTINATIONS: readonly { id: string; href: string; label: string; icon: SiteNavigationIcon }[] = [
  { id: "marketplace", href: "/inserat?group=marktplatz", label: "Genie.destinations.create", icon: "marketplace" },
  { id: "locations", href: "/inserat?group=drehorte", label: "locations.heroCta", icon: "locations" },
  { id: "jobs", href: "/inserat?group=jobs", label: "jobs.postJobBtn", icon: "jobs" },
  { id: "projects", href: "/projects/neu", label: "projects.addProject", icon: "projects" },
  { id: "companies", href: "/company-setup", label: "home.pillarCompaniesCta", icon: "companies" },
  { id: "profile", href: "/profile", label: "PersonalArea.editProfile", icon: "profile" },
];
