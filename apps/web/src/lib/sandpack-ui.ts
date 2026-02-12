/**
 * Sandpack UI Kit — shadcn-style components + inline CSS utilities
 *
 * All components are injected as hidden files into every Sandpack instance.
 * The AI only generates App.tsx, page files, and globals.css (theme colors).
 *
 * NOTE: Tailwind CDN doesn't load in Sandpack's sandboxed iframe, so we
 * provide all needed CSS utility classes via an inline stylesheet.
 */

// ─── Dependencies ───────────────────────────────────────────────────────────

export const SANDPACK_DEPENDENCIES: Record<string, string> = {
  'class-variance-authority': 'latest',
  clsx: 'latest',
  'tailwind-merge': 'latest',
  'lucide-react': 'latest',
  ethers: '^6.13.0',
};

// ─── No custom entry file — use template default ───────────────────────────
// CSS is injected via JavaScript in utils.ts (imported by every component)

// ─── CSS variables + reset (Tailwind CDN loaded dynamically via JS) ─────────

const BASE_CSS = `/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-text-size-adjust: 100%; tab-size: 4; line-height: 1.5; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
img, svg, video { display: block; max-width: 100%; }
button, input, select, textarea { font: inherit; color: inherit; pointer-events: auto; position: relative; }
input, textarea, select { cursor: text; z-index: 1; }
button { cursor: pointer; }
a { color: inherit; text-decoration: inherit; }
h1,h2,h3,h4,h5,h6 { font-size: inherit; font-weight: inherit; }
ol, ul { list-style: none; }
table { border-collapse: collapse; border-color: inherit; text-indent: 0; }
hr { height: 0; color: inherit; border-top-width: 1px; }

/* ─── CSS Variables (defaults — overridden by generated globals.css) ─── */
:root {
  --background: #09090b; --foreground: #fafafa;
  --card: #0f0f12; --card-foreground: #fafafa;
  --primary: #3b82f6; --primary-foreground: #ffffff;
  --secondary: #1c1c22; --secondary-foreground: #fafafa;
  --muted: #1c1c22; --muted-foreground: #a1a1aa;
  --accent: #1c1c22; --accent-foreground: #fafafa;
  --destructive: #ef4444; --destructive-foreground: #ffffff;
  --border: #222228; --input: #222228; --ring: #3b82f6;
  --radius: 0.75rem;
}
body { background-color: var(--background); color: var(--foreground); }
@keyframes toast-in{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
.text-gradient{background:linear-gradient(135deg,var(--primary) 0%,color-mix(in srgb,var(--primary) 70%,#fff) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.glow-primary{box-shadow:0 0 40px color-mix(in srgb,var(--primary) 20%,transparent)}
`;

// Build the inject-css module:
// 1. Injects CSS variables + reset immediately (sync)
// 2. Loads real Tailwind CDN dynamically and configures custom theme
const INJECT_CSS = `
const BASE = ${JSON.stringify(BASE_CSS)};

let injected = false;
export function injectBaseCSS() {
  if (injected) return;
  injected = true;

  // 1. Inject CSS variables + reset immediately
  const style = document.createElement("style");
  style.id = "__bnbrew-base";
  style.textContent = BASE;
  document.head.appendChild(style);

  // 2. Load real Tailwind CDN
  if (document.getElementById("__tw-cdn")) return;
  const script = document.createElement("script");
  script.id = "__tw-cdn";
  script.src = "https://cdn.tailwindcss.com";
  script.onload = () => {
    if (typeof window.tailwind !== "undefined") {
      window.tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              border: "var(--border)",
              input: "var(--input)",
              ring: "var(--ring)",
              background: "var(--background)",
              foreground: "var(--foreground)",
              primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
              secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
              destructive: { DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" },
              muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
              accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },
              card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
            },
            borderRadius: {
              lg: "var(--radius)",
              md: "calc(var(--radius) - 2px)",
              sm: "calc(var(--radius) - 4px)",
            },
          },
        },
      };
    }
  };
  document.head.appendChild(script);
}
`;

// ─── Component Source Code ──────────────────────────────────────────────────

const UTILS = `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { injectBaseCSS } from "./inject-css";

injectBaseCSS();

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`;

const BUTTON = `import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-110",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-110",
        outline: "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:brightness-125",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };`;

const CARD = `import * as React from "react";
import { cn } from "/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-card text-card-foreground shadow-sm", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}`;

const INPUT = `import * as React from "react";
import { cn } from "/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}`;

