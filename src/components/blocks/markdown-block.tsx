import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

export function MarkdownBlock({ md }: { md: string }) {
  return (
    <div className="prose-tutor text-[15px]">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {md}
      </ReactMarkdown>
    </div>
  );
}
