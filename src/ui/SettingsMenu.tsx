// The display settings, behind one button in the top bar: theme, wording and
// the OS keyboard layout keys are shown in. All are browser-local preferences,
// never written to the keyboard.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { LOCALES, getLocaleId, setLocaleId, subscribeLocale } from "./locale";
import { setTheme, useTheme } from "./theme";
import { setWording, useWording } from "./terms";
import { Segmented, SectionLabel, cx } from "./kit";
import { SettingsIcon } from "./icons";

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  );
}

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const wording = useWording();
  const localeId = useSyncExternalStore(subscribeLocale, getLocaleId, getLocaleId);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Display settings"
        aria-expanded={open}
        title="Display settings"
        className={cx(
          "flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors duration-150",
          open ? "bg-raised text-ink" : "text-mute hover:bg-hover hover:text-ink",
        )}
      >
        <SettingsIcon size={16} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Display settings"
          className="absolute right-0 top-full z-30 mt-2 flex w-64 flex-col gap-4 rounded-xl border border-line bg-panel p-4 shadow-lg animate-fade-up"
        >
          <Setting label="Theme">
            <Segmented
              size="sm"
              value={theme}
              onChange={setTheme}
              items={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
              ]}
            />
          </Setting>
          <Setting label="Wording">
            <Segmented
              size="sm"
              value={wording}
              onChange={setWording}
              items={[
                { value: "technical", label: "Technical", title: "RMK and Rynk terms" },
                { value: "friendly", label: "Friendly", title: "Plain descriptions" },
              ]}
            />
          </Setting>
          <Setting label="Keyboard layout">
            <select
              value={localeId}
              onChange={(event) => setLocaleId(event.target.value)}
              title="The OS keyboard layout keys are shown and picked in"
              aria-label="OS keyboard layout"
              className="w-full cursor-pointer rounded-lg border border-line bg-raised px-2 py-1.5 text-body text-ink hover:border-line-strong"
            >
              {LOCALES.map((locale) => (
                <option key={locale.id} value={locale.id}>
                  {locale.name}
                </option>
              ))}
            </select>
          </Setting>
        </div>
      )}
    </div>
  );
}
