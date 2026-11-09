import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/content";
import OpenCase from "./OpenCase";

type Params = { params: Promise<{ slug: string }> };

/** One static page per project slug. */
export async function caseStaticParams() {
  return (await getContent()).projects.map((p) => ({ slug: p.slug }));
}

/** Per-project SEO: title is the project name, description is its headline. */
export async function caseMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = (await getContent()).projects.find((x) => x.slug === slug);
  return p ? { title: p.title, description: p.headline, alternates: { canonical: `/work/${p.slug}` } } : {};
}

/** The /work/[slug] page body: 404s on an unknown slug, otherwise opens the case sheet. */
export async function CasePage({ params }: Params) {
  const { slug } = await params;
  if (!(await getContent()).projects.some((x) => x.slug === slug)) notFound();
  return <OpenCase slug={slug} />;
}
