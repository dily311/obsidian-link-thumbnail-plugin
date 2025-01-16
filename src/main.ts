import { Plugin } from 'obsidian';
import { asyncDecoBuilderExt } from './EnbedDecoratiion';
import { PostProcessor } from './PostProcessor';
import { ogData } from './Interface/ogData';
import { widgetParams } from './WidgetParams';
interface ExamplePluginSettings {
	data: ogData[];
	disableUrl: string[];
}
const DEFAULT_SETTINGS: Partial<ExamplePluginSettings> = {
	data: [],
	disableUrl: []	
};
export default class LinkThumbnailPlugin extends Plugin {
	settings:ExamplePluginSettings;
	widget: widgetParams;

	/**
	 * @returns true if Live Preview is supported
	 */
	isUsingLivePreviewEnabledEditor(): boolean {
		//@ts-ignore
		return !this.app.vault.getConfig('legacyEditor');
	}

    async onload() {
		// 세팅 로드
		await this.loadSettings();

		this.widget = new widgetParams(this);

		// In LivePre view Mode
		if (this.isUsingLivePreviewEnabledEditor()) {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const Prec = require("@codemirror/state").Prec;
			this.registerEditorExtension(Prec.lowest(asyncDecoBuilderExt(this,)));
		}
		// In Reading Mode
		const postProcessor = new PostProcessor(this,);
        this.registerMarkdownPostProcessor(postProcessor.processor);

		// updateOptions
		this.registerEvent(this.app.workspace.on('css-change', () => {
			this.app.workspace.updateOptions();
		}));

		this.app.workspace.updateOptions();
    }
	async onunload() {
		console.log("disabling plugin: link");
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}