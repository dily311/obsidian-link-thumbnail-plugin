import { requestUrl } from "obsidian";
import { Buffer } from "../LivePreviewMode/Buffer";
import { ogDataCache, ogDataCacheDisable } from "../Utils/localforage";

// baseUrl 구하는 정규식
const baseUrl = new RegExp("^https?:\\/\\/[^\\/]+"); 

export class LinkDataManger {
    private memoryCache: Map<string, string> = new Map();
    private disableCache: Set<string> = new Set(); // 단순 존재 확인은 Set이 더 빠름

    constructor() {
    }

    clearCache() {
        this.memoryCache.clear();
        this.disableCache.clear();
    }

    setCache(key: string, data: string) {
        this.memoryCache.set(key, data);
        ogDataCache.setItem(key, data);
    }

    setDisableCache(key: string) {
        this.disableCache.add(key);
        ogDataCacheDisable.setItem(key, "");
    }
    
    async getCachedLink(key: string) {
        // 1. Disable 메모리 확인
        if (this.disableCache.has(key)) return null;

        // 2. 정상 메모리 확인
        if (this.memoryCache.has(key)) return this.memoryCache.get(key);

        // 3. Disable DB 확인 (비동기)
        const isDisableData = await ogDataCacheDisable.getItem(key);
        if (isDisableData) {
            this.disableCache.add(key);
            return null;
        }

        // 4. 정상 DB 확인 (비동기)
        const cachedData = await ogDataCache.getItem(key) as string;
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


            const base = baseUrl.exec(key);
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
            const data =  `
                ${(ogImage === "")? "" : `<div class="og-thumbnail"><img src="${ogImage}" alt="${ogImageAlt}" loading="lazy"></img></div>`}
                <div class="og-info-container">
                    <div class="og-info">
                        <strong>${ogTitle}</strong>
                    </div>
                    <div class="og-description">
                        ${ogDescription}
                    </div>
                    <div class="og-url">${key}</div>
                </div>
            `;
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
            body = Buffer.from(bodyArrayBuffer).toString('utf-8');
        } else {
            const decoder = new TextDecoder(charset);
            body = decoder.decode(Buffer.from(bodyArrayBuffer));
        }
        const parser = new DOMParser();
        const document = parser.parseFromString(body, 'text/html');

        return document;
    } catch (error) {
        console.log(error, url);
    }
}
