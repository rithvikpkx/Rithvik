import SiteProvider from "@/components/site/SiteProvider";
import Tracker from "@/components/site/Tracker";
import RecruiterView from "@/components/recruiter/RecruiterView";
import { getContent } from "@/lib/content";

export const revalidate = 60;

/** /recruiter: the minimal, content-first portfolio. Same content, agent, composer and tracking as the full site. */
export default async function RecruiterPage() {
  const content = await getContent();
  return (
    <SiteProvider content={content}>
      <RecruiterView />
      <Tracker />
    </SiteProvider>
  );
}
