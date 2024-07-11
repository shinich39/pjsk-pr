import * as util from "./src/js/util.min.mjs";

const str = `あと1111111人`;

const res = str.replace(/(?:あと|@)([1-4])+人?/g, (s, s1) => `@${s1}`);

console.log(res)