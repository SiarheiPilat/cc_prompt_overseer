import { queryPrompts, getProjects, hiddenCount } from "@/lib/queries";
import { PromptTable } from "@/components/PromptTable";
import { FilterBar } from "@/components/FilterBar";

export const dynamic = "force-dynamic";

export default async function PromptsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = sp.q || "";
  const project = sp.project || "";
  const slash = sp.slash === "1";
  const starred = sp.starred === "1";
  const hasPlan = sp.hasPlan === "1";
  const showHidden = sp.showHidden === "1";
  const onlyHidden = sp.onlyHidden === "1";
  const minLen = sp.minLen ? Number(sp.minLen) : undefined;
  const orderBy = (sp.orderBy as any) || "ts";
  const dir = (sp.dir as any) || "desc";
  const limit = Math.min(2000, Number(sp.limit) || 500);
  const cat = sp.cat || "";
  const tag = sp.tag || "";
  const permissionMode = sp.perm || "";
  const from = sp.from ? Number(sp.from) : undefined;
  const to = sp.to ? Number(sp.to) : undefined;

  const { rows, total } = queryPrompts({
    q, project: project || undefined, slash, starred, hasPlan,
    minLen, orderBy, dir, limit, offset: 0,
    category: cat || undefined, tag: tag || undefined,
    permissionMode: permissionMode || undefined,
    showHidden, onlyHidden,
    from, to,
  });
  const projects = getProjects() as any[];
  const hiddenN = hiddenCount();

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">All Prompts {onlyHidden && <span className="text-mutedfg">· hidden</span>}</h1>
          <p className="text-sm text-mutedfg">
            {rows.length.toLocaleString()} shown / {total.toLocaleString()} match
            {hiddenN > 0 && !onlyHidden && (
              <> · <a className="text-accent hover:underline" href="/prompts?onlyHidden=1">{hiddenN} hidden</a></>
            )}
          </p>
        </div>
      </header>
      <FilterBar projects={projects} initial={{ q, project, slash, starred, hasPlan, showHidden, onlyHidden, minLen, orderBy, dir, limit, permissionMode }} />
      <PromptTable rows={rows} allowUnhide={onlyHidden || showHidden} />
    </div>
  );
}
