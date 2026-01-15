import { ogData } from "./LinkDataManger";

export function LinkRenderer(ogData: ogData, cssClasses: string[] = []): HTMLElement {
    const wrapper = createDiv({
        cls: `link-thumbnail`,
        attr: {
            "data-tooltip-position": "top",
            "aria-label": ogData.ogUrl
        },
    });
    if (cssClasses.length !== 0) {
        wrapper.addClasses(cssClasses)
    }

    const linkWrapper = createEl("a", {
        cls: "external-link",
        attr: {
            "href": ogData.ogUrl,
            "target": "_blank",
            "rel": "noopener nofollow"
        }
    });
    wrapper.appendChild(linkWrapper);


    if (ogData.ogImage) {
        const ogImageWrapper = createDiv({cls: "og-thumbnail"});
        const ogImage = createEl("img", {attr: {
            src: ogData.ogImage,
            alt: ogData.ogImageAlt,
            loading: "lazy"
        }})
        ogImageWrapper.appendChild(ogImage);
        linkWrapper.appendChild(ogImageWrapper);
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
    linkWrapper.appendChild(containerEl);

    return wrapper;
}
