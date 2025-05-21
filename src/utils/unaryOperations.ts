import { Op, UnaryOp, Vardecl } from "@specs-feup/clava/api/Joinpoints.js";
import { containsVarrefOf } from "./varReferences.js";

export function isAddressof(op: Op): boolean {
    return op instanceof UnaryOp && op.operator === "&";
}

export function isAddressofToVar(op: Op, varDecl: Vardecl): boolean {
    return isAddressof(op) && containsVarrefOf(op, varDecl);
}