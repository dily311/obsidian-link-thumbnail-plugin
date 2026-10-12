const localforage = window?.localforage;
if (!localforage) {
    console.error("옵시디언 내장 localforage를 찾을 수 없습니다.");
}

export const ogDataCache = localforage?.createInstance({
    name: "ogDataCache"
});
  
export const ogDataCacheDisable = localforage?.createInstance({
    name: "ogDataCacheDisable"
});