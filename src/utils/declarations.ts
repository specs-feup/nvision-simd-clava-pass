import { Vardecl, Varref, Literal } from "@specs-feup/clava/api/Joinpoints.js";

export function isDeclaredWithLiteral(variable: Vardecl | Varref): boolean {
    let varDecl: Vardecl;

    if (variable instanceof Vardecl) {
        varDecl = variable;
    } else {
        varDecl = variable.decl as Vardecl;
    }

    // handles cases where varDecl is just the extern declaration and not the actual declaration/initialization. read Vardecl.definition's documentation for more info.
    varDecl = varDecl.definition ?? varDecl;

    // the value which is assigned is varDecl's only child node
    if (varDecl.children.length === 0 || !(varDecl.children[0] instanceof Literal)) {
        return false;
    }
    
    return true;
}

/**
 * Returns a mapping of a variable's name to its Literal. If the declaration was not initialized with a literal, it will not be present in the map.
 * @param decls 
 * @returns 
 */
export function mapToVariableNameAndLiteral(decls: Vardecl[]): Map<string, Literal> {
    const map = new Map<string, Literal>();
    for (const declWithLiteral of decls.filter(isDeclaredWithLiteral)) {
        map.set(declWithLiteral.name, declWithLiteral.children[0] as Literal); // a declaration's value (if present) is always its only children
    }

    return map;
}