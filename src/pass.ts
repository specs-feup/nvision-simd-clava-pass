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
import Clava from "@specs-feup/clava/api/clava/Clava.js";

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

function getExternalVariableWrites(baseJp: Joinpoint): Varref[] {
    const declaredVariablesInLoop: Vardecl[] = Query.searchFrom(baseJp, Vardecl).get();
    const externalVariableModifications: Varref[] = Query.searchFrom(baseJp, Varref, varref => {
        if (!(varref.use === "write" || varref.use === "readwrite")) return false;

        if (varref.vardecl === undefined || varref.vardecl === null) return false;
        return declaredVariablesInLoop.filter(vardecl => vardecl.equals(varref.vardecl)).length === 0;
    }).get();

    return externalVariableModifications;
}

function getArrayAccessWithoutLastSubscript(arrAccess: ArrayAccess): Expression {
    if (arrAccess.numSubscripts <= 1) return arrAccess.arrayVar.deepCopy() as Expression;
    const subscriptsCopy: Expression[] = [...arrAccess.subscript];
    subscriptsCopy.pop();

    const newArrayAccess: ArrayAccess = ClavaJoinPoints.arrayAccess(arrAccess.arrayVar, ...subscriptsCopy);
    return newArrayAccess;
}

function logWithCodeAndPos(jp: Joinpoint, message: string, prefix: string = "") {
    console.log(`${prefix}«${jp.code}» [${jp.line}:${jp.column}] ${message}`);
}

type ValidLoopInfo = {
    loopAstId: string,
    accumVarrefAstId: string,
    firstArrayAccessAstId: string,
    secondArrayAccessAstId: string,
}
export class VecMulAccumulationReplacer {
    private currentLoop: Loop | undefined;
    private currentAccumVarref: Varref | undefined;
    private currentArrayAccesses: ArrayAccess[];
    private validLoops: ValidLoopInfo[];
    private packingFactor: number;
    private silent: boolean;
    private cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>;

    public constructor(packingFactor: number, silent: boolean = true, cfg?: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>) {
        this.currentArrayAccesses = [];
        this.validLoops = [];
        this.packingFactor = packingFactor;
        this.silent = silent;
        this.cfg = cfg ?? Graph.create()
            .apply(new ClavaCfgGenerator(Query.root() as Program));
    }

    private resetCurrentVariables() {
        this.currentLoop = undefined;
        this.currentAccumVarref = undefined;
        this.currentArrayAccesses = [];
    }

    private logJp(jp: Joinpoint, message: string) {
        if (this.silent) return;
        logWithCodeAndPos(jp, message, "\t");
    }

    private logJpAndValue(jp: Joinpoint, value: Joinpoint, message: string) {
        if (this.silent) return;
        if (jp.equals(value)) {
            this.logJp(jp, message);
            return;
        }

        console.log(`\t«${jp.code}» [${jp.line}:${jp.column}] with value «${value.code}» [${value.line}:${value.column}] ${message}`);
    }

    private logLoop(message: string) {
        if (this.silent) return;
        console.log(`\tLoop at [${this.currentLoop!.line}:${this.currentLoop!.column}] ` + message);
    }

    private log(message: string, prefix = "\t") {
        if (this.silent) return;
        console.log(prefix + message);
    }

    private isValidArrayAccess(jp: Joinpoint): boolean {
        const arrayAccessValue: ArrayAccess | undefined = valueIs(jp, ArrayAccess, this.cfg);
        if (arrayAccessValue === undefined) {
            this.logJp(jp, "is not an array access, therefore is not a valid array access");
            return false;
        }

        if (!packingFactorAcceptedArrayTypes.get(this.packingFactor)?.includes(arrayAccessValue.type.desugar.code)) {
            this.logJpAndValue(jp, arrayAccessValue, `type (${arrayAccessValue.type}) is not valid for a packing factor of ${this.packingFactor}`);
            return false;
        }

        if (this.currentLoop?.controlVarref?.vardecl === undefined) {
            this.logLoop(`does not have a control variable. This should have been caught in earlier checks`);
            return false;
        }

        const controlVardecl: Vardecl = this.currentLoop?.controlVarref.vardecl;

        for (let i = 0; i < arrayAccessValue.numSubscripts - 1; i++) {
            if (Query.searchFromInclusive(arrayAccessValue.subscript[i], Varref, varref => isVarrefOf(varref, controlVardecl)).get().length !== 0) return false;
        }

        const lastSubscript: Expression = arrayAccessValue.subscript[arrayAccessValue.numSubscripts - 1];
        if (lastSubscript === undefined) throw new Error(`Array access without subscript: «${arrayAccessValue.code}»`);

        const controlVarAccessesInLastSubscript: Varref[] = Query.searchFromInclusive(lastSubscript, Varref, varref => isVarrefOf(varref, controlVardecl)).get();

        if (controlVarAccessesInLastSubscript.length !== 1) {
            this.logJp(arrayAccessValue, `does not access memory continuously, since in each iteration it accesses a different subarray (loop control variable «${controlVardecl.name}» found in a subscript that isn't the last)`);
            return false;
        }

        if (isInsideMultiplication(controlVarAccessesInLastSubscript[0])) {
            this.logJp(arrayAccessValue, `does not access memory continuously, since in each iteration it does not move forward in the array (loop control variable «${controlVardecl.name}» not found in the access' subscript)`);
            return false;
        }

        this.currentArrayAccesses.push(arrayAccessValue);
        this.logJp(arrayAccessValue, "contains a valid array access");
        return true;
    }

