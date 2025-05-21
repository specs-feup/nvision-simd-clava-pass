import { Call, FunctionJp, UnaryOp, Vardecl } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { isAddressofToVar } from "./unaryOperations.js";
import { findAllIndices } from "./jsArrays.js";

type FunctionArgument = {
    functionJp: FunctionJp,
    argumentDecl: Vardecl
}

/**
 * Given a variable, finds all the times that they are passed to a function
 * and then return the corresponding function argument.
 * 
 * E.g. if we call foo(a, b) and foo is defined as foo(int argOne, int argTwo),
 * if we call getAllReferencesToVariablePassedToFunctions(a) then we'd get argOne,
 * and if we search for b then we get argTwo.
 */
export function getAllReferencesToVariablePassedToFunctions(varDecl: Vardecl): FunctionArgument[] {
    const callsThatReceivePointerToVariable = Query.search(Call, call => {
        for (const argExpr of call.args) {
            if (Query.searchFromInclusive(argExpr, UnaryOp, op => isAddressofToVar(op, varDecl)).get().length > 0) return true;
        }
        
        return false;
    }).get();

    const functionArguments: FunctionArgument[] = [];

    for (const call of callsThatReceivePointerToVariable) {
        const argumentIndices: Array<number> = findAllIndices(call.args, expr => expr instanceof UnaryOp && isAddressofToVar(expr, varDecl))

        if (argumentIndices.length === 0) {
            console.error("Call that was identified receiving a pointer to variable ' + " + varDecl.name + "' doesn't actually receive any: " + call.code);
            continue;
        }

        for (const argumentIndex of argumentIndices) {
            functionArguments.push({
                functionJp: call.function,
                argumentDecl: call.function.params[argumentIndex] 
            });
        }
    }

    return functionArguments;
}