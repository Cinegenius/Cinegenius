import { redirect } from "next/navigation";

// New users are sent directly to the full profile editor
export default function ProfileSetupPage() {
  redirect("/profile");
}
