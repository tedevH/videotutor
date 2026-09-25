import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/**
 * A post's body, rendered on the server so the full text is in the HTML Google indexes.
 * Math is KaTeX (same as the tutor), tables and footnote-style links come from GFM.
 */
export function PostBody({ markdown }: { markdown: string }) {
  return (
    <div
      className={[
        "leading-[1.75] text-[17px] text-ink/85",
        "[&_p]:my-5",
        "[&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:text-[26px] [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:tracking-tight [&_h2]:text-ink",
        "[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-ink",
        "[&_a]:font-medium [&_a]:text-pen [&_a]:underline [&_a]:decoration-pen/30 [&_a]:underline-offset-2 [&_a:hover]:decoration-pen",
        "[&_strong]:font-semibold [&_strong]:text-ink",
        "[&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5 [&_li]:pl-1",
        "[&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-pen/60 [&_blockquote]:pl-5 [&_blockquote]:text-ink/75 [&_blockquote]:italic",
        "[&_code]:rounded [&_code]:bg-stone-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em]",
        "[&_hr]:my-10 [&_hr]:border-ink/10",
        "[&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[15px]",
        "[&_th]:border-b-2 [&_th]:border-ink/20 [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border-b [&_td]:border-ink/10 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top",
        "[&_.katex-display]:my-6 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden",
      ].join(" ")}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
