import LinkThumbnailPlugin from "./main";

export async function check_cssclasses(plugin: LinkThumbnailPlugin) {
    let isNoLinkThumbnails = false;
    const tfile = plugin.app.workspace.getActiveFile();
    if (tfile) {
        await plugin.app.fileManager.processFrontMatter(tfile, (f: any) => {
            const cssclasses = f["cssclasses"];
            if (cssclasses) isNoLinkThumbnails = cssclasses.includes("noLinkThumbnail");
        });
    }
    return isNoLinkThumbnails;
}