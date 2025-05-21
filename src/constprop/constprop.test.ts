import { registerSourceCodeOnce } from "../utils/jestHelpers.js";
import { isAddressofToVar } from "../utils/unaryOperations.js";
import { Vardecl, ReturnStmt, Literal, Varref, BinaryOp, Call, Op } from "@specs-feup/clava/api/Joinpoints.js";
import { isDeclaredWithLiteral } from "../utils/declarations.js"
import Query from "@specs-feup/lara/api/weaver/Query.js";
import Clava from "@specs-feup/clava/api/clava/Clava.js";

import fs from "node:fs";

import { propagateConstants } from "./constprop.js"

const simpleCode = fs.readFileSync("./src/input/constprop/simple.c", "utf-8");
const separateAssignmentCode = fs.readFileSync("./src/input/constprop/separate_assignment.c", "utf-8");
const simpleAlterationCode = fs.readFileSync("./src/input/constprop/simple_alteration.c", "utf-8");
const hiddenAlterationCode = fs.readFileSync("./src/input/constprop/hidden_alteration.c", "utf-8");
const readWriteCode = fs.readFileSync("./src/input/constprop/readwrite_isnt_propagated.c", "utf-8");
const addressofCode = fs.readFileSync("./src/input/constprop/doesnt_substitute_in_addressof.c", "utf-8");
const complexPropagationCode = fs.readFileSync("./src/input/constprop/complex_propagations.c", "utf-8");
const forloopStepCode = fs.readFileSync("./src/input/constprop/forloop_step_isnt_affected.c", "utf-8");
const forloopLookAheadCode = fs.readFileSync("./src/input/constprop/forloop_lookahead.c", "utf-8");

afterEach(() => {
    Clava.getProgram().pop();
})

describe("simple test case", () => {

    test("correct number of varDecls", () => {
        registerSourceCodeOnce(simpleCode);
        propagateConstants();

        const varDecls: Vardecl[] = Query.search(Vardecl).get();
        expect(varDecls).toHaveLength(5);
    });

    test("All variables are declared with literals", () => {
        registerSourceCodeOnce(simpleCode);
        propagateConstants();

        const varDecls: Vardecl[] = Query.search(Vardecl).get();
        for (const vardecl of varDecls) {
            expect(isDeclaredWithLiteral(vardecl)).toBe(true);
        }
    });

    test("Returns a literal", () => {
        registerSourceCodeOnce(simpleCode);
        propagateConstants();

        const retStmt = Query.search(ReturnStmt).getFirst();

        expect(retStmt).toBeDefined();
        expect(retStmt).not.toBeNull();
        expect(retStmt?.children.at(0)).toBeInstanceOf(Literal);
    });

    test("There are 6 literals and they are all '5'", () => {
        registerSourceCodeOnce(simpleCode);
        propagateConstants();

        const literals: Literal[] = Query.search(Literal).get();

        expect(literals).toHaveLength(6);

        for (const literal of literals) {
            expect(literal.code).toBe("5");
        }
    });
});

describe("separate assignment test case", () => {
    test("b is declared with a literal", () => {
        registerSourceCodeOnce(separateAssignmentCode);
        propagateConstants();

        const bVarDecl: Vardecl | undefined = Query.search(Vardecl, /b/).getFirst();
        expect(bVarDecl).toBeDefined();
        expect(bVarDecl).not.toBeNull();
        expect(isDeclaredWithLiteral(bVarDecl!)).toBe(true);
    });

    test("there are 2 literals and they are both '3'", () => {
        registerSourceCodeOnce(separateAssignmentCode);
        propagateConstants();


        const literals: Literal[] = Query.search(Literal).get();

        expect(literals).toHaveLength(2);

        for (const literal of literals) {
            expect(literal.code).toBe("3");
        }
    });
});

