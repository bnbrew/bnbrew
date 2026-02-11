'use client';

import { useEffect, useRef, useState } from 'react';

interface PreviewSandboxProps {
  files: Array<{ path: string; content: string; language: string }>;
  isActive: boolean;
}

/**
 * Renders generated app files in a sandboxed iframe using srcdoc.
 * Constructs a single HTML page from the generated file map
 * for instant preview without a build step.
 */
export default function PreviewSandbox({ files, isActive }: PreviewSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isActive || files.length === 0) return;

    try {
      const htmlFile = files.find((f) => f.path.endsWith('.html') || f.path.endsWith('index.html'));
      const cssFiles = files.filter((f) => f.path.endsWith('.css'));
      const jsFiles = files.filter((f) => f.path.endsWith('.tsx') || f.path.endsWith('.ts') || f.path.endsWith('.jsx') || f.path.endsWith('.js'));

      // Build a preview HTML document
      const previewHtml = buildPreviewHtml(
        htmlFile?.content,
        cssFiles.map((f) => f.content),
        jsFiles,
      );

      if (iframeRef.current) {
        iframeRef.current.srcdoc = previewHtml;
      }

      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview error');
    }
  }, [files, isActive]);

  if (!isActive) return null;

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-bnb-error text-sm">Preview error</p>
          <p className="text-xs text-bnb-gray">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0 bg-white"
        sandbox="allow-scripts"
        title="App Preview"
      />

      {/* Preview mode badge */}
      <div className="absolute top-3 right-3 px-2 py-1 bg-bnb-dark/80 border border-bnb-border rounded text-xs text-bnb-gray">
        Preview Mode
      </div>
    </div>
  );
}

function buildPreviewHtml(
  htmlContent: string | undefined,
  cssContents: string[],
  jsFiles: Array<{ path: string; content: string }>,
): string {
  const styles = cssContents.join('\n');

  // If we have raw HTML, use it as the base
  if (htmlContent) {
    // Inject CSS into the head
    const styledHtml = htmlContent.replace(
      '</head>',
      `<style>${styles}</style></head>`,
    );
    return styledHtml;
  }

  // Otherwise build a minimal preview page
  const componentPreviews = jsFiles
    .filter((f) => f.path.includes('components/') || f.path.includes('pages/'))
    .map((f) => {
      const name = f.path.split('/').pop()?.replace(/\.(tsx|ts|jsx|js)$/, '') || 'Component';
      return `<div class="preview-component">
        <div class="preview-label">${name}</div>
        <div class="preview-placeholder">Component: ${name}</div>
      </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App Preview</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Space Grotesk', sans-serif;
      background: #f5f5f5;
      padding: 24px;
    }
    .preview-component {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .preview-label {
      font-size: 11px;
      font-weight: 600;
      color: #F0B90B;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }
    .preview-placeholder {
      padding: 32px;
      background: #fafafa;
      border: 2px dashed #e0e0e0;
      border-radius: 8px;
      text-align: center;
      color: #999;
      font-size: 14px;
    }
    ${styles}
  </style>
</head>
<body>
  <div id="app">
    ${componentPreviews || '<div class="preview-placeholder">Your app preview will render here</div>'}
  </div>
</body>
</html>`;
}
