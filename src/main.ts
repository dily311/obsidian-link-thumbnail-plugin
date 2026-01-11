import { Plugin } from 'obsidian';
import { asyncDecoBuilderExt } from '@/LivePreviewMode/EnbedDecoratiion';
import { PostProcessor } from '@/ReadingMode/PostProcessor';
import { ogDataCache, ogDataCacheDisable } from '@/Utils/localforage';
import { LinkDataManger } from '@/Widget/WidgetParams';

export default class LinkThumbnailPlugin extends Plugin {
	linkDataManger: LinkDataManger

    async onload() {
		this.linkDataManger = new LinkDataManger();
		
		// add command
		this.addCommand({
			id: "Remove-caching-link data",
			name: "Remove caching link data",
			callback: () => {
				ogDataCache.clear();
				ogDataCacheDisable.clear();
				this.linkDataManger.clearCache();
			}
		})
		
		// In Reading Mode
		const postProcessor = new PostProcessor(this);
        this.registerMarkdownPostProcessor(postProcessor.processor);
		
		// In LivePre view Mode
		this.registerEditorExtension(asyncDecoBuilderExt(this));
		// 모든 편집기에 변경사항 반영
		this.app.workspace.updateOptions();
    }

	async onunload() {
		console.log("disabling plugin: link");

		this.linkDataManger.clearCache();
	}

}