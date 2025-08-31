import Query from "@specs-feup/lara/api/weaver/Query.js"
import { Loop, Statement, ReturnStmt, GotoStmt, Break, Continue, Varref, BinaryOp, Joinpoint, Vardecl, Call, ArrayAccess, FunctionJp, Op, Body, Program, Expression, Cast, UnaryOp } from "@specs-feup/clava/api/Joinpoints.js"
import ClavaJoinPoints from "@specs-feup/clava/api/clava/ClavaJoinPoints.js"
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

function bitwidthInRv32(type: string): number | undefined {
    if (type.includes("char")) return 8;
    if (type.includes("short")) return 16;
    if (type.includes("int")) return 32;
    if (type.includes("long long")) return 64;
    if (type.includes("long")) return 32;

    return undefined;
}

const SW_MAC_CODE_8: string = `
signed int __nvision_sim_accum = 0;

void __mac_8b(int a, int b, int c, int d) {
  signed char *a_cast = (signed char *)(&a);
  signed char *b_cast = (signed char *)(&b);
  signed char *c_cast = (signed char *)(&c);
  signed char *d_cast = (signed char *)(&d);

  __nvision_sim_accum += a_cast[0] * b_cast[0];
  __nvision_sim_accum += a_cast[1] * b_cast[1];
  __nvision_sim_accum += a_cast[2] * b_cast[2];
  __nvision_sim_accum += a_cast[3] * b_cast[3];

  __nvision_sim_accum += c_cast[0] * d_cast[0];
  __nvision_sim_accum += c_cast[1] * d_cast[1];
  __nvision_sim_accum += c_cast[2] * d_cast[2];
  __nvision_sim_accum += c_cast[3] * d_cast[3];
}

int __read_clear() {
  inr temp = __nvision_sim_accum;
  __nvision_sim_accum = 0;

  return temp;
}
`

const HW_MAC_CODE_8: string = `
void __mac_8b(int a, int b, int c, int d) {
  asm volatile(".insn r 0b0001011, 0x02, 0x0, x0, %[RS1], %[RS2]\\n"
               ".insn r 0b0001011, 0x02, 0x0, x0, %[RS3], %[RS4]"
               :
               : [RS1] "r"(a), [RS2] "r"(b), [RS3] "r"(c), [RS4] "r"(d));
}

int __read_clear() {
  int result = 0;
  asm volatile(".insn r 0b0001011, 0x07, 0x0, %[RD], x0, x0"
               : [RD] "=r"(result));
  return result;
}
`

const WRAPPER_FUNCTION_CODE_8: string = `
#include <stddef.h>

void __mac_8b(int a, int b, int c, int d);
int __read_clear();

void __mac_wrapper_8b(signed char *A, signed char *B, int *accum,
                           size_t length) {
  __read_clear();

  int mac_len = length / 8;
  int *A_cast = (int *)A;
  int *B_cast = (int *)B;

  for (int i = 0; i < mac_len; i++) {
    __mac_8b(A_cast[i * 2], B_cast[i * 2], A_cast[i * 2 + 1],
               B_cast[i * 2 + 1]);
  }

  *accum += __read_clear();

  for (int i = (length / 8) * 8; i < length; i++) {
    *accum += A[i] * B[i];
  }
}
`

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

function endValueIsConstant(loop: Loop, silent = true): boolean {
    let endValue: string = loop.endValue;

    if (endValue === undefined || endValue === null) return true;

    let endValueIsLiteral: boolean = Number.isSafeInteger(parseFloat(endValue));
    if (!silent) console.log(`\tend value is «${endValue}», therefore it is${endValueIsLiteral ? "" : " not"} constant`);
    return endValueIsLiteral;
}

