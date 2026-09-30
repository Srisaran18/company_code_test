import { useMemo } from "react";
import SearchSelect from "../../components/ui/SearchSelect";
import TimezoneSelect from "../../components/ui/TimezoneSelect";
import { fieldClass } from "../../components/ui/formStyles";
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS, findCountry, timezoneFor } from "../../constants/countries";

export const PROFILE_KEYS = [
  "name",
  "legalName",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "postalCode",
  "country",
  "taxNumber",
  "timezone",
  "currency",
];

export function profilePayload(company) {
  const payload = Object.fromEntries(PROFILE_KEYS.map((key) => [key, company[key] ?? ""]));
  payload.currency = String(payload.currency || "").toUpperCase();
  return payload;
}

function isValidTimezone(value) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Maps stored country names to ISO codes and replaces invalid timezones (e.g. "IST") with the country default. */
export function normalizeProfile(company) {
  const country = findCountry(company.country);
  const next = { ...company, country: country?.code || company.country || "" };
  if (!isValidTimezone(next.timezone)) next.timezone = timezoneFor(next.country, next.state) || "UTC";
  return next;
}

function withValue(options, value) {
  return value && !options.some((item) => item.value === value) ? [{ value, label: value }, ...options] : options;
}

function Field({ label, hint, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm text-white/70">
        {label}
        {hint ? <span className="ml-1 text-xs text-white/45">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

/**
 * Company profile inputs shared by the create and detail pages.
 * Picking a country fills currency + timezone; picking a state refines the timezone.
 */
export default function CompanyProfileFields({
  value,
  onChange,
  codeField,
  disabled = false,
  lockName = false,
  lockEmail = false,
  emailInUse = "",
}) {
  const country = findCountry(value.country);
  const countryValue = country?.code || value.country || "";
  const countryOptions = useMemo(() => withValue(COUNTRY_OPTIONS, countryValue), [countryValue]);
  const stateOptions = useMemo(
    () => withValue((country?.states || []).map((item) => ({ value: item.name, label: item.name })), value.state),
    [country, value.state]
  );
  const currencyOptions = useMemo(
    () => withValue(CURRENCY_OPTIONS, String(value.currency || "").toUpperCase()),
    [value.currency]
  );

  const set = (patch) => onChange({ ...value, ...patch });
  const text = (key) => ({
    className: fieldClass,
    value: value[key] || "",
    disabled,
    onChange: (e) => set({ [key]: e.target.value }),
  });

  const onCountry = (code) => {
    const next = findCountry(code);
    if (!next) {
      set({ country: code, state: "" });
      return;
    }
    const keepState = next.states.some((item) => item.name === value.state) ? value.state : "";
    set({
      country: next.code,
      state: keepState,
      currency: next.currency,
      timezone: timezoneFor(next.code, keepState),
    });
  };

  const onState = (state) => set({ state, timezone: country ? timezoneFor(country.code, state) : value.timezone });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Company name" hint={lockName ? "(fixed)" : ""}>
        <input {...text("name")} required disabled={disabled || lockName} />
      </Field>
      {codeField}
      <Field label="Legal name" hint="(as registered)">
        <input {...text("legalName")} />
      </Field>
      <Field label="Tax / VAT number">
        <input {...text("taxNumber")} />
      </Field>
      <Field label="Country" hint="(sets currency & timezone)">
        <SearchSelect
          value={countryValue}
          onChange={onCountry}
          options={countryOptions}
          placeholder="Select country"
          disabled={disabled}
          emptyText="No matching country"
        />
      </Field>
      <Field label="State / region" hint={country?.states.length ? "(refines timezone)" : ""}>
        {country?.states.length ? (
          <SearchSelect
            value={value.state || ""}
            onChange={onState}
            options={stateOptions}
            placeholder="Select state"
            disabled={disabled}
            emptyText="No matching state"
          />
        ) : (
          <input {...text("state")} placeholder={country ? "" : "Select a country first, or type"} />
        )}
      </Field>
      <Field label="City">
        <input {...text("city")} />
      </Field>
      <Field label="Postal code">
        <input {...text("postalCode")} />
      </Field>
      <Field label="Address" className="sm:col-span-2">
        <input {...text("address")} />
      </Field>
      <Field label="Timezone" hint="(auto from country/state)">
        <TimezoneSelect
          value={value.timezone}
          onChange={(timezone) => set({ timezone })}
          disabled={disabled}
          required
        />
      </Field>
      <Field label="Currency" hint="(auto from country)">
        <SearchSelect
          value={String(value.currency || "").toUpperCase()}
          onChange={(currency) => set({ currency })}
          options={currencyOptions}
          placeholder="Select currency"
          disabled={disabled}
          emptyText="No matching currency"
        />
      </Field>
      {lockEmail ? (
        value.email || emailInUse ? (
          <Field label="Email in use">
            <p className={`${fieldClass} bg-white/70`}>{emailInUse || value.email}</p>
          </Field>
        ) : null
      ) : (
        <Field label="Company email">
          <input {...text("email")} type="email" />
        </Field>
      )}
      <Field label="Phone">
        <input {...text("phone")} type="tel" />
      </Field>
    </div>
  );
}

export { Field as ProfileField };
