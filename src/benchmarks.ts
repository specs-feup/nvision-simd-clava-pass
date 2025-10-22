import { applyPass } from "./pass.js";
import { loadSuite, loadApp } from "@specs-feup/clava-lite-benchmarks/LiteBenchmarkLoader";
import { POLYBENCH_SIZES, POLYBENCH_4_2 } from "@specs-feup/clava-lite-benchmarks/BenchmarkSuites";
import { Joinpoint } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import VisualizationTool from "@specs-feup/clava-visualization/api/VisualizationTool.js";
import Clava from "@specs-feup/clava/api/clava/Clava.js";
import { writeFileSync } from "node:fs";

type entry = {
    durations: number[],
    numTransformations: number
}

const map: Map<string, entry> = new Map();

for (let i = 0; i < 10; i++) {
    const initialTotal = performance.now();
    for (const res of loadSuite(POLYBENCH_4_2, undefined, POLYBENCH_SIZES.SMALL)) {
        if (res.success === false) {
            console.log(`Error, couldn't load ${res.appSummary.canonicalName}`);
            break;
        }
        const ini = performance.now();
        const numTransformations = applyPass(false, true);
        const final = performance.now();
        const entryInMap = map.get(res.appSummary.canonicalName);
        const entry: entry = entryInMap !== undefined ? entryInMap : { durations: [], numTransformations: numTransformations };
        entry.durations.push(final - ini);
        map.set(res.appSummary.canonicalName, entry);
    }

    const finalTotal = performance.now();
    const entryInMap = map.get("total");
    const entry: entry = entryInMap !== undefined ? entryInMap : { durations: [], numTransformations: 0 };
    entry.durations.push(finalTotal - initialTotal);
    map.set("total", entry);
}

writeFileSync("dist/output.json", JSON.stringify(Array.from(map.entries())));