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
const readWriteCode = fs.readFileSync("./src/input/constprop/readwrite_isnt_propagated.c", "utf-8");
const addressofCode = fs.readFileSync("./src/input/constprop/doesnt_substitute_in_addressof.c", "utf-8");
const complexPropagationCode = fs.readFileSync("./src/input/constprop/complex_propagations.c", "utf-8");
const forloopStepCode = fs.readFileSync("./src/input/constprop/forloop_step_isnt_affected.c", "utf-8");
const forloopLookAheadCode = fs.readFileSync("./src/input/constprop/forloop_lookahead.c", "utf-8");
const loopContinuityCode = fs.readFileSync("./src/input/constprop/loop_continuity.c", "utf-8");
const nestedLoopsCode = fs.readFileSync("./src/input/constprop/nested_loops.c", "utf-8");
const globalsCode = fs.readFileSync("./src/input/constprop/globals.c", "utf-8");
const controlFlowCode = fs.readFileSync("./src/input/constprop/control_flow.c", "utf-8");

describe("simple test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(simpleCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("correct number of varDecls", () => {
        const varDecls: Vardecl[] = Query.search(Vardecl).get();
        expect(varDecls).toHaveLength(5);
    });

    test("All variables are declared with literals", () => {
        const varDecls: Vardecl[] = Query.search(Vardecl).get();
        for (const vardecl of varDecls) {
            expect(isDeclaredWithLiteral(vardecl)).toBe(true);
        }
    });

    test("Returns a literal", () => {
        const retStmt: ReturnStmt = getFirstAndExpectExists(ReturnStmt);
        expect(retStmt.children).toHaveLength(1);
        expect(retStmt.children.at(0)!).toBeInstanceOf(Literal);
    });

    test("There are 6 literals and they are all '5'", () => {
        const literals: Literal[] = Query.search(Literal).get();

        expect(literals).toHaveLength(6);

        for (const literal of literals) {
            expect(literal.code).toBe("5");
        }
    });
});

describe("separate assignment test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(separateAssignmentCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("b is declared with a literal", () => {
        const bVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });
        expect(isDeclaredWithLiteral(bVarDecl)).toBe(true);
    });

    test("there are 2 literals and they are both '3'", () => {
        const literals: Literal[] = Query.search(Literal).get();

        expect(literals).toHaveLength(2);

        for (const literal of literals) {
            expect(literal.code).toBe("3");
        }
    });
});

describe("simple alteration test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(simpleAlterationCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("b is not initialized with a literal", () => {

        const bVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });
        expect(isDeclaredWithLiteral(bVarDecl)).toBe(false);
    });

    test("d is not initialized with a literal", () => {
        const dVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "d" });
        expect(isDeclaredWithLiteral(dVarDecl)).toBe(false);
    });

    test("there are only 4 literals", () => {
        const literals: Literal[] = Query.search(Literal).get();
        expect(literals).toHaveLength(4);
    });

})

describe("readwrite test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(readWriteCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("b's declaration still contains a reference to a", () => {

        const bVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });
        const innerAssignmentBinaryOp: BinaryOp = expectExists(Query.searchFrom(bVarDecl, BinaryOp).getFirst());

        expect(Query.searchFrom(innerAssignmentBinaryOp, Varref, { name: "a" }).get()).toHaveLength(1);
        expect(Query.search(Literal).get()).toHaveLength(2);
    });
});

describe("addressof test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(addressofCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("bar's invocation still contains a reference to a", () => {

        const aVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "a" });
        const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });

        expect(barCall.children).toHaveLength(2);
        expect(barCall.children.at(1)).toBeInstanceOf(Op);
        expect(isAddressofToVar((barCall.children.at(1) as Op), aVarDecl)).toBe(true);
    });

    test("b's declaration still contains a reference to a", () => {
        const aVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "a" });
        const bVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });

        expect(bVarDecl.children).toHaveLength(1);
        expect(bVarDecl.children.at(0)).toBeInstanceOf(Op);
        expect(isAddressofToVar((bVarDecl.children.at(0) as Op), aVarDecl)).toBe(true);
    });
});

