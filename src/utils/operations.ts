import { Expression, Joinpoint, Op } from "@specs-feup/clava/api/Joinpoints.js";

export function getParentOp(expr: Expression): Op {
    let jp: Joinpoint = expr;
        while (true) {
            if (jp instanceof Op) return jp;

            if (!jp.hasParent) {
                throw new Error("Tried to find parent operation of Expression '" + expr.code + "' of line " + expr.line +", but it is not a child of an Op node");
            }

            jp = jp.parent;
        }
}