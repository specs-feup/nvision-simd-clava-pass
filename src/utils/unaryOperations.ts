import { Op, UnaryOp, Vardecl } from "@specs-feup/clava/api/Joinpoints.js";
import { containsVarrefOf } from "./varReferences.js";

/**
 * Checks whether an Op Joinpoint is an Addressof operator (&)
 */
export function isAddressof(op: Op): boolean {
    return op instanceof UnaryOp && op.operator === "&";
}

/**
 *  Checks whether an Op Joinpoint is an Addressof operator (&) 
 * whose operand is a Varref of the provided Vardecl 
 */
export function isAddressofToVar(op: Op, varDecl: Vardecl): boolean {
    return isAddressof(op) && containsVarrefOf(op, varDecl);
}