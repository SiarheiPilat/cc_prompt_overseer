"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function PlanView({ body }: { body: string }) {
  return (
    <div className="prose-mini text-[14px] leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
