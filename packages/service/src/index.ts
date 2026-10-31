/**
 * Application use cases over a project folder, free of any UI. The Electron main process, the command line and a
 * future remote client all call this layer (see doc/readme/architecture.md, "Client boundary").
 */
export * from './footage';
export * from './project-service';
export * from './starter';
