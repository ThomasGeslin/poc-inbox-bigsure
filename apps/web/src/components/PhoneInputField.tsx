import PhoneInput, { getCountryCallingCode } from "react-phone-number-input";
import type { Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { forwardRef, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";

// Maps a 2-letter country code to its flag emoji
function flagEmoji(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("");
}

interface CountryOption {
  value?: Country;
  label: string;
  divider?: boolean;
}

// Props passed by react-phone-number-input to countrySelectComponent
interface CountrySelectProps {
  value?: Country;
  onChange: (country?: Country) => void;
  options: CountryOption[];
  disabled?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  iconComponent?: any;
  unicodeFlags?: boolean;
}

function CountrySelect({
  value,
  onChange,
  options,
  disabled,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const countries = options.filter(
    (option): option is CountryOption & { value: Country } =>
      !!option.value && !option.divider,
  );

  const filtered = countries.filter((country) => {
    if (!search) return true;

    const query = search.toLowerCase();
    return (
      country.label.toLowerCase().includes(query) ||
      getCountryCallingCode(country.value).includes(query)
    );
  });

  const openDropdown = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: 256,
      zIndex: 9999,
    });
    setOpen(true);
  };

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  // Focus the search box when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  // Close when clicking outside both the button and the portal dropdown
  const onMouseDown = useCallback((e: MouseEvent) => {
    const target = e.target as Node;
    if (
      !buttonRef.current?.contains(target) &&
      !dropdownRef.current?.contains(target)
    ) {
      close();
    }
  }, [close]);

  useEffect(() => {
    if (open) document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, onMouseDown]);

  const dropdown = (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
    >
      {/* Search */}
      <div className="p-2 border-b border-gray-100">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un pays…"
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-300 placeholder:text-gray-300"
          />
        </div>
      </div>

      {/* Country list */}
      <ul className="max-h-52 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <li className="px-3 py-3 text-xs text-gray-400 text-center">
            Aucun pays trouvé
          </li>
        ) : (
          filtered.map((country) => (
            <li key={country.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(country.value);
                  close();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                  value === country.value
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="text-base leading-none w-6 shrink-0">
                  {flagEmoji(country.value)}
                </span>

                <span className="flex-1 truncate text-xs">{country.label}</span>

                <span className="text-xs text-gray-400 shrink-0 tabular-nums">
                  +{getCountryCallingCode(country.value)}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );

  return (
    <>
      {/* Trigger button — self-stretch so it fills the input row height */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : openDropdown())}
        className="flex items-center gap-1 px-2.5 py-2 border-r border-gray-200 hover:bg-gray-50 transition-colors rounded-l-[7px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="text-sm font-medium text-gray-700 select-none tabular-nums">
          +{value ? getCountryCallingCode(value) : "--"}
        </span>

        <ChevronDown
          size={11}
          className={`text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && createPortal(dropdown, document.body)}
    </>
  );
}

// Custom text input matching the app's style
const CustomInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className: _cls, ...props }, ref) => (
  <input
    ref={ref}
    {...props}
    className="flex-1 min-w-0 py-2 pr-3 pl-2 text-sm bg-transparent focus:outline-none placeholder:text-gray-300 text-gray-800"
  />
));
CustomInput.displayName = "CustomInput";

interface Props {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: Country;
  variant?: "create" | "edit";
}

export default function PhoneInputField({
  value,
  onChange,
  defaultCountry = "FR",
  variant = "create",
}: Props) {
  const containerClass =
    variant === "edit"
      ? "phone-input-root flex items-center border border-gray-200 rounded-lg focus-within:border-indigo-400 bg-gray-50 focus-within:bg-white transition-colors"
      : "phone-input-root flex items-center border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-indigo-300 focus-within:border-transparent";

  return (
    <div className={containerClass}>
      <PhoneInput
        value={value}
        onChange={(v) => onChange(v ?? "")}
        defaultCountry={defaultCountry}
        inputComponent={CustomInput}
        countrySelectComponent={CountrySelect}
        international
        onCountryChange={(country) => {
          // Pre-fill the calling code prefix when the input is empty
          if (country && !value) {
            onChange(`+${getCountryCallingCode(country)}`);
          }
        }}
      />
    </div>
  );
}