describe("complex propagation test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(complexPropagationCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("bar's call uses a literal and it's '3'", () => {
        const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });

        expect(barCall.children).toHaveLength(2);
        expect(barCall.children.at(1)).toBeInstanceOf(Literal);
        expect(barCall.children.at(1)?.code).toBe("3");
    });

    test("the varref to a in the while's header has been replaced with a literal '3'", () => {
        const whileLoop: Loop = getFirstAndExpectExists(Loop, {
            kind: "while"
        });

        const whileBinaryOp: BinaryOp = expectExists(Query.searchFrom(whileLoop!, BinaryOp).getFirst());

        expect(whileBinaryOp.children).toHaveLength(2);
        expect(whileBinaryOp.children.at(0)).toBeInstanceOf(Literal);
        expect(whileBinaryOp.children.at(0)?.code).toBe("3");
    });

    test("the forloop's header has been correctly modified", () => {
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
    beforeAll(() => {
        registerSourceCodeOnce(forloopStepCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("first loop's header remains the same", () => {
        const firstForLoop: Loop = getFirstAndExpectExists(Loop);

        expect(Query.searchFrom(firstForLoop, Varref, { name: "i" }).get()).toHaveLength(2);
    });

    test("second loop's header remains the same", () => {
        const loops: Loop[] = Query.search(Loop).get();
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
    beforeAll(() => {
        registerSourceCodeOnce(forloopLookAheadCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });


    test("first forloop header doesn't change", () => {
        const firstForLoop: Loop = getFirstAndExpectExists(Loop);

        expect(Query.searchFrom(firstForLoop, Varref, { use: "read", name: "a" }).get()).toHaveLength(1);
    });

    test("second forloop header doesn't change", () => {
        const loops: Loop[] = Query.search(Loop).get();
        expect(loops).toHaveLength(2);

        const secondForLoop: Loop = loops[1];

        expect(Query.searchFrom(secondForLoop!, Varref, { use: "read", name: "a" }).get()).toHaveLength(1);
    });
});

describe("loop continuity test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(loopContinuityCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("i remains unaltered", () => {
        const iDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "i" });

        const allVarIReferences: Varref[] = Query.search(Varref, { name: "i" }).get();
        expect(allVarIReferences).toHaveLength(2);

        const whileCond: BinaryOp = expectExists(Query.search(Loop).search(BinaryOp, { kind: "lt" }).getFirst());
        const leftExpr: Expression = expectExists(whileCond.left);

        expect(isVarrefOf(leftExpr, iDecl));

        const iIncreaseVarref = expectExists(Query.search(Loop).search(Varref, { name: "i", use: "readwrite" }).getFirst());
        expect(iIncreaseVarref.parent).toBeInstanceOf(UnaryOp);
        expect((iIncreaseVarref.parent as UnaryOp).kind).toBe("pre_inc");
    });

    test("a remains unaltered", () => {
        const aDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "a" });
        const bDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });

        const allVarAReferences: Varref[] = Query.search(Varref, { name: "a" }).get();
        expect(allVarAReferences).toHaveLength(2);

        const bAssignment: BinaryOp = expectExists(Query.search(Loop).search(BinaryOp, { kind: "assign" }).getFirst());

        const leftExpr: Expression = expectExists(bAssignment.left);
        const rightExpr: Expression = expectExists(bAssignment.right);

        expect(isVarrefOf(leftExpr, bDecl));
        expect(isVarrefOf(rightExpr, aDecl));

        const aIncreaseVarref = expectExists(Query.search(Loop).search(Varref, { name: "a", use: "readwrite" }).getFirst());
        expect(aIncreaseVarref.parent).toBeInstanceOf(UnaryOp);
        expect((aIncreaseVarref.parent as UnaryOp).kind).toBe("post_inc");
    });
});

describe("nested loops test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(nestedLoopsCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("b is declared with a 0 literal", () => {
        const bVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });

        expect(isDeclaredWithLiteral(bVarDecl)).toBe(true);
        expect(bVarDecl.children).toHaveLength(1);
        expect(bVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(bVarDecl.children.at(0)!.code).toBe("0");
    });

    test("c is declared with a 0 literal", () => {
        const cVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "c" });

        expect(isDeclaredWithLiteral(cVarDecl)).toBe(true);
        expect(cVarDecl.children).toHaveLength(1);
        expect(cVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(cVarDecl.children.at(0)!.code).toBe("0");
    });

    test("d is declared with a 'changed' varref", () => {
        const dVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "d" });
        const changedVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "changed" });


        expect(isDeclaredWithLiteral(dVarDecl)).toBe(false);
        expect(dVarDecl.children).toHaveLength(1);
        expect(dVarDecl.children.at(0)!).toBeInstanceOf(Varref);
        expect(isVarrefOf(dVarDecl.children.at(0)!, changedVarDecl)).toBe(true);
    });

    test("e is declared with a 'd' varref", () => {
        const eVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "e" });
        const dVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "d" });


        expect(isDeclaredWithLiteral(eVarDecl)).toBe(false);
        expect(eVarDecl.children).toHaveLength(1);
        expect(eVarDecl.children.at(0)!).toBeInstanceOf(Varref);
        expect(isVarrefOf(eVarDecl.children.at(0)!, dVarDecl)).toBe(true);
    });
});

