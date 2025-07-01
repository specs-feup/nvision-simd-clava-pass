import { registerSourceCodeOnce, getFirstAndExpectExists, expectExists } from "../utils/jestHelpers.js";
import { Vardecl, BinaryOp, Joinpoint, UnaryOp, Program, Loop, FunctionJp, Scope, Param, Varref } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";

import fs from "node:fs";

import { findInCfg } from "./search.js"
import ClavaFlowGraph from "@specs-feup/clava-flow/ClavaFlowGraph";
import ClavaCfgGenerator from "@specs-feup/clava-flow/transformation/ClavaCfgGenerator";
import Graph from "@specs-feup/flow/graph/Graph";

const expressionsCode = fs.readFileSync("./src/input/cfg/search/expressions.c", "utf-8");
const nestingCode = fs.readFileSync("./src/input/cfg/search/nesting.c", "utf-8");
const scopedVariablesCode = fs.readFileSync("./src/input/cfg/search/scoped_variables.c", "utf-8");

describe("expressions test case", () => {
    let cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>;

    beforeAll(() => {
        registerSourceCodeOnce(expressionsCode);
        cfg = Graph.create()
            .apply(new ClavaCfgGenerator(Query.root() as Program));

        console.log((Query.root() as Joinpoint).code);
    });

    test("finds normal binop statement", () => {
        const sum: BinaryOp = getFirstAndExpectExists(BinaryOp, { "kind": "add" });

        const found = expectExists(findInCfg(cfg, sum));
        expect(found.jp?.equals(sum)).toBe(true);
    });

    test("finds binop inside if header", () => {
        const gt: BinaryOp = getFirstAndExpectExists(BinaryOp, { "kind": "gt" });

        const found = expectExists(findInCfg(cfg, gt));
        expect(found.jp?.equals(gt.parent)).toBe(true);
    });

    test("finds initialization in forloop header", () => {
        const vardecl: Vardecl = getFirstAndExpectExists(Vardecl, { "name": "i" });

        const found = expectExists(findInCfg(cfg, vardecl));
        expect(found.jp?.equals(vardecl)).toBe(true);
    });

    test("finds comparison in forloop header", () => {
        const lt: BinaryOp = getFirstAndExpectExists(BinaryOp, { "kind": "lt" });

        const found = expectExists(findInCfg(cfg, lt));
        expect(found.jp?.equals(lt.parent.parent)).toBe(true);
    });

    test("finds increment in forloop header", () => {
        const post_inc: UnaryOp = getFirstAndExpectExists(UnaryOp, { "kind": "post_inc" });

        const found = expectExists(findInCfg(cfg, post_inc));
        expect(found.jp?.equals(post_inc)).toBe(true);
    });

    test("finds expressions inside forloop body", () => {
        const pre_inc: UnaryOp = getFirstAndExpectExists(UnaryOp, { "kind": "pre_inc" });

        const found = expectExists(findInCfg(cfg, pre_inc));
        expect(found.jp?.equals(pre_inc)).toBe(true);
    });
});