const TEXTAREA = `import * as React from "react";
import { cn } from "/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}`;

const LABEL = `import * as React from "react";
import { cn } from "/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}`;

const BADGE = `import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}`;

const SEPARATOR = `import * as React from "react";
import { cn } from "/lib/utils";

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      role="separator"
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  );
}`;

const TABLE = `import * as React from "react";
import { cn } from "/lib/utils";

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-border transition-colors hover:bg-muted/50", className)} {...props} />;
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0", className)} {...props} />;
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />;
}`;

const TABS = `import * as React from "react";
import { cn } from "/lib/utils";

const TabsContext = React.createContext<{
  value: string;
  onValueChange: (v: string) => void;
}>({ value: "", onValueChange: () => {} });

export function Tabs({
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  className,
  children,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const value = controlledValue ?? internalValue;
  const setValue = onValueChange ?? setInternalValue;

  return (
    <TabsContext.Provider value={{ value, onValueChange: setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  value,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const ctx = React.useContext(TabsContext);
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none",
        ctx.value === value
          ? "bg-background text-foreground shadow-sm"
          : "hover:text-foreground",
        className
      )}
      onClick={() => ctx.onValueChange(value)}
      {...props}
    />
  );
}

export function TabsContent({
  value,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={cn("mt-2", className)} {...props} />;
}`;

const DIALOG = `import * as React from "react";
import { cn } from "/lib/utils";
import { X } from "lucide-react";

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/80"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50">{children}</div>
    </div>
  );
}

export function DialogContent({
  className,
  children,
  onClose,
}: React.HTMLAttributes<HTMLDivElement> & { onClose?: () => void }) {
  return (
    <div
      className={cn(
        "relative w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg",
        className
      )}
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4", className)} {...props} />;
}`;

const TOAST = `import * as React from "react";
import { cn } from "/lib/utils";
import { CheckCircle, XCircle, X } from "lucide-react";

interface ToastData {
  id: number;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

type ToastListener = (t: ToastData) => void;
let listeners: ToastListener[] = [];

export function toast(data: Omit<ToastData, "id">) {
  const t = { ...data, id: Date.now() + Math.random() };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  React.useEffect(() => {
    const handler: ToastListener = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 4000);
    };
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((l) => l !== handler);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-lg border border-border bg-card p-4 shadow-lg flex items-start gap-3",
            t.variant === "destructive" && "border-destructive/50"
          )}
          style={{ animation: "toast-in 0.3s ease-out" }}
        >
          {t.variant === "destructive" ? (
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            {t.title && <p className="text-sm font-semibold">{t.title}</p>}
            {t.description && (
              <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
            )}
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}`;

const SELECT = `import * as React from "react";
import { cn } from "/lib/utils";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
}: {
  value?: string;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value || ""}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(
          "flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}`;

const CONTAINER = `import * as React from "react";
import { cn } from "/lib/utils";

export function Container({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
}`;

// ─── Wallet + Contract mocks (real implementations injected by deploy scaffold) ──

const MOCK_USE_WALLET = `import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface WalletContextType {
  address: string | null;
  signer: null;
  provider: null;
  isConnecting: boolean;
  isOwner: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null, signer: null, provider: null,
  isConnecting: false, isOwner: false,
  connect: async () => {}, disconnect: () => {},
});

export function WalletProvider({ ownerAddress, children }: { ownerAddress?: string; children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    await new Promise(r => setTimeout(r, 800));
    const mock = '0x' + 'f'.repeat(40);
    setAddress(mock);
    setIsConnecting(false);
  }, []);

  const disconnect = useCallback(() => setAddress(null), []);
  const isOwner = !!address;

  return (
    <WalletContext.Provider value={{ address, signer: null, provider: null, isConnecting, isOwner, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}`;

