import localforage from "localforage";

export const ogDataCache = localforage.createInstance({
    name: "ogDataCache"
});
  
export const ogDataCacheDisable = localforage.createInstance({
    name: "ogDataCacheDisable"
});