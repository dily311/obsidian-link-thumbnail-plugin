import { MarkdownPostProcessorContext } from "obsidian";
import LinkThumbnailPlugin from "./main";
import { LinkThumbnailWidgetParams, urlRegex } from "./LinkThumbnailWidgetParams";

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
		for (const linkEl of linkEls) {
			const url = linkEl.innerHTML;
			// url이 적합한 지 판벌
			const isUrl = urlRegex.test(url);
			if (!linkEl.closest(".noLinkThumbnail") && isUrl) {
				const params = await LinkThumbnailWidgetParams(url);
				if (params != null) {
					const linkContainer = linkEl.parentElement;
					const wrapper = createDiv({cls: "link-thumbnail"})
					
					linkEl.innerHTML = params;
                    linkEl.className = "markdown-rendered external-link og-link";
					linkEl.setAttribute("data-tooltip-position", "top");
					linkEl.setAttribute("aria-label", url);
					linkEl.addEventListener("click", (e) => e.stopPropagation());
					// 위치 변경
					linkContainer?.insertBefore(wrapper, linkEl);
					wrapper.appendChild(linkEl);

				}
			}
		}
	};

	isDisabled = (el: Element) => {
		return false;
	};
}