import { Vardecl } from "@specs-feup/clava/api/Joinpoints.js";
import { getAllDirectAssignments, getAllIndirectAssignments } from "./assignments.js";

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
export function isConstant(varDecl: Vardecl): boolean {
    return [...getAllDirectAssignments(varDecl), ...getAllIndirectAssignments(varDecl)].length === 0;
}