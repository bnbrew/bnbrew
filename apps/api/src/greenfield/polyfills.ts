/**
 * Browser global polyfills for Greenfield JS SDK.
 * MUST be imported before any Greenfield/cosmjs/axios imports.
 * Only used in the isolated worker process — never in the main NestJS process.
 */
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    ...globalThis,
    location: { href: 'http://localhost', origin: 'http://localhost', protocol: 'http:', host: 'localhost' },
    navigator: { userAgent: 'node' },
    document: { createElement: () => ({}), head: { appendChild: () => {} } },
  };
}
if (typeof globalThis.document === 'undefined') {
  (globalThis as any).document = { createElement: () => ({}), head: { appendChild: () => {} } };
}
