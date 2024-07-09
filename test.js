import * as util from "./src/js/util.min.mjs";

const str = `
2】
主 150% 募 130%
長時間歓迎 スタン
`

console.log(str.replace(/(\n[^\S\r\n]{0,2}主[^\n]+)((?:募集|募|求)[^\n]+\n)/g, (a0, a1, a2) => `${a1}\n${a2}`))