import { debounce, editorLivePreviewField, MarkdownView } from "obsidian";
import {
	EditorView,
	Decoration,
	DecorationSet,
	ViewUpdate,
	ViewPlugin,
} from "@codemirror/view";
import {
	StateField,
	StateEffect,
	StateEffectType,
	Range,
} from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import LinkThumbnailPlugin from "@/main";
import { urlRegex } from "@/Utils/urlRegex";
import { WidgetType } from "@codemirror/view";
import { LinkRenderer } from "@/Widget/LinkRenderer";

//based on: https://gist.github.com/nothingislost/faa89aa723254883d37f45fd16162337

interface TokenSpec {
	from: number;
	to: number;
	value: string;
	isBlock: boolean;
}

const statefulDecorations = defineStatefulDecoration();

class StatefulDecorationSet {
	editor: EditorView;
	decoCache: { [cls: string]: Decoration } = Object.create(null);
	plugin: LinkThumbnailPlugin;

	constructor(editor: EditorView, plugin: LinkThumbnailPlugin) {
		this.editor = editor;
		this.plugin = plugin;
	}

	async computeAsyncDecorations(tokens: TokenSpec[]): Promise<DecorationSet> {
		const decorations: Range<Decoration>[] = [];

		const results = await Promise.all(
			tokens.map(async (token) => {
				try {
					const cacheKey = `${token.value}:${token.to}`;
					let deco = this.decoCache[cacheKey];

					if (!deco) {
						const params =
							await this.plugin.linkDataManger?.getCachedLink(
								token.value,
							);

						// 섬네일을 가져오지 못한 링크는 건너뛴다.
						if (!params) return null;

						const element = LinkRenderer(params, ["cm-embed-link"]);

						deco = Decoration.widget({
							widget: new ogLinkWidget(element),
							side: token.isBlock ? 3e8 : 2e8,
							block: token.isBlock,
						});

						this.decoCache[cacheKey] = deco;
					}

					return {
						deco,
						to: token.to,
					};
				} catch (error) {
					// 특정 링크의 실패가 다른 링크에 영향을 주지 않게 한다.
					console.warn(
						"[LinkThumbnail] Failed to create thumbnail:",
						token.value,
						error,
					);

					return null;
				}
			}),
		);

		for (const result of results) {
			if (!result?.deco) continue;

			decorations.push(result.deco.range(result.to));
		}

		return Decoration.set(decorations, true);
	}

	debouncedUpdate = debounce(this.updateAsyncDecorations, 100, true);

	async updateAsyncDecorations(tokens: TokenSpec[]): Promise<void> {
		try {
			const activeView =
				this.plugin.app.workspace.getActiveViewOfType(MarkdownView);

			const isNoLinkThumbnails =
				activeView?.contentEl.children[0]?.classList.contains(
					"noLinkThumbnail",
				);

			const { from: selectFrom, to: selectTo } =
				this.editor.state.selection.main;

			tokens = tokens.filter((token) => {
				const isSelected =
					selectFrom <= token.to && selectTo >= token.from;

				const isUrl = urlRegex.test(token.value);

				return !isSelected && isUrl;
			});

			const isLivePreviewMode = this.editor.state.field(
				editorLivePreviewField,
			);

			const decorations =
				isLivePreviewMode && !isNoLinkThumbnails
					? await this.computeAsyncDecorations(tokens)
					: Decoration.none;

			// 비동기 작업 중 편집기가 종료되었을 가능성도 고려한다.
			if (
				this.editor.state.field(statefulDecorations.field).size ||
				decorations.size
			) {
				this.editor.dispatch({
					effects: statefulDecorations.update.of(decorations),
				});
			}
		} catch (error) {
			console.error(
				"[LinkThumbnail] Failed to update decorations:",
				error,
			);
		}
	}
}

function buildViewPlugin(plugin: LinkThumbnailPlugin) {
	return ViewPlugin.fromClass(
		class {
			decoManager: StatefulDecorationSet;

			constructor(view: EditorView) {
				this.decoManager = new StatefulDecorationSet(view, plugin);
				this.buildAsyncDecorations(view);
			}

			update(update: ViewUpdate) {
				if (
					update.docChanged ||
					update.viewportChanged ||
					update.selectionSet
				) {
					this.buildAsyncDecorations(update.view);
				}
			}

			buildAsyncDecorations(view: EditorView) {
				const targetElements: TokenSpec[] = [];
				try {
					const tree = syntaxTree(view.state);
					tree.iterate({
						enter: ({ node, from, to }) => {
							// const tokenProps = node.type.prop<string>(tokenClassNodeProp);
							if (
								node.name.includes("url") &&
								!node.name.includes("string")
							) {
								const value = view.state.doc.sliceString(
									from,
									to,
								);
								targetElements.push({
									from: from,
									to: to,
									value: value,
									isBlock: node.name === "url" || false,
								});
							}
						},
					});
				} catch (error) {
					console.error("Custom CM6 view plugin failure", error);
					throw error;
				}
				this.decoManager.debouncedUpdate(targetElements);
			}
		},
	);
}

export function asyncDecoBuilderExt(plugin: LinkThumbnailPlugin) {
	return [statefulDecorations.field, buildViewPlugin(plugin)];
}

////////////////
// Utility Code
////////////////

// Generic helper for creating pairs of editor state fields and
// effects to model imperatively updated decorations.
// source: https://github.com/ChromeDevTools/devtools-frontend/blob/8f098d33cda3dd94b53e9506cd3883d0dccc339e/front_end/panels/sources/DebuggerPlugin.ts#L1722
function defineStatefulDecoration(): {
	update: StateEffectType<DecorationSet>;
	field: StateField<DecorationSet>;
} {
	const update = StateEffect.define<DecorationSet>();
	const field = StateField.define<DecorationSet>({
		create(): DecorationSet {
			return Decoration.none;
		},
		update(deco, tr): DecorationSet {
			return tr.effects.reduce(
				(deco, effect) => (effect.is(update) ? effect.value : deco),
				deco.map(tr.changes),
			);
		},
		provide: (field) => EditorView.decorations.from(field),
	});
	return { update, field };
}
class ogLinkWidget extends WidgetType {
	private readonly source: HTMLElement;

	constructor(source: HTMLElement) {
		super();
		this.source = source;
	}

	eq(other: ogLinkWidget) {
		return other == this;
	}

	toDOM() {
		return this.source;
	}

	ignoreEvent(): boolean {
		return false;
	}
}
