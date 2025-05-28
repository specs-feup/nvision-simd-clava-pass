import { Joinpoint, Vardecl } from "@specs-feup/clava/api/Joinpoints.js";
import { getAllDirectAssignments, getAllDirectAssignmentsIn, getAllDirectAssignmentsInAfter, getAllIndirectAssignments, getAllIndirectAssignmentsIn, getAllIndirectAssignmentsInAfter } from "./assignments.js";

/**
 * Checks whether a variable is modified in any of the descendants of baseJp,
 * but after referenceJp.
 * It checks for assignments directly to the variable, and also
 * assignments to a dereferenced pointer to the variable, supporting
 * only one level of indirection within function calls (e.g. we pass
 * a pointer to the var 'a' to a function and then we assign a value
 * to the dereferenced pointer)
 * 
 * This function does not account for unreachable code.
 * A pointer to a pointer to a variable, and further indirection
 * levels, are not checked.
 * 
 * @param referenceInclusive DEFAULT false
 */
export function isConstantInAfter(varDecl: Vardecl, baseJp: Joinpoint, referenceJp: Joinpoint, referenceInclusive: boolean = false): boolean {
    return [...getAllDirectAssignmentsInAfter(varDecl, baseJp, referenceJp, referenceInclusive), ...getAllIndirectAssignmentsInAfter(varDecl, baseJp, referenceJp, referenceInclusive)].length === 0;
}

/**
 * Checks whether a variable is modified in any of the descendants of baseJp.
 * It checks for assignments directly to the variable, and also
 * assignments to a dereferenced pointer to the variable, supporting
 * only one level of indirection within function calls (e.g. we pass
 * a pointer to the var 'a' to a function and then we assign a value
 * to the dereferenced pointer)
 * 
 * This function does not account for unreachable code.
 * A pointer to a pointer to a variable, and further indirection
 * levels, are not checked.
 */
export function isConstantIn(varDecl: Vardecl, baseJp: Joinpoint): boolean {
    return [...getAllDirectAssignmentsIn(varDecl, baseJp), ...getAllIndirectAssignmentsIn(varDecl, baseJp)].length === 0;
}

/**
 * Same as isContantIn but uses the root as the base joinpoint, effectively
 * checking if the constant is variable in the entirety of the program.
 */
export function isConstant(varDecl: Vardecl): boolean {
    return [...getAllDirectAssignments(varDecl), ...getAllIndirectAssignments(varDecl)].length === 0;
}
