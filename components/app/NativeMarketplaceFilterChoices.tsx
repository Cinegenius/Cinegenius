"use client";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { type ReactNode } from "react";
import { NativeFilterChoices } from "./NativeBrowseFilterPanel";

/** Three presentation groups, retaining the existing persisted category IDs.
 * Equipment opens the existing detailed catalogue; it is never a fabricated ID. */
export default function NativeMarketplaceFilterChoices({ options, selected, onChange, children }: {
  options: { value:string;label:string }[]; selected: string[]; onChange:(value:string)=>void; children?:ReactNode;
}) {
  const ui = useTranslations();
  const details = options.filter(option => !["requisiten","fahrzeuge"].includes(option.value));
  const direct = [{value:"requisiten",label:ui("Ui.text_27c673e10176f0")},{value:"fahrzeuge",label:ui("BookingRequest.typeVehicle")}]
    .map(option => ({...option,disabled:!options.some(value=>value.value===option.value)&&!selected.includes(option.value)}));
  return <div>
    <NativeFilterChoices label={ui("BrowseFilters.marketplace")} options={[direct[0]]} selected={selected} onChange={onChange}/>
    <details className="border-y border-border"><summary className="flex min-h-11 cursor-pointer items-center gap-2 px-1 text-sm"><span className="min-w-0 flex-1">{ui("BrowseFilters.equipmentCategory")}</span><ChevronDown size={16} aria-hidden="true"/></summary>
      <NativeFilterChoices label={ui("BrowseFilters.equipmentCategory")} options={details} selected={selected} onChange={onChange}/>
    </details>
    <NativeFilterChoices label={ui("BrowseFilters.marketplace")} options={[direct[1]]} selected={selected} onChange={onChange}/>
    {children}
  </div>;
}
