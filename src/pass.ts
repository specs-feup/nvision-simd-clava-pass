import Query from "@specs-feup/lara/api/weaver/Query.js";
import { Loop, Statement, ReturnStmt, GotoStmt, Break, Continue, Varref, BinaryOp, Joinpoint, Vardecl, Call, ArrayAccess, FunctionJp, Op, Body, Program, Expression, Cast, UnaryOp, ParenExpr, InitList } from "@specs-feup/clava/api/Joinpoints.js";
import ClavaJoinPoints from "@specs-feup/clava/api/clava/ClavaJoinPoints.js";
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
import { VectorReduceSimplificator } from "@specs-feup/clava-code-transforms/VectorReduceSimplification";
// import { FW_DECL_CODE_4, SW_MAC_CODE_4, HW_MAC_CODE_4, DOT_PROD_CODE_4 } from "./insertedcode/4bit.js";
import { FW_DECL_CODE_8, SW_MAC_CODE_8, HW_MAC_CODE_8, DOT_PROD_CODE_8 } from "./insertedcode/8bit.js";
import { FW_DECL_CODE_16, SW_MAC_CODE_16, HW_MAC_CODE_16, DOT_PROD_CODE_16 } from "./insertedcode/16bit.js";
import { FW_DECL_CODE_32, SW_MAC_CODE_32, HW_MAC_CODE_32, DOT_PROD_CODE_32 } from "./insertedcode/32bit.js";
import { SW_READ_CLEAR_CODE, HW_READ_CLEAR_CODE, FW_DECL_READ_CLEAR_SW, FW_DECL_READ_CLEAR_HW } from "./insertedcode/readclear.js";

function bitwidthInRv32(type: string): number | undefined {
    if (type.includes("char")) return 8;
    if (type.includes("short")) return 16;
    if (type.includes("int")) return 32;
    if (type.includes("long long")) return 64;
    if (type.includes("long")) return 32;

    return undefined;
}

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
    if (endValueIsLiteral) {
        try {
            ClavaJoinPoints.integerLiteral(endValue);
        } catch (e) {
            endValueIsLiteral = false;
        }
    }

    if (!endValueIsLiteral) {
        try {
            const varrefsWithEndValueName: Varref[] = Query.searchFromInclusive(loop, Varref, { name: endValue }).get();
            if (varrefsWithEndValueName.length === 0) {
                if (!silent) console.log(`\tloop's endvalue is not a literal, however it is not just a varref either, therefore it is currently impossible to determine if its value is constant: «${endValue}»`);
                return false;
            }

            for (const varref of varrefsWithEndValueName) {
                if (varref.use !== "read") {
                    if (!silent) console.log(`\tendValue is a variable that is not constant inside the loop: ${varref.parent.code}`);
                    return false;
                }
            }
        } catch (e) {
            if (!silent) console.log(`\tUnknown error when trying to process loop end value: ${e}`);
            return false;
        }
    }

    return true;
}