    private isValidVectorMultiplication(jp: Joinpoint): boolean {
        const multiplicationValue: BinaryOp | undefined = valueIs(jp, BinaryOp, this.cfg);
        if (multiplicationValue === undefined) {
            this.logJp(jp, "is not a binary operation, therefore it is an invalid vector multiplication")
            return false;
        }

        if (multiplicationValue.kind !== "mul") {
            this.logJpAndValue(jp, multiplicationValue, "is not a multiplication, therefore it is an invalid vector multiplication")
            return false;
        }

        if (!(this.isValidArrayAccess(multiplicationValue.left) && this.isValidArrayAccess(multiplicationValue.right))) {
            this.logJpAndValue(jp, multiplicationValue, "is not a valid vector multiplication since its operands are not valid array accesses");

            return false;
        }

        return true;
    }

    private isValidAccumulatorIncrease(jp: Joinpoint): boolean {
        const increaseValue: BinaryOp | undefined = valueIs(jp, BinaryOp, this.cfg);

        if (increaseValue === undefined) {
            this.logJp(jp, "is not a binary operation, therefore it is not a valid accumulator increase (expected a sum)");
            return false;
        }

        if (increaseValue.kind !== "add") {
            this.logJpAndValue(jp, increaseValue, "is not a sum, therefore it is not a valid accumulator increase");
            return false;
        }

        if (
            isVarrefOf(increaseValue.left, this.currentAccumVarref!.vardecl) && this.isValidVectorMultiplication(increaseValue.right)
            ||
            isVarrefOf(increaseValue.right, this.currentAccumVarref!.vardecl) && this.isValidVectorMultiplication(increaseValue.left)
        ) {
            this.logJpAndValue(jp, increaseValue, "constitutes a valid accumulator increase (it's a sum of the accumulator and the vector multiplication)");
            return true;
        }

        this.logJpAndValue(jp, increaseValue, "is a sum but does not constitute a valid accumulator increase (either the accumulator or a valid vector multiplication was not found)");
        return false;
    }

    private isValidAccumulatorAssignment(jp: Joinpoint): boolean {
        if (!(jp instanceof BinaryOp)) {
            this.logJp(jp, "is not a binary operation, therefore it is not a valid accumulator assignment");
            return false;
        }
        const accumAssignment: BinaryOp = jp as BinaryOp;

        if (!accumAssignment.left.equals(this.currentAccumVarref!)) {
            this.logJp(jp, "left value is the accumulator, therefore it does not consitutate a valid accumulator assignment. This is not supposed to happen.");
            return false;
        }

        if (accumAssignment.kind === "assign") {
            if (this.isValidAccumulatorIncrease(accumAssignment.right)) {
                this.logJp(jp, "is a valid accumulator assignment of type 'simple assignment'");
                return true;
            }
            this.logJp(jp, "is not a valid accumulator assignment of type 'simple assignment'");
            return false;
        }

        if (accumAssignment.kind === "add_assign") {
            if (this.isValidVectorMultiplication(accumAssignment.right)) {
                this.logJp(jp, "is a valid accumulator assignment of type 'add and assign'");
                return true;
            }
            this.logJp(jp, "is not a valid accumulator assignment of type 'add and assign'");
            return false;
        }

        this.logJp(jp, "is not a valid accumulator assignment");
        return false;
    }

