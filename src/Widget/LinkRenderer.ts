import { ogData } from "./WidgetParams";

export function LinkRenderer(ogData: ogData): DocumentFragment {
    const wrapper = createFragment()

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

    const urlEl = createDiv({cls: "og-url"});
    urlEl.setText((ogData.baseUrl !== "")? ogData.baseUrl: ogData.ogUrl);
    containerEl.appendChild(urlEl);
    wrapper.appendChild(containerEl);

    return wrapper;
}

export function LivePreviewRenderer(ogData: ogData): HTMLElement {
        const linkEl = createEl("a", {
            href: ogData.ogUrl,
            cls: "external-link link-thumbnail",
            attr: {
                "data-tooltip-position": "top",
                "aria-label": ogData.ogUrl
            },
        });
        linkEl.addEventListener("click", (e) => e.stopPropagation());
        linkEl.appendChild(LinkRenderer(ogData));
        return linkEl
}