describe("nesting test case", () => {
    let cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>;

    beforeAll(() => {
        registerSourceCodeOnce(nestingCode);
        cfg = Graph.create()
            .apply(new ClavaCfgGenerator(Query.root() as Program));

        console.log((Query.root() as Joinpoint).code);
    });

    test("finds outer forloop", () => {
        const outerForLoop: Loop = expectExists(Query.search(FunctionJp, { name: "main" }).search(Loop, loop => {
            return loop.kind === "for" && Query.searchFrom(loop, Loop, { kind: "for" }).get().length !== 0;
        }).getFirst());

        const found = expectExists(findInCfg(cfg, outerForLoop));
        expect(found.jp?.equals(outerForLoop)).toBe(true);
    });

    test("finds nested forloop", () => {
        const innerForLoop: Loop = expectExists(Query.search(Loop, { kind: "for" }).search(Loop, { kind: "for" }).getFirst());

        const found = expectExists(findInCfg(cfg, innerForLoop));
        expect(found.jp?.equals(innerForLoop)).toBe(true);
    });

    test("finds function scope", () => {
        const mainFunction: FunctionJp = getFirstAndExpectExists(FunctionJp, { name: "main" });
        const mainFunctionScope: Scope = expectExists(mainFunction.body);

        const found = expectExists(findInCfg(cfg, mainFunctionScope));
        expect(found.jp?.equals(mainFunctionScope)).toBe(true);
    });

    test("finds outer scope inside function", () => {
        const fooFunction: FunctionJp = getFirstAndExpectExists(FunctionJp, { name: "foo" });
        const fooFunctionScope: Scope = expectExists(fooFunction.body);
        const outerScopeInsideFun: Scope = expectExists(Query.searchFrom(fooFunctionScope, Scope, scope => Query.searchFrom(scope, Scope).get().length !== 0).getFirst());

        const found = expectExists(findInCfg(cfg, outerScopeInsideFun));
        expect(found.jp?.equals(outerScopeInsideFun)).toBe(true);
    });

    test("finds inner scope inside function", () => {
        const innerScope: Scope = expectExists(Query.search(FunctionJp, { name: "foo" }).search(Scope).search(Scope).search(Scope).getFirst());

        const found = expectExists(findInCfg(cfg, innerScope));
        expect(found.jp?.equals(innerScope)).toBe(true);
    });

    test("finds outer loop initialization", () => {
        const aInitialization: Vardecl = getFirstAndExpectExists(Vardecl, { name: "a" });

        const found = expectExists(findInCfg(cfg, aInitialization));
        expect(found.jp?.equals(aInitialization)).toBe(true);
    });

    test("finds inner loop initialization", () => {
        const bInitialization: Vardecl = getFirstAndExpectExists(Vardecl, { name: "b" });

        const found = expectExists(findInCfg(cfg, bInitialization));
        expect(found.jp?.equals(bInitialization)).toBe(true);
    });

    test("finds outer loop condition", () => {
        const outerLoopCond: BinaryOp = getFirstAndExpectExists(BinaryOp, { kind: "lt" });

        const found = expectExists(findInCfg(cfg, outerLoopCond));
        expect(found.jp?.equals(outerLoopCond.parent.parent)).toBe(true);
    });

    test("finds inner loop condition", () => {
        const innerLoopCond: BinaryOp = getFirstAndExpectExists(BinaryOp, { kind: "le" });

        const found = expectExists(findInCfg(cfg, innerLoopCond));
        expect(found.jp?.equals(innerLoopCond.parent.parent)).toBe(true);
    });

    test("finds outer loop step", () => {
        const outerLoopStep: UnaryOp = getFirstAndExpectExists(UnaryOp, { kind: "post_inc" });

        const found = expectExists(findInCfg(cfg, outerLoopStep));
        expect(found.jp?.equals(outerLoopStep)).toBe(true);
    });

    test("finds inner loop step", () => {
        const innerLoopStep: UnaryOp = getFirstAndExpectExists(UnaryOp, { kind: "pre_inc" });

        const found = expectExists(findInCfg(cfg, innerLoopStep));
        expect(found.jp?.equals(innerLoopStep)).toBe(true);
    });
});

