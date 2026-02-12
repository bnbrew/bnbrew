import type { AppSpec } from '@bnbrew/shared';

interface ContractConfig {
  name: string;
  address: string;
  abi: unknown[];
}

/**
 * Convert Sandpack preview files into a full Vite + React + Tailwind project.
 * No LLM needed — purely deterministic transformation.
 *
 * Includes the same UI component kit that Sandpack uses as hidden files,
 * so all imports like `/components/ui` and `/lib/utils` resolve correctly.
 */
export function scaffoldViteProject(
  previewFiles: Record<string, string>,
  contracts: ContractConfig[],
  appSpec: AppSpec,
  ownerAddress?: string,
): Record<string, string> {
  const files: Record<string, string> = {};
  const primaryColor = appSpec.frontend?.theme?.primaryColor || '#3b82f6';

  // 1. package.json
  files['package.json'] = JSON.stringify({
    name: appSpec.id,
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
    dependencies: {
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      'react-router-dom': '^7.0.0',
      ethers: '^6.13.0',
      'lucide-react': '^0.460.0',
      'tailwind-merge': '^2.6.0',
      clsx: '^2.1.0',
      'class-variance-authority': '^0.7.0',
    },
    devDependencies: {
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
      '@vitejs/plugin-react': '^4.3.0',
      typescript: '^5.7.0',
      vite: '^6.0.0',
      tailwindcss: '^3.4.0',
      postcss: '^8.4.0',
      autoprefixer: '^10.4.0',
    },
  }, null, 2);

  // 2. vite.config.ts — plugin resolves all /foo imports from src/
  files['vite.config.ts'] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, 'src');

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'resolve-absolute-imports',
      resolveId(source) {
        if (!source.startsWith('/') || source.startsWith('/src/') || source.startsWith('/node_modules')) return null;
        const base = path.join(srcDir, source.slice(1));
        const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
        for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '.json']) {
          if (isFile(base + ext)) return base + ext;
        }
        for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
          const idx = path.join(base, 'index' + ext);
          if (isFile(idx)) return idx;
        }
        return null;
      },
    },
  ],
});
`;

  // 3. tsconfig.json
  files['tsconfig.json'] = JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      useDefineForClassFields: true,
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      skipLibCheck: true,
      moduleResolution: 'bundler',
      allowImportingTsExtensions: true,
      isolatedModules: true,
      moduleDetection: 'force',
      noEmit: true,
      jsx: 'react-jsx',
      strict: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
    },
    include: ['src'],
  }, null, 2);

  // 4. postcss.config.cjs
  files['postcss.config.cjs'] = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

  // 5. tailwind.config.cjs — full theme with CSS variable colors
  files['tailwind.config.cjs'] = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
`;

  // 6. index.html
  files['index.html'] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appSpec.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  // 7. src/index.css — CSS variables + reset + Tailwind directives
  files['src/index.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-text-size-adjust: 100%; tab-size: 4; line-height: 1.5; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
img, svg, video { display: block; max-width: 100%; }
button, input, select, textarea { font: inherit; color: inherit; pointer-events: auto; position: relative; z-index: 1; }
input, textarea, select { cursor: text; }
button { cursor: pointer; }
a { color: inherit; text-decoration: inherit; }

:root {
  --background: #09090b;
  --foreground: #fafafa;
  --card: #0f0f12;
  --card-foreground: #fafafa;
  --primary: ${primaryColor};
  --primary-foreground: #ffffff;
  --secondary: #1c1c22;
  --secondary-foreground: #fafafa;
  --muted: #1c1c22;
  --muted-foreground: #a1a1aa;
  --accent: #1c1c22;
  --accent-foreground: #fafafa;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --border: #222228;
  --input: #222228;
  --ring: ${primaryColor};
  --radius: 0.75rem;
}

body {
  background-color: var(--background);
  color: var(--foreground);
}

@keyframes toast-in {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.text-gradient {
  background: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #fff) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.glow-primary {
  box-shadow: 0 0 40px color-mix(in srgb, var(--primary) 20%, transparent);
}
`;

  // 8. src/main.tsx — wrapped with WalletProvider (ConnectWallet is rendered by LLM in App.tsx nav)
  const owner = ownerAddress || appSpec.owner || '';
  files['src/main.tsx'] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { WalletProvider } from './hooks/useWallet';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider ownerAddress="${owner}">
      <App />
    </WalletProvider>
  </React.StrictMode>
);
`;

  // 9. Contract config + ABI files
  files['src/config.json'] = JSON.stringify({
    appId: appSpec.id,
    contracts: contracts.map((c) => ({
      name: c.name,
      address: c.address,
    })),
  }, null, 2);

  for (const contract of contracts) {
    files[`src/abi/${contract.name}.json`] = JSON.stringify(contract.abi, null, 2);
  }

  // 10. Contract hook
  files['src/hooks/useContract.ts'] = generateContractHook(contracts);

  // 11. UI component kit (same as Sandpack hidden files)
  const uiFiles = generateUIKit();
  for (const [path, content] of Object.entries(uiFiles)) {
    files[path] = content;
  }

  // 12. Wallet + auth infrastructure
  const walletFiles = generateWalletInfrastructure(owner, contracts);
  for (const [filePath, content] of Object.entries(walletFiles)) {
    files[filePath] = content;
  }

  // 13. Map preview files into src/
  for (const [filePath, content] of Object.entries(previewFiles)) {
    const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    if (normalizedPath === 'index.css' || normalizedPath === 'main.tsx') continue;
    const destPath = normalizedPath.startsWith('src/') ? normalizedPath : `src/${normalizedPath}`;
    files[destPath] = content;
  }

  // 14. Post-process App.tsx — inject ConnectWallet + RequireOwner
  if (files['src/App.tsx']) {
    files['src/App.tsx'] = postProcessAppTsx(files['src/App.tsx'], appSpec);
  }

  return files;
}

function generateContractHook(contracts: ContractConfig[]): string {
  const imports = contracts.map(
    (c) => `import ${c.name}ABI from '../abi/${c.name}.json';`,
  ).join('\n');

  const configs = contracts.map(
    (c) => `  ${c.name}: { address: '${c.address}' as const, abi: ${c.name}ABI },`,
  ).join('\n');

  return `import { ethers } from 'ethers';
${imports}

const RPC_URL = 'https://opbnb-testnet-rpc.bnbchain.org';

export const contracts = {
${configs}
};

export function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

export function getContract(name: keyof typeof contracts) {
  const provider = getProvider();
  const config = contracts[name];
  return new ethers.Contract(config.address, config.abi, provider);
}

export function getSignedContract(name: keyof typeof contracts, signer: ethers.Signer) {
  const config = contracts[name];
  return new ethers.Contract(config.address, config.abi, signer);
}
`;
}

function generateUIKit(): Record<string, string> {
  const files: Record<string, string> = {};

  // lib/utils.ts — cn() helper (no CSS injection needed, Tailwind is via PostCSS)
  files['src/lib/utils.ts'] = `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`;

  // lib/inject-css.ts — no-op (Tailwind handled by PostCSS in build)
  files['src/lib/inject-css.ts'] = `export function injectBaseCSS() {}`;

  // components/ui/button.tsx
  files['src/components/ui/button.tsx'] = `import * as React from "react";
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

  // components/ui/card.tsx
  files['src/components/ui/card.tsx'] = `import * as React from "react";
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

  // components/ui/input.tsx
  files['src/components/ui/input.tsx'] = `import * as React from "react";
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

  // components/ui/textarea.tsx
  files['src/components/ui/textarea.tsx'] = `import * as React from "react";
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

  // components/ui/label.tsx
  files['src/components/ui/label.tsx'] = `import * as React from "react";
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

  // components/ui/badge.tsx
  files['src/components/ui/badge.tsx'] = `import * as React from "react";
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

  // components/ui/separator.tsx
  files['src/components/ui/separator.tsx'] = `import * as React from "react";
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

  // components/ui/table.tsx
  files['src/components/ui/table.tsx'] = `import * as React from "react";
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

  // components/ui/tabs.tsx
  files['src/components/ui/tabs.tsx'] = `import * as React from "react";
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

  // components/ui/dialog.tsx
  files['src/components/ui/dialog.tsx'] = `import * as React from "react";
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

  // components/ui/toast.tsx
  files['src/components/ui/toast.tsx'] = `import * as React from "react";
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

  // components/ui/select.tsx
  files['src/components/ui/select.tsx'] = `import * as React from "react";
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

  // components/ui/container.tsx
  files['src/components/ui/container.tsx'] = `import * as React from "react";
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

  // components/ui/index.tsx — barrel export
  files['src/components/ui/index.tsx'] = `export { Button, buttonVariants } from "./button";
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

  return files;
}

function generateWalletInfrastructure(
  ownerAddress: string,
  contracts: ContractConfig[],
): Record<string, string> {
  const files: Record<string, string> = {};

  // src/hooks/useWallet.tsx — React context + ethers v6 wallet connection + auto chain switch
  files['src/hooks/useWallet.tsx'] = `import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { ethers } from 'ethers';

const OPBNB_TESTNET = {
  chainId: '0x15EB',
  chainName: 'opBNB Testnet',
  nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls: ['https://opbnb-testnet-rpc.bnbchain.org'],
  blockExplorerUrls: ['https://opbnb-testnet.bscscan.com'],
};

async function switchToOpBNB(eth: any) {
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: OPBNB_TESTNET.chainId }] });
  } catch (err: any) {
    // 4902 = chain not added yet
    if (err.code === 4902) {
      await eth.request({ method: 'wallet_addEthereumChain', params: [OPBNB_TESTNET] });
    } else {
      throw err;
    }
  }
}

interface WalletContextType {
  address: string | null;
  signer: ethers.JsonRpcSigner | null;
  provider: ethers.BrowserProvider | null;
  isConnecting: boolean;
  isOwner: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  signer: null,
  provider: null,
  isConnecting: false,
  isOwner: false,
  connect: async () => {},
  disconnect: () => {},
});

export function WalletProvider({ ownerAddress, children }: { ownerAddress: string; children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      alert('Please install MetaMask to use this app');
      return;
    }
    setIsConnecting(true);
    try {
      // Switch to opBNB testnet first
      await switchToOpBNB(eth);
      const p = new ethers.BrowserProvider(eth);
      const s = await p.getSigner();
      const addr = await s.getAddress();
      setProvider(p);
      setSigner(s);
      setAddress(addr);
    } catch (err) {
      console.error('Failed to connect wallet:', err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setProvider(null);
  }, []);

  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) disconnect();
      else setAddress(accounts[0]);
    };
    const handleChainChanged = () => {
      // Re-init provider on chain change
      window.location.reload();
    };
    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);
    return () => {
      eth.removeListener('accountsChanged', handleAccountsChanged);
      eth.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnect]);

  const isOwner = address
    ? address.toLowerCase() === ownerAddress.toLowerCase()
    : false;

  return (
    <WalletContext.Provider value={{ address, signer, provider, isConnecting, isOwner, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
`;

  // src/components/ConnectWallet.tsx
  files['src/components/ConnectWallet.tsx'] = `import React from 'react';
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
}
`;

  // src/components/RequireOwner.tsx — gate for admin pages
  files['src/components/RequireOwner.tsx'] = `import React from 'react';
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
            <p className="text-muted-foreground">
              This page requires owner authentication.
            </p>
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
            <p className="text-muted-foreground">
              Only the app owner can access this page.
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              Connected: {address.slice(0, 10)}...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
`;

  // src/hooks/useAppContract.ts — typed wrapper around deployed contracts
  const contractMethods = contracts.map((c) => {
    return `  ${c.name}: {
    address: '${c.address}' as const,
    abi: ${c.name}ABI,
  },`;
  }).join('\n');

  const abiImports = contracts.map(
    (c) => `import ${c.name}ABI from '../abi/${c.name}.json';`,
  ).join('\n');

  files['src/hooks/useAppContract.ts'] = `import { useState } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '/hooks/useWallet';
${abiImports}

const RPC_URL = 'https://opbnb-testnet-rpc.bnbchain.org';

const CONTRACTS: Record<string, { address: string; abi: any[] }> = {
${contractMethods}
};

interface TxOptions {
  value?: string; // ETH/BNB amount in ether (e.g. "0.01")
}

export function useAppContract() {
  const { signer, connect } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitTx = async (contractName: string, functionName: string, args: any[] = [], options?: TxOptions) => {
    if (!signer) {
      await connect();
      throw new Error('Please connect your wallet first');
    }
    const config = CONTRACTS[contractName];
    if (!config) throw new Error('Contract ' + contractName + ' not found');
    setIsSubmitting(true);
    try {
      const contract = new ethers.Contract(config.address, config.abi, signer);
      const overrides: any = {};
      if (options?.value) {
        overrides.value = ethers.parseEther(options.value);
      }
      const tx = await contract[functionName](...args, overrides);
      const receipt = await tx.wait();
      return receipt;
    } finally {
      setIsSubmitting(false);
    }
  };

  const readContract = async (contractName: string, functionName: string, args: any[] = []) => {
    const config = CONTRACTS[contractName];
    if (!config) throw new Error('Contract ' + contractName + ' not found');
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(config.address, config.abi, provider);
    return contract[functionName](...args);
  };

  return { submitTx, readContract, isSubmitting };
}
`;

  return files;
}

/**
 * Post-process the LLM-generated App.tsx to inject wallet UI and admin protection.
 * This is a best-effort transformation — if patterns don't match, the app still works.
 */
function postProcessAppTsx(content: string, appSpec: AppSpec): string {
  let code = content;

  // 1. Add wallet/auth imports after the last import statement
  const walletImports = [
    'import { useWallet } from "/hooks/useWallet";',
    'import { RequireOwner } from "/components/RequireOwner";',
  ].join('\n');

  const importRegex = /^import\s.+$/gm;
  let lastImportEnd = 0;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(code)) !== null) {
    lastImportEnd = match.index + match[0].length;
  }
  if (lastImportEnd > 0) {
    code = code.slice(0, lastImportEnd) + '\n' + walletImports + code.slice(lastImportEnd);
  }

  // 2. Wrap requiresAuth pages with RequireOwner
  const authPages = appSpec.frontend?.pages?.filter((p) => p.requiresAuth) || [];
  for (const page of authPages) {
    const route = page.route.replace(/^\//, '') || 'admin';
    // Match: {page === "admin" && <Admin />} or {page === "admin" && <AdminDashboard />}
    const pagePattern = new RegExp(
      `(\\{\\s*page\\s*===\\s*["'])${route}(["']\\s*&&\\s*)((?:<\\w+)\\s*/>)\\s*\\}`,
      'g',
    );
    code = code.replace(pagePattern, `$1${route}$2<RequireOwner>$3</RequireOwner>}`);
  }

  return code;
}
