import { Expression, Literal, MemberAccess, Program, UnaryOp, Vardecl, Varref } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { isVarrefOf } from "../utils/varReferences.js"
import { isConstant } from "../utils/constants.js";
import Graph from "@specs-feup/flow/graph/Graph";
import ClavaCfgGenerator from "@specs-feup/clava-flow/transformation/ClavaCfgGenerator";
import ClavaFlowGraph from "@specs-feup/clava-flow/ClavaFlowGraph";
import { getLastWrites } from "../cfg/writes.js";

export function areAllTheSameLiteral(exprs: Expression[]): boolean {
    if (exprs.filter(expr => !(expr instanceof Literal)).length !== 0) return false;
    if (exprs.length === 0) return true;
    const first: Literal = exprs[0];
    for (let i = 1; i < exprs.length; i++) {
        if (first.constructor !== exprs[i].constructor || first.code !== exprs[i].code) return false;
    }

    return true;
}

export function propagateConstants(): number {
    let iterationChanges: number = 0;
    let totalChanges: number = 0;
    let cycle: number = 0;

    const constantGlobalVariables: Vardecl[] = Query.search(Vardecl, vardecl => vardecl.isGlobal && isConstant(vardecl)).get();
    for (const constGlobalVariable of constantGlobalVariables) {
        if (!constGlobalVariable.hasInit || !(constGlobalVariable.init instanceof Literal)) continue;
        for (const varref of Query.search(Varref, varref => varref.use === "read" && isVarrefOf(varref, constGlobalVariable)).get()) {
            varref.replaceWith(constGlobalVariable.init.copy());
            totalChanges++;
        }
    }

    do {
        const cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData> = Graph.create()
            .apply(new ClavaCfgGenerator(Query.root() as Program));

        iterationChanges = 0;

        const variables: Vardecl[] = Query.search(Vardecl, vardecl => !vardecl.isGlobal).get();
        const eligibleVarrefs: Varref[] = Query.search(Varref, varref => {
            return varref.use === "read"
                && varref.vardecl !== undefined
                && variables.findIndex(vardecl => isVarrefOf(varref, vardecl)) !== -1
                && !(varref.parent instanceof UnaryOp && varref.parent.kind === "addr_of")
                && !(varref.parent instanceof MemberAccess)
                ;
        }).get();

        for (const eligibleVarref of eligibleVarrefs) {
            const lastWrites: Expression[] = getLastWrites(cfg, eligibleVarref);
            if (lastWrites.length === 0 || !areAllTheSameLiteral(lastWrites)) continue;
            eligibleVarref.replaceWith(lastWrites[0].copy());
            iterationChanges++;
        }

        totalChanges += iterationChanges;
        cycle++;
    } while (iterationChanges > 0 && cycle < 100);

    return totalChanges;
}