describe("scoped variables test case", () => {
    let cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>;

    beforeAll(() => {
        registerSourceCodeOnce(scopedVariablesCode);
        cfg = Graph.create()
            .apply(new ClavaCfgGenerator(Query.root() as Program));

        console.log((Query.root() as Joinpoint).code);
    });

    test("finds function argument", () => {
        const aParam: Param = expectExists(Query.search(FunctionJp, { name: "foo" }).search(Param, { name: "a" }).getFirst());

        const found = expectExists(findInCfg(cfg, aParam));
        expect(found.jp?.equals(aParam.parent)).toBe(true);
    });

    test("finds correct variable when there is a parameter of the same name", () => {
        const mainFunc: FunctionJp = getFirstAndExpectExists(FunctionJp, { name: "main" });
        const aVardecl: Vardecl = expectExists(Query.searchFrom(mainFunc, Vardecl, { name: "a" }).getFirst());
        const aVarref: Varref = expectExists(Query.searchFrom(mainFunc, Varref, { name: "a" }).getFirst());

        const foundVardecl = expectExists(findInCfg(cfg, aVardecl));
        expect(foundVardecl.jp?.equals(aVardecl)).toBe(true);

        const foundVarref = expectExists(findInCfg(cfg, aVarref));
        expect(foundVarref.jp?.equals(aVarref.parent)).toBe(true);
    });

    test("finds correct variable when there is another variable in another function with the same name", () => {
        const mainFunc: FunctionJp = getFirstAndExpectExists(FunctionJp, { name: "main" });
        const bVardeclMain: Vardecl = expectExists(Query.searchFrom(mainFunc, Vardecl, { name: "b" }).getFirst());
        const bVarrefMain: Varref = expectExists(Query.searchFrom(mainFunc, Varref, { name: "b" }).getFirst());

        const foundVardeclMain = expectExists(findInCfg(cfg, bVardeclMain));
        expect(foundVardeclMain.jp?.equals(bVardeclMain)).toBe(true);

        const foundVarrefMain = expectExists(findInCfg(cfg, bVarrefMain));
        expect(foundVarrefMain.jp?.equals(bVarrefMain.parent)).toBe(true);

        const fooFunc: FunctionJp = getFirstAndExpectExists(FunctionJp, { name: "foo" });
        const bVarDeclFoo: Vardecl = expectExists(Query.searchFrom(fooFunc, Vardecl, { name: "b" }).getFirst());
        const bVarrefFoo: Varref = expectExists(Query.searchFrom(fooFunc, Varref, { name: "b" }).getFirst());

        const foundVardeclFoo = expectExists(findInCfg(cfg, bVarDeclFoo));
        expect(foundVardeclFoo.jp?.equals(bVarDeclFoo)).toBe(true);

        const foundVarrefFoo = expectExists(findInCfg(cfg, bVarrefFoo));
        expect(foundVarrefFoo.jp?.equals(bVarrefFoo.parent)).toBe(true);
    });

    test("finds correct variable when there is another variable in another scope in the same function with the same name", () => {
        const mainFunc: FunctionJp = getFirstAndExpectExists(FunctionJp, { name: "main" });
        const firstCVardecl: Vardecl = expectExists(Query.searchFrom(mainFunc, Vardecl, { name: "c" }).getFirst());
        const firstCVarref: Varref = expectExists(Query.searchFrom(mainFunc, Varref, { name: "c" }).getFirst());

        const foundFirstCVardecl = expectExists(findInCfg(cfg, firstCVardecl));
        expect(foundFirstCVardecl.jp?.equals(firstCVardecl)).toBe(true);

        const foundFirstCVarref = expectExists(findInCfg(cfg, firstCVarref));
        expect(foundFirstCVarref.jp?.equals(firstCVarref.parent)).toBe(true);

        const nestedCVardecl: Vardecl = expectExists(Query.searchFrom(mainFunc, Scope).search(Scope).search(Vardecl, { name: "c" }).getFirst());
        const nestedCVarref: Varref = expectExists(Query.searchFrom(mainFunc, Scope).search(Scope).search(Varref, { name: "c" }).getFirst());

        const foundNestedCVardecl = expectExists(findInCfg(cfg, nestedCVardecl));
        expect(foundNestedCVardecl.jp?.equals(nestedCVardecl)).toBe(true);

        const foundNestedCVarref = expectExists(findInCfg(cfg, nestedCVarref));
        expect(foundNestedCVarref.jp?.equals(nestedCVarref.parent)).toBe(true);
    });
});