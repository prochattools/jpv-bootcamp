import config from "@/config";
import { getSEOTags } from "@/libs/seo";
import Form from "./_assets/components/form";
import WaitingListHero from "@/components/WaitingListHero";

export const metadata = getSEOTags({
  title: `${config.appName} Waiting List | Best AI tools`,
  description: "How to launch your MicroSaaS",
});

export default function WaitingList() {
  return (
    <>
      <WaitingListHero />
      {/* <section className="text-center max-w-xl w-full mx-auto pt-32 mb-24 md:mb-32 px-4 sm:px-8">
        <h1 className="font-extrabold text-[30px] lg:text-[48px] leading-snug mb-12 text-white">
          {config.appName} Waiting List
        </h1>
        <Form />
      </section> */}
    </>
  );
}
