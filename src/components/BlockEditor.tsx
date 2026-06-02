import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { Block, PartialBlock } from "@blocknote/core";
import { useEffect, useRef } from "react";

export function parseBody(body: string | null | undefined): PartialBlock[] {
  if (!body) return [{ type: "paragraph" }];
  try {
    const p = JSON.parse(body);
    if (Array.isArray(p) && p.length) return p as PartialBlock[];
  } catch {
    // not JSON — treat as plain text
  }
  return body
    .split(/\n+/)
    .filter(Boolean)
    .map((t) => ({ type: "paragraph", content: t } as PartialBlock));
}

export function BlockView({ body }: { body: string | null | undefined }) {
  const editor = useCreateBlockNote({ initialContent: parseBody(body) });
  return (
    <div className="blocknote-readonly">
      <BlockNoteView editor={editor} editable={false} theme="light" />
    </div>
  );
}

export function BlockEditorPanel({
  initial,
  onChange,
}: {
  initial: PartialBlock[];
  onChange: (blocks: Block[]) => void;
}) {
  const editor = useCreateBlockNote({ initialContent: initial });
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);
  return (
    <BlockNoteView
      editor={editor}
      editable
      theme="light"
      onChange={() => cb.current(editor.document)}
    />
  );
}
