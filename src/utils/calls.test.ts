import { registerSourceCodeOnce, getFirstAndExpectExists, expectExists } from "./jestHelpers.js";
import { flattenCalledCode, getAllCalledFunctions } from "./calls.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import Clava from "@specs-feup/clava/api/clava/Clava.js";
import fs from "node:fs";
import { Call, FunctionJp, Joinpoint, Vardecl } from "@specs-feup/clava/api/Joinpoints.js";

const simpleCode = fs.readFileSync("./src/input/calls/simple.c", "utf-8");
const nestedCode = fs.readFileSync("./src/input/calls/nested.c", "utf-8");
const mutualRecursionCode = fs.readFileSync("./src/input/calls/mutual_recursion.c", "utf-8");

describe("flatten called code", () => {
    describe("simple test case", () => {
        beforeAll(() => {
            registerSourceCodeOnce(simpleCode);
            console.log((Query.root() as Joinpoint).code);
        });

        afterAll(() => {
            Clava.getProgram().pop();
        });

        test("the declaration of d is in the returned list", () => {
            const fooCall: Call = getFirstAndExpectExists(Call, { name: "foo" });
            const calledCode: Joinpoint[] = flattenCalledCode(fooCall);
            expect(calledCode.filter((jp) => { return jp instanceof Vardecl && jp.name === "d" })).toHaveLength(1);
        });

        test("the declaration of a is NOT in the returned list", () => {
            const fooCall: Call = getFirstAndExpectExists(Call, { name: "foo" });
            const calledCode: Joinpoint[] = flattenCalledCode(fooCall);
            expect(calledCode.filter((jp) => { return jp instanceof Vardecl && jp.name === "a" })).toHaveLength(0);
        });
    });

    describe("nested test case", () => {
        beforeAll(() => {
            registerSourceCodeOnce(nestedCode);
            console.log((Query.root() as Joinpoint).code);
        });

        afterAll(() => {
            Clava.getProgram().pop();
        });

        test("the declaration of y is in the returned list", () => {
            const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });
            const calledCode: Joinpoint[] = flattenCalledCode(barCall);
            expect(calledCode.filter((jp) => { return jp instanceof Vardecl && jp.name === "y" })).toHaveLength(1);
        });

        test("the declaration of x is in the returned list", () => {
            const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });
            const calledCode: Joinpoint[] = flattenCalledCode(barCall);
            expect(calledCode.filter((jp) => { return jp instanceof Vardecl && jp.name === "x" })).toHaveLength(1);
        });

        test("the declaration of k is in the returned list", () => {
            const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });
            const calledCode: Joinpoint[] = flattenCalledCode(barCall);
            expect(calledCode.filter((jp) => { return jp instanceof Vardecl && jp.name === "k" })).toHaveLength(1);
        });

        test("the declaration of m is in the returned list", () => {
            const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });
            const calledCode: Joinpoint[] = flattenCalledCode(barCall);
            expect(calledCode.filter((jp) => { return jp instanceof Vardecl && jp.name === "m" })).toHaveLength(1);
        });

        test("the declaration of n is in the returned list", () => {
            const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });
            const calledCode: Joinpoint[] = flattenCalledCode(barCall);
            expect(calledCode.filter((jp) => { return jp instanceof Vardecl && jp.name === "n" })).toHaveLength(1);
        });

        test("the declaration of a is NOT in the returned list", () => {
            const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });
            const calledCode: Joinpoint[] = flattenCalledCode(barCall);
            expect(calledCode.filter((jp) => { return jp instanceof Vardecl && jp.name === "a" })).toHaveLength(0);
        });

        test("the declaration of b is NOT in the returned list", () => {
            const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });
            const calledCode: Joinpoint[] = flattenCalledCode(barCall);

            expect(calledCode.filter((jp) => { return jp instanceof Vardecl && jp.name === "b" })).toHaveLength(0);
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

        test("the declaration of w is in the returned list", () => {
            const fooCall: Call = expectExists(Query.search(FunctionJp, { name: "main" }).search(Call, { name: "foo" }).getFirst());
            const calledCode: Joinpoint[] = flattenCalledCode(fooCall);
            expect(calledCode.filter((jp) => { return jp instanceof Vardecl && jp.name === "w" })).toHaveLength(1);
        });

        test("the declaration of z is in the returned list", () => {
            const fooCall: Call = getFirstAndExpectExists(Call, { name: "foo" });
            const calledCode: Joinpoint[] = flattenCalledCode(fooCall);
            expect(calledCode.filter((jp) => { return jp instanceof Vardecl && jp.name === "z" })).toHaveLength(1);
        });


        test("the declaration of a is NOT in the returned list", () => {
            const fooCall: Call = getFirstAndExpectExists(Call, { name: "foo" });
            const calledCode: Joinpoint[] = flattenCalledCode(fooCall);
            expect(calledCode.filter((jp) => { return jp instanceof Vardecl && jp.name === "a" })).toHaveLength(0);
        });
    });
});

