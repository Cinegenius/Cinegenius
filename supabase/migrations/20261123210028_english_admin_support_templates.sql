-- Operator request, 23 November 2026: outgoing support templates in English.
-- Only the seven unchanged seeded bodies are translated. Preserve labels,
-- enabled flags, permissions, custom templates and every existing message.
-- Abort atomically if an administrator has edited a seeded body since review.
do $migration$
declare
  template record;
  current_body text;
begin
  for template in select * from (values
    ('crew_profile', $old$Hallo {{Vorname}}, bei deinem Crewprofil fehlen noch {{fehlendeAngaben}}. Hier kannst du die Angaben ergänzen: {{Bearbeitungslink}}. Bei Fragen antworte uns gerne direkt. Dein CineGenius Support$old$, $new$Hello {{Vorname}}, your Crew profile is missing: {{fehlendeAngaben}}. You can add these details here: {{Bearbeitungslink}}. Reply here if you need help. CineGenius Support$new$),
    ('marketplace_listing', $old$Hallo {{Vorname}}, bei deinem Angebot „{{Inserattitel}}“ fehlen noch {{fehlendeAngaben}}. Ergänze sie hier, damit Interessierte dein Angebot besser einschätzen können: {{Bearbeitungslink}}. Dein CineGenius Support$old$, $new$Hello {{Vorname}}, your listing “{{Inserattitel}}” is missing: {{fehlendeAngaben}}. You can add these details here: {{Bearbeitungslink}}. CineGenius Support$new$),
    ('location', $old$Hallo {{Vorname}}, deine Location „{{Inserattitel}}“ könnte noch ein paar Angaben gebrauchen: {{fehlendeAngaben}}. Hier kannst du sie ergänzen: {{Bearbeitungslink}}. Dein CineGenius Support$old$, $new$Hello {{Vorname}}, your location “{{Inserattitel}}” could use a few more details: {{fehlendeAngaben}}. You can add them here: {{Bearbeitungslink}}. CineGenius Support$new$),
    ('more_photos', $old$Hallo {{Vorname}}, möchtest du „{{Inserattitel}}“ noch besser zeigen? Ergänze gerne weitere Fotos mit unterschiedlichen Ansichten: {{Bearbeitungslink}}. Dein CineGenius Support$old$, $new$Hello {{Vorname}}, would you like to show more of “{{Inserattitel}}”? You can add more photos with different views here: {{Bearbeitungslink}}. CineGenius Support$new$),
    ('company_profile', $old$Hallo {{Vorname}}, ergänze gerne die Leistungen, Fotos oder Teamangaben von „{{Firmenname}}“. Hier gelangst du direkt zur Bearbeitung: {{Bearbeitungslink}}. Dein CineGenius Support$old$, $new$Hello {{Vorname}}, you can add services, photos or team details to “{{Firmenname}}” here: {{Bearbeitungslink}}. CineGenius Support$new$),
    ('resume_draft', $old$Hallo {{Vorname}}, dein Entwurf „{{Inserattitel}}“ ist noch nicht veröffentlicht. Wenn du ihn fertigstellen möchtest, kannst du hier weitermachen: {{Bearbeitungslink}}. Bei Fragen helfen wir gerne. Dein CineGenius Support$old$, $new$Hello {{Vorname}}, your draft “{{Inserattitel}}” has not been published yet. If you would like to finish it, continue here: {{Bearbeitungslink}}. Reply here if you need help. CineGenius Support$new$),
    ('check_in', $old$Hallo {{Vorname}}, brauchst du Unterstützung bei deinem Profil oder Angebot? Antworte uns einfach hier und beschreibe kurz, wobei du Hilfe brauchst. Dein CineGenius Support$old$, $new$Hello {{Vorname}}, do you need help with your profile or listing? Reply here and let us know what you need help with. CineGenius Support$new$)
  ) as translations(template_key, old_body, new_body)
  loop
    select body into current_body from public.support_message_templates
      where template_key = template.template_key for update;
    if not found then continue; end if; -- Do not resurrect deleted templates.
    if current_body = template.new_body then continue; end if;
    if current_body <> template.old_body then
      raise exception 'Support template % changed; review before translating', template.template_key;
    end if;
    update public.support_message_templates
      set body = template.new_body, updated_at = now(), updated_by = null
      where template_key = template.template_key;
  end loop;
end;
$migration$;
