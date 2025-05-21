import { Expression, Joinpoint, Op } from "@specs-feup/clava/api/Joinpoints.js";

/**
 *  Walks upwards on the JoinPoint tree, starting from the provided Expression,
 * until it finds the first Op JoinPoint and returns it.
 * 
 * @throws Error if the provided Expression JoinPoint is not a descendant
 * of any Op JoinPoint.
 */

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