describe("get called functions", () => {
    describe("simple test case", () => {
        beforeAll(() => {
            registerSourceCodeOnce(simpleCode);
            console.log((Query.root() as Joinpoint).code);
        });

        afterAll(() => {
            Clava.getProgram().pop();
        });

        test("foo is present", () => {
            const fooCall: Call = getFirstAndExpectExists(Call, { name: "foo" });
            const calledFunctions: FunctionJp[] = getAllCalledFunctions(fooCall);
            expect(calledFunctions.filter((jp) => { return jp.name === "foo" })).toHaveLength(1);
        });

        test("main is not present", () => {
            const fooCall: Call = getFirstAndExpectExists(Call, { name: "foo" });
            const calledFunctions: FunctionJp[] = getAllCalledFunctions(fooCall);
            expect(calledFunctions.filter((jp) => { return jp.name === "main" })).toHaveLength(0);
        });
    });

    describe("nested test case", () => {
        beforeAll(() => {
            registerSourceCodeOnce(nestedCode);
            console.log((Query.root() as Joinpoint).code);
        });

        afterAll(() => {
            Clava.getProgram().pop();
        });

        test("bar is included", () => {
            const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });
            const calledFunctions: FunctionJp[] = getAllCalledFunctions(barCall);
            expect(calledFunctions.filter((jp) => { return jp.name === "bar" })).toHaveLength(1);
        });

        test("foo is included", () => {
            const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });
            const calledFunctions: FunctionJp[] = getAllCalledFunctions(barCall);
            expect(calledFunctions.filter((jp) => { return jp.name === "foo" })).toHaveLength(1);
        });

        test("baz is included", () => {
            const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });
            const calledFunctions: FunctionJp[] = getAllCalledFunctions(barCall);
            expect(calledFunctions.filter((jp) => { return jp.name === "baz" })).toHaveLength(1);
        });

        test("test1 is included", () => {
            const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });
            const calledFunctions: FunctionJp[] = getAllCalledFunctions(barCall);
            expect(calledFunctions.filter((jp) => { return jp.name === "test1" })).toHaveLength(1);
        });

        test("test2 is included", () => {
            const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });
            const calledFunctions: FunctionJp[] = getAllCalledFunctions(barCall);
            expect(calledFunctions.filter((jp) => { return jp.name === "test2" })).toHaveLength(1);
        });

        test("main is not included", () => {
            const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });
            const calledFunctions: FunctionJp[] = getAllCalledFunctions(barCall);
            expect(calledFunctions.filter((jp) => { return jp.name === "main" })).toHaveLength(0);
        });

        test("notIncluded is... not included", () => {
            const barCall: Call = getFirstAndExpectExists(Call, { name: "bar" });
            const calledFunctions: FunctionJp[] = getAllCalledFunctions(barCall);
            expect(calledFunctions.filter((jp) => { return jp.name === "notIncluded" })).toHaveLength(0);
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

        test("foo is included", () => {
            const fooCall: Call = getFirstAndExpectExists(Call, { name: "foo" });
            const calledFunctions: FunctionJp[] = getAllCalledFunctions(fooCall);
            expect(calledFunctions.filter((jp) => { return jp.name === "foo" })).toHaveLength(1);
        });

        test("bar is included", () => {
            const fooCall: Call = getFirstAndExpectExists(Call, { name: "foo" });
            const calledFunctions: FunctionJp[] = getAllCalledFunctions(fooCall);
            expect(calledFunctions.filter((jp) => { return jp.name === "bar" })).toHaveLength(1);
        });


        test("main is not included", () => {
            const fooCall: Call = getFirstAndExpectExists(Call, { name: "foo" });
            const calledFunctions: FunctionJp[] = getAllCalledFunctions(fooCall);
            expect(calledFunctions.filter((jp) => { return jp.name === "main" })).toHaveLength(0);
        });
    });
});