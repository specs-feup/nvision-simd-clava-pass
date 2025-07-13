import Query from "@specs-feup/lara/api/weaver/Query.js"
import { Loop, Statement, ReturnStmt, GotoStmt, Break, Continue, Varref, BinaryOp, Joinpoint, Vardecl, Call, ArrayAccess, FunctionJp, Op, Body, Program, Expression } from "@specs-feup/clava/api/Joinpoints.js"
import ClavaJoinPoints from "@specs-feup/clava/api/clava/ClavaJoinPoints.js"
import SimplifyAssignment from "@specs-feup/clava/api/clava/code/SimplifyAssignment.js";
import { propagateAndFoldConstants } from "./constprop/propandfold.js";
import { isConstantIn } from "./utils/constants.js";
import { isVarrefOf } from "./utils/varReferences.js";
import "@specs-feup/clava/api/clava/ClavaJoinPoints.js"
import Graph from "@specs-feup/flow/graph/Graph";
import ClavaCfgGenerator from "@specs-feup/clava-flow/transformation/ClavaCfgGenerator";
import ClavaFlowDotFormatter from "@specs-feup/clava-flow/dot/ClavaFlowDotFormatter";
import ClavaFlowGraph from "@specs-feup/clava-flow/ClavaFlowGraph";
import { valueIs } from "./cfg/valueIs.js";

const packingFactorAcceptedArrayTypes = new Map([
    [2, ["__int16_t", "__uint16_t", "int16_t", "uint16_t"]],
    [4, ["__int8_t", "__uint8_t", "int8_t", "uint8_t"]]
]);

function altersControlFlow(stmt: Statement) {
    return stmt instanceof ReturnStmt || stmt instanceof GotoStmt || stmt instanceof Break || stmt instanceof Continue;
}

/**
 * Checks if the loop's step value is an integer
 */
function hasKnownIntStepValue(loop: Loop): boolean {
    return loop.stepValue !== null && loop.stepValue !== undefined && Number.isSafeInteger(parseFloat(loop.stepValue));
}

/**
 * Checks if the loop's end value can be parsed as an Int
 */
function hasKnownEndValue(loop: Loop): boolean {
    return loop.endValue !== null && loop.endValue !== undefined && Number.isSafeInteger(parseFloat(loop.endValue));
}

function hasConstantPredictableStep(loop: Loop): boolean {
    if (loop.controlVar === undefined || loop.controlVar === null) return false;

    if (!hasKnownIntStepValue(loop)) return false;

    if (loop.controlVarref === undefined || loop.controlVarref.vardecl === undefined) return false;
    return isConstantIn(loop.controlVarref.vardecl, loop.body);
}

function endValueIsConstant(loop: Loop): boolean {
    let endValue: string = loop.endValue;

    if (endValue === undefined || endValue === null) return true;

    let endValueIsLiteral: boolean = Number.isSafeInteger(parseFloat(endValue));

    return endValueIsLiteral;
}

function hasRegularControlFlow(loop: Loop): boolean {
    let hasNoCustomControlFlow: boolean = Query.searchFrom(loop, Statement, altersControlFlow).get().length === 0;

    return hasNoCustomControlFlow && hasConstantPredictableStep(loop) && endValueIsConstant(loop);
}

function isInsideMultiplication(jp: Joinpoint): boolean {
    let parent: Joinpoint = jp.parent;
    while (parent instanceof Op) {
        if (parent instanceof BinaryOp && parent.kind === "mul") return true;
        parent = parent.parent;
    };

    return false;
}

function isValidArrayAccess(jp: Joinpoint, loop: Loop, packingFactor: number, cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>): boolean {
    const arrayAccessValue: ArrayAccess | undefined = valueIs(jp, ArrayAccess, cfg);
    if (arrayAccessValue === undefined) return false;
    if (!packingFactorAcceptedArrayTypes.get(packingFactor)?.includes(arrayAccessValue.type.desugar.code)) return false;

    if (loop.controlVarref?.vardecl === undefined) return false;
    const controlVardecl: Vardecl = loop.controlVarref.vardecl;

    for (let i = 0; i < arrayAccessValue.numSubscripts - 1; i++) {
        if (Query.searchFromInclusive(arrayAccessValue.subscript[i], Varref, varref => isVarrefOf(varref, controlVardecl)).get().length !== 0) return false;
    }

    const lastSubscript: Expression = arrayAccessValue.subscript[arrayAccessValue.numSubscripts - 1];
    if (lastSubscript === undefined) throw new Error(`Array access without subscript: «${arrayAccessValue.code}»`);

    const controlVarAccessesInLastSubscript: Varref[] = Query.searchFromInclusive(lastSubscript, Varref, varref => isVarrefOf(varref, controlVardecl)).get();

    if (controlVarAccessesInLastSubscript.length !== 1 || isInsideMultiplication(controlVarAccessesInLastSubscript[0])) return false;

    return true;
}

function isValidVectorMultiplication(jp: Joinpoint, loop: Loop, packingFactor: number, cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>): boolean {
    const multiplicationValue: BinaryOp | undefined = valueIs(jp, BinaryOp, cfg);
    if (multiplicationValue === undefined || multiplicationValue.kind !== "mul") return false;

    return (isValidArrayAccess(multiplicationValue.left, loop, packingFactor, cfg) && isValidArrayAccess(multiplicationValue.right, loop, packingFactor, cfg));
}