function hasRegularControlFlow(loop: Loop, silent = true): boolean {
    let hasNoCustomControlFlow: boolean = Query.searchFrom(loop, Statement, altersControlFlow).get().length === 0;

    if (!hasNoCustomControlFlow) {
        if (!silent) console.log(`\tLoop has control-flow altering statements, therefore it is not valid`);
        return false;
    }

    if (!hasConstantPredictableStep(loop)) {
        if (!silent) console.log(`\tLoop does not have constant predictable step, therefore it is not valid`);
        return false;
    }

    if (!endValueIsConstant(loop, silent)) {
        if (!silent) console.log(`\tLoop's end value is not constant, therefore it is not valid`);
        return false;
    }

    return true;
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
        return declaredVariablesInLoop.filter(vardecl => vardecl.astId === varref.vardecl.astId).length === 0;
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
    private operandBitwidth: number;
    private silent: boolean;
    private cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>;

    public constructor(operandBitSize: number, silent: boolean = true, cfg?: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>) {
        this.currentArrayAccesses = [];
        this.validLoops = [];
        this.operandBitwidth = operandBitSize;
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

        const arrayTypeSizeInBitsInRiscv32: number | undefined = bitwidthInRv32(arrayAccessValue.type.desugarAll.code);
        if (arrayTypeSizeInBitsInRiscv32 === undefined) {
            this.logJpAndValue(jp, arrayAccessValue, `of type «${arrayAccessValue.type.code}»${arrayAccessValue.type.code !== arrayAccessValue.type.desugarAll.code ? ` (${arrayAccessValue.type.desugarAll.code})` : ''} is not of a valid type for the elements of one of the vectors. The elements of an array should be of one of the following types: [char, short, int, long] and have bit size «${this.operandBitwidth}» in rv32`);
            return false;
        }

        if (arrayTypeSizeInBitsInRiscv32 !== this.operandBitwidth) {
            this.logJpAndValue(jp, arrayAccessValue, `of type «${arrayAccessValue.type.code}»${arrayAccessValue.type.code !== arrayAccessValue.type.desugarAll.code ? ` (${arrayAccessValue.type.desugarAll.code})` : ''} is not of a valid type for the elements of one of the vectors, since its bit size is «${arrayTypeSizeInBitsInRiscv32}» in rv32, and the hardware instructions expect operands with a bit width of «${this.operandBitwidth}»`);
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
            this.logJp(jp, "left value is the accumulator, therefore it does not constitute a valid accumulator assignment. This is not supposed to happen.");
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

        if (this.operandBitwidth !== 8) {
            throw new Error(`Tried to use unsupported bitwidth: ${this.operandBitwidth}`);
        }

        if (loop.kind !== "for") {
            this.logLoop("is invalid since it is not a for loop\n");
            return false;
        }

        if (!hasRegularControlFlow(loop, this.silent)) {
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

        if (bitwidthInRv32(accumVarref.type.desugarAll.code) !== 32) {
            this.logJp(accumVarref, "is not a valid accumulator since its bitwidth is not 32");
            return false;
        }

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

        if (this.operandBitwidth !== 8) throw new Error("TODO");
        const substituteFunction: FunctionJp = Query.search(FunctionJp, { name: `__mac_wrapper_${this.operandBitwidth}b` }).getFirst()!;

        const accumAddrof = ClavaJoinPoints.unaryOp("addr_of", accumVarref.copy() as Varref);
        const castPointerToAccum: Cast = ClavaJoinPoints.cStyleCast(ClavaJoinPoints.type("int*"), accumAddrof);

        const callToSubFunction: Call = ClavaJoinPoints.call(substituteFunction, arrayA, arrayB, castPointerToAccum, ClavaJoinPoints.exprLiteral(validLoop.endValue));
        
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

function attachNecessaryFunctions(useSoftwareSimInstructions: boolean): void {
    Clava.getProgram().files[0].insert("before", WRAPPER_FUNCTION_CODE_8);
    Clava.rebuild();
}

export function applyPass(useSoftwareSimInstructions: boolean, operandBitwidth: number = 8, silent: boolean = true): void {
    attachNecessaryFunctions(useSoftwareSimInstructions);

    Clava.pushAst();

    if (!silent) console.log(`Propagated & folded constants a total of ${propagateAndFoldConstants()} times`);

    const cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData> = Graph.create()
        .apply(new ClavaCfgGenerator(Query.root() as Program));

    const formatter = new ClavaFlowDotFormatter();
    cfg.toFile(formatter, "dist/graph.dot");
    const vecMulReplacer: VecMulAccumulationReplacer = new VecMulAccumulationReplacer(operandBitwidth, silent, cfg);

    for (const loop of Query.search(Loop).get()) {
        vecMulReplacer.analyseLoopValidity(loop);
    }

    Clava.popAst();

    vecMulReplacer.applyTransformations();
    Clava.getProgram().files[0].insert("after", useSoftwareSimInstructions ? SW_MAC_CODE_8 : HW_MAC_CODE_8);

    if (!silent) {
        console.log(`Applied transformations to ${vecMulReplacer.getValidLoopNumber()} loops`);
    }
}