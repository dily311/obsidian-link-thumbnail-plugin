import { ogData } from "./LinkDataManger";

export function LinkRenderer(ogData: ogData): HTMLElement {
    const wrapper = createDiv({
        cls: "cm-embed-link link-thumbnail",
        attr: {
            "data-tooltip-position": "top",
            "aria-label": ogData.ogUrl
        },
    });
    wrapper.addEventListener("click", (e) => {
        e.stopPropagation();
        // 외부 브라우저 열기
        window.open(ogData.ogUrl, "_blank");
    });

    if (ogData.ogImage) {
        const ogImageWrapper = createDiv({cls: "og-thumbnail"});
        const ogImage = createEl("img", {attr: {
            src: ogData.ogImage,
            alt: ogData.ogImageAlt,
            loading: "lazy"
        }})
        ogImageWrapper.appendChild(ogImage);
        wrapper.appendChild(ogImageWrapper);
    }

    const containerEl = createDiv({cls: "og-info-container"});
    const titleEl = createDiv({cls: "og-info"})
    const titleTextEl = createEl("strong");
    titleTextEl.setText(ogData.ogTitle);
    titleEl.appendChild(titleTextEl);
    containerEl.appendChild(titleEl);

    const desEl = createDiv({cls: "og-description"});
    desEl.setText(ogData.ogDescription);
    containerEl.appendChild(desEl);

    const urlEl = createEl("a", {href: ogData.ogUrl, cls: "og-url", attr: {target: "_blank"}});
    urlEl.setText((ogData.baseUrl !== "")? ogData.baseUrl: ogData.ogUrl);
    urlEl.addEventListener("click", (e) => e.stopPropagation())
    containerEl.appendChild(urlEl);
    wrapper.appendChild(containerEl);

    return wrapper;
}
