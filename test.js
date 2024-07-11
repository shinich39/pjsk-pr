import * as util from "./src/js/util.min.mjs";

const str = `実効値140%↑225%↑SF狙い`;

const res = /([1-2][0-9][0-9])[^0-9]+([1-2][0-9][0-9])/g.exec(str);

console.log(res)