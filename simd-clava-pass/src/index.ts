import Query from "@specs-feup/lara/api/weaver/Query.js"
import { Loop, Statement, ReturnStmt, GotoStmt, Break, Continue, Type, BuiltinType, TypedefType, Expression, Decl, Varref, BinaryOp, UnaryOp, Joinpoint, FunctionJp } from "@specs-feup/clava/api/Joinpoints.js"
import ClavaJoinPoints from "@specs-feup/clava/api/clava/ClavaJoinPoints.js"
import { FoldingPropagationCombiner } from "@specs-feup/clava-code-transforms/FoldingPropagationCombiner";
import VisualizationTool from "@specs-feup/clava-visualization/api/VisualizationTool.js"

const int8_t: string = "int8_t";

function isOfType(typed: Type | Expression | Decl, typeName: string) {
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
        if (typedefType.decl !== null && typedefType.decl.name === typeName) return true;
        if (!(typedefType.underlyingType instanceof TypedefType)) return false;

        typedefType = typedefType.underlyingType;
    } while (true);
}

function isInt8(typed: Type | Expression | Decl): boolean {
    return isOfType(typed, int8_t);
}

function altersControlFlow(stmt: Statement): boolean {
    return stmt instanceof ReturnStmt || stmt instanceof GotoStmt || stmt instanceof Break || stmt instanceof Continue;
}

function isIntegerLiteral(value: string): boolean {
    return !Number.isNaN(parseInt(value));
}

function isFloatLiteral(value: string): boolean {
    return !Number.isNaN(parseFloat(value));
}

/**
 * Checks whether the loop's step value is a literal or an expression whose value is known at compile time (e.g. i++ is step value 1)
 * For better results, use constant folding and propagation beforehand.
 * @param loop 
 * @returns 
 */
function hasKnownStepValue(loop: Loop): boolean  {
    return isIntegerLiteral(loop.stepValue) || isFloatLiteral(loop.stepValue);
}

/**
 * Checks whether the loop's end value is a literal or not.
 * For better results, use constant folding and propagation beforehand.
 * @param loop 
 * @returns 
 */
function hasKnownEndValue(loop: Loop): boolean  {
    return isIntegerLiteral(loop.endValue) || isFloatLiteral(loop.endValue);
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

async function main() {
    /*
        I am first considering the case where the original value is an int8_t, since
        nvision's instructions use 32 bit packed values, the packing factor is 4x!
    */
    const packingFactor = 4; 
    
    const funcs: FunctionJp[] = Query.search(FunctionJp).get();

    const folder = new FoldingPropagationCombiner(false);
    
    for (const fn of funcs) {
        const numPasses = folder.doPassesUntilStop(fn);
        folder.doPassesUntilStop(fn);
        folder.doPassesUntilStop(fn);
        
        console.log("Applied " + numPasses + " passes in function '" + fn.name + "'");
    }

    console.log(Query.search(FunctionJp).getFirst()!.code);
    await VisualizationTool.visualize(Query.root());

    const forLoops = Query.search(Loop, (loop: Loop) => loopIsSuitable(loop, packingFactor)).get();
    console.log("Found " + forLoops.length + " forloops.")
    // TODO: for (const loop of forLoops) applyTransformation(loop, 4);
}

await main();