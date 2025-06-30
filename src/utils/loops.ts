import Query from "@specs-feup/lara/api/weaver/Query.js";
import { Joinpoint, Loop, Scope, Statement } from "@specs-feup/clava/api/Joinpoints.js";

export enum PositionRelToLoop {
    OUTSIDE,
    INITIALIZATION,
    CONDITION,
    STEP,
    BODY
}

/**
 * Recursively iterates up the tree from jp until it finds a Loop and
 * returns it. If no Loop is found, undefined is returned instead
 */
export function getNearestAncestorLoop(jp: Joinpoint): Loop | undefined {
    while (true) {
        if (!jp.hasParent) return undefined;

        jp = jp.parent;

        if (jp instanceof Loop) return jp;
    }
}

/**
 * Checks if the given Joinpoint is inside a Loop. If so, it specifies
 * where. Otherwise, returns PoPositionRelToLoop.OUTSIDE
 * 
 * ForEach loops are unsupported and will throw an error
 */
export function getPositionRelativeToOuterLoop(jp: Joinpoint): PositionRelToLoop {
    const ancestorLoop: Loop | undefined = getNearestAncestorLoop(jp);

    if (ancestorLoop === undefined) return PositionRelToLoop.OUTSIDE;

    if (ancestorLoop.kind === "foreach") throw new Error("getPositionRelativeToALoop: Foreach loops are unsupported");

    const body: Scope = ancestorLoop.body;

    if (Query.searchFromInclusive(body, Joinpoint, { astId: jp.astId }).get().length === 1) return PositionRelToLoop.BODY;

    const cond: Statement | null | undefined = ancestorLoop.cond;
    if (cond !== null && cond !== undefined && Query.searchFromInclusive(cond, Joinpoint, { astId: jp.astId }).get().length === 1) return PositionRelToLoop.CONDITION;

    const init: Statement | null | undefined = ancestorLoop.init;
    if (init !== null && init !== undefined && Query.searchFromInclusive(init, Joinpoint, { astId: jp.astId }).get().length === 1) return PositionRelToLoop.INITIALIZATION;

    const step: Statement | null | undefined = ancestorLoop.step;
    if (step !== null && step !== undefined && Query.searchFromInclusive(step, Joinpoint, { astId: jp.astId }).get().length === 1) return PositionRelToLoop.STEP;

    throw new Error("getPositionRelativeToALoop: Unknown position in loop.");
}