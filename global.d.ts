// Allow plain CSS side-effect imports (e.g. import './foo.css')
// Next.js handles these at build time; TypeScript just needs to know they exist.
declare module '*.css'
