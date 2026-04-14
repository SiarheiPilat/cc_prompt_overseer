// Heuristic prompt categorization — no LLM calls.
const RULES: Array<[string, RegExp]> = [
  ["slash",     /^\s*\/[a-z]/i],
  ["question",  /^\s*(why|how|what|when|where|which|who|can|could|should|would|do|does|did|is|are|was|were|will|am|may|might|could)\b.*\?/i],
  ["debug",     /\b(error|exception|fail(ed|ing)?|broken|crash|stack ?trace|bug|undefined|null|nan|timeout|hang|stuck|doesn'?t work|not working|isn'?t working|why (?:doesn'?t|isn't)|wtf)\b/i],
  ["fix",       /\b(fix|repair|patch|resolve|correct|address)\b/i],
  ["refactor",  /\b(refactor|rename|extract|inline|cleanup|clean up|simplify|deduplicate|reorganize|restructure)\b/i],
  ["plan",      /\b(plan|design|architect|approach|strategy|outline|propose)\b/i],
  ["build",     /\b(build|create|make|implement|add|write|generate|scaffold|set up|setup|new\s+(component|page|api|route|endpoint))\b/i],
  ["explain",   /\b(explain|describe|tell me|walk me through|what does|summarize|tldr)\b/i],
  ["test",      /\b(test|spec|jest|vitest|playwright|cypress|tdd|coverage)\b/i],
  ["deploy",    /\b(deploy|release|publish|ship|production|preview|vercel|netlify|fly|render)\b/i],
  ["search",    /\b(find|search|locate|where is|grep|look for|where (?:does|is))\b/i],
  ["polish",    /\b(polish|tweak|improve|enhance|nicer|prettier|better|style|css|tailwind|design)\b/i],
  ["confirm",   /^\s*(yes|yep|yeah|ok|okay|sure|please|do it|go ahead|ship it|approve|continue)\b/i],
  ["correct",   /^\s*(no|nope|don'?t|stop|wait|actually|instead|wrong|not that|undo|revert)\b/i],
];

export function categorize(text: string): string {
  if (!text) return "other";
  for (const [name, re] of RULES) {
    if (re.test(text)) return name;
  }
  if (text.length < 30) return "short";
  if (text.length > 500) return "long";
  return "other";
}

export const CATEGORIES = ["slash","question","debug","fix","refactor","plan","build","explain","test","deploy","search","polish","confirm","correct","short","long","other"] as const;
