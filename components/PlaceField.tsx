'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown } from 'lucide-react';
import { COUNTRY_CODES } from '@/lib/places/countries';
import { countryCode, countryName, placeKey } from '@/lib/places/core';

type RegionOption = { id: string; name: string; aliases: string[] };
type CityOption = { id: string; name: string; canonicalName: string; regionId: string; region: string; district?: string };
type SearchResult = { country: string; locale: string; query: string; regionId: string; regions: RegionOption[]; cities: CityOption[]; regionOnly: RegionOption | null };
type PlaceFieldProps = {
  value: string;
  onChange: (value: string, cityId?: string) => void;
  id?: string;
  required?: boolean;
  selectedCityId?: string;
  onSelection?: (cityId: string) => void;
};

/** The legacy text is a compatibility field. Selection IDs are explicit and
 * remain server-validated; typing a place never silently creates an identity. */
export default function PlaceField({ value, onChange, id, required = false, selectedCityId, onSelection }: PlaceFieldProps) {
  const generated = useId(), base = id ?? generated;
  const t = useTranslations('Places'), locale = useLocale();
  const parts = value.split(',').map(part => part.trim()), code = countryCode(parts.at(-1) ?? '');
  const city = code && parts.length === 1 ? '' : parts[0] ?? '';
  const region = code ? parts.slice(1, -1).join(', ') : '';
  const [result, setResult] = useState<SearchResult | null>(null);
  const [failed, setFailed] = useState(false), [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<{ id: string; raw: string } | null>(null);
  const [open, setOpen] = useState(false), [activeIndex, setActiveIndex] = useState(-1);
  const cityInput = useRef<HTMLInputElement | null>(null), activeOption = useRef<HTMLButtonElement | null>(null);
  const current = result?.country === code && result.locale === locale ? result : null;
  const regions = current?.regions ?? [];
  const selectedRegion = regions.find(option => [option.name, ...option.aliases].some(name => placeKey(name) === placeKey(region)));
  const regionId = selectedRegion?.id ?? '';
  const matchingResult = current?.query === city && current.regionId === regionId ? current : null;
  const cities = matchingResult?.cities ?? [], regionOnly = matchingResult?.regionOnly ?? null;
  const selectionId = selectedCityId ?? (picked?.raw === value ? picked.id : '');
  const selectedCity = selectionId ? cities.find(option => option.id === selectionId) : null;
  const showSuggestions = open && cities.length > 0 && !regionOnly;
  const active = showSuggestions && activeIndex >= 0 && activeIndex < cities.length ? activeIndex : -1;
  const listId = `${base}-suggestions`;
  const optionId = (index: number) => `${base}-suggestion-${index}`;
  const countries = useMemo(() => COUNTRY_CODES.map(country => ({ value: country, label: countryName(country, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale)), [locale]);
  const ambiguousSelection = selectedCity && cities.filter(option => option.name === selectedCity.name && option.regionId === selectedCity.regionId).length > 1;
  const selectionLabel = [selectedCity?.name ?? city, ambiguousSelection ? selectedCity?.district : '', selectedCity?.region ?? selectedRegion?.name ?? region, code ? countryName(code, locale) : ''].filter(Boolean).join(', ');

  function emit(country: string, nextRegion: string, nextCity: string) {
    setPicked(null);
    setActiveIndex(-1);
    onChange([nextCity, nextRegion, country].join(', '));
  }

  function choose(option: CityOption) {
    const raw = [option.name, option.region, code].join(', ');
    setPicked({ id: option.id, raw });
    setOpen(false);
    setActiveIndex(-1);
    onChange(raw, option.id);
    onSelection?.(option.id);
  }

  function handleCityKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && cities.length && !regionOnly) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(event.key === 'ArrowDown'
        ? !showSuggestions || active < 0 ? 0 : (active + 1) % cities.length
        : !showSuggestions || active < 0 ? cities.length - 1 : (active - 1 + cities.length) % cities.length);
    } else if (event.key === 'Enter' && showSuggestions && (active >= 0 || cities.length === 1)) {
      event.preventDefault();
      choose(cities[active >= 0 ? active : 0]);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!code) { setResult(null); setLoading(false); return; }
      setLoading(true);
      setFailed(false);
      try {
        const params = new URLSearchParams({ country: code, region: regionId, q: city, locale });
        const response = await fetch(`/api/places?${params}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw Error();
        const data = await response.json() as { regions: RegionOption[]; cities: CityOption[] };
        let regionOnly: RegionOption | null = null;
        const matches = data.regions.filter(option => [option.name, ...option.aliases].some(name => placeKey(name) === placeKey(city)));
        const hasExactCity = data.cities.some(option => [option.name, option.canonicalName].some(name => placeKey(name) === placeKey(city)));
        if (matches.length === 1 && !hasExactCity) {
          // Resolve without a region restriction: Berlin/Hamburg remain cities
          // even when the member has currently chosen a different region.
          try {
            const classification = await fetch(`/api/places?${new URLSearchParams({ resolve: [city, code].join(', '), locale })}`, { signal: controller.signal, cache: 'no-store' });
            if (classification.ok) {
              const place = await classification.json() as { city: string; regionId: string | null };
              if (!place.city && place.regionId === matches[0].id) regionOnly = matches[0];
            }
          } catch { /* Suggestions and manual input remain usable if classification is unavailable. */ }
        }
        if (!controller.signal.aborted) {
          setResult({ country: code, locale, query: city, regionId, regions: data.regions, cities: data.cities, regionOnly });
          setActiveIndex(-1);
        }
      } catch {
        if (!controller.signal.aborted) { setFailed(true); setResult(null); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [code, city, regionId, locale]);

  useEffect(() => {
    if (active >= 0) activeOption.current?.scrollIntoView({ block: 'nearest' });
  }, [active, showSuggestions]);

  const input = 'min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-secondary px-3 py-2.5 text-sm text-text-primary outline-none focus:border-gold';
  const manual = !selectionId && city.trim().length >= 2 && !!matchingResult && !cities.length && !regionOnly;
  return <fieldset className="min-w-0 space-y-3" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setActiveIndex(-1); }
  }}>
    <legend className="mb-2 text-sm font-medium text-text-primary">{t('location')}</legend>
    <div><label className="mb-1 block text-sm text-text-secondary" htmlFor={`${base}-country`}>{t('country')}</label><div className="relative">
      <select id={`${base}-country`} autoComplete="country" required={required} value={code} onChange={event => { setOpen(false); emit(event.target.value, '', code ? '' : city); }} className={`${input} appearance-none pr-9`}>
        <option value="">{t('chooseCountry')}</option>{countries.map(country => <option key={country.value} value={country.value}>{country.label}</option>)}
      </select><ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
    </div></div>
    {code && <>
      {(regions.length > 0 || region || failed) && <div>
        <label className="mb-1 block text-sm text-text-secondary" htmlFor={`${base}-region`}>{t(code === 'CH' ? 'canton' : ['DE', 'AT'].includes(code) ? 'state' : 'region')}</label>
        <input id={`${base}-region`} autoComplete="address-level1" maxLength={100} list={`${base}-regions`} value={selectedRegion?.name ?? region} onChange={event => { setOpen(false); emit(code, event.target.value, ''); }} className={input} />
        <datalist id={`${base}-regions`}>{regions.map(option => <option key={option.id} value={option.name} />)}</datalist>
        <p className="mt-1 text-xs text-text-muted">{t('regionOptional')}</p>
      </div>}
      <div>
        <label className="mb-1 block text-sm text-text-secondary" htmlFor={base}>{t('city')}</label>
        <input ref={cityInput} id={base} role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={showSuggestions} aria-controls={showSuggestions ? listId : undefined} aria-activedescendant={active >= 0 ? optionId(active) : undefined} aria-busy={loading} aria-invalid={regionOnly ? true : undefined}
          autoComplete="address-level2" required={required} maxLength={100} placeholder={t('cityPlaceholder')} value={selectedCity?.name ?? city}
          onFocus={() => { if (!selectionId && city.trim().length >= 2) setOpen(true); }}
          onChange={event => { setOpen(true); emit(code, region, event.target.value); }} onKeyDown={handleCityKey}
          aria-describedby={[`${base}-help`, regionOnly ? `${base}-region-warning` : '', selectionId && city && !regionOnly ? `${base}-selected` : ''].filter(Boolean).join(' ')} className={input} />
      </div>
      {regionOnly && <div id={`${base}-region-warning`} role="alert" className="text-sm text-text-secondary">
        <p>{t('regionInCity', { region: regionOnly.name })}</p>
        <button type="button" onClick={() => { setOpen(false); emit(code, regionOnly.name, ''); cityInput.current?.focus(); }} className="mt-2 min-h-11 rounded-lg border border-border px-3 text-sm font-medium text-text-primary hover:bg-bg-elevated focus-visible:outline-gold">{t('useRegion')}</button>
      </div>}
      <div role="status" aria-live="polite" className="text-xs text-text-muted">
        {selectionId && city && !regionOnly ? <p id={`${base}-selected`} className="inline-flex items-center gap-1.5 text-text-secondary"><Check size={14} aria-hidden="true" />{t('selectedCity', { place: selectionLabel })}</p>
          : loading ? t('searching') : failed ? t('unavailable') : showSuggestions ? t('suggestionCount', { count: cities.length }) : open && manual ? t('noSuggestions') : ''}
      </div>
      {showSuggestions && <div className="rounded-xl border border-border bg-bg-primary">
        <p id={`${base}-suggestion-label`} className="px-3 pt-3 text-xs text-text-muted">{t('suggestions')}</p>
        <div id={listId} role="listbox" aria-labelledby={`${base}-suggestion-label`} className="max-h-60 overflow-y-auto">
          {cities.map((option, index) => <button id={optionId(index)} key={option.id} ref={index === active ? activeOption : undefined} type="button" role="option" tabIndex={-1} aria-selected={index === active}
            onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)}
            className={`block min-h-11 w-full break-words px-3 py-3 text-left text-sm hover:bg-bg-elevated focus-visible:outline-gold${index === active ? ' bg-bg-elevated' : ''}`}>
            {[option.name, option.district, option.region].filter(Boolean).join(', ')}
          </button>)}
        </div>
      </div>}
      <p id={`${base}-help`} className="text-xs leading-5 text-text-muted">{t('citySearchHelp')}</p>
      {(manual || failed) && <p className="text-xs leading-5 text-text-muted">{t('manualHelp')}</p>}
    </>}
    {!code && value && <p className="break-words text-xs text-text-muted">{t('legacy', { value })}</p>}
    <p className="text-xs text-text-muted"><a href="https://www.geonames.org/" target="_blank" rel="noreferrer">{t('source')}</a>{' · '}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">{t('sourceLicense')}</a>{' · '}{t('sourceChanges')}</p>
  </fieldset>;
}
