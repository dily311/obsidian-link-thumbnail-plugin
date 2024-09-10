import { arrayBufferToBase64, requestUrl } from "obsidian";
import { ogData } from "./ogData";
import { Buffer } from "./Buffer";
import { ogDataCache, ogDataCacheDisable } from "./localforage";

// url 정규식
export const urlRegex = new RegExp("^(http:\\/\\/www\\.|https:\\/\\/www\\.|http:\\/\\/|https:\\/\\/)?[a-z0-9]+([\\-.]{1}[a-z0-9]+)*\\.[a-z]{2,5}(:[0-9]{1,5})?(\\/.*)?$");
const baseUrl = new RegExp("^https?:\\/\\/[^\\/]+");
const charsetRegex = new RegExp(/charset=["']?(.+?)["']/i);

// 저장하기 전에 img 데이터를 url-> blob -> base64로 변환 후 저장
async function getImgFile(imgUrl: string, userAgent:string) {
    const imgFormat = ["jpg", "jpeg", "png", "bmp", "tif", "gif", "svg"];
    try {
        let imgType = "";
        imgFormat.forEach((format) => {
            if (imgUrl.includes(format)) {
                imgType = format;
            }
        });

        const file = await requestUrl({
            url: imgUrl,
            contentType: `image/${imgType}`,
            headers: {
                "user-agent": userAgent,
            }
        });
        const base64String = arrayBufferToBase64(file.arrayBuffer);
        if (imgType.includes("svg")) imgType += "+xml";
        return `data:image/${imgType};charset=utf-8;base64,` + base64String;

    } catch (error) {
        console.log(error);
        return "";
    }
}

function lintStr(str:string) {
    // 태그 제거
    str = str.replace(/(<([^>]+)>)/gi, "");
    // & ; 제거
    str = str.replace(/(&(\S+?);)/, "");
    // 공백 제거
    str = str.replace(/\s\s+/g, ' ');
    return str;
}


async function getOgData(url: string , userAgent:string, document: Document): Promise<ogData | null> {
    const base = baseUrl.exec(url);
    const ogTitle = document.querySelector("meta[property='og:title']")?.getAttribute("content") || document.querySelector("title")?.textContent || "";
    if (ogTitle === "") return null;

    const ogDescription = document.querySelector("meta[property='og:description']")?.getAttribute("content") || "";
    let ogImage = "";
    let imgUrl = document.querySelector("meta[property='og:image']")?.getAttribute("content") || "";
    if (base && imgUrl !== "") {
        if (imgUrl.startsWith("//")) {
            imgUrl = "https:" + imgUrl;
        } else if (!imgUrl.startsWith("http")) {
            imgUrl = base[0] + (imgUrl.startsWith("/"))? "" : "/" + imgUrl;
        }
        ogImage = await getImgFile(imgUrl, userAgent);
    }

    const ogImageAlt = document.querySelector("meta[property='og:image:alt']")?.getAttribute("content") || "";
    const ogUrl = document.querySelector("meta[property='og:url']")?.getAttribute("content") || url;

    const data: ogData = {
        "ogTitle": ogTitle,
        "ogDescription": lintStr(ogDescription),
        "ogImage": ogImage,
        "ogImageAlt": ogImageAlt,
        "ogUrl": ogUrl,
        "baseUrl": (base)? base[0] : ""
    }

    return data;
}

async function getData(url: string): Promise<ogData|undefined> {
    const userAgent = navigator.userAgent.replace(/(obsidian\/([0-9|\\.]+)|Electron\/([0-9|\\.]+))\s/g, "");
    const response = await requestUrl({
        url:url,
        headers:{
            "user-agent": userAgent,
            'accept-language': navigator.language,
            'accept-encoding': "UTF-8"
        }
    });

    try {
        const contentType = response.headers["content-type"];
        if (response && response.headers && contentType && !contentType?.includes('text/')) {
            throw new Error('Page must return a header content-type with text/');
        }
        if (!response.text?.includes("charset") && !contentType.includes("charset")) {
            throw new Error('Page is not html file')
        }

        const bodyArrayBuffer = response.arrayBuffer;
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
        const ogData = await getOgData(url, userAgent, document);
        if (ogData) {
            await ogDataCache.setItem(url, ogData);
            return ogData;
        }
    } catch (error) {
        console.log(error, response);
        ogDataCacheDisable.setItem(url, "");
    }

}

function template(data: ogData): string {
    return `
        ${(data?.ogImage === "")? "" : `<div class="og-thumbnail"><img src="${data?.ogImage}" alt="${data?.ogImageAlt}" loading="lazy"></img></div>`}
        <div class="og-info-container">
            <div class="og-info">
                <strong>${data?.ogTitle}</strong>
            </div>
            <div class="og-description">
                ${data?.ogDescription}
            </div>
            <div class="og-url">${data?.ogUrl}</div>
        </div>
    `;
}

export async function LinkThumbnailWidgetParams(url: string): Promise<string | null> {
    const isDisable = await ogDataCacheDisable.getItem(url);
    if (!isDisable) {
        const data = await ogDataCache.getItem(url) as ogData;
        if (data) return template(data);
         
        const ogData = await getData(url);
        if (ogData) return template(ogData);
    }
    return null;
}