function isValidAccumulatorIncrease(jp: Joinpoint, accumVarref: Varref, loop: Loop, packingFactor: number, cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>): boolean {
    const increaseValue: BinaryOp | undefined = valueIs(jp, BinaryOp, cfg);

    if (increaseValue === undefined || increaseValue.kind !== "add") return false;

    if (
        isVarrefOf(increaseValue.left, accumVarref.vardecl) && isValidVectorMultiplication(increaseValue.right, loop, packingFactor, cfg)
        ||
        isVarrefOf(increaseValue.right, accumVarref.vardecl) && isValidVectorMultiplication(increaseValue.left, loop, packingFactor, cfg)
    ) {
        return true;
    }

    return false;
}

function isValidAccumulatorAssignment(jp: Joinpoint, accumVarref: Varref, loop: Loop, packingFactor: number, cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>): boolean {
    if (!(jp instanceof BinaryOp)) return false;
    const accumAssignment: BinaryOp = jp as BinaryOp;

    if (!accumAssignment.left.equals(accumVarref)) return false;

    if (accumAssignment.kind === "assign") {
        return isValidAccumulatorIncrease(accumAssignment.right, accumVarref, loop, packingFactor, cfg);
    }

    if (accumAssignment.kind === "add_assign") {
        return isValidVectorMultiplication(accumAssignment.right, loop, packingFactor, cfg);
    }

    return false;
}

export function loopIsSuitable(loop: Loop, packingFactor: number, cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>): boolean {
    if (!packingFactorAcceptedArrayTypes.has(packingFactor)) {
        throw new Error(`Tried to use unsupported packingFactor: ${packingFactor}`);
    }

    if (!(loop.kind === "for" && hasRegularControlFlow(loop) && parseInt(loop.initValue) === 0) && parseInt(loop.stepValue) === 1) {
        return false;
    }

    const declaredVariablesInLoop: Vardecl[] = Query.searchFrom(loop, Vardecl).get();
    const externalVariableModifications: Varref[] = Query.searchFrom(loop, Varref, varref => {
        if (!(varref.use === "write" || varref.use === "readwrite")) return false;

        if (varref.vardecl === undefined || varref.vardecl === null) return false;
        return declaredVariablesInLoop.filter(vardecl => vardecl.equals(varref.vardecl)).length === 0;
    }).get();

    const calls: Call[] = Query.searchFrom(loop, Call).get();

    if (calls.length !== 0 || externalVariableModifications.length !== 1) {
        return false;
    }

    const accumVarref: Varref = externalVariableModifications[0];

    // the accumulation should be equivalent to accum += A[...] * B[...]
    return isValidAccumulatorAssignment(accumVarref.parent, accumVarref, loop, packingFactor, cfg);
}

function getArrayAccessWithoutLastSubscript(arrAccess: ArrayAccess): Expression {
    if (arrAccess.numSubscripts <= 1) return arrAccess.arrayVar;
    const subscriptsCopy: Expression[] = [...arrAccess.subscript];
    subscriptsCopy.pop();

    const newArrayAccess: ArrayAccess = ClavaJoinPoints.arrayAccess(arrAccess.arrayVar, ...subscriptsCopy);
    return newArrayAccess;
}

function applyTransformation(suitableForLoop: Loop, packingFactor: number): void {
    const accumVarref: Varref = Query.searchFrom(suitableForLoop, Body).search(BinaryOp, { kind: "assign" }).search(Varref, { use: "write" }).getFirst()!;
    const arrayAccesses: ArrayAccess[] = Query.searchFrom(suitableForLoop, ArrayAccess).get();

    if (arrayAccesses.length !== 1 && arrayAccesses.length !== 2) throw new Error(`Unsupported number of array accesses: «${arrayAccesses.length}», loop code = ${suitableForLoop.code}`);

    const arrayA: Expression = getArrayAccessWithoutLastSubscript(arrayAccesses[0]);
    const arrayB: Expression = getArrayAccessWithoutLastSubscript(arrayAccesses.length === 1 ? arrayAccesses[0] : arrayAccesses[1]);
    const substituteFunction: FunctionJp = Query.search(FunctionJp, { name: `nvision_matrix_col_${packingFactor === 4 ? 8 : 16}b` }).getFirst()!;
    const callToSubFunction: Call = ClavaJoinPoints.call(substituteFunction, arrayA.copy() as Varref, arrayB.copy() as Varref, ClavaJoinPoints.unaryOp("addr_of", accumVarref.copy() as Varref), ClavaJoinPoints.exprLiteral(suitableForLoop.endValue));
    suitableForLoop.replaceWith(callToSubFunction);
}

export async function applyPass(): Promise<void> {
    Query.search(Loop).search(Body).search(BinaryOp, binOp => binOp.isAssignment).get().map(SimplifyAssignment);
    propagateAndFoldConstants();

    const cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData> = Graph.create()
        .apply(new ClavaCfgGenerator(Query.root() as Program));

    const formatter = new ClavaFlowDotFormatter();
    cfg.toFile(formatter, "dist/graph.dot");

    /*
        I am first considering the case where the original value is an int8_t, since
        nvision's instructions use 32 bit packed values, the packing factor is 4x!
    */
    const packingFactor = 4;

    const forLoops = Query.search(Loop, (loop: Loop) => loopIsSuitable(loop, packingFactor, cfg)).get();

    // await VisualizationTool.visualize();

    for (const suitableLoop of forLoops) {
        applyTransformation(suitableLoop, 4);
    }
    console.log("Found " + forLoops.length + " forloops.")
}