const MOCK_USE_APP_CONTRACT = `import { useState, useCallback } from 'react';
import { useWallet } from '/hooks/useWallet';

export function useAppContract() {
  const { address, connect } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitTx = useCallback(async (
    contractName: string,
    functionName: string,
    args: any[] = [],
    options?: { value?: string }
  ): Promise<string> => {
    if (!address) { connect(); throw new Error('Wallet not connected'); }
    setIsSubmitting(true);
    // Simulate transaction in preview
    await new Promise(r => setTimeout(r, 1500));
    setIsSubmitting(false);
    return '0x' + Math.random().toString(16).slice(2, 66).padEnd(64, '0');
  }, [address, connect]);

  const readContract = useCallback(async (
    contractName: string,
    functionName: string,
    args?: any[]
  ): Promise<any> => {
    // Simulate read delay
    await new Promise(r => setTimeout(r, 300));
    // Return sensible defaults for common patterns
    if (functionName.includes('count') || functionName.includes('Count')) return BigInt(0);
    if (functionName.includes('total') || functionName.includes('Total')) return BigInt(0);
    if (functionName.includes('balance') || functionName.includes('Balance')) return BigInt(0);
    if (functionName.includes('get') && functionName.includes('All')) return [];
    if (functionName.includes('owner')) return '0x' + '0'.repeat(40);
    return BigInt(0);
  }, []);

  return { submitTx, readContract, isSubmitting };
}`;

const MOCK_CONNECT_WALLET = `import React from 'react';
import { useWallet } from '/hooks/useWallet';
import { Button } from '/components/ui';
import { Wallet } from 'lucide-react';

export function ConnectWallet() {
  const { address, isConnecting, connect, disconnect } = useWallet();

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-sm">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={connect} disabled={isConnecting} className="gap-2">
      <Wallet className="h-4 w-4" />
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
}`;

const MOCK_REQUIRE_OWNER = `import React from 'react';
import { useWallet } from '/hooks/useWallet';
import { Button, Card, CardContent } from '/components/ui';
import { ShieldX, Wallet } from 'lucide-react';

export function RequireOwner({ children }: { children: React.ReactNode }) {
  const { address, isOwner, connect, isConnecting } = useWallet();

  if (!address) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Connect Your Wallet</h2>
            <p className="text-muted-foreground">This page requires owner authentication.</p>
            <Button onClick={connect} disabled={isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <ShieldX className="h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground">Only the app owner can access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}`;

// ─── Barrel export ──────────────────────────────────────────────────────────

const BARREL = `export { Button, buttonVariants } from "./button";
export type { ButtonProps } from "./button";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";

export { Input } from "./input";
export type { InputProps } from "./input";

export { Textarea } from "./textarea";
export type { TextareaProps } from "./textarea";

export { Label } from "./label";
export type { LabelProps } from "./label";

export { Badge } from "./badge";
export type { BadgeProps } from "./badge";

export { Separator } from "./separator";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table";

export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./dialog";

export { toast, Toaster } from "./toast";

export { Select } from "./select";
export type { SelectOption } from "./select";

export { Container } from "./container";`;

// ─── Final export: all files for Sandpack ───────────────────────────────────

// ─── Simple index.html ──────────────────────────────────────────────────────

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

export const SANDPACK_UI_FILES: Record<string, { code: string; hidden: boolean }> = {
  '/public/index.html': { code: INDEX_HTML, hidden: true },
  '/lib/inject-css.ts': { code: INJECT_CSS, hidden: true },
  '/lib/utils.ts': { code: UTILS, hidden: true },
  '/components/ui/button.tsx': { code: BUTTON, hidden: true },
  '/components/ui/card.tsx': { code: CARD, hidden: true },
  '/components/ui/input.tsx': { code: INPUT, hidden: true },
  '/components/ui/textarea.tsx': { code: TEXTAREA, hidden: true },
  '/components/ui/label.tsx': { code: LABEL, hidden: true },
  '/components/ui/badge.tsx': { code: BADGE, hidden: true },
  '/components/ui/separator.tsx': { code: SEPARATOR, hidden: true },
  '/components/ui/table.tsx': { code: TABLE, hidden: true },
  '/components/ui/tabs.tsx': { code: TABS, hidden: true },
  '/components/ui/dialog.tsx': { code: DIALOG, hidden: true },
  '/components/ui/toast.tsx': { code: TOAST, hidden: true },
  '/components/ui/select.tsx': { code: SELECT, hidden: true },
  '/components/ui/container.tsx': { code: CONTAINER, hidden: true },
  '/components/ui/index.tsx': { code: BARREL, hidden: true },
  // Wallet + contract mocks (replaced by real implementations in deploy scaffold)
  '/hooks/useWallet.tsx': { code: MOCK_USE_WALLET, hidden: true },
  '/hooks/useAppContract.ts': { code: MOCK_USE_APP_CONTRACT, hidden: true },
  '/components/ConnectWallet.tsx': { code: MOCK_CONNECT_WALLET, hidden: true },
  '/components/RequireOwner.tsx': { code: MOCK_REQUIRE_OWNER, hidden: true },
};
