import * as util from "./src/js/util.min.mjs";

const str = `実効値140%↑225%↑SF狙い`;

const res = /([1-2][0-9][0-9])[^0-9]+([1-2][0-9][0-9])/g.exec(str);

let readerPowerLimit = /(?:[^実][^効][^値])([1-2][0-9][0-9])/.exec(str)?.[1];
let appliedPowerLimit = readerPowerLimit ?
  /(?:[1-2][0-9][0-9])[^\n0-9]+([1-2][0-9][0-9])/g.exec(str)?.[1] :
  /(?:実効値)([1-2][0-9][0-9])/.exec(str)?.[1];
console.log(readerPowerLimit, appliedPowerLimit)