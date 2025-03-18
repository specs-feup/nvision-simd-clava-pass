import Query from "@specs-feup/lara/api/weaver/Query.js"
import { Loop, Statement, ReturnStmt, GotoStmt, Break, Continue, Type, BuiltinType, TypedefType, Expression, Decl } from "@specs-feup/clava/api/Joinpoints.js"
import ClavaJoinPoints from "@specs-feup/clava/api/clava/ClavaJoinPoints.js"

const int8_t = "int8_t";

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

function isControlFlowAltering(stmt: Statement) {
    return stmt instanceof ReturnStmt || stmt instanceof GotoStmt || stmt instanceof Break || stmt instanceof Continue;
}

function hasPredictableStep(loop: Loop): boolean {
    if (Query.searchFrom(loop, Statement, isControlFlowAltering).get().length !== 0) {
        return false;
    }

    // loop.

    return false;
}

function hasRegularControlFlow(loop: Loop): boolean {
    return hasPredictableStep(loop) // &&
}

function loopIsSuitable(loop: Loop): boolean {
    return loop.kind === "for" && hasRegularControlFlow(loop) // &&
}

const forLoops = Query.search(Loop, (loop: Loop) => loop.kind === "for").get();

for (const forLoop of forLoops) {
    forLoop.insertBefore(ClavaJoinPoints.comment("fond a forloop"));
    console.log("Cond: {\n" + forLoop.cond.code + "\n}\n");
    
    if (forLoop.hasCondRelation) {
         console.log("CondRelation: {\n" + forLoop.condRelation + "\n}\n");
    }

    console.log("ControlVar: {\n" + forLoop.controlVar + "\n}\n");
    console.log("endValue: {\n" + forLoop.endValue + "\n}\n");
    console.log("step: {\n" + forLoop.step + "\n}\n");
    console.log("stepValue: {\n" + forLoop.stepValue + "\n}\n");

}


console.log("Found " + forLoops.length + " forloops.")