import JsonLd from "@/components/JsonLd";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { canEditListing } from "@/lib/listing-access";
import { getListingProvider } from "@/lib/listing-provider";
import type { Metadata } from "next";
import TiereDetail from "@/components/TiereDetail";

async function getAnimal(slug: string, viewerId: string | null = null, preview = false) {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(slug)) return null;
  const {data,error} = await db.from("listings")
    .select("id,user_id,company_id,responsible_person,type,title,category,city,price,image_url,description,metadata,extra_images,published")
    .eq("id",slug).eq("type","animal").maybeSingle();
  if (error) throw new Error("Animal portfolio could not be loaded");
  if (!data) return null;
  const canEdit = viewerId ? await canEditListing(viewerId,data) : false;
  if (!data.published && !(preview && canEdit)) return null;
  const provider = await getListingProvider(data.user_id,data.company_id,viewerId,data.responsible_person);
  const meta = (data.metadata ?? {}) as Record<string,unknown>;
  return { id:data.id,title:data.title,category:data.category ?? "",location:data.city ?? "",dailyRate:data.price ?? 0,image:data.image_url ?? "",
    trainingLevel:typeof meta.training_level === "string" ? meta.training_level : null,handlerIncluded:meta.handler_included === true,
    count:String(meta.count ?? "1"),specialSkills:typeof meta.special_skills === "string" ? meta.special_skills : null,delivery:meta.delivery === true,
    focalPoint:meta.focal_point as {x:number;y:number}|null,description:data.description ?? "",extra_images:data.extra_images ?? [],
    ownerId:provider.contactUserId ?? undefined,ownerName:provider.name,ownerAvatar:provider.imageUrl,ownerHref:provider.href,canEdit,privatePreview:!data.published };
}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata> {
  const animal = await getAnimal((await params).slug);
  if (!animal) return {robots:{index:false,follow:false}};
  const t = await getTranslations("FilmAnimals");
  return {title:animal.title,description:animal.description?.slice(0,155) || t("description"),openGraph:{title:animal.title,description:t("description")}};
}
export default async function AnimalDetailPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{preview?:string}>}) {
  const {userId} = await auth();
  const animal = await getAnimal((await params).slug,userId,(await searchParams).preview === "1");
  if (!animal) notFound();
  return <>{!animal.privatePreview && <JsonLd data={{"@context":"https://schema.org","@type":"CreativeWork",name:animal.title,description:animal.description,image:animal.image || undefined}} />}<TiereDetail animal={animal} /></>;
}
