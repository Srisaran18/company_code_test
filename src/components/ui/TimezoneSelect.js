import { useMemo } from "react";
import SearchSelect from "./SearchSelect";
import { timezoneOptions } from "../../constants/timezones";

const OPTIONS = timezoneOptions();

export default function TimezoneSelect({ value, onChange, disabled = false, required = false }) {
  const options = useMemo(
    () =>
      value && !OPTIONS.some((item) => item.value === value)
        ? [{ value, label: value.replace(/_/g, " ") }, ...OPTIONS]
        : OPTIONS,
    [value]
  );
  return (
    <SearchSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select timezone"
      disabled={disabled}
      required={required}
      emptyText="No matching timezone"
    />
  );
}
