import { FunctionJp, If, Joinpoint, Loop, Param, Scope } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";

import ClavaFlowGraph from "@specs-feup/clava-flow/ClavaFlowGraph";
import ClavaNode from "@specs-feup/clava-flow/ClavaNode";
import FunctionNode from "@specs-feup/flow/flow/FunctionNode";
import ScopeNode from "@specs-feup/clava-flow/cfg/node/ScopeNode";
import ConditionNode from "@specs-feup/clava-flow/cfg/node/condition/ConditionNode";

import { getPositionRelativeToOuterLoop, PositionRelToLoop } from "../utils/loops.js";
import { isInIfCondition } from "../utils/ifs.js";

/**
 * Searches the CFG for a ClavaNode whose inner Clava Joinpoint matches the given AST ID.
 * Note that not all nodes are present in the cfg, and as such may not be found e.g. instead
 * of searching for a statement, one should instead search for its first child
 * 
 * @param cfg A ClavaFlowGraph
 * @param astId The Clava AST Id of the node to be found in the CFG
 * @returns The CFG node with whose Clava AST Id matches the provided id or undefined if it couldn't be found
 */
export function getByAstId(cfg: ClavaFlowGraph.Class, astId: string): ClavaNode.Class | undefined {
    for (const node of cfg.nodes) {
        if (!node.is(ClavaNode)) continue;
        const cNode = node.as(ClavaNode);

        if (cNode.jp.astId === astId) return cNode;
    }

    return undefined;
}

/**
 * Finds a node that is the condition of or a descendant of the condition of a loop or if node.
 */
function findConditionOrItsDescendantInCfg(cfg: ClavaFlowGraph.Class, jp: Joinpoint): ClavaNode.Class | undefined {
    for (const node of cfg.nodes) {
        if (!node.is(ConditionNode)) continue;

        const conditionNode = node.as(ConditionNode);

        if (conditionNode.condition?.astId === jp.astId || conditionNode.condition?.contains(jp)) return conditionNode;
    }

    return undefined;
}


export function findInCfg(cfg: ClavaFlowGraph.Class, jp: Joinpoint): ClavaNode.Class | undefined {
    if (getPositionRelativeToOuterLoop(jp) === PositionRelToLoop.CONDITION || isInIfCondition(jp)) return findConditionOrItsDescendantInCfg(cfg, jp);

    const necessarilyTopLevel: boolean = jp instanceof FunctionJp || jp instanceof Scope || jp instanceof Loop || jp instanceof If;

    for (const node of cfg.nodes) {
        if (!node.is(ClavaNode)) continue;
        if (!necessarilyTopLevel && (node.is(ConditionNode) || node.is(ScopeNode) || (node.is(FunctionNode) && !(jp instanceof Param)))) continue;

        const cNode = node.as(ClavaNode);

        const toSearch: Joinpoint[] = necessarilyTopLevel ? [cNode.jp] : Query.searchFromInclusive(cNode.jp, Joinpoint).get()
        if (toSearch
            .filter(candidate => jp.astId === candidate.astId)
            .length !== 0) {
            return cNode;
        }
    }

    return undefined;
}