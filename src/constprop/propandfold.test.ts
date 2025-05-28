import { registerSourceCodeOnce, expectExists, getFirstAndExpectExists } from "../utils/jestHelpers.js";
import { isAddressofToVar } from "../utils/unaryOperations.js";
import { isVarrefOf } from "../utils/varReferences.js";
import { Vardecl, ReturnStmt, Literal, Varref, BinaryOp, Call, Op, Loop, Joinpoint, UnaryOp, Expression, IntLiteral } from "@specs-feup/clava/api/Joinpoints.js";
import { isDeclaredWithLiteral } from "../utils/declarations.js"
import Query from "@specs-feup/lara/api/weaver/Query.js";
import Clava from "@specs-feup/clava/api/clava/Clava.js";

import fs from "node:fs";

import { propagateAndFoldConstants } from "./propandfold.js"

const simpleCode = fs.readFileSync("./src/input/propandfold/simple.c", "utf-8");

function expectVarIsInitializedWithIntLiteral(varName: string, literalCode: string) {
    const varDecl: Vardecl = getFirstAndExpectExists(Vardecl, { name: varName });
    expect(varDecl.hasInit).toBe(true);
    expect(varDecl.init).toBeInstanceOf(IntLiteral);
    expect(varDecl.init.code).toBe(literalCode);

}

describe("simple test case", () => {
    beforeAll(() => {
        registerSourceCodeOnce(simpleCode);
        propagateAndFoldConstants();
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("a is initialized with a '3' Literal", () => {
        expectVarIsInitializedWithIntLiteral("a", "3");
    });

    test("b is initialized with an '8' Literal", () => {
        expectVarIsInitializedWithIntLiteral("b", "8");
    });

    test("c is initialized with an '11' Literal", () => {
        expectVarIsInitializedWithIntLiteral("c", "11");
    });

    test("d is initialized with a '42' Literal", () => {
        expectVarIsInitializedWithIntLiteral("d", "42");
    });

    test("e is initialized with an '131' Literal", () => {
        expectVarIsInitializedWithIntLiteral("e", "131");
    });

    test("f is initialized with an '127' Literal", () => {
        expectVarIsInitializedWithIntLiteral("f", "127");
    });

    test("g is initialized with a '4' Literal", () => {
        expectVarIsInitializedWithIntLiteral("g", "4");
    });

    test("h is initialized with an '89' Literal", () => {
        expectVarIsInitializedWithIntLiteral("h", "89");
    });

    test("i is initialized with an '8' Literal", () => {
        expectVarIsInitializedWithIntLiteral("i", "8");
    });

    test("j is initialized with a '63' Literal", () => {
        expectVarIsInitializedWithIntLiteral("j", "63");
    });

    test("k is initialized with a '37' Literal", () => {
        expectVarIsInitializedWithIntLiteral("k", "37");
    });

    test("l is initialized with a '314' Literal", () => {
        expectVarIsInitializedWithIntLiteral("l", "314");
    });

    test("m is initialized with a '217' Literal", () => {
        expectVarIsInitializedWithIntLiteral("m", "217");
    });

});
