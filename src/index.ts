import Query from "@specs-feup/lara/api/weaver/Query.js"
import { Loop } from "@specs-feup/clava/api/Joinpoints.js"
import ClavaJoinPoints from "@specs-feup/clava/api/clava/ClavaJoinPoints.js"

const forLoops = Query.search(Loop, (loop: Loop) => loop.kind === "for").get();

for (const forLoop of forLoops) {
    forLoop.insertBefore(ClavaJoinPoints.comment("fond a forloop"));
    console.log("Cond: {\n" + forLoop.cond.code + "\n}\n");
    
    if (forLoop.hasCondRelation) {
        //console.log("CondRelation: {\n" + forLoop.condRelation + "\n}\n");
    }

    console.log("ControlVar: {\n" + forLoop.controlVar + "\n}\n");
    console.log("endValue: {\n" + forLoop.endValue + "\n}\n");
    console.log("step: {\n" + forLoop.step + "\n}\n");
    console.log("stepValue: {\n" + forLoop.stepValue + "\n}\n");

}


console.log("Found " + forLoops.length + " forloops.")