import Query from "@specs-feup/lara/api/weaver/Query.js"
import { Loop, Statement, ReturnStmt, GotoStmt, Break, Continue, Varref, BinaryOp, Joinpoint, Vardecl, Call, ArrayAccess, FunctionJp, Op, Body, Program } from "@specs-feup/clava/api/Joinpoints.js"
import ClavaJoinPoints from "@specs-feup/clava/api/clava/ClavaJoinPoints.js"
import SimplifyAssignment from "@specs-feup/clava/api/clava/code/SimplifyAssignment.js";
import { propagateAndFoldConstants } from "./constprop/propandfold.js";
import { isConstantIn } from "./utils/constants.js";
import { isVarrefOf } from "./utils/varReferences.js";
import "@specs-feup/clava/api/clava/ClavaJoinPoints.js"


const packingFactorAcceptedArrayTypes = new Map([
    [2, ["__int16_t", "__uint16_t", "int16_t", "uint16_t"]],
    [4, ["__int8_t", "__uint8_t", "int8_t", "uint8_t"]]
]);

function altersControlFlow(stmt: Statement) {
    return stmt instanceof ReturnStmt || stmt instanceof GotoStmt || stmt instanceof Break || stmt instanceof Continue;
}

/**
 * Checks if the loop's step value can be parsed as an Int
 */
function hasKnownIntStepValue(loop: Loop): boolean {
    return loop.stepValue !== null && loop.stepValue !== undefined && !Number.isNaN(parseInt(loop.stepValue));
}

/**
 * Checks if the loop's end value can be parsed as an Int
 */
function hasKnownEndValue(loop: Loop): boolean {
    return loop.endValue !== null && loop.endValue !== undefined && !Number.isNaN(parseInt(loop.endValue));
}

function hasConstantPredictableStep(loop: Loop): boolean {
    if (loop.controlVar === undefined || loop.controlVar === null) return false;

    if (!hasKnownIntStepValue(loop)) return false;

    const loopControlVarDecl: Vardecl = Query.searchFrom(loop, Varref, { name: loop.controlVar }).getFirst()!.vardecl!;

    return isConstantIn(loopControlVarDecl, loop.body);
}

function endValueIsConstant(loop: Loop): boolean {
    let endValue: string = loop.endValue;

    if (endValue === undefined || endValue === null) return true;

    let endValueIsLiteral: boolean = !Number.isNaN(parseInt(endValue));

    if (endValueIsLiteral) return true;

    return false;
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

function loopIsSuitable(loop: Loop, packingFactor: number): boolean {

    if (!(packingFactorAcceptedArrayTypes.has(packingFactor))) {
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

    // for now, the accumulation should be of the type accum = accum + A[...] * B[...]
    if (!(accumVarref.parent instanceof BinaryOp)) return false;
    const accumAssignment: BinaryOp = accumVarref.parent as BinaryOp;
    if (accumAssignment.kind !== "assign" || !accumAssignment.left.equals(accumVarref)) return false;

    if (!(accumAssignment.right instanceof BinaryOp)) return false;
    const assignmentRightJp: BinaryOp = accumAssignment.right as BinaryOp;
    if (assignmentRightJp.kind !== "add" || !isVarrefOf(assignmentRightJp.left, accumVarref.vardecl) || !(assignmentRightJp.right instanceof BinaryOp))
        return false;

    const multiplicationOfArrayAccesses: BinaryOp = assignmentRightJp.right;
    if (multiplicationOfArrayAccesses.kind !== "mul" || !(multiplicationOfArrayAccesses.left instanceof ArrayAccess) || !(multiplicationOfArrayAccesses.right instanceof ArrayAccess))
        return false;

    if (!packingFactorAcceptedArrayTypes.get(packingFactor)?.includes(multiplicationOfArrayAccesses.left.type.desugar.code)) return false;
    if (!packingFactorAcceptedArrayTypes.get(packingFactor)?.includes(multiplicationOfArrayAccesses.right.type.desugar.code)) return false;

    // does not work if control var is initialized outside of loop...
    const controlVal: Vardecl = Query.searchFrom(loop, Vardecl, { name: loop.controlVar }).getFirst()!;

    if (Query.searchFrom(multiplicationOfArrayAccesses.left, Varref, varref => isVarrefOf(varref, controlVal) && !isInsideMultiplication(varref)).get().length === 0) return false;
    if (Query.searchFrom(multiplicationOfArrayAccesses.right, Varref, varref => isVarrefOf(varref, controlVal) && !isInsideMultiplication(varref)).get().length === 0) return false;

    return true;
}

function applyTransformation(suitableForLoop: Loop, packingFactor: number): void {
    const accumVarref: Varref = Query.searchFrom(suitableForLoop, Body).search(BinaryOp, { kind: "assign" }).search(Varref, { use: "write" }).getFirst()!;
    const arrayAccesses: ArrayAccess[] = Query.searchFrom(accumVarref.parent, ArrayAccess).get();

    if (arrayAccesses.length !== 1 && arrayAccesses.length !== 2) throw new Error("Unsupported number of array accesses");

    const arrayA: Varref = arrayAccesses[0].arrayVar as Varref;
    const arrayB: Varref = (arrayAccesses.length === 1 ? arrayAccesses[0] : arrayAccesses[1]).arrayVar as Varref;
    const substituteFunction: FunctionJp = Query.search(FunctionJp, { name: `nvision_matrix_col_${packingFactor === 4 ? 8 : 16}b` }).getFirst()!;
    const callToSubFunction: Call = ClavaJoinPoints.call(substituteFunction, arrayA.copy() as Varref, arrayB.copy() as Varref, ClavaJoinPoints.unaryOp("addr_of", accumVarref.copy() as Varref), ClavaJoinPoints.exprLiteral(suitableForLoop.endValue));
    suitableForLoop.replaceWith(callToSubFunction);
}

Query.search(Loop).search(Body).search(BinaryOp, binOp => binOp.isAssignment).get().map(SimplifyAssignment);
propagateAndFoldConstants();

/*
    I am first considering the case where the original value is an int8_t, since
    nvision's instructions use 32 bit packed values, the packing factor is 4x!
*/
const packingFactor = 4;

const forLoops = Query.search(Loop, (loop: Loop) => loopIsSuitable(loop, packingFactor)).get();

for (const suitableLoop of forLoops) {
    applyTransformation(suitableLoop, 4);
}

console.log("Found " + forLoops.length + " forloops.")