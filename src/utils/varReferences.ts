import { Joinpoint, Vardecl, Varref } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";

export function getAllReferencesTo(variable: Vardecl): Varref[] {
    return Query.search(Varref, (varref) => isVarrefOf(varref, variable)).get();
}

/**
 * Checks whether a given JoinPoint contains (can be either itself or any of its descendants) a Varref of the provided varDecl
 *  
 * @param jp JoinPoint from which the search starts
 * @param varDecl Variable that is being search
 */
export function containsVarrefOf(jp: Joinpoint, varDecl: Vardecl): boolean {
    return Query.searchFromInclusive(jp, Varref, varref => varref.decl.equals(varDecl)).get().length !== 0;
}

/**
 * Checks whether the provided Joinpoint is a Varref of the provided varDecl
 */
export function isVarrefOf(jp: Joinpoint, varDecl: Vardecl): boolean {
    return jp instanceof Varref && jp.decl !== undefined && jp.decl !== null && jp.decl.equals(varDecl);
}