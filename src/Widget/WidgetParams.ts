import { Platform, requestUrl } from "obsidian";
import { ogDataCache, ogDataCacheDisable } from "@/Utils/localforage";

// 캐시 제한
const MAX_CACHE_SIZE = 1000;
const MAX_DISABLE_CACHE_SIZE = 2000;

// baseUrl 구하는 정규식
const BASEURL = new RegExp("^https?:\\/\\/[^\\/]+"); 
const BUFFER = (Platform.isMobileApp) ? require("buffer/index.ts") : global.Buffer;

export interface ogData {
    "ogTitle": string;
    "ogDescription": string;
    "ogImage": string;
    "ogImageAlt": string;
    "ogUrl": string;
    "baseUrl": string;
}
export class LinkDataManger {
    private memoryCache: Map<string, ogData> = new Map();
    private disableCache: Set<string> = new Set(); // 단순 존재 확인은 Set이 더 빠름

    clearCache() {
        this.memoryCache.clear();
        this.disableCache.clear();
    }

    setCache(key: string, data: ogData) {
        // 메모리가 가득찼다면 FIFO 순으로 삭제
        if (this.memoryCache.size > MAX_CACHE_SIZE) {
            const firstKey = this.memoryCache.keys().next().value;
            if (firstKey) this.memoryCache.delete(firstKey)
        }
        this.memoryCache.set(key, data);
        ogDataCache.setItem(key, data);
    }

    setDisableCache(key: string) {
        if (this.disableCache.size > MAX_DISABLE_CACHE_SIZE) {
            // 메모리가 가득찼다면 disableCache는 비워버리기
            this.disableCache.clear();
        }
        this.disableCache.add(key);
        ogDataCacheDisable.setItem(key, "");
    }
    
    async getCachedLink(key: string) {
        // 1. Disable 메모리 확인
        if (this.disableCache.has(key)) return null;

        // 2. 정상 메모리 확인
        if (this.memoryCache.has(key)) {

            return this.memoryCache.get(key);
        }

        // 3. Disable DB 확인 (비동기)
        const isDisableData = await ogDataCacheDisable.getItem(key);
        if (isDisableData) {
            this.disableCache.add(key);
            return null;
        }

        // 4. 정상 DB 확인 (비동기)
        const cachedData = await ogDataCache.getItem(key) as ogData;
        if (cachedData) {
            this.memoryCache.set(key, cachedData);
            return cachedData;
        }
        
        // 5. 모두 없으면 네트워크 요청
        const data = await this.createdLinkWidget(key);
        if (!data) {
            this.setDisableCache(key);
            return null;
        }
        
        // 링크가 정상적으로 접속이 가능하다면
        this.setCache(key, data);
        return data;
    }
    
    async createdLinkWidget(key: string) {
        const document = await conn(key);
        if(document) {


            const base = BASEURL.exec(key);
            const ogTitle = document.querySelector("meta[property='og:title']")?.getAttribute("content") || document.querySelector("title")?.textContent || "";
            if (ogTitle === "") return null;
        
            let ogDescription = document.querySelector("meta[property='og:description']")?.getAttribute("content") || "";
            ogDescription = ogDescription.replace(/(<([^>]+)>)/gi, "")
                                                            .replace(/(&(\S+?);)/, "") 
                                                            .replace(/\s\s+/g, ' ')
                                                            .trim();

            let ogImage = document.querySelector("meta[property='og:image']")?.getAttribute("content") || "";
            if (base && ogImage !== "" ) {
                if (!ogImage.startsWith("https:")) {
                    if (ogImage.startsWith("//")) {
                        ogImage = "https:" + ogImage;
                    } else {
                        ogImage = base[0] + ((ogImage.startsWith("/"))? "" : "/") + ogImage;
                    }
                }
            }
        
            const ogImageAlt = document.querySelector("meta[property='og:image:alt']")?.getAttribute("content") || "";
            const data: ogData =  {
                ogTitle: ogTitle,
                ogDescription: ogDescription,
               ogImage: ogImage,
               ogImageAlt: ogImageAlt,
               ogUrl: key,
               baseUrl: base ? base[0]: key,
            }
            return data
        }
        return null;
    }
}

async function conn(url: string) {
    try {
        const response = await requestUrl({
            url:url,
            headers:{
                "user-agent": navigator.userAgent,
                'accept-language': navigator.language,
                'accept-encoding': "UTF-8",
            },
            // timeout
            throw: false
        });

        const contentType = response.headers["content-type"];
        if (response && response.headers && contentType && !contentType?.includes('text/')) {
            throw new Error('Page must return a header content-type with text/');
        }
        if (!response.text?.includes("charset") && !contentType.includes("charset")) {
            throw new Error('Page is not html file')
        }

        const bodyArrayBuffer = response.arrayBuffer;
        const charsetRegex = new RegExp(/charset=["']?(.+?)["']/i);
        const regex = charsetRegex.exec(response.text);
        const charset = (regex) ? regex[1] : contentType.substring(contentType.indexOf("charset=") + 8, contentType.length);
    
        let body;
        if (charset === "utf-8") {
            body = BUFFER.from(bodyArrayBuffer).toString('utf-8');
        } else {
            const decoder = new TextDecoder(charset);
            body = decoder.decode(BUFFER.from(bodyArrayBuffer));
        }
        const parser = new DOMParser();
        const document = parser.parseFromString(body, 'text/html');

        return document;
    } catch (error) {
        console.log(error, url);
    }
}
