// This route has been removed. Redirect to home.
import { redirect } from "next/navigation";

export default function CloserPage() {
  redirect("/");
}
