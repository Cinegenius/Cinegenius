"use client";
export default function ListingPriceOptions({onRequest,negotiable,onChange}:{onRequest:boolean;negotiable:boolean;onChange:(value:{priceOnRequest:boolean;priceNegotiable:boolean})=>void}) {
 return <div className="space-y-2"><div className="flex flex-wrap gap-2" role="group" aria-label="Preisart">{[
  {label:'Festpreis',priceOnRequest:false,priceNegotiable:false},
  {label:'VB – Verhandlungsbasis',priceOnRequest:false,priceNegotiable:true},
  {label:'Preis auf Anfrage',priceOnRequest:true,priceNegotiable:false},
 ].map(option=>{const selected=option.priceNegotiable?negotiable:option.priceOnRequest?onRequest&&!negotiable:!onRequest&&!negotiable;return <button key={option.label} type="button" aria-pressed={selected} onClick={()=>onChange({priceOnRequest:option.priceOnRequest,priceNegotiable:option.priceNegotiable})} className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm ${selected?'border-gold bg-gold/10 text-gold':'border-border bg-bg-primary text-text-secondary'}`}>{option.label}</button>;})}</div>{negotiable&&<p className="text-xs leading-5 text-text-muted">Der Preis ist verhandelbar. Du kannst einen Betrag nennen oder das Preisfeld leer lassen.</p>}</div>;
}
