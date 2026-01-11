import { MarkdownPostProcessorContext, MarkdownView } from "obsidian";
import LinkThumbnailPlugin from "@/main";
import { urlRegex } from "@/Utils/urlRegex";
import { LinkRenderer } from "@/Widget/LinkRenderer";

export class PostProcessor {
	plugin: LinkThumbnailPlugin;

	constructor(plugin: LinkThumbnailPlugin) {
		this.plugin = plugin;
	}

	processor = async (
		element: HTMLElement,
		context: MarkdownPostProcessorContext
	) => {
		// 링크 변환
		const linkEls:Element[] = element.findAll("a.external-link:not(.cm-formatting, .markdown-rendered)");
		
        // 현재 뷰에서 cssClasses가 적용되는 지 판별
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        const isNoLinkThumbnails = activeView?.contentEl.children[0]?.classList.contains("noLinkThumbnail");

		if (!isNoLinkThumbnails) {
			for (const linkEl of linkEls) {
				const url = linkEl.innerHTML;
				// url이 적합한 지 판벌
				const isUrl = urlRegex.test(url);
				if (isUrl) {
					
					const ogData = await this.plugin.linkDataManger.getCachedLink(url);
					if (ogData != null) {						
						linkEl.innerHTML = "";
						linkEl.addClass("link-thumbnail");
						linkEl.setAttribute("data-tooltip-position", "top");
						linkEl.setAttribute("aria-label", url);
						linkEl.addEventListener("click", (e) => e.stopPropagation());
						linkEl.appendChild(LinkRenderer(ogData));
					}
				}
			}
		}
	};

	isDisabled = (el: Element) => {
		return false;
	};

}