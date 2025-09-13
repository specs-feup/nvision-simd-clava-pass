import { applyPass } from "./pass.js";
import { loadSuite, loadApp } from "@specs-feup/clava-lite-benchmarks/LiteBenchmarkLoader";
import { POLYBENCH_SIZES, POLYBENCH_4_2 } from "@specs-feup/clava-lite-benchmarks/BenchmarkSuites";
import { Joinpoint } from "@specs-feup/clava/api/Joinpoints.js";
import Query  from "@specs-feup/lara/api/weaver/Query.js";
import VisualizationTool from "@specs-feup/clava-visualization/api/VisualizationTool.js";
import Clava from "@specs-feup/clava/api/clava/Clava.js";

loadApp(POLYBENCH_4_2, POLYBENCH_4_2.apps["atax"], undefined, POLYBENCH_SIZES.SMALL);

applyPass(false, 8, false);

Clava.writeCode("dist/woven_code");