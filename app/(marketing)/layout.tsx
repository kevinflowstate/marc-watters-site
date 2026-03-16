import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import MetaPixel from "@/components/MetaPixel";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MetaPixel />
      <Nav />
      {children}
      <Footer />
    </>
  );
}
