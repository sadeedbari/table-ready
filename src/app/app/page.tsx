import { redirect } from "next/navigation";
import { getMyRestaurants, requireUser } from "@/lib/auth";

export const metadata = { robots: { index: false } };

/** Where sign-in sends people: straight to their restaurant, or to set one up. */
export default async function AppHome() {
  await requireUser("/app");
  const mine = await getMyRestaurants();
  redirect(mine.length ? `/o/${mine[0].slug}` : "/onboarding");
}