describe("globals test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(globalsCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("y is initialized with a '1' Literal", () => {
        const yVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "y" });

        expect(isDeclaredWithLiteral(yVarDecl)).toBe(true);
        expect(yVarDecl.children).toHaveLength(1);
        expect(yVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(yVarDecl.children.at(0)!.code).toBe("1");
    });

    test("z is initialized with a 'nonConstGlobal' Varref", () => {
        const zVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "z" });
        const nonConstGlobalVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "nonConstGlobal" });

        expect(isDeclaredWithLiteral(zVarDecl)).toBe(false);
        expect(zVarDecl.children).toHaveLength(1);
        expect(zVarDecl.children.at(0)!).toBeInstanceOf(Varref);
        expect(isVarrefOf(zVarDecl.children.at(0)!, nonConstGlobalVarDecl)).toBe(true);
    });

    test("a is initialized with a 'nonConstGlobal' Varref", () => {
        const aVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "a" });
        const nonConstGlobalVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "nonConstGlobal" });

        expect(isDeclaredWithLiteral(aVarDecl)).toBe(false);
        expect(aVarDecl.children).toHaveLength(1);
        expect(aVarDecl.children.at(0)!).toBeInstanceOf(Varref);
        expect(isVarrefOf(aVarDecl.children.at(0)!, nonConstGlobalVarDecl)).toBe(true);
    });

    test("b is initialized with a 'nonConstGlobal' Varref", () => {
        const bVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });
        const nonConstGlobalVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "nonConstGlobal" });

        expect(isDeclaredWithLiteral(bVarDecl)).toBe(false);
        expect(bVarDecl.children).toHaveLength(1);
        expect(bVarDecl.children.at(0)!).toBeInstanceOf(Varref);
        expect(isVarrefOf(bVarDecl.children.at(0)!, nonConstGlobalVarDecl)).toBe(true);
    });

    test("c is initialized with a '1' Literal", () => {
        const cVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "c" });

        expect(isDeclaredWithLiteral(cVarDecl)).toBe(true);
        expect(cVarDecl.children).toHaveLength(1);
        expect(cVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(cVarDecl.children.at(0)!.code).toBe("1");
    });

    test("d is initialized with a '1' Literal", () => {
        const dVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "d" });

        expect(isDeclaredWithLiteral(dVarDecl)).toBe(true);
        expect(dVarDecl.children).toHaveLength(1);
        expect(dVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(dVarDecl.children.at(0)!.code).toBe("1");
    });
});

