import { registerSourceCodeOnce, expectExists, getFirstAndExpectExists } from "../utils/jestHelpers.js";
import { isAddressofToVar } from "../utils/unaryOperations.js";
import { isVarrefOf } from "../utils/varReferences.js";
import { Vardecl, ReturnStmt, Literal, Varref, BinaryOp, Call, Op, Loop, Joinpoint, UnaryOp, Expression } from "@specs-feup/clava/api/Joinpoints.js";
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
const loopContinuityCode = fs.readFileSync("./src/input/constprop/loop_continuity.c", "utf-8");
const nestedLoopsCode = fs.readFileSync("./src/input/constprop/nested_loops.c", "utf-8");

afterEach(() => {
    Clava.getProgram().pop();
})

describe("simple test case", () => {

    test("correct number of varDecls", () => {
        registerSourceCodeOnce(simpleCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);

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

        const retStmt: ReturnStmt = getFirstAndExpectExists(ReturnStmt);
        expect(retStmt.children).toHaveLength(1);
        expect(retStmt.children.at(0)!).toBeInstanceOf(Literal);
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
        console.log((Query.root() as Joinpoint).code);

        const bVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });
        expect(isDeclaredWithLiteral(bVarDecl)).toBe(true);
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
        console.log((Query.root() as Joinpoint).code);

        const bVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });
        expect(isDeclaredWithLiteral(bVarDecl)).toBe(false);
    });

    test("d is not initialized with a literal", () => {
        registerSourceCodeOnce(simpleAlterationCode);
        propagateConstants();

        const dVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "d" });
        expect(isDeclaredWithLiteral(dVarDecl)).toBe(false);
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
        console.log((Query.root() as Joinpoint).code);

        const bVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });

        expect(isDeclaredWithLiteral(bVarDecl)).toBe(false);
    });

    test("d is initialized with a literal and it is 7", () => {
        registerSourceCodeOnce(hiddenAlterationCode);
        propagateConstants();

        const dVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "d" });

        expect(isDeclaredWithLiteral(dVarDecl)).toBe(true);
        expect(dVarDecl.children).toHaveLength(1);
        expect(dVarDecl.children.at(0)?.code).toBe("7");
    });
});

describe("readwrite test case", () => {
    test("b's declaration still contains a reference to a", () => {
        registerSourceCodeOnce(readWriteCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);

        const bVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });
        const innerAssignmentBinaryOp: BinaryOp = expectExists(Query.searchFrom(bVarDecl, BinaryOp).getFirst());

        expect(Query.searchFrom(innerAssignmentBinaryOp, Varref, { name: "a" }).get()).toHaveLength(1);
        expect(Query.search(Literal).get()).toHaveLength(2);
    });
});

describe("addressof test case", () => {
    test("bar's invocation still contains a reference to a", () => {
        registerSourceCodeOnce(addressofCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);

        const aVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "a" });
        const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });

        expect(barCall.children).toHaveLength(2);
        expect(barCall.children.at(1)).toBeInstanceOf(Op);
        expect(isAddressofToVar((barCall.children.at(1) as Op), aVarDecl)).toBe(true);
    });

    test("b's declaration still contains a reference to a", () => {
        registerSourceCodeOnce(addressofCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);

        const aVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "a" });
        const bVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });

        expect(bVarDecl.children).toHaveLength(1);
        expect(bVarDecl.children.at(0)).toBeInstanceOf(Op);
        expect(isAddressofToVar((bVarDecl.children.at(0) as Op), aVarDecl!)).toBe(true);
    });
});

describe("complex propagation test case", () => {
    test("bar's call uses a literal and it's '3'", () => {
        registerSourceCodeOnce(complexPropagationCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);
        const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });

        expect(barCall.children).toHaveLength(2);
        expect(barCall.children.at(1)).toBeInstanceOf(Literal);
        expect(barCall.children.at(1)?.code).toBe("3");
    });

    test("the varref to a in the while's header has been replaced with a literal '3'", () => {
        registerSourceCodeOnce(complexPropagationCode);
        propagateConstants();

        const whileLoop: Loop = getFirstAndExpectExists(Loop, {
            kind: "while"
        });

        const whileBinaryOp: BinaryOp = expectExists(Query.searchFrom(whileLoop!, BinaryOp).getFirst());

        expect(whileBinaryOp.children).toHaveLength(2);
        expect(whileBinaryOp.children.at(0)).toBeInstanceOf(Literal);
        expect(whileBinaryOp.children.at(0)?.code).toBe("3");
    });

    test("the forloop's header has been correctly modified", () => {
        registerSourceCodeOnce(complexPropagationCode);
        propagateConstants();

        const forLoop: Loop = getFirstAndExpectExists(Loop, {
            kind: "for"
        });

        expect(Query.searchFrom(forLoop, Varref, { name: "a" }).get()).toHaveLength(0);

        const iVarDecl: Vardecl = expectExists(Query.searchFrom(forLoop!, Vardecl, { name: "i" }).getFirst());

        expect(iVarDecl.children).toHaveLength(1);
        expect(iVarDecl.children.at(0)).toBeInstanceOf(Literal);
        expect(iVarDecl.children.at(0)?.code).toBe('3');

        const forBinaryOp: BinaryOp = expectExists(Query.searchFrom(forLoop!, BinaryOp, {
            kind: "add"
        }).getFirst());

        expect(forBinaryOp.children).toHaveLength(2);
        expect(forBinaryOp.children.at(0)).toBeInstanceOf(Literal);
        expect(forBinaryOp.children.at(0)?.code).toBe("3");
        expect(forBinaryOp.children.at(1)).toBeInstanceOf(Literal);
        expect(forBinaryOp.children.at(1)?.code).toBe("1");
    });
});

describe("forloop step test case", () => {
    test("first loop's header remains the same", () => {
        registerSourceCodeOnce(forloopStepCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);

        const firstForLoop: Loop = getFirstAndExpectExists(Loop);

        expect(Query.searchFrom(firstForLoop, Varref, { name: "i" }).get()).toHaveLength(2);
    });

    test("second loop's header remains the same", () => {
        registerSourceCodeOnce(forloopStepCode);
        propagateConstants();

        const loops = Query.search(Loop).get();
        expect(loops).toHaveLength(2);

        const secondForLoop: Loop = loops[1];

        const jVarDecl: Vardecl = expectExists(Query.searchFrom(secondForLoop!, Vardecl, { name: "j" }).getFirst());
        const binaryOp: BinaryOp = expectExists(Query.searchFrom(secondForLoop!, BinaryOp, {
            kind: "lt"
        }).getFirst());

        const leftExpr: Expression = expectExists(binaryOp.left);
        expect(isVarrefOf(leftExpr, jVarDecl)).toBe(true);
    });
});

describe("forloop lookahead test case", () => {
    test("first forloop header doesn't change", () => {
        registerSourceCodeOnce(forloopLookAheadCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);

        const firstForLoop: Loop = getFirstAndExpectExists(Loop);

        expect(Query.searchFrom(firstForLoop, Varref, { use: "read", name: "a" }).get()).toHaveLength(1);
    });

    test("second forloop header doesn't change", () => {
        registerSourceCodeOnce(forloopLookAheadCode);
        propagateConstants();

        const loops = Query.search(Loop).get();
        expect(loops).toHaveLength(2);

        const secondForLoop: Loop = loops[1];

        expect(Query.searchFrom(secondForLoop!, Varref, { use: "read", name: "a" }).get()).toHaveLength(1);
    });
});