    public analyseLoopValidity(loop: Loop): boolean {
        this.currentLoop = loop;
        this.log(`Analysing Loop [${loop.line}:${loop.column}]`, "");

        if (!packingFactorAcceptedArrayTypes.has(this.packingFactor)) {
            throw new Error(`Tried to use unsupported packingFactor: ${this.packingFactor}`);
        }

        if (loop.kind !== "for") {
            this.logLoop("is invalid since it is not a for loop\n");
            return false;
        }

        if (!hasRegularControlFlow(loop)) {
            this.logLoop("is invalid since its control flow is not regular\n");
            return false;
        }

        if (parseFloat(loop.initValue) !== 0 || !Number.isSafeInteger(parseFloat(loop.initValue))) {
            this.logLoop(`is invalid since its init value is not 0 but «${loop.initValue}» (currently unsupported)\n`);
            return false;
        }

        if (parseFloat(loop.stepValue) !== 1 || !Number.isSafeInteger(parseFloat(loop.stepValue))) {
            this.logLoop(`is invalid since its step value is not 1 but «${loop.stepValue}» (memory accesses must be continuous)\n`);
            return false;
        }

        const externalVariableModifications: Varref[] = getExternalVariableWrites(loop);

        const calls: Call[] = Query.searchFrom(loop, Call).get();

        if (calls.length !== 0) {
            this.logLoop("is invalid since it contains function calls (loop must not produce side effects aside from the accumulator)\n");
            return false;
        }

        if (externalVariableModifications.length === 0) {
            this.logLoop(`is invalid since it doesn't alter a single variable declared outside of the loop (loop must modify an accumulator that was declared outside of the loop)\n`);
            return false
        }

        if (externalVariableModifications.length > 1) {
            this.logLoop(`is invalid since it alters multiple variables declared outside of the loop «${externalVariableModifications.map(varref => `${varref.code} [${varref.line}:${varref.column}]`)}» (loop must not produce side effects aside from the accumulator)\n`);
            return false;
        }

        const accumVarref: Varref = externalVariableModifications[0];
        this.currentAccumVarref = accumVarref;

        // the accumulation should be equivalent to accum += A[...] * B[...]
        if (this.isValidAccumulatorAssignment(accumVarref.parent)) {
            if (this.currentArrayAccesses.length !== 2) throw new Error(`Found a valid loop, but the number of current array accesses isn't 2 but instead ${this.currentArrayAccesses.length}`);

            this.logLoop("is a valid loop\n");
            this.validLoops.push({
                loopAstId: this.currentLoop.astId,
                accumVarrefAstId: this.currentAccumVarref.astId,
                firstArrayAccessAstId: this.currentArrayAccesses[0].astId,
                secondArrayAccessAstId: this.currentArrayAccesses[1].astId
            });

            this.resetCurrentVariables();
            return true;
        }

        this.logLoop("is not a valid loop since it does not contain a valid accumulator assignment\n");
        this.resetCurrentVariables();
        return false;
    }

    public applyTransformation(validLoopInfo: ValidLoopInfo): void {
        this.log(`Transforming Loop with id ${validLoopInfo.loopAstId}`, "");

        const validLoop: Loop = Query.search(Loop, { astId: validLoopInfo.loopAstId }).getFirst()!;
        const accumVarref: Varref = Query.search(Varref, { astId: validLoopInfo.accumVarrefAstId }).getFirst()!;
        const baseArrayAccessA: ArrayAccess = Query.search(ArrayAccess, { astId: validLoopInfo.firstArrayAccessAstId }).getFirst()!;
        const baseArrayAccessB: ArrayAccess = Query.search(ArrayAccess, { astId: validLoopInfo.secondArrayAccessAstId }).getFirst()!;

        const arrayA: Expression = getArrayAccessWithoutLastSubscript(baseArrayAccessA);
        const arrayB: Expression = getArrayAccessWithoutLastSubscript(baseArrayAccessB);
        const substituteFunction: FunctionJp = Query.search(FunctionJp, { name: `nvision_matrix_col_${this.packingFactor === 4 ? 8 : 16}b` }).getFirst()!;
        const callToSubFunction: Call = ClavaJoinPoints.call(substituteFunction, arrayA, arrayB, ClavaJoinPoints.unaryOp("addr_of", accumVarref.copy() as Varref), ClavaJoinPoints.exprLiteral(validLoop.endValue));
        this.log(`Transformed Loop [${validLoop.line}:${validLoop.column}]\n`);
        validLoop.replaceWith(callToSubFunction);
    }

    public applyTransformations(): void {
        for (const validLoopInfo of this.validLoops) {
            this.applyTransformation(validLoopInfo);
        }
    }

    public getValidLoopNumber(): number {
        return this.validLoops.length;
    }
}

export function applyPass(packingFactor: number = 4, silent: boolean = true): void {
    // Clava.pushAst();
    propagateAndFoldConstants();

    const cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData> = Graph.create()
        .apply(new ClavaCfgGenerator(Query.root() as Program));

    const formatter = new ClavaFlowDotFormatter();
    cfg.toFile(formatter, "dist/graph.dot");
    const vecMulReplacer: VecMulAccumulationReplacer = new VecMulAccumulationReplacer(packingFactor, silent, cfg);

    for (const loop of Query.search(Loop).get()) {
        vecMulReplacer.analyseLoopValidity(loop);
    }

    // Clava.popAst();
    // await VisualizationTool.visualize();

    vecMulReplacer.applyTransformations();

    if (!silent) {
        console.log(`Applied transformations to ${vecMulReplacer.getValidLoopNumber()} loops`);
    }
}