import {expect,it} from "vitest";
import {outcomeStats, validOutcome} from "../lib/ops/call-outcomes";
it("computes conversion only from won and lost decisions; pending calls stay visible",()=>{
  expect(validOutcome("lost")).toBe(true);
  expect(validOutcome("__proto__")).toBe(false);
  expect(outcomeStats([{outcome:"won"},{outcome:"lost"},{outcome:"unqualified"},{outcome:"no_show"},{outcome:"follow_up"},{outcome:null},{outcome:null,status:"cancelled"}])).toEqual({won:1,lost:1,unqualified:1,no_show:1,follow_up:1,unmarked:1,qualified_decisions:2,close_rate:50});
  expect(outcomeStats([]).close_rate).toBeNull();
});