describe("control flow test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(controlFlowCode);
        propagateConstants();
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("q is initialized with a '2' Literal", () => {
        const qVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "q" });

        expect(isDeclaredWithLiteral(qVarDecl)).toBe(true);
        expect(qVarDecl.children).toHaveLength(1);
        expect(qVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(qVarDecl.children.at(0)!.code).toBe("2");
    });

    test("r is initialized with a 'foo' Call", () => {
        const rVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "r" });

        expect(isDeclaredWithLiteral(rVarDecl)).toBe(false);
        expect(rVarDecl.children).toHaveLength(1);
        expect(rVarDecl.children.at(0)!).toBeInstanceOf(Call);
        expect((rVarDecl.children.at(0)! as Call).name).toBe("foo");
    });

    test("s is initialized with a 'foo' Call", () => {
        const sVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "s" });

        expect(isDeclaredWithLiteral(sVarDecl)).toBe(false);
        expect(sVarDecl.children).toHaveLength(1);
        expect(sVarDecl.children.at(0)!).toBeInstanceOf(Call);
        expect((sVarDecl.children.at(0)! as Call).name).toBe("foo");
    });

    test("t is initialized with a '3' Literal", () => {
        const tVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "t" });

        expect(isDeclaredWithLiteral(tVarDecl)).toBe(true);
        expect(tVarDecl.children).toHaveLength(1);
        expect(tVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(tVarDecl.children.at(0)!.code).toBe("3");
    });

    test("u is initialized with a '2' Literal", () => {
        const uVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "u" });

        expect(isDeclaredWithLiteral(uVarDecl)).toBe(true);
        expect(uVarDecl.children).toHaveLength(1);
        expect(uVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(uVarDecl.children.at(0)!.code).toBe("2");
    });

    test("v is initialized with a '5' Literal", () => {
        const vVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "v" });

        expect(isDeclaredWithLiteral(vVarDecl)).toBe(true);
        expect(vVarDecl.children).toHaveLength(1);
        expect(vVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(vVarDecl.children.at(0)!.code).toBe("5");
    });

    test("w is initialized with a '2' Literal", () => {
        const wVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "w" });

        expect(isDeclaredWithLiteral(wVarDecl)).toBe(true);
        expect(wVarDecl.children).toHaveLength(1);
        expect(wVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(wVarDecl.children.at(0)!.code).toBe("2");
    });

    test("x is initialized with a '8' Literal", () => {
        const xVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "x" });

        expect(isDeclaredWithLiteral(xVarDecl)).toBe(true);
        expect(xVarDecl.children).toHaveLength(1);
        expect(xVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(xVarDecl.children.at(0)!.code).toBe("8");
    });

    test("y is initialized with a 't' Varref", () => {
        const yVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "y" });
        const tVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "t" });

        expect(isDeclaredWithLiteral(yVarDecl)).toBe(false);
        expect(yVarDecl.children).toHaveLength(1);
        expect(yVarDecl.children.at(0)!).toBeInstanceOf(Varref);
        expect(isVarrefOf(yVarDecl.children.at(0)!, tVarDecl)).toBe(true);
    });

    test("z is initialized with a 't' Varref", () => {
        const zVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "z" });
        const tVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "t" });

        expect(isDeclaredWithLiteral(zVarDecl)).toBe(false);
        expect(zVarDecl.children).toHaveLength(1);
        expect(zVarDecl.children.at(0)!).toBeInstanceOf(Varref);
        expect(isVarrefOf(zVarDecl.children.at(0)!, tVarDecl)).toBe(true);
    });

    test("alpha is initialized with a '2' Literal", () => {
        const alphaVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "alpha" });

        expect(isDeclaredWithLiteral(alphaVarDecl)).toBe(true);
        expect(alphaVarDecl.children).toHaveLength(1);
        expect(alphaVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(alphaVarDecl.children.at(0)!.code).toBe("2");
    });

    test("delta is initialized with a '13' Literal", () => {
        const deltaVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "delta" });

        expect(isDeclaredWithLiteral(deltaVarDecl)).toBe(true);
        expect(deltaVarDecl.children).toHaveLength(1);
        expect(deltaVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(deltaVarDecl.children.at(0)!.code).toBe("13");
    });

    test("epsilon is initialized with a '34' Literal", () => {
        const epsilonVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "epsilon" });

        expect(isDeclaredWithLiteral(epsilonVarDecl)).toBe(true);
        expect(epsilonVarDecl.children).toHaveLength(1);
        expect(epsilonVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(epsilonVarDecl.children.at(0)!.code).toBe("34");
    });

    test("zeta is initialized with a '13' Literal", () => {
        const zetaVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "zeta" });

        expect(isDeclaredWithLiteral(zetaVarDecl)).toBe(true);
        expect(zetaVarDecl.children).toHaveLength(1);
        expect(zetaVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(zetaVarDecl.children.at(0)!.code).toBe("13");
    });

    test("eta is initialized with a 'gamma' Varref", () => {
        const etaVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "eta" });
        const gammaVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "gamma" });

        expect(isDeclaredWithLiteral(etaVarDecl)).toBe(false);
        expect(etaVarDecl.children).toHaveLength(1);
        expect(etaVarDecl.children.at(0)!).toBeInstanceOf(Varref);
        expect(isVarrefOf(etaVarDecl.children.at(0)!, gammaVarDecl)).toBe(true);
    });

    test("a is initialized with a 'foo' Call", () => {
        const aVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "a" });

        expect(isDeclaredWithLiteral(aVarDecl)).toBe(false);
        expect(aVarDecl.children).toHaveLength(1);
        expect(aVarDecl.children.at(0)!).toBeInstanceOf(Call);
        expect((aVarDecl.children.at(0)! as Call).name).toBe("foo");
    });

    test("b is initialized with a '55' Literal", () => {
        const bVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });

        expect(isDeclaredWithLiteral(bVarDecl)).toBe(true);
        expect(bVarDecl.children).toHaveLength(1);
        expect(bVarDecl.children.at(0)!).toBeInstanceOf(Literal);
        expect(bVarDecl.children.at(0)!.code).toBe("55");
    });

    test("c is initialized with a 'b' Varref", () => {
        const cVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "c" });
        const bVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });

        expect(isDeclaredWithLiteral(cVarDecl)).toBe(false);
        expect(cVarDecl.children).toHaveLength(1);
        expect(cVarDecl.children.at(0)!).toBeInstanceOf(Varref);
        expect(isVarrefOf(cVarDecl.children.at(0)!, bVarDecl)).toBe(true);
    });
});