describe("simple alteration test case", () => {
    test("b is not initialized with a literal", () => {
        registerSourceCodeOnce(simpleAlterationCode);
        propagateConstants();

        const bVarDecl: Vardecl | undefined = Query.search(Vardecl, /b/).getFirst();
        expect(bVarDecl).toBeDefined();
        expect(bVarDecl).not.toBeNull();
        expect(isDeclaredWithLiteral(bVarDecl!)).toBe(false);
    });

    test("d is not initialized with a literal", () => {
        registerSourceCodeOnce(simpleAlterationCode);
        propagateConstants();

        const dVarDecl: Vardecl | undefined = Query.search(Vardecl, /d/).getFirst();
        expect(dVarDecl).toBeDefined();
        expect(dVarDecl).not.toBeNull();
        expect(isDeclaredWithLiteral(dVarDecl!)).toBe(false);
    });

    test("there are only 4 literals", () => {
        registerSourceCodeOnce(simpleAlterationCode);
        propagateConstants();

        const literals: Literal[] = Query.search(Literal).get();
        expect(literals).toHaveLength(4);
    });

})

describe("hidden alteration test case", () => {
    test("b isn't initialized with a literal", () => {
        registerSourceCodeOnce(hiddenAlterationCode);
        propagateConstants();

        const bVarDecl: Vardecl | undefined = Query.search(Vardecl, /b/).getFirst();
        expect(bVarDecl).toBeDefined();
        expect(bVarDecl).not.toBeNull();
        expect(isDeclaredWithLiteral(bVarDecl!)).toBe(false);
    });

    test("d is initialized with a literal and it is 7", () => {
        registerSourceCodeOnce(hiddenAlterationCode);
        propagateConstants();

        const dVarDecl: Vardecl | undefined = Query.search(Vardecl, /d/).getFirst();
        expect(dVarDecl).toBeDefined();
        expect(dVarDecl).not.toBeNull();
        expect(isDeclaredWithLiteral(dVarDecl!)).toBe(true);
        expect(dVarDecl!.children.at(0)?.code).toBe("7");
    });
});

describe("readwrite test case", () => {
    test("b's declaration still contains a reference to a", () => {
        registerSourceCodeOnce(readWriteCode);
        propagateConstants();

        const bVarDecl = Query.search(Vardecl, /b/).getFirst();

        expect(bVarDecl).toBeDefined();
        expect(bVarDecl).not.toBeNull();

        const innerAssignmentBinaryOp: BinaryOp | undefined = Query.searchFrom(bVarDecl!, BinaryOp).getFirst();

        expect(innerAssignmentBinaryOp).toBeDefined();
        expect(innerAssignmentBinaryOp).not.toBeNull();

        expect(Query.searchFrom(innerAssignmentBinaryOp!, Varref, /a/).get()).toHaveLength(1);

        expect(Query.search(Literal).get()).toHaveLength(2);
    });
});

describe("addressof test case", () => {
    test("bar's invocation still contains a reference to a", () => {
        registerSourceCodeOnce(addressofCode);
        propagateConstants();

        const aVarDecl: Vardecl | undefined = Query.search(Vardecl, /a/).getFirst();
        expect(aVarDecl).toBeDefined();
        expect(aVarDecl).not.toBeNull();

        const barCall: Call | undefined = Query.search(Call, /bar/).getFirst();

        expect(barCall).toBeDefined();
        expect(barCall).not.toBeNull();

        expect(barCall?.children).toHaveLength(2);
        expect(barCall?.children.at(1)).toBeInstanceOf(Op);
        expect(isAddressofToVar((barCall?.children.at(1) as Op), aVarDecl!)).toBe(true);
    });

    test("b's declaration still contains a reference to a", () => {
        registerSourceCodeOnce(addressofCode);
        propagateConstants();

        const aVarDecl: Vardecl | undefined = Query.search(Vardecl, /a/).getFirst();
        expect(aVarDecl).toBeDefined();
        expect(aVarDecl).not.toBeNull();

        const bVarDecl: Vardecl | undefined = Query.search(Vardecl, /b/).getFirst();

        expect(bVarDecl).toBeDefined();
        expect(bVarDecl).not.toBeNull();

        expect(bVarDecl?.children).toHaveLength(1);
        expect(bVarDecl?.children.at(0)).toBeInstanceOf(Op);
        expect(isAddressofToVar((bVarDecl?.children.at(0) as Op), aVarDecl!)).toBe(true);

    });
});
