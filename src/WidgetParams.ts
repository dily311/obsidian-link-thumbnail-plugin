import { arrayBufferToBase64, requestUrl } from "obsidian";
import { Buffer } from "./Buffer";
import { ogData } from "./Interface/ogData";
import { urlRegex } from "./urlRegex";
import { ogDataCache, ogDataCacheDisable } from "./localforage";

const userAgent  = navigator.userAgent.replace(/(obsidian\/([0-9|\\.]+)|Electron\/([0-9|\\.]+))\s/g, "");

export async function getItem(url: string) {
    const dataArray = await ogDataCache.getItem(url) as ogData;
    if (dataArray) {
        return template(dataArray);
    }

    const item = await createdItem(url);
    if (item) {
        return template(item);
    }
}

async function createdItem(url: string) {
    const document = await conn(url);
    if (document) {
        // baseUrl 구하는 정규식
        const baseUrl = new RegExp("^https?:\\/\\/[^\\/]+"); 

        const base = baseUrl.exec(url);
        const ogTitle = document.querySelector("meta[property='og:title']")?.getAttribute("content") || document.querySelector("title")?.textContent || "";
        if (ogTitle === "") return null;
    
        const ogDescription = document.querySelector("meta[property='og:description']")?.getAttribute("content") || "";
        ogDescription.replace(/(<([^>]+)>)/gi, ""); // 태그 제거
        ogDescription.replace(/(&(\S+?);)/, "");  // & ; 제거
        ogDescription.replace(/\s\s+/g, ' ');  // 공백 제거
        let ogImage = "";
        let imgUrl = document.querySelector("meta[property='og:image']")?.getAttribute("content") || "";
        if (base && imgUrl !== "") {
            if (imgUrl.startsWith("//")) {
                imgUrl = "https:" + imgUrl;
            } else if (!imgUrl.startsWith("http")) {
                imgUrl = base[0] + (imgUrl.startsWith("/"))? "" : "/" + imgUrl;
            }
            ogImage = await connImgFile(imgUrl);
        }
    
        const ogImageAlt = document.querySelector("meta[property='og:image:alt']")?.getAttribute("content") || "";
        const data: ogData = {
            "ogTitle": ogTitle,
            "ogDescription": ogDescription,
            "ogImage": ogImage,
            "ogImageAlt": ogImageAlt,
            "ogUrl": url,
            "baseUrl": (base)? base[0] : ""
        }
        await ogDataCache.setItem(url, data);
        return data
    }
    await ogDataCacheDisable.setItem(url, "");
    return null;
}

async function conn(url: string) {
    try {
        const response = await requestUrl({
            url:url,
            headers:{
                "user-agent": userAgent,
                'accept-language': navigator.language,
                'accept-encoding': "UTF-8"
            }
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

async function connImgFile(imgUrl: string) {
    if (urlRegex.exec(imgUrl)) {
        // 저장하기 전에 img 데이터를 url-> blob -> base64로 변환 후 저장
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
                headers: {"user-agent": userAgent,}
            });
            const base64String = arrayBufferToBase64(file.arrayBuffer);
            if (imgType.includes("svg")) imgType += "+xml";
            return `data:image/${imgType};charset=utf-8;base64,` + base64String;
        } catch (error) {
            console.log(error);
        }
    }
    return "";
}

function template(data: ogData) {
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