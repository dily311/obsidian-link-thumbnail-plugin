import { Plugin } from 'obsidian';
import { asyncDecoBuilderExt } from './EnbedDecoratiion';
import { PostProcessor } from './PostProcessor';
import { widgetParams } from './WidgetParams';
import { ogDataCache, ogDataCacheDisable } from './localforage';

export default class LinkThumbnailPlugin extends Plugin {
	widget: widgetParams;

    async onload() {
		// widget 등록
		this.widget = new widgetParams(this);

		// In LivePre view Mode
		this.registerEditorExtension(asyncDecoBuilderExt(this));

		// In Reading Mode
		const postProcessor = new PostProcessor(this);
        this.registerMarkdownPostProcessor(postProcessor.processor);

		this.app.workspace.updateOptions();
    }

	async onunload() {
		console.log("disabling plugin: link");

		ogDataCache.clear();
		ogDataCacheDisable.clear();
	}

}