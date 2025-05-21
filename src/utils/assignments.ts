import { BinaryOp, Op, UnaryOp, Vardecl, Varref } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { containsVarrefOf } from "./varReferences.js";
import { getParentOp } from "./operations.js";
import { isAddressofToVar } from "./unaryOperations.js";
import { getAllReferencesToVariablePassedToFunctions } from "./calls.js";

/**
 * Deprecated (check if other version works)
 * 
 * @param varDecl 
 * @returns 
 */
function oldGetAlLDirectAssignments(varDecl: Vardecl): Op[] {
    return Query.search(Op, (op) => {
        if (op instanceof BinaryOp)
            return op.isAssignment && containsVarrefOf(op.left, varDecl);
        else if (op instanceof UnaryOp)
            return op.operator === "++" || op.operator === "--" && containsVarrefOf(op.operand, varDecl);
        
        return false;
    }).get();
}

/**
 * Operations that directly modify the value of variable declared in varDecl. Includes assignments and unary operations, but not operations involving
 * the derreference of pointers to the variable.
 * 
 * @param varDecl 
 * @returns 
 */
export function getAllDirectAssignments(varDecl: Vardecl): Op[] {
    return Query.search(Varref, (varref) => {
        return varref.vardecl.equals(varDecl) && varref.use === "write" || varref.use === "readwrite";
    }).get().map(getParentOp);
}

export function getAllDerrefAssignments(varDecl: Vardecl): Op[] {
    return Query.search(UnaryOp, unaryOp => {
        return isAddressofToVar(unaryOp, varDecl) && (unaryOp.use === "write" || unaryOp.use === "readwrite");
    }).get();
}

/**
 * WARNING: This function is **severely** limited.
 * Searches for operations that modify the contents of the variable declared in Vardecl, specifically those accomplish
 * that by derreferencing a pointer to that variable.
 * Currently it only checks for function calls that receive a pointer to the variable via the addressOf operator (&)
 * and then use that pointer as described above. Any level of indirection (e.g. first creating a pointer,
 * and then passing it to the function) or other scenarios are not detected.
 * Reassigning the pointer variable to another address inside the function body, which may lead to the original variable's
 * value not actually being modified, is not checked for, and so it might return operations that do not actually modify
 * the variable.
 * 
 * @param varDecl 
 * @returns 
 */
export function getAllIndirectAssignments(varDecl: Vardecl): Op[] {
    const functionParametersThatArePointersToVar = getAllReferencesToVariablePassedToFunctions(varDecl).map(functionArgument => functionArgument.argumentDecl);
    
    return functionParametersThatArePointersToVar.flatMap(getAllDerrefAssignments);
}