"use client";
import { occupationChoices, primaryOccupationForPositions, occupationReference, type PrimaryOccupation } from '@/lib/primary-occupation';

export default function PrimaryOccupationPicker({positions,value,onChange,id='primary-occupation'}:{positions:readonly string[];value:PrimaryOccupation|null;onChange:(value:PrimaryOccupation|null)=>void;id?:string}) {
  const options = occupationChoices(positions);
  const selected = primaryOccupationForPositions(value, positions);
  if (!positions.length) return null;
  return <div className="mt-5 space-y-2">
    <label htmlFor={id} className="block text-sm font-semibold text-text-primary">Haupttätigkeit</label>
    <select id={id} value={selected?.roleId ?? ''} onChange={event=>onChange(occupationReference(options.find(option=>option.roleId===event.target.value)??null))} className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-primary px-3 py-3 text-base text-text-primary">
      <option value="">Haupttätigkeit auswählen</option>
      {options.map(option=><option key={option.roleId} value={option.roleId}>{option.departmentLabel} → {option.label}</option>)}
    </select>
    <p className="text-xs leading-5 text-text-muted">Die Haupttätigkeit wird in deinem Profil hervorgehoben. In der Crewübersicht wirst du unter allen ausgewählten Tätigkeiten und ihren Gewerken gefunden.</p>
    {!selected && options.length > 1 && <p className="text-xs leading-5 text-text-muted">Für deine bisherigen Tätigkeiten ist noch keine eindeutige Haupttätigkeit festgelegt. Bitte wähle sie hier aus; deine weiteren Tätigkeiten bleiben erhalten.</p>}
    {!options.length && <p className="text-xs text-text-muted">Wähle für die Zuordnung eine Tätigkeit aus dem Berufskatalog. Deine bisherigen Angaben bleiben erhalten.</p>}
  </div>;
}
