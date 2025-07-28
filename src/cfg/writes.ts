import { Expression, Joinpoint, Vardecl, Varref } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";

import VariableDeclarationNode from "@specs-feup/clava-flow/cfg/node/VariableDeclarationNode";
import ReturnNode from "@specs-feup/clava-flow/cfg/node/ReturnNode";
import ExpressionNode from "@specs-feup/clava-flow/cfg/node/ExpressionNode";
import ForEachNode from "@specs-feup/clava-flow/cfg/node/condition/ForEachNode";
import ClavaNode from "@specs-feup/clava-flow/ClavaNode";
import ConditionNode from "@specs-feup/clava-flow/cfg/node/condition/ConditionNode";
import ClavaFlowGraph from "@specs-feup/clava-flow/ClavaFlowGraph";

import { getAssignedExpression, isVarrefOf } from "../utils/varReferences.js";
import { getIncomingClavaNodes } from "./clavaNode.js";
import { findInCfg } from "./search.js";


function getLastWritesHelper(vardecl: Vardecl, currentNode: ClavaNode.Class, checkedNodes: ClavaNode.Class[]): Expression[] {
    if (checkedNodes.filter(node => node.id === currentNode.id).length > 0) return [];
    checkedNodes.push(currentNode);

    if (currentNode.is(VariableDeclarationNode)) {
        const currVardecl: Vardecl = currentNode.as(VariableDeclarationNode).jp;
        if (currVardecl.astId === vardecl.astId) {
            return currVardecl.hasChildren ? [currVardecl.firstChild as Expression] : [];
        }
    }

    let searchStartNode: Joinpoint | undefined;
    
    //it may be a variable declaration node but not of variable being searched
    if (currentNode.is(ReturnNode) || currentNode.is(ExpressionNode) || currentNode.is(VariableDeclarationNode)) { 
        searchStartNode = currentNode.jp;
    }
    else if (currentNode.is(ConditionNode) && !currentNode.is(ForEachNode)) {
        const conditionNode: ConditionNode.Class = currentNode.as(ConditionNode);
        searchStartNode = conditionNode.condition;
    }

    if (searchStartNode !== undefined) {
        const useVarrefs: Varref[] =
            Query.searchFromInclusive(searchStartNode, Varref,
                varref => isVarrefOf(varref, vardecl) && (varref.use === "write" || varref.use === "readwrite")
            ).get();

        if (useVarrefs.length > 1) {
            throw new Error(`The program contains unspecified behaviour: «${searchStartNode.code}»`);
        } else if (useVarrefs.length === 1) {
            return [getAssignedExpression(useVarrefs[0])];
        }
    }

    let writesFromControlFlowAncestors: Expression[] = [];

    for (const incomingClavaNode of getIncomingClavaNodes(currentNode)) {
        writesFromControlFlowAncestors = writesFromControlFlowAncestors.concat(...getLastWritesHelper(vardecl, incomingClavaNode, checkedNodes));
    }
    return writesFromControlFlowAncestors;
}

/**
 * Returns a list of the last writes done to a variable. Multiple writes may be the "last"
 * in case of divergent control flow (e.g. one is inside an if, other is before the if).
 * 
 * If a function that is not in the AST (e.g. imported from a library) modifies
 * a given global variable that will not be caught, since we cannot inspect that function
 */
export function getLastWrites(cfg: ClavaFlowGraph.Class, varref: Varref): Expression[] {
    const initialCfgNode: ClavaNode.Class | undefined = findInCfg(cfg, varref);
    if (initialCfgNode === undefined) throw new Error(`Tried to find ${varref.code} of line ${varref.line} in cfg but was unable to`);
    if (varref.vardecl === undefined || varref.vardecl === null)
        throw new Error(`Cannot get assignments of variable «${varref.name}» from line ${varref.line} because it does not have a Vardecl (is it a function call?)`);


    return getLastWritesHelper(varref.vardecl, initialCfgNode, []);
}