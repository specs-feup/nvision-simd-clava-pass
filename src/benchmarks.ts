import { applyPass } from "./pass.js";
import { loadSuite } from "@specs-feup/clava-lite-benchmarks/LiteBenchmarkLoader";
import { POLYBENCH_SIZES, POLYBENCH_4_2 } from "@specs-feup/clava-lite-benchmarks/BenchmarkSuites";
import { writeFileSync } from "node:fs";

type entry = {
    durations: number[],
    numTransformations: number
}

const map: Map<string, entry> = new Map();

const initialTotal = performance.now();
for (const res of loadSuite(POLYBENCH_4_2, undefined, POLYBENCH_SIZES.MINI)) {
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

writeFileSync("dist/output.json", JSON.stringify(Array.from(map.entries())));