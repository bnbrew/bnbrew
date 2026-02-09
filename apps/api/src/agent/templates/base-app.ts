export const BASE_PACKAGE_JSON = {
  name: 'bnbrew-app',
  private: true,
  type: 'module',
  scripts: {
    dev: 'vite',
    build: 'tsc && vite build',
    preview: 'vite preview',
  },
  dependencies: {
    react: '^19.0.0',
    'react-dom': '^19.0.0',
    'react-router-dom': '^7.1.0',
    ethers: '^6.13.0',
  },
  devDependencies: {
    '@types/react': '^19.0.0',
    '@types/react-dom': '^19.0.0',
    '@vitejs/plugin-react': '^4.3.0',
    typescript: '^5.7.0',
    vite: '^6.0.0',
    tailwindcss: '^4.0.0',
    '@tailwindcss/vite': '^4.0.0',
  },
};

export const BASE_VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
`;

export const BASE_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{APP_NAME}}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
`;

export const BASE_MAIN_TSX = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
`;

export const BASE_INDEX_CSS = `@import "tailwindcss";
`;

export const BASE_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
`;
