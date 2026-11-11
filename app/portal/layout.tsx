import "../admin/work/workspace.css";
import "../restyle.css";
import PortalChrome from "@/components/portal/PortalChrome";

export const metadata = {
  title: "Client Portal - Marc Watters",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalChrome>{children}</PortalChrome>;
}
