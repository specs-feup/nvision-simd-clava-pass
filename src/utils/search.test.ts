import { registerSourceCodeOnce, getFirstAndExpectExists } from "./jestHelpers.js";
import { Vardecl, Loop, Joinpoint } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import Clava from "@specs-feup/clava/api/clava/Clava.js";

import fs from "node:fs";

import { getFromAfter } from "./search.js"

const simpleCode = fs.readFileSync("./src/input/search/simple.c", "utf-8");
const simpleFunctionCode = fs.readFileSync("./src/input/search/simple_function.c", "utf-8");
const nestedFunctionsCode = fs.readFileSync("./src/input/search/nested_functions.c", "utf-8");
const mutualRecursionCode = fs.readFileSync("./src/input/search/mutual_recursion.c", "utf-8");

describe("simple test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(simpleCode);
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("aVarDecl is not found inside loop starting from c", () => {
        const cVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "c" });
        const whileLoop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "a" })).toHaveLength(0);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "a" }, true)).toHaveLength(0);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "a" }, false, true)).toHaveLength(0);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "a" }, true, true)).toHaveLength(0);
    });

    test("bVarDecl is not found inside loop starting from c", () => {
        const cVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "c" });
        const whileLoop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "b" })).toHaveLength(0);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "b" }, true)).toHaveLength(0);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "b" }, false, true)).toHaveLength(0);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "b" }, true, true)).toHaveLength(0);
    });

    test("dVarDecl is found inside loop starting from c", () => {
        const cVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "c" });
        const whileLoop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "d" })).toHaveLength(1);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "d" }, true)).toHaveLength(1);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "d" }, false, true)).toHaveLength(1);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "d" }, true, true)).toHaveLength(1);
    });

    test("eVarDecl is not found inside loop starting from c", () => {
        const cVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "c" });
        const whileLoop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "e" })).toHaveLength(0);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "e" }, true)).toHaveLength(0);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "e" }, false, true)).toHaveLength(0);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "e" }, true, true)).toHaveLength(0);
    });

    test("c is found only if the search is inclusive", () => {
        const cVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "c" });
        const whileLoop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "c" })).toHaveLength(0);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "c" }, true)).toHaveLength(1);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "c" }, false, true)).toHaveLength(0);
        expect(getFromAfter(whileLoop, Vardecl, cVarDecl, { name: "c" }, true, true)).toHaveLength(1);
    });

    test("no loops are found inside the loop after c", () => {
        const cVarDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: "c" });
        const whileLoop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(whileLoop, Loop, cVarDecl)).toHaveLength(0);
    });

    test("loop finds itself only if referenceInclusive is true", () => {
        const whileLoop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(whileLoop, Loop, whileLoop)).toHaveLength(0);
        expect(getFromAfter(whileLoop, Loop, whileLoop, {}, true)).toHaveLength(1);
        expect(getFromAfter(whileLoop, Loop, whileLoop, {}, false, true)).toHaveLength(0);
        expect(getFromAfter(whileLoop, Loop, whileLoop, {}, true, true)).toHaveLength(1);
    })
});

describe("simple function test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(simpleFunctionCode);
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("z is found only if searchCalls = true", () => {
        const loop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(loop, Vardecl, loop, { name: "z" })).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "z" }, false, true)).toHaveLength(1);
        expect(getFromAfter(loop, Vardecl, loop, { name: "z" }, true)).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "z" }, true, true)).toHaveLength(1);
    });
});

describe("nested function test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(nestedFunctionsCode);
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("z is found only if searchCalls = true", () => {
        const loop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(loop, Vardecl, loop, { name: "z" })).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "z" }, false, true)).toHaveLength(1);
        expect(getFromAfter(loop, Vardecl, loop, { name: "z" }, true)).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "z" }, true, true)).toHaveLength(1);
    });

    test("y is found only if searchCalls = true", () => {
        const loop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(loop, Vardecl, loop, { name: "y" })).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "y" }, false, true)).toHaveLength(1);
        expect(getFromAfter(loop, Vardecl, loop, { name: "y" }, true)).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "y" }, true, true)).toHaveLength(1);
    });

    test("x is found only if searchCalls = true", () => {
        const loop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(loop, Vardecl, loop, { name: "x" })).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "x" }, false, true)).toHaveLength(1);
        expect(getFromAfter(loop, Vardecl, loop, { name: "x" }, true)).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "x" }, true, true)).toHaveLength(1);
    });
    test("w is found only if searchCalls = true", () => {
        const loop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(loop, Vardecl, loop, { name: "w" })).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "w" }, false, true)).toHaveLength(1);
        expect(getFromAfter(loop, Vardecl, loop, { name: "w" }, true)).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "w" }, true, true)).toHaveLength(1);
    });
    test("v is found only if searchCalls = true", () => {
        const loop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(loop, Vardecl, loop, { name: "v" })).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "v" }, false, true)).toHaveLength(1);
        expect(getFromAfter(loop, Vardecl, loop, { name: "v" }, true)).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "v" }, true, true)).toHaveLength(1);
    });

    test("u is never found", () => {
        const loop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(loop, Vardecl, loop, { name: "u" })).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "u" }, false, true)).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "u" }, true)).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "u" }, true, true)).toHaveLength(0);
    });
});

describe("mutual recursion test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(mutualRecursionCode);
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("z is found only if searchCalls = true", () => {
        const loop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(loop, Vardecl, loop, { name: "z" })).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "z" }, false, true)).toHaveLength(1);
        expect(getFromAfter(loop, Vardecl, loop, { name: "z" }, true)).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "z" }, true, true)).toHaveLength(1);
    });

    test("y is found only if searchCalls = true", () => {
        const loop: Loop = getFirstAndExpectExists(Loop);

        expect(getFromAfter(loop, Vardecl, loop, { name: "y" })).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "y" }, false, true)).toHaveLength(1);
        expect(getFromAfter(loop, Vardecl, loop, { name: "y" }, true)).toHaveLength(0);
        expect(getFromAfter(loop, Vardecl, loop, { name: "y" }, true, true)).toHaveLength(1);
    });

});
