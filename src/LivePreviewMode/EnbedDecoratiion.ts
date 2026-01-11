import {debounce, editorLivePreviewField, MarkdownView} from "obsidian";
import {EditorView, Decoration, DecorationSet, ViewUpdate, ViewPlugin} from "@codemirror/view";
import {StateField, StateEffect, StateEffectType, Range} from "@codemirror/state";
import {syntaxTree, tokenClassNodeProp} from "@codemirror/language";
import LinkThumbnailPlugin from "@/main";
import { urlRegex } from "@/Utils/urlRegex";
import { WidgetType } from "@codemirror/view";
import { LivePreviewRenderer } from "@/Widget/LinkRenderer";

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

    async computeAsyncDecorations(tokens: TokenSpec[]): Promise<DecorationSet | null> {    
        const decorations: Range<Decoration>[] = [];
        
        // 모든 비동기 작업을 먼저 시작
        const results = await Promise.all(tokens.map(async (token) => {
            let deco = this.decoCache[token.value + token.to];
            if(!deco) {
                const params = await this.plugin.linkDataManger.getCachedLink(token.value);
                if (params) {
                        deco = this.decoCache[token.value  + token.to] = Decoration.widget({widget: new ogLinkWidget(LivePreviewRenderer(params)), side: (token.isBlock)? 3e8: 2e8 , block: token.isBlock});
                }
            }
            return { deco: deco, to: token.to }
        }))

        // 결과값을 순회하며 decorations 배열에 담기
        for (const res of results) {
            if(res) {{
                decorations.push(res.deco.range(res.to));
            }}
        }
        return Decoration.set(decorations, true);
    }

    debouncedUpdate = debounce(this.updateAsyncDecorations, 100, true);

    async updateAsyncDecorations(tokens: TokenSpec[]): Promise<void> {
        // 현재 뷰에서 cssClasses가 적용되는 지 판별
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        // cssClasses가 있으면 true / 없으면 false
        const isNoLinkThumbnails = activeView?.contentEl.children[0]?.classList.contains("noLinkThumbnail");

        // 현재 선택된 부분은 적용되지 않게 설정
        // 현재 선택된 부분
        const selectFrom = this.editor.state.selection.main.from;
        const selectTo = this.editor.state.selection.main.to;

        tokens = tokens.filter((token) => {
            // 현재 선택영역 판별
            const isSelected = (selectFrom <= token.to && selectTo >= token.from) || (selectFrom >= token.from && selectTo <= token.to);
            // url이 적합한 지 판벌
            const isUrl = urlRegex.test(token.value);
            return !isSelected && isUrl;
        });
        // 현재 모드 판별 : false: editor / true: livePreview
        const isLivePreviewMode = this.editor.state.field(editorLivePreviewField);
        const decorations = (isLivePreviewMode && !isNoLinkThumbnails)? await this.computeAsyncDecorations(tokens): null;

        // if our compute function returned nothing and the state field still has decorations, clear them out
        if (decorations || this.editor.state.field(statefulDecorations.field).size) {
            this.editor.dispatch({effects: statefulDecorations.update.of(decorations || Decoration.none)});
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
                if (update.docChanged || update.viewportChanged || update.selectionSet) {
                    this.buildAsyncDecorations(update.view);
                }
            }

            buildAsyncDecorations(view: EditorView) {
                const targetElements: TokenSpec[] = [];
                try {
                    const tree = syntaxTree(view.state);
                    tree.iterate({
                        enter: ({node, from, to}) => {
                            const tokenProps = node.type.prop<string>(tokenClassNodeProp);
                            if(tokenProps && (node.name.includes("url") && !node.name.includes("string"))) {
                                // console.log(tokenProps, node.name);
                                const value = view.state.doc.sliceString(from, to);
                                targetElements.push({from: from, to: to, value: value, isBlock: (node.name === "url" || false)});
                            }

                        },
                    });
                } catch (error) {
                    console.error("Custom CM6 view plugin failure", error);
                    throw error;
                }
                this.decoManager.debouncedUpdate(targetElements);
            }
        }
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
            return tr.effects.reduce((deco, effect) => (effect.is(update) ? effect.value : deco), deco.map(tr.changes));
        },
        provide: field => EditorView.decorations.from(field),
    });
    return {update, field};
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