function hasRegularControlFlow(loop: Loop, silent = true): boolean {
    let hasNoCustomControlFlow: boolean = Query.searchFrom(loop, Statement, altersControlFlow).get().length === 0;

    if (!hasNoCustomControlFlow) {
        if (!silent) console.log(`\tLoop has control-flow altering statements`);
        return false;
    }

    if (!hasConstantPredictableStep(loop)) {
        if (!silent) console.log(`\tLoop does not have constant predictable step`);
        return false;
    }

    if (!endValueIsConstant(loop, silent)) {
        if (!silent) console.log(`\tLoop's end value is not constant`);
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

function isInsideOpThatIsNotAdd(jp: Joinpoint): boolean {
    let parent: Joinpoint = jp.parent;
    while (parent instanceof Op || parent instanceof ParenExpr) {
        if (parent instanceof BinaryOp && parent.kind !== "add") return true;
        if (parent instanceof UnaryOp) return true;

        parent = parent.parent;
    };

    return false;
}

function getExternalVariableOrArrayWrites(baseJp: Joinpoint, except?: Vardecl): (Varref | ArrayAccess)[] {
    const declaredVariablesInLoop: Vardecl[] = Query.searchFrom(baseJp, Vardecl).get();
    const externalVariableModifications: Varref[] = Query.searchFrom(baseJp, Varref, varref => {
        if (!(varref.use === "write" || varref.use === "readwrite")) return false;

        if (varref.vardecl === undefined || varref.vardecl === null) return false;
        if (except !== undefined && varref.vardecl.astId === except.astId) return false;
        return declaredVariablesInLoop.filter(vardecl => vardecl.astId === varref.vardecl.astId).length === 0;
    }).get();

    const externalArrayModifications: ArrayAccess[] = Query.searchFrom(baseJp, ArrayAccess, arrAccess => {
        if (!(arrAccess.use === "write" || arrAccess.use === "readwrite")) return false;

        if (arrAccess.vardecl === undefined || arrAccess.vardecl === null) return false;
        if (except !== undefined && arrAccess.vardecl.astId === except.astId) return false;
        return declaredVariablesInLoop.filter(vardecl => vardecl.astId === arrAccess.vardecl.astId).length === 0;
    }).get();

    return [...externalVariableModifications, ...externalArrayModifications];
}

function getArrayAccessWithoutLastSubscript(arrAccess: ArrayAccess) {
    if (arrAccess.numSubscripts <= 1) return arrAccess.arrayVar.deepCopy() as Expression;
    const subscriptsCopy: Expression[] = [...arrAccess.subscript];
    subscriptsCopy.pop();

    // console.log(`arrAccess.arrayVar: ${arrAccess.arrayVar.code}`);
    // console.log(`arrAccess.arrayVar.type: ${arrAccess.arrayVar.type.desugarAll.code}`);
    // const newArrayAccess: ArrayAccess = ClavaJoinPoints.arrayAccess(arrAccess.arrayVar, ...subscriptsCopy);
    return ClavaJoinPoints.exprLiteral(`${arrAccess.arrayVar.vardecl.name}${subscriptsCopy.map(e => "[" + e.code + "]").join("")}`) as ArrayAccess;
}

function getArrayAccessWithoutControlVar(arrAccess: ArrayAccess, controlVar: Vardecl): Expression {
    const controlVarVarref: Varref | undefined = Query.searchFromInclusive(arrAccess.subscript[arrAccess.numSubscripts - 1], Varref, varref => isVarrefOf(varref, controlVar)).getFirst();
    if (controlVarVarref === undefined) throw new Error("Loop Control Var's Varref was not found in the last subscript, violating one of the preconditions for the loop being selected");

    let lastPossibleChildOfParenthesis: Joinpoint = controlVarVarref;
    let parent: Joinpoint = controlVarVarref.parent;

    while (parent instanceof ParenExpr) {
        lastPossibleChildOfParenthesis = parent;
        parent = parent.parent;
    }

    if (parent instanceof ArrayAccess) return getArrayAccessWithoutLastSubscript(arrAccess);
    if (parent instanceof BinaryOp && parent.kind === "add") {
        const otherExpr: Expression = parent.left.astId === lastPossibleChildOfParenthesis.astId ? parent.right : parent.left;
        parent.replaceWith(otherExpr);
        return ClavaJoinPoints.unaryOp("&", ClavaJoinPoints.parenthesis(arrAccess.deepCopy() as Expression));
    }

    throw new Error(`Invalid array access: «${arrAccess.code}»: control var varref's parent is neither the ArrayAccess, a sum BinaryOp or a ParenthesisExpression, but instead «${controlVarVarref.parent.code}»`);
}

function logWithCodeAndPos(jp: Joinpoint, message: string, prefix: string = "") {
    console.log(`${prefix}«${jp.code}» [${jp.line}:${jp.column}] ${message}`);
}

enum MacBitWidth {
    FOUR_BIT = "4b",
    EIGHT_BIT = "8b",
    SIXTEEN_BIT = "16b",
    THIRTYTWO_BIT = "32b",
};

type ValidLoopInfo = {
    loopAstId: string,
    accumVarrefAstId: string,
    firstArrayAccessAstId: string,
    secondArrayAccessAstId: string,
    macBitWidth: MacBitWidth,
}
export class VecMulAccumulationReplacer {
    private currentLoop: Loop | undefined;
    private currentAccumVarref: Varref | ArrayAccess | undefined;
    private currentArrayAccesses: ArrayAccess[];
    private currentMacBitWidthLeft: MacBitWidth | undefined;
    private currentMacBitWidthRight: MacBitWidth | undefined;
    private _transformations: number = 0;

    public get transformations(): number {
        return this._transformations;
    }

    private validLoops: ValidLoopInfo[];
    private silent: boolean;
    private cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>;

    public constructor(silent: boolean = true, cfg?: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>) {
        this.currentArrayAccesses = [];
        this.validLoops = [];
        this.silent = silent;
        this.cfg = cfg ?? Graph.create()
            .apply(new ClavaCfgGenerator(Query.root() as Program));
    }

    private resetCurrentVariables() {
        this.currentLoop = undefined;
        this.currentAccumVarref = undefined;
        this.currentMacBitWidthLeft = undefined;
        this.currentMacBitWidthRight = undefined;
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

    private isValidArrayAccess(jp: Joinpoint, left: boolean): boolean {
        const arrayAccessValue: ArrayAccess | undefined = valueIs(jp, ArrayAccess, this.cfg);
        if (arrayAccessValue === undefined) {
            this.logJp(jp, "is not an array access, therefore is not a valid array access");
            return false;
        }

        const arrayTypeSizeInBitsInRiscv32: number | undefined = bitwidthInRv32(arrayAccessValue.type.desugarAll.code);
        if (arrayTypeSizeInBitsInRiscv32 === undefined) {
            this.logJpAndValue(jp, arrayAccessValue, `of type «${arrayAccessValue.type.code}»${arrayAccessValue.type.code !== arrayAccessValue.type.desugarAll.code ? ` (${arrayAccessValue.type.desugarAll.code})` : ''} is not of a valid type for the elements of one of the vectors. The elements of an array should be of one of the following types: [char, short, int, long]`);
            return false;
        }

        if (arrayTypeSizeInBitsInRiscv32 === 64) {
            this.logJpAndValue(jp, arrayAccessValue, `of type «${arrayAccessValue.type.code}»${arrayAccessValue.type.code !== arrayAccessValue.type.desugarAll.code ? ` (${arrayAccessValue.type.desugarAll.code})` : ''} is not of a valid type for the elements of one of the vectors, since its bit size is «${arrayTypeSizeInBitsInRiscv32}» in rv32, and the hardware instructions expect operands with a bit width of 4, 8, 16 or 32`);
            return false;
        }

        let macBitWidth: MacBitWidth | undefined;
        if (arrayTypeSizeInBitsInRiscv32 === 4) macBitWidth = MacBitWidth.FOUR_BIT;
        else if (arrayTypeSizeInBitsInRiscv32 === 8) macBitWidth = MacBitWidth.EIGHT_BIT;
        else if (arrayTypeSizeInBitsInRiscv32 === 16) macBitWidth = MacBitWidth.SIXTEEN_BIT;
        else if (arrayTypeSizeInBitsInRiscv32 === 32) macBitWidth = MacBitWidth.THIRTYTWO_BIT;
        else {
            this.logJp(arrayAccessValue, `has an unsupported bitwidth in rv32: «${arrayTypeSizeInBitsInRiscv32}», should be 4, 8, 16 or 32`);

            return false;
        }

        if (left) this.currentMacBitWidthLeft = macBitWidth;
        else this.currentMacBitWidthRight = macBitWidth;

        if (this.currentLoop?.controlVarref?.vardecl === undefined) {
            this.logLoop(`does not have a control variable. This should have been caught in earlier checks`);
            return false;
        }

        const controlVardecl: Vardecl = this.currentLoop?.controlVarref.vardecl;

        for (let i = 0; i < arrayAccessValue.numSubscripts - 1; i++) {
            if (Query.searchFromInclusive(arrayAccessValue.subscript[i], Varref, varref => isVarrefOf(varref, controlVardecl)).get().length !== 0) {
                this.logJp(arrayAccessValue, `does not access memory continuously, since in each iteration it accesses a different subarray (loop control variable «${controlVardecl.name}» found in a subscript that isn't the last)`);
                return false;
            }
        }

        const lastSubscript: Expression = arrayAccessValue.subscript[arrayAccessValue.numSubscripts - 1];
        if (lastSubscript === undefined) throw new Error(`Array access without subscript: «${arrayAccessValue.code}»`);

        const controlVarAccessesInLastSubscript: Varref[] = Query.searchFromInclusive(lastSubscript, Varref, varref => isVarrefOf(varref, controlVardecl)).get();

        if (controlVarAccessesInLastSubscript.length === 0) {
            this.logJp(arrayAccessValue, `does not access memory continuously, since in each iteration it does not move forward in the array (loop control variable «${controlVardecl.name}» not found in the array access' last subscript)`);
            return false;
        }

        if (controlVarAccessesInLastSubscript.length > 1) {
            this.logJp(arrayAccessValue, `may not access memory continuously since there are multiple references to the loop's control variable in the last subscript («${lastSubscript.code}»)`);
            return false;
        }

        if (isInsideOpThatIsNotAdd(controlVarAccessesInLastSubscript[0])) {
            this.logJp(arrayAccessValue, `may not access memory continuously since the loop's control variable («${controlVardecl.name}») is inside an Op that is not a sum`);
            return false;
        }

        const varrefsInsideSubscripts: Varref[] = [];
        for (const subscript of arrayAccessValue.subscript) {
            varrefsInsideSubscripts.push(...Query.searchFromInclusive(subscript, Varref, varref => varref.vardecl !== undefined && varref.vardecl.astId !== this.currentLoop?.controlVarref.vardecl.astId).get())
        }

        for (const varrefInsideSubscript of varrefsInsideSubscripts) {
            if (Query.searchFrom(this.currentLoop.body, Vardecl, vardecl => vardecl.astId === varrefInsideSubscript.vardecl.astId).get().length !== 0) {
                this.logJp(arrayAccessValue, `contains a varref whose value cannot be determined at compile-time and was declared inside the body's loop: «${varrefInsideSubscript.code}»`);
                return false;
            }
        }

        this.currentArrayAccesses.push(arrayAccessValue);
        // this.logJp(arrayAccessValue, "contains a valid array access");
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

        if (!(this.isValidArrayAccess(multiplicationValue.left, true) && this.isValidArrayAccess(multiplicationValue.right, false))) {
            this.logJpAndValue(jp, multiplicationValue, "is not a valid vector multiplication since its operands are not valid array accesses");

            return false;
        }

        if (this.currentMacBitWidthLeft !== this.currentMacBitWidthRight) {
            this.logJpAndValue(jp, multiplicationValue, `is not a valid vector multiplication since its operands have different bit widths in rv32: left is «${this.currentMacBitWidthLeft}» and right is «${this.currentMacBitWidthRight}»`);

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
            (increaseValue.left.code === this.currentAccumVarref!.code) && this.isValidVectorMultiplication(increaseValue.right)
            ||
            (increaseValue.right.code === this.currentAccumVarref!.code) && this.isValidVectorMultiplication(increaseValue.left)
        ) {
            // this.logJpAndValue(jp, increaseValue, "constitutes a valid accumulator increase (it's a sum of the accumulator and the vector multiplication)");
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
                // this.logJp(jp, "is a valid accumulator assignment of type 'simple assignment'");
                return true;
            }
            this.logJp(jp, "is not a valid accumulator assignment of type 'simple assignment'");
            return false;
        }

        if (accumAssignment.kind === "add_assign") {
            if (this.isValidVectorMultiplication(accumAssignment.right)) {
                // this.logJp(jp, "is a valid accumulator assignment of type 'add and assign'");
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

        if (loop.kind !== "for") {
            this.log("Loop is invalid since it is not a for loop\n");
            return false;
        }

        if (!hasRegularControlFlow(loop, this.silent)) {
            this.log("Loop is invalid since its control flow is not regular\n");
            return false;
        }

        if (parseFloat(loop.initValue) !== 0 || !Number.isSafeInteger(parseFloat(loop.initValue))) {
            this.log(`Loop is invalid since its init value is not 0 but «${loop.initValue}» (currently unsupported)\n`);
            return false;
        }

        if (parseFloat(loop.stepValue) !== 1 || !Number.isSafeInteger(parseFloat(loop.stepValue))) {
            this.log(`Loop is invalid since its step value is not 1 but «${loop.stepValue}» (memory accesses must be continuous)\n`);
            return false;
        }

        const externalVariableModifications: (Varref | ArrayAccess)[] = getExternalVariableOrArrayWrites(loop, loop.controlVarref.vardecl);

        const calls: Call[] = Query.searchFrom(loop, Call).get();

        if (calls.length !== 0) {
            this.log("Loop is invalid since it contains function calls (loop must not produce side effects aside from the accumulator)\n");
            return false;
        }

        if (externalVariableModifications.length === 0) {
            this.log(`Loop is invalid since it doesn't alter a single variable declared outside of the loop (loop must modify an accumulator that was declared outside of the loop)\n`);
            return false
        }

        if (externalVariableModifications.length > 1) {
            this.log(`Loop is invalid since it alters multiple variables declared outside of the loop «${externalVariableModifications.map(varref => `${varref.code} [${varref.line}:${varref.column}]`)}» (loop must not produce side effects aside from the accumulator)\n`);
            return false;
        }

        const accumWrite: Varref | ArrayAccess = externalVariableModifications[0];
        this.currentAccumVarref = accumWrite;

        if (this.currentAccumVarref instanceof ArrayAccess) {
            const varsReferencedInSubscript: Vardecl[] = [];
            for (const subscript of this.currentAccumVarref.subscript) {
                varsReferencedInSubscript.push(...Query.searchFromInclusive(subscript, Varref, varref => varref.vardecl !== undefined).get().map(varref => varref.vardecl));
            }

            for (const varReferencedInSubscript of varsReferencedInSubscript) {
                if (varReferencedInSubscript.astId === this.currentLoop.controlVarref.vardecl.astId) {
                    this.logJp(this.currentAccumVarref, `left value is the accumulator and an ArrayAccess, however it contains a variable that is not constant inside the loop (loop's control var): ${varReferencedInSubscript.name}»\n`);
                    this.resetCurrentVariables();
                    return false;

                }

                if (Query.searchFromInclusive(this.currentLoop, Vardecl, vardecl => vardecl.astId === varReferencedInSubscript.astId).get().length !== 0) {
                    this.logJp(this.currentAccumVarref, `left value is the accumulator and an ArrayAccess, however it contains a variable that is not constant inside the loop: ${varReferencedInSubscript.name}»\n`);
                    this.resetCurrentVariables();
                    return false;
                }
            }
        }

        const bitWidthInRv32: number | undefined = bitwidthInRv32(accumWrite.type.desugarAll.code);

        if (bitWidthInRv32 === undefined) {
            this.logJp(accumWrite, `is not a valid accumulator since its bitwidth in rv32 is unknown (type must be char, short, int, long or long long but is «${accumWrite.type.desugarAll.code}»)\n`);
            this.resetCurrentVariables();
            return false;
        }

        if (bitWidthInRv32 > 32) {
            this.logJp(accumWrite, `is not a valid accumulator since its bitwidth is larger than 32 in RV32 (${accumWrite.type.desugarAll.code})\n`);
            this.resetCurrentVariables();
            return false;
        }

        // the accumulation should be equivalent to accum += A[...] * B[...]
        if (this.isValidAccumulatorAssignment(accumWrite.parent)) {
            if (this.currentArrayAccesses.length !== 2) throw new Error(`Found a valid loop, but the number of current array accesses isn't 2 but instead ${this.currentArrayAccesses.length}\n`);

            this.log("Loop is valid\n");
            this.validLoops.push({
                loopAstId: this.currentLoop.astId,
                accumVarrefAstId: this.currentAccumVarref.astId,
                firstArrayAccessAstId: this.currentArrayAccesses[0].astId,
                secondArrayAccessAstId: this.currentArrayAccesses[1].astId,
                macBitWidth: this.currentMacBitWidthLeft!
            });

            this.resetCurrentVariables();
            return true;
        }

        this.log("Loop is not valid since it does not contain a valid accumulator assignment\n");
        this.resetCurrentVariables();
        return false;
    }

    private getSubstituteFunction(macBitWidth: MacBitWidth): FunctionJp | undefined {
        switch (macBitWidth) {
            case MacBitWidth.FOUR_BIT: return Query.search(FunctionJp, { name: `__dot_prod_4b` }).getFirst();
            case MacBitWidth.EIGHT_BIT: return Query.search(FunctionJp, { name: `__dot_prod_8b` }).getFirst();
            case MacBitWidth.SIXTEEN_BIT: return Query.search(FunctionJp, { name: `__dot_prod_16b` }).getFirst();
            case MacBitWidth.THIRTYTWO_BIT: return Query.search(FunctionJp, { name: `__dot_prod_32b` }).getFirst();
        }
    }

    public applyTransformation(validLoopInfo: ValidLoopInfo): void {
        this.log(`Transforming Loop with id ${validLoopInfo.loopAstId}`, "");

        this.cfg = Graph.create()
            .apply(new ClavaCfgGenerator(Query.root() as Program));

        const validLoop: Loop = Query.search(Loop, { astId: validLoopInfo.loopAstId }).getFirst()!;
        const accumWrite: Expression = Query.search(Expression, { astId: validLoopInfo.accumVarrefAstId }).getFirst()!;
        const baseArrayAccessA: ArrayAccess = Query.search(ArrayAccess, { astId: validLoopInfo.firstArrayAccessAstId }).getFirst()!;
        const baseArrayAccessB: ArrayAccess = Query.search(ArrayAccess, { astId: validLoopInfo.secondArrayAccessAstId }).getFirst()!;

        const arrayA: Expression = getArrayAccessWithoutControlVar(baseArrayAccessA, validLoop.controlVarref!.vardecl);
        const arrayB: Expression = getArrayAccessWithoutControlVar(baseArrayAccessB, validLoop.controlVarref!.vardecl);

        const substituteFunction: FunctionJp | undefined = this.getSubstituteFunction(validLoopInfo.macBitWidth);

        if (substituteFunction === undefined) {
            this.log(`Failed transforming loop: substitute function not found`);

            return;
        }

        const callToSubFunction: Call = ClavaJoinPoints.call(substituteFunction, arrayA, arrayB, ClavaJoinPoints.exprLiteral(validLoop.endValue));
        const accumAssignment: BinaryOp = ClavaJoinPoints.binaryOp("add_assign", accumWrite.deepCopy() as Expression, callToSubFunction);

        validLoop.replaceWith(accumAssignment);

        this.log(`Transformed Loop [${validLoop.line}:${validLoop.column}]\n`);
        this._transformations++;
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
    for (const file of Clava.getProgram().files) {
        if (!file.isHeader) {
            file.insert("before", FW_DECL_CODE_8);
            file.insert("before", FW_DECL_CODE_16);
            file.insert("before", FW_DECL_CODE_32);
            file.insert("before", useSoftwareSimInstructions ? FW_DECL_READ_CLEAR_SW : FW_DECL_READ_CLEAR_HW);
        }
    }
    Clava.rebuild();
}

/**
 * Needed so large init lists (array declarations) don't slow down the code to a crawl.
 * Replaces every instance of InitList with an generic expression literal that contains
 * all the data (elements) within, hiding them from queries and the like.
 * 
 * https://github.com/specs-feup/clava/issues/214
 */
function bypassLargeInitLists(): void {
    for (const initList of Query.search(InitList).get()) {
        const blob = initList.code;
        const blobExpr = ClavaJoinPoints.exprLiteral(blob);
        initList.removeChildren();
        initList.setFirstChild(blobExpr);
    }

    Clava.rebuild();
}

export function applyPass(useSoftwareSimInstructions: boolean, silent: boolean = true): number {
    bypassLargeInitLists();
    attachNecessaryFunctions(useSoftwareSimInstructions);

    const propagateAndFoldCount: number = propagateAndFoldConstants();
    if (!silent) {
        console.log(`Propagated & folded constants a total of ${propagateAndFoldCount} times`);
    }

    Clava.pushAst();

    const vrs: VectorReduceSimplificator = new VectorReduceSimplificator(silent);
    const vrsCount = vrs.simplify();
    if (!silent) {
        console.log(`Simplified a total of ${vrsCount} vector reduces`);
    }

    const cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData> = Graph.create()
        .apply(new ClavaCfgGenerator(Query.root() as Program));

    const formatter = new ClavaFlowDotFormatter();
    cfg.toFile(formatter, "dist/graph.dot");
    const vecMulReplacer: VecMulAccumulationReplacer = new VecMulAccumulationReplacer(silent, cfg);

    for (const loop of Query.search(Loop).get()) {
        vecMulReplacer.analyseLoopValidity(loop);
    }

    if (!silent) console.log("---------------\n");

    Clava.popAst();

    vecMulReplacer.applyTransformations();

    for (const file of Clava.getProgram().files) {
        if (!file.isHeader) {
            file.insert("after", useSoftwareSimInstructions ? SW_MAC_CODE_8 : HW_MAC_CODE_8);
            file.insert("after", useSoftwareSimInstructions ? SW_MAC_CODE_16 : HW_MAC_CODE_16);
            file.insert("after", useSoftwareSimInstructions ? SW_MAC_CODE_32 : HW_MAC_CODE_32);
            file.insert("after", useSoftwareSimInstructions ? SW_READ_CLEAR_CODE : HW_READ_CLEAR_CODE);
            file.insert("after", DOT_PROD_CODE_8);
            file.insert("after", DOT_PROD_CODE_16);
            file.insert("after", DOT_PROD_CODE_32);
        }
    }

    if (!silent) {
        console.log(`Applied transformations to ${vecMulReplacer.transformations} loops`);
    }
    return vecMulReplacer.getValidLoopNumber();
}