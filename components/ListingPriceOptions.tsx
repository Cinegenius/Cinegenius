"use client";
import { useTranslations } from "next-intl";

export default function ListingPriceOptions({onRequest,negotiable,onChange}:{onRequest:boolean;negotiable:boolean;onChange:(value:{priceOnRequest:boolean;priceNegotiable:boolean})=>void}) {
  const uiText = useTranslations();

 return <div className="space-y-2"><div className="flex flex-wrap gap-2" role="group" aria-label={uiText("Ui.text_7bd02fb407ccf6")}>{[
  {label:uiText("Ui.text_10be4cdfb86684"),priceOnRequest:false,priceNegotiable:false},
  {label:uiText("Ui.text_16f15ff3a1ce92"),priceOnRequest:false,priceNegotiable:true},
  {label:uiText("AdminReview.fields.price_on_request"),priceOnRequest:true,priceNegotiable:false},
 ].map(option=>{const selected=option.priceNegotiable?negotiable:option.priceOnRequest?onRequest&&!negotiable:!onRequest&&!negotiable;return <button key={option.label} type="button" aria-pressed={selected} onClick={()=>onChange({priceOnRequest:option.priceOnRequest,priceNegotiable:option.priceNegotiable})} className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm ${selected?'border-gold bg-gold/10 text-gold':'border-border bg-bg-primary text-text-secondary'}`}>{option.label}</button>;})}</div>{negotiable&&<p className="text-xs leading-5 text-text-muted">{uiText("Ui.text_cd3405a6d7d9db")}</p>}</div>;
}
