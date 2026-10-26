/**
 * Node.js file system adapter for the project format. Lives apart from `core` so that `core` stays free of Node
 * imports; used by the CLI and the Electron main process.
 */
export * from './node-fs';
