/**
 * Models sometimes write LaTeX commands inside JSON strings with a single backslash, so "\\text"
 * arrives as a tab followed by "ext". Restore the commands that collide with JSON escapes.
 */
const COLLISIONS: [RegExp, string][] = [
  [/\t(?=(ext|imes|heta|au|an|anh|riangle|ilde|op|frac|o\b|extbf|extit))/g, "\\t"],
  [/\f(?=(rac|orall|lat))/g, "\\f"],
  [/\u0008(?=(egin|eta|ar|inom|oldsymbol|ig|ot|ullet|ackslash))/g, "\\b"],
  [/\r(?=(ho|ight|angle|ceil|floor|m\b|ightarrow))/g, "\\r"],
  // Real newlines are common, so only restore commands that can't be ordinary words after a line break.
  [/\n(?=(abla|eq(?![a-z])|otin(?![a-z])|u(?![a-z])))/g, "\\n"],
];

export function repairLatex<T>(value: T): T {
  if (typeof value === "string") {
    let s: string = value;
    for (const [pattern, replacement] of COLLISIONS) s = s.replace(pattern, replacement);
    return s as T;
  }
  if (Array.isArray(value)) return value.map(repairLatex) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, repairLatex(v)])) as T;
  }
  return value;
}
