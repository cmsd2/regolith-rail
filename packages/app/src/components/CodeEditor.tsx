import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";

export interface CodeEditorProps {
  value: string;
  onChange(value: string): void;
  extensions: Extension[];
  label: string;
  /** Scroll to and select this line when the nonce changes. */
  reveal?: { line: number; nonce: number } | null;
  testId?: string;
}

const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    backgroundColor: "var(--surface)",
    color: "var(--text)",
  },
  ".cm-scroller": { fontFamily: "var(--mono)" },
  ".cm-gutters": {
    backgroundColor: "var(--surface-2)",
    color: "var(--muted)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border)",
  },
});

/** A CodeMirror editor that owns its view and syncs with an external value. */
export function CodeEditor({
  value,
  onChange,
  extensions,
  label,
  reveal,
  testId,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  // biome-ignore lint/correctness/useExhaustiveDependencies: the view is created once; value and extensions are synced below.
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          theme,
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) change.current(update.state.doc.toString());
          }),
          ...extensions,
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || !reveal) return;
    const line = editor.state.doc.line(Math.max(1, Math.min(reveal.line, editor.state.doc.lines)));
    editor.dispatch({ selection: { anchor: line.from, head: line.to }, scrollIntoView: true });
    editor.focus();
  }, [reveal]);

  return <div ref={host} style={{ height: "100%", overflow: "hidden" }} data-testid={testId} />;
}
