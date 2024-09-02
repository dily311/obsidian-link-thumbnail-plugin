import { Platform } from "obsidian";

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const Buffer = (Platform.isMobileApp) ? require("buffer/index.ts") : global.Buffer;
