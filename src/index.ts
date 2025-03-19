import Query from "@specs-feup/lara/api/weaver/Query.js"
import { Loop, Statement, ReturnStmt, GotoStmt, Break, Continue, Type, BuiltinType, TypedefType, Expression, Decl, Varref, BinaryOp, UnaryOp, Joinpoint } from "@specs-feup/clava/api/Joinpoints.js"
import ClavaJoinPoints from "@specs-feup/clava/api/clava/ClavaJoinPoints.js"

const int8_t: string = "int8_t";

function isInt8(typed: Type | Expression | Decl): boolean {
    let type: Type;

    if (typed instanceof Type) {
        type = typed;
    } else {
        if (!typed.hasType) return false;
        type = typed.type;
    }

    if (!(type instanceof TypedefType)) return false;
    
    let typedefType: TypedefType = type as TypedefType;
    do {
        if (typedefType.decl !== null && typedefType.decl.name === int8_t) return true;
        if (!(typedefType.underlyingType instanceof TypedefType)) return false;

        typedefType = typedefType.underlyingType;
    } while (true);
}

function altersControlFlow(stmt: Statement) {
    return stmt instanceof ReturnStmt || stmt instanceof GotoStmt || stmt instanceof Break || stmt instanceof Continue;
}

/**
 * Indicates whether "examinee"'s value is known at compile time when referenceJoinpoint is being executed.
 * For example, given a "i += a" statement, we might want to know whether the value of "a" is known.
 * This can be achieved by checking if the last assignment to "a" before the statement was done with a 
 * value known at compile time (with a literal, #define, expression of literal values, etc.)
 * @param referenceJoinpoint dictates where the assignments are searched from
 * @param examinee representation of the value to be searched. Could be a literal or a variable's name
 */
function hasKnownValue(referenceJoinpoint: Joinpoint, examinee: string) {
    // TODO: Check #defines and statically initialized (or last assigned) variables
    return !Number.isNaN(parseInt(examinee));
}

/**
 * Checks whether the loop's step value is constant or not. This is trivial if the step is "i++",
 * but it might also be "i += a", where a was assigned "1" right before the loop.
 * See the hasKnownValue function's documentation for more info
 * @param loop 
 * @returns 
 */
function hasKnownStepValue(loop: Loop): boolean  {

    return hasKnownValue(loop, loop.stepValue);
}

/**
 * Checks whether the loop's end value is constant or not, which is not trivial if the end value is not
 * a literal.
 * See the hasKnownValue function's documentation for more info
 * @param loop 
 * @returns 
 */
function hasKnownEndValue(loop: Loop): boolean  {
    // TODO: Check #defines and statically initialized (or last assigned) variables

    return hasKnownValue(loop, loop.endValue);
}

function searchVariableAssignments(searchRoot: Joinpoint, variableName: string): BinaryOp[] {
    return Query.searchFrom(searchRoot, BinaryOp, (op) => {
        if (!op.isAssignment || !(op.left instanceof Varref)) return false;

        let varref: Varref = op.left as Varref;
        return varref.name === variableName;
    }).get();
}

function unaryOperationModifiesOperandValue(op: UnaryOp): boolean {
    switch (op.kind) {
        case "post_inc":
        case "post_dec":
        case "pre_inc":
        case "pre_dec":
            return true;
    }
    return false;
}

type VariableModification = {
    variableName: string,
    assignments: BinaryOp[],
    unaryOps: UnaryOp[]
}

function searchVariableModifications(searchRoot: Joinpoint, variableName: string): VariableModification {
    let assignments: BinaryOp[] = searchVariableAssignments(searchRoot, variableName);

    let modifyingUnaryOps: UnaryOp[] = Query.searchFrom(searchRoot, UnaryOp, (op) => {
        if (!unaryOperationModifiesOperandValue(op)) return false;
        
        let operand: Expression = op.operand;
        if (!(operand instanceof Varref)) return false;

        return operand.name === variableName;
    }).get();
    
    return {
        variableName: variableName,
        assignments: assignments,
        unaryOps: modifyingUnaryOps
    };
}

function variableModificationsCount(searchRoot: Joinpoint, variableName: string): number {
    let modifications = searchVariableModifications(searchRoot, variableName);

    return modifications.assignments.length + modifications.unaryOps.length;
}

function hasPredictableStep(loop: Loop): boolean {
    if (loop.controlVar === undefined) return false;

    return variableModificationsCount(loop.body, loop.controlVar) === 0;
}

function endValueIsConstant(loop: Loop): boolean {
    let endValue: string = loop.endValue;

    if (endValue === undefined || endValue === null) return true;

    let endValueIsLiteral: boolean = !Number.isNaN(parseInt(endValue));
    
    if (endValueIsLiteral) return true;

    // therefore endValue is a variable name

    return variableModificationsCount(loop.body, endValue) === 0;
}

function hasRegularControlFlow(loop: Loop): boolean {
    let hasNoCustomControlFlow: boolean = Query.searchFrom(loop, Statement, altersControlFlow).get().length !== 0;

    return hasNoCustomControlFlow && hasPredictableStep(loop) && endValueIsConstant(loop);
}

function tryComputeIntegerValue(referencePoint: Joinpoint, value: string): number {
    // TODO: Check what is returned from loop.stepValue is it's something like i += a+2 or i += a*2
    // TODO: Check other options, see hasKnownValue for deets

    let tryInt = parseInt(value);

    if (Number.isNaN(tryInt)) {
        throw new Error("value is not an integer literal... other options are currently unimplemented");
    }

    return tryInt;
}

function stepHasKnownNumberValue(loop: Loop, expectedValue: number) {
    if (!hasKnownStepValue(loop)) return false;
    let actualStepValue: number;

    try {
        actualStepValue = tryComputeIntegerValue(loop, loop.stepValue);
    } catch (e) {
        return false;
    }

    return expectedValue === actualStepValue;
}

function endValueIsDivisible(loop: Loop, diviser: number): boolean {
    if (!hasKnownEndValue(loop)) return false;
    
    let endValue: number;

    try {
        endValue = tryComputeIntegerValue(loop, loop.endValue);
    } catch (e) {
        return false;
    }

    return endValue % diviser === 0;

}

function loopIsSuitable(loop: Loop, packingFactor: number): boolean {
    // TODO: In the future, end value might not need to be divisible, similar to loop unrolling

    // packingFactor*2 since nvision's hw performs two packed simd multiplications sequencially (a*b and c*d, where each letter are actually packed values)
    return loop.kind === "for" && hasRegularControlFlow(loop) && stepHasKnownNumberValue(loop, 1) && endValueIsDivisible(loop, packingFactor*2);
}

/*
    I am first considering the case where the original value is an int8_t, since
    nvision's instructions use 32 bit packed values, the packing factor is 4x!
*/
const packingFactor = 4; 

const forLoops = Query.search(Loop, (loop: Loop) => loopIsSuitable(loop, packingFactor)).get();

console.log("Found " + forLoops.length + " forloops.")

// TODO: for (const loop of forLoops) applyTransformation(loop, 4);