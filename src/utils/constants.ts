import { Joinpoint, Vardecl } from "@specs-feup/clava/api/Joinpoints.js";
import { getAllDirectAssignments, getAllDirectAssignmentsIn, getAllIndirectAssignments, getAllIndirectAssignmentsIn } from "./assignments.js";

/**
 * Checks whether a variable is modified at any part of the program.
 * It checks for assignments directly to the variable, and also
 * assignments to a dereferenced pointer to the variable, supporting
 * only one level of indirection within function calls (e.g. we pass
 * a pointer to the var 'a' to a function and then we assign a value
 * to the dereferenced pointer)
 * 
 * This function does not account for account for unreachable code.
 * A pointer to a pointer to a variable, and further indirection
 * levels, are not be checked.
 */
export function isConstantIn(baseJp: Joinpoint, varDecl: Vardecl): boolean {
    return [...getAllDirectAssignmentsIn(baseJp, varDecl), ...getAllIndirectAssignmentsIn(baseJp, varDecl)].length === 0;
}

/**
 * Same as isContantIn but uses the root as the base joinpoint
 */
export function isConstant(varDecl: Vardecl): boolean {
    return [...getAllDirectAssignments(varDecl), ...getAllIndirectAssignments(varDecl)].length === 0;
}