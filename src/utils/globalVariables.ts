import Query from "@specs-feup/lara/api/weaver/Query.js";
import { Vardecl } from "@specs-feup/clava/api/Joinpoints.js";

/**
 * Returns the uppermost Vardecl of all global variables.
 * In the case of a global extern variable, it will try to find its actual declaration (in another file). If it does find it, only that declaration is present.
 * Otherwise, the "extern" declaration is included.
 * @returns 
 */
export function getGlobalVariableDeclarations(): Vardecl[] {
    const globalVariableDeclarations = Query.search(Vardecl, (vardecl) => vardecl.isGlobal).get().map(varDecl => varDecl.definition ?? varDecl);
    const variableIds = new Set();

    return globalVariableDeclarations.filter(varDecl => {
        if (variableIds.has(varDecl.astId)) {
            return false;
        }
        
        variableIds.add(varDecl.astId);
        return true;
    });
}

export function getGlobalVariableNames(): string[] {
    return getGlobalVariableDeclarations().map(varDecl => varDecl.name);
}