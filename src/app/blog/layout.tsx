import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default async function LayoutBlog({ children }: { children: any }) {
  return (
    <div>
      {/* <Suspense> */}
      <Header />
      {/* </Suspense> */}

      <main className="">{children}</main>

      <div className="h-24" />

      <Footer />
    </div>
  );
}
