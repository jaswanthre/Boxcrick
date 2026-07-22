import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronsUpDown, Check, Search } from "lucide-react";

type Option = { value: string; label: string };

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  className = "",
  portal = false,
  modal = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  portal?: boolean;
  modal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateMenuStyle = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const maxHeight = Math.min(320, window.innerHeight - 88);
    const openAbove = rect.bottom + maxHeight > window.innerHeight && rect.top > maxHeight + 24;

    setMenuStyle({
      position: "fixed",
      top: openAbove ? Math.max(16, rect.top - maxHeight - 8) : rect.bottom,
      left: rect.left,
      width: rect.width,
      maxHeight,
      zIndex: 1000,
    });
  };

  useLayoutEffect(() => {
    if (open && portal) {
      updateMenuStyle();
    }
  }, [open, portal]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open && modal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, modal]);

  useEffect(() => {
    if (!open) return;

    const onClick = (e: MouseEvent) => {
      if (
        !ref.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onResize = () => portal && updateMenuStyle();
    const onScroll = () => portal && updateMenuStyle();

    document.addEventListener("mousedown", onClick);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, portal]);

  const selected = options.find((o) => o.value === value);
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;

  const menuStyleInline: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 0.5rem)",
    left: 0,
    width: "100%",
    zIndex: 1000,
    maxHeight: "24rem",
  };

  const menuContent = (
    <div
      ref={menuRef}
      style={portal ? (menuStyle ?? undefined) : menuStyleInline}
      className="overflow-hidden rounded-xl border border-white/10 bg-[oklch(0.16_0.008_260)] shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="max-h-64 overflow-auto py-1">
        {filtered.length === 0 && (
          <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
        )}
        {filtered.map((o) => (
          <button
            key={o.value}
            onClick={() => {
              onChange(o.value);
              setOpen(false);
              setQ("");
            }}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/10"
          >
            <span>{o.label}</span>
            {o.value === value && <Check className="h-4 w-4 text-gold" />}
          </button>
        ))}
      </div>
    </div>
  );

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div
        ref={menuRef}
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[oklch(0.16_0.008_260)] shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[60vh] overflow-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">No matches</div>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
                setQ("");
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-white/10"
            >
              <span>{o.label}</span>
              {o.value === value && <Check className="h-4 w-4 text-gold" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderedMenu = modal
    ? createPortal(modalContent, document.body)
    : portal && menuStyle
      ? createPortal(menuContent, document.body)
      : menuContent;

  return (
    <>
      <div ref={ref} className={`relative ${className}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-foreground transition hover:bg-white/10 disabled:opacity-40"
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      {open && renderedMenu}
    </>
  );
}
