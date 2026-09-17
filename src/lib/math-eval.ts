import { compile } from "mathjs";

/** Compiles a model-written expression like "x^2 - y^2" into a safe numeric function. Null if invalid. */
export function compileExpr(expr: string, vars: string[]): ((...args: number[]) => number) | null {
  try {
    const code = compile(expr.replace(/\*\*/g, "^"));
    return (...args: number[]) => {
      const scope = Object.fromEntries(vars.map((v, i) => [v, args[i]]));
      const value = code.evaluate(scope);
      return typeof value === "number" ? value : Number.NaN;
    };
  } catch {
    return null;
  }
}
