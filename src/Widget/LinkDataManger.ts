import { requestUrl } from "obsidian";
import { ogDataCache, ogDataCacheDisable } from "@/Utils/localforage";

// 캐시 제한
const MAX_CACHE_SIZE = 1000;
const MAX_DISABLE_CACHE_SIZE = 2000;

// baseUrl 구하는 정규식
const BASEURL = new RegExp("^https?:\\/\\/[^\\/]+");
// const BUFFER = Platform.isMobileApp ? require("buffer/index.ts"): global.Buffer;

export interface ogData {
	ogTitle: string;
	ogDescription: string;
	ogImage: string;
	ogImageAlt: string;
	ogUrl: string;
	baseUrl: string;
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
			if (firstKey) this.memoryCache.delete(firstKey);
		}
		this.memoryCache.set(key, data);
		ogDataCache?.setItem(key, data);
	}

	setDisableCache(key: string) {
		if (this.disableCache.size > MAX_DISABLE_CACHE_SIZE) {
			// 메모리가 가득찼다면 disableCache는 비워버리기
			this.disableCache.clear();
		}
		this.disableCache.add(key);
		ogDataCacheDisable?.setItem(key, "");
	}

	async getCachedLink(key: string): Promise<ogData | null> {
		try {
			if (this.disableCache.has(key)) return null;

			const memoryData = this.memoryCache.get(key);
			if (memoryData) return memoryData;

			const isDisabled = await ogDataCacheDisable?.getItem(key);

			if (isDisabled) {
				this.disableCache.add(key);
				return null;
			}

			const cachedData = await ogDataCache?.getItem<ogData>(key);

			if (cachedData) {
				this.memoryCache.set(key, cachedData);
				return cachedData;
			}

			const data = await this.createdLinkWidget(key);

			if (!data) {
				// 기존 정책 유지: 가져오기에 실패한 링크는 캐싱한다.
				// 단, 장기적으로 일시 오류와 영구 오류는 구분하는 것이 좋다.
				try {
					await this.setDisableCacheAsync(key);
				} catch (error) {
					console.warn("[LinkThumbnail] Failed to save failure cache:", key, error,);
				}
				return null;
			}

			this.setMemoryCache(key, data);

			// 영속 캐시는 실패하더라도 가져온 데이터까지 잃지 않도록 분리한다.
			void ogDataCache?.setItem(key, data).catch((error) => {
				console.warn("[LinkThumbnail] Failed to save cache:", key, error,);
			});

			return data;
		} catch (error) {
			console.warn("[LinkThumbnail] Failed to load link data:", key, error,);
			return null;
		}
	}

	private setMemoryCache(key: string, data: ogData): void {
		if (
			!this.memoryCache.has(key) &&
			this.memoryCache.size >= MAX_CACHE_SIZE
		) {
			const firstKey = this.memoryCache.keys().next().value;

			if (firstKey !== undefined) {
				this.memoryCache.delete(firstKey);
			}
		}

		this.memoryCache.set(key, data);
	}

	private async setDisableCacheAsync(key: string): Promise<void> {
		if (!this.disableCache.has(key)) {
			if (this.disableCache.size >= MAX_DISABLE_CACHE_SIZE) {
				this.disableCache.clear();
			}

			this.disableCache.add(key);
		}

		await ogDataCacheDisable?.setItem(key, "");
	}

	async createdLinkWidget(key: string) {
		const document = await conn(key);
		if (document) {
			const base = BASEURL.exec(key);
			const ogTitle =
				document
					.querySelector("meta[property='og:title']")
					?.getAttribute("content") ||
				document.querySelector("title")?.textContent ||
				"";
			if (ogTitle === "") return null;

			let ogDescription =
				document
					.querySelector("meta[property='og:description']")
					?.getAttribute("content") || "";
			ogDescription = ogDescription
				.replace(/(<([^>]+)>)/gi, "")
				.replace(/(&(\S+?);)/, "")
				.replace(/\s\s+/g, " ")
				.trim();

			let ogImage =
				document
					.querySelector("meta[property='og:image']")
					?.getAttribute("content") || "";
			if (base && ogImage !== "") {
				if (!ogImage.startsWith("https:")) {
					if (ogImage.startsWith("//")) {
						ogImage = "https:" + ogImage;
					} else {
						ogImage =
							base[0] +
							(ogImage.startsWith("/") ? "" : "/") +
							ogImage;
					}
				}
			}

			const ogImageAlt =
				document
					.querySelector("meta[property='og:image:alt']")
					?.getAttribute("content") || "";
			const data: ogData = {
				ogTitle: ogTitle,
				ogDescription: ogDescription,
				ogImage: ogImage,
				ogImageAlt: ogImageAlt,
				ogUrl: key,
				baseUrl: base ? base[0] : key,
			};
			return data;
		}
		return null;
	}
}
async function conn(url: string): Promise<Document | null> {
	try {
		const response = await requestUrl({
			url,
			headers: {
				"user-agent": navigator.userAgent,
				"accept-language": navigator.language,
			},
			throw: false,
		});

		// HTTP 오류 응답은 HTML 파싱을 진행하지 않는다.
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`HTTP ${response.status}`);
		}

		const contentType = response?.headers?.["content-type"] ?? "";
        let mimeType = contentType?.split(";")[0];
        if (!mimeType) return null;
        mimeType = mimeType.trim().toLowerCase();

		// HTML 또는 XHTML만 허용한다.
		if (mimeType !== "text/html" && mimeType !== "application/xhtml+xml") {
			throw new Error(
				`Unsupported content type: ${contentType || "(missing)"}`,
			);
		}

		// charset은 없어도 된다. 기본값은 UTF-8.
		const charsetMatch = contentType.match(
			/charset\s*=\s*["']?([^;"'\s]+)/i,
		);

		const charset = charsetMatch?.[1] ?? "utf-8";

		const decoder = new TextDecoder(charset);
		const body = decoder.decode(response.arrayBuffer);

		const parser = new DOMParser();
		return parser.parseFromString(body, "text/html");
	} catch (error) {
		console.warn("[LinkThumbnail] Failed to fetch page:", url, error);
		return null;
	}
}
