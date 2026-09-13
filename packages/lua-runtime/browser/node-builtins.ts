/**
 * Stand-in for the Node built-ins (`module`, `url`) that wasmoon imports only
 * when it runs under Node. Bundlers alias those imports here for browsers.
 */
export default {};
export const createRequire = undefined;
export const pathToFileURL = undefined;
export const fileURLToPath = undefined;
