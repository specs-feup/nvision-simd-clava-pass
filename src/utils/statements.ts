import { Expression, Joinpoint, Statement } from "@specs-feup/clava/api/Joinpoints.js";

export function getAncestorStmt(exprJp: Expression): Statement {
    let jp: Joinpoint = exprJp.parent;
    do {
        if (jp instanceof Statement) return jp;
        if (!jp.hasParent) throw new Error("getParentStmt: Found expression without ancestor Statement");
        jp = jp.parent;
    } while (true);
}