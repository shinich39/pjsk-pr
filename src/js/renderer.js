const { sendMsg, sendErr, getMsg, waitMsg } = window.electron;
// init moment
try {
  console.log("Found device languages:", navigator.languages?.[0], navigator.language);
  moment.relativeTimeThreshold('ss', 0);
  moment.locale(navigator.languages?.[0] || navigator.language || "ja-JP");
} catch(err) {
  console.error(err);
}
// init error toast
const errorToast = bootstrap.Toast.getOrCreateInstance(document.getElementById('error-toast'));
// init message toast
const messageToast = bootstrap.Toast.getOrCreateInstance(document.getElementById('message-toast'));
// init preview toast
const previewToast = bootstrap.Toast.getOrCreateInstance(document.getElementById('preview-toast'));
// init write modal
const writeModal = new bootstrap.Modal('#write-modal', { keyboard: false });
// init room modal
const roomModal = new bootstrap.Modal('#room-modal', { keyboard: false });
const ROW_BACKGROUND_COLORSET= ["#ffbcbc", "#ffabab", "#ffbcbc", "#ffcdcd", "#ffdfdf"];
const EXPIRE_TIME = 1000 * 60 * 60; // a hour
const EXPIRE_DELAY = 1000 * 60; // a min
const INITIAL_SORT = [{column: "time", dir: "desc"}];
const BOOLEAN_OPTIONS = {
  sorter: "boolean",
  formatter: "tickCross",
  hozAlign:"center",
  headerFilterParams:{
    "tristate": true
  }
};
const TIME_OPTIONS = {
  sorter: "number",
  formatter: function(cell, formatterParams, onRendered) {
    return moment(cell.getValue()).fromNow();
  },
};

const ROW_FORMATTER = {
  rowFormatter: function(row) {
    const elem = row.getElement();
    if (!__readerPower__) {
      elem.style.backgroundColor = "";
      return;
    }

    let { guestStat } = row.getData();
    if (!guestStat) {
      elem.style.backgroundColor = "";
      return;
    }

    guestStat = "   " + guestStat.replace(/実効値|実効|実/, "実効値");
    
    let readerPowerLimit = /(?:[^実][^効][^値])([1][0-6][0-9])/.exec(guestStat)?.[1];
    let appliedPowerLimit = readerPowerLimit ?
      /(?:[1][0-6][0-9])[^\n0-9]+([1-3][0-9][0-9])/g.exec(guestStat)?.[1] :
      /(?:実効値)([1-3][0-9][0-9])/.exec(guestStat)?.[1] || /([1-3][0-9][0-9])/.exec(guestStat)?.[1];

    if (__readerPower__ && readerPowerLimit && __readerPower__ < readerPowerLimit) {
      elem.style.backgroundColor = ROW_BACKGROUND_COLORSET[0];
      return;
    }

    if (__appliedPower__ && appliedPowerLimit && __appliedPower__ < appliedPowerLimit) {
      elem.style.backgroundColor = ROW_BACKGROUND_COLORSET[0];
      return;
    }

    elem.style.backgroundColor = "";
  }
}

const STAMP_URLS = [
  "https://github.com/shinich39/pyjs/blob/main/src/img/stamp0011.png", // mouikkai
  "https://github.com/shinich39/pyjs/blob/main/src/img/stamp0421.png", // otsusaki
];

const MIN_POWER = 50;
const MAX_POWER = 150;
const POWER_RATES = [1, 0.2, 0.2, 0.2, 0.2];
const DEBUG = false;

let __roomModalTimer__ = null,
    __appliedPower__ = null,
    __readerPower__ = null,
    __table__, 
    __room__, 
    __contents__ = []; // fix twitter error: message duplicated

function createTable() {
  __table__ = new Tabulator("#room-table", {
    height: "100%",
    data: [],
    layout: "fitColumns",
    index: "roomId",
    columnHeaderSortMulti: true,
    columnDefaults: {
      // headerFilter: true,
      headerSort: false,
      headerHozAlign: "center",
      // hozAlign: "center",
    },
    initialSort: INITIAL_SORT,
    ...ROW_FORMATTER,
    columns: [
      {title: "🕒", field: "time", width: 96, ...TIME_OPTIONS},
      {title: "🔑", field: "roomId", sorter: "string", width: 64, hozAlign: "center" },
      {title: "ベテラン", field: "isVeteranRoom", width: 68, ...BOOLEAN_OPTIONS},
      {title: "3DMV", field: "isMVRoom", width: 56, ...BOOLEAN_OPTIONS},
      {title: "火消し", field: "allowPlayForStaminaEmpty", width: 68, ...BOOLEAN_OPTIONS},
      {title: "いじぺち", field: "allowEasyModeWithAFK", width: 68, ...BOOLEAN_OPTIONS},
      {title: "曲", field: "limitMusic", width: 68, sorter: "string",},
      {title: "回", field: "playsRemaining", width: 48, sorter: "string",},
      {title: "@", field: "playersNeeded", width: 48, sorter: "string",},
      {title: "主", field: "hostStat", sorter: "string", hozAlign: "left"},
      {title: "募", field: "guestStat", sorter: "string", hozAlign: "left"},
      // {title: "主", headerPopup: "Host name, 主", field: "hostName", sorter: "string",},
      // {title: "主星", headerPopup: "Host rank, 主星", field: "hostRank", sorter: "string",},
      // {title: "主%", headerPopup: "Host power, 主リーダースキル倍率", field: "hostPower", sorter: "string",},
      // {title: "募星", headerPopup: "Guest rank required, 募集星", field: "guestRank", sorter: "string",},
      // {title: "募%", headerPopup: "Guest power required, 募集リーダースキル倍率", field: "guestPower", sorter: "string",},
      // {title: "SF", headerPopup: "Allow super ferver, SF", field: "allowSuperFever", ...BOOLEAN_OPTIONS},
      // {title: "選曲", headerPopup: "Allow select song, 選曲", field: "allowSelectSong", ...BOOLEAN_OPTIONS},
    ]
  });

  // highlight
  __table__.on("rowUpdated", rowUpdatedHandler);

  // preview
  __table__.on("rowClick", rowClickHandler);

  setInterval(removeExpiredPosts, EXPIRE_DELAY);
}

function rowUpdatedHandler(row) {
  const element = row.getElement();
  if (element.style.backgroundColor !== "#fcffcf") {
    const tmp = element.style.backgroundColor;
    element.style.backgroundColor = "#fcffcf";
    setTimeout(function() {
      element.style.backgroundColor = tmp;
    }, 3072);
  }
}

function rowClickHandler(e, row) {
  const data = row.getData();
  const title = document.getElementById("preview-title");
  const time = document.getElementById("preview-time");
  const body = document.getElementById("preview-body");
  body.innerHTML = "";
  const wrapper = document.getElementById("preview-button-wrapper");
  wrapper.innerHTML = "";

  const joinButton = document.createElement("button");
  joinButton.className = "btn btn-primary btn-sm w-100";
  joinButton.innerHTML = "Join";
  joinButton.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();

    // set room data
    __room__ = getValuesFromData(data);
  
    // stop collect
    pauseCollector();
  
    // render room modal comtent
    renderRoomModal();
  
    // create room modal timer
    const timeElem = document.getElementById("room-modal-time");
    const startedAt = moment();
    __roomModalTimer__ = setInterval(function() {
      timeElem.innerHTML = moment.utc(moment.duration(moment().diff(startedAt)).valueOf()).format("HH:mm:ss");
    });
  
    roomModal.show();
  });
  
  const content = document.createElement("pre");
  content.style.margin = "0";
  content.style.whiteSpace = "pre-wrap";
  content.innerHTML = data.html;

  title.innerHTML = `🔑 ${data.roomId}`;
  time.innerHTML = moment(data.time).fromNow();
  body.appendChild(content);

  wrapper.appendChild(joinButton);

  previewToast.show();
}

function parsePostContent(content) {

  // function getHeader(str) {
  //   const re = /\n(募|求)[^\n]+\n/g;
  //   return !re.test(str) ? str : str.substring(0, re.lastIndex);
  // }

  originalContent = content;

  // normalize
  content = util.toHalfWidth(content)
    .toLowerCase()
    .trim()
    // save options
    .replace(/もう一回/g, "STAMP1")
    // to single linebreak
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, "\n")
    // remove all whitespace
    .replace(/([0-9])[^\S\r\n]+([0-9])/g, (s, s1, s2) => `${s1}|${s2}`)
    .replace(/[^\S\r\n]+/g, "")
    // remove special characters
    .replace(/[･・￤…‗╎┆┊︎╏▹|_\-=*&\$⇒\:\^!?▷▶︎→✧]/g, " ")
    .replace(/[()[\]꒰꒱<>【】{}「」『』〈〉≪≫《》〔〕〖〗]/g, " ")
    .replace(/[^\S\r\n]+/g, " ") 
    // remove kanji numbers
    .replace(/一/g, "1")
    .replace(/二/g, "2")
    .replace(/三/g, "3")
    .replace(/四/g, "4")
    // remove hiragana
    .replace(/あっと([1-4])+/g, (s, s1) => `@${s1}`)
    .replace(/ひとり/g, "1人")
    .replace(/ふたり/g, "2人")
    // remove あと following 回
    .replace(/(?:あと)([0-9]+)回/g, (s, s1) => `${s1}回`)
    // remove あと following 人
    .replace(/(?:あと|@)([1-4])+人?/g, (s, s1) => `@${s1}`)
    // remove emoji
    .replace(/([^A-Za-z0-9])(?:x|no)([^A-Za-z0-9])/g, (s, c1, c2) => `${c1}❌${c2}`)
    .replace(/不可|不|以外|🙅|🙅‍♂️|🙅‍♀️|⛔|🚫|⛔|×|✕|✖|✖️|❎|🆖|❌/g, "❌")
    .replace(/([^A-Za-z0-9])(?:ok|o|yes)([^A-Za-z0-9])/g, (s, c1, c2) => `${c1}⭕${c2}`)
    .replace(/可|🙆‍♀️|👌|◎|◎|○|⭕|✔|✅|歓迎/g, "⭕")
    .replace(/星|ほし|✭|⭑|✦|⭐︎|☆|✰|⚝|⋆|✶|🌟|ִ ࣪𖤐|★|✮|ᯓ★|⭐/g, "⭐")
    .replace(/⤴|↑|⬆|🔼|⏫|▲|🆙|⬆️/g, "⬆️")
    .replace(/([0-9]+)(上|アップ)/g, (e, e1) => `${e1}⬆️`)
    .replace(/🦐|エビ|エンヴィー|独りんぼエンヴィー/g, "🦐") // 独りんぼエンヴィー
    .replace(/ロストエ|ロストエンファウンド/g, "ロストエ") // ロストエンファウンド
    .replace(/(\n[^\n]{0,1}主[^\n]+)((?:募集|募|求)[^\n]+\n)/g, (a0, a1, a2) => `${a1}\n${a2}`)
    // load options
    .replace(/STAMP1/g, "もう一回");

  const roomId = /[^@0-9]([0-9][0-9][0-9][0-9][0-9])[^回0-9]/.exec(content)?.[1];
  const isVeteranRoom = /ベテラン/.test(content);
  const isMVRoom = /(3dmv|mv)[^\n]{0,1}[^❌]/.test(content);

  let limitMusic = null;
  if (!isMVRoom) {
    if (/おまかせ[^\n]{0,1}[^❌]/.test(content)) {
      limitMusic = "おまかせ";
    } else if (/🦐[^\n]{0,1}[^❌]/.test(content)) {
      limitMusic = "🦐";
    } else if (/ロスエン[^\n]{0,1}[^❌]/.test(content)) {
      limitMusic = "ロスエン";
    } else if (/sage[^\n]{0,1}[^❌]/.test(content)) {
      limitMusic = "sage";
    } else if (/選曲[^\n]{0,1}[^❌]/.test(content)) {
      limitMusic = "選曲";
    }
  }

  const allowPlayForStaminaEmpty = !/火消し[^\n]{0,1}❌/.test(content);
  const allowEasyModeWithAFK = /いじぺち[^\n]{0,1}[^❌]/.test(content);
  const playsRemaining = /(周回|[0-9]+回)/.exec(content)?.[1];
  const playersNeeded = /(@[^\n]{0,1}[1-4])+/.exec(content)?.[1]?.replace(/(@)[^\n]{0,1}([1-4])/, (s, s1, s2) => `${s1}${s2}`);
  const hostStat = /\n[^\n]{0,1}(?:主)([^\n]+)\n/.exec(content)
    ?.[1]
    ?.replace(/%/g, "% ")
    ?.replace(/\//g, " / ")
    ?.replace(/[^\S\r\n]+/g, " ")
    ?.trim();
  const guestStat = /\n[^\n]{0,1}(?:募集|募|求)([^\n]+)\n/.exec(content)
    ?.[1]
    ?.replace(/%/g, "% ")
    ?.replace(/\//g, " / ")
    ?.replace(/[^\S\r\n]+/g, " ")
    ?.trim();
  
  return {
    roomId,
    isVeteranRoom,
    isMVRoom,
    allowPlayForStaminaEmpty,
    allowEasyModeWithAFK,
    limitMusic,
    playsRemaining,
    playersNeeded,
    hostStat,
    guestStat,
    originalContent,
  }
}

function getValuesFromData(data) {
  let {
    roomId,
    isVeteranRoom,
    isMVRoom,
    allowPlayForStaminaEmpty,
    allowEasyModeWithAFK,
    limitMusic,
    playsRemaining,
    playersNeeded,
    hostStat,
    guestStat,
    content,
    originalContent,
  } = data;

  // normalize
  content = util.toHalfWidth(content)
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/r\n/g, "\n")
    .replace(/\n+/g, "\n")
    // remove kanji numbers
    .replace(/一人/g, "1人")
    .replace(/二人/g, "2人")
    .replace(/三人/g, "3人")
    .replace(/四人/g, "4人")
    // remove hiragana
    .replace(/あっと([^\S\r\n]*[1-4]+)/g, (s, s1) => `@${s1}`)
    .replace(/ひとり/g, "1人")
    .replace(/ふたり/g, "2人")
    // remove あと following 回
    .replace(/(?:あと)[^\S\r\n]*([0-9]+)[^\S\r\n]*回/g, (s, s1) => `${s1}回`)
    // remove あと following 人
    .replace(/(?:あと|@)[^\S\r\n]*([1-4])+[^\S\r\n]*人?/g, (s, s1) => `@${s1}`)

  // set playersNeeded
  if (playersNeeded) {
    const re = new RegExp(`(?:あと|あっと|@)[^\\n]{0,1}(?:ひとり|ふたり|[1-4]人|[1-4]+|いち)`);
    content = content.replace(re, playersNeeded);
  } else {
    // default @4
    playersNeeded = "@4";
    const re = new RegExp(`(${roomId}[^\n]*)\n`);
    content = content.replace(re, (e, e1) => `${e1} ${playersNeeded}\n`);
  }

  // set playsRemaining
  if (playsRemaining) {
    content = content.replace(/(周|[0-9]+)[^\n]{0,1}回/, playsRemaining);
  } else {
    // default 周回
    playsRemaining = "周回";
    const re = new RegExp(`(${roomId}[^\n]*)\n`);
    content = content.replace(re, (e, e1) => `${e1} ${playsRemaining}\n`);
  }

  return {
    roomId,
    isVeteranRoom,
    isMVRoom,
    allowPlayForStaminaEmpty,
    allowEasyModeWithAFK,
    limitMusic,
    playsRemaining,
    playersNeeded,
    hostStat,
    guestStat,
    stamp1: false,
    stamp2: false,
    stamp3: false,
    content,
    originalContent,
  }
}

function getWriteModalValues() {
  const roomId = document.getElementById("write-room-id").value;
  const isVeteranRoom = document.getElementById("write-room-type-1").checked;
  const isMVRoom = document.getElementById("write-room-type-2").checked;
  const allowPlayForStaminaEmpty = document.getElementById("write-room-type-3").checked;
  const allowEasyModeWithAFK = document.getElementById("write-room-type-4").checked;
  const limitMusic = document.querySelector("input[name='write-limit-music']:checked").value;
  const playsRemaining = document.querySelector("input[name='write-plays-remaining']:checked").value;
  const playersNeeded = document.querySelector("input[name='write-players-needed']:checked").value;
  const hostRank = document.querySelector("input[name='write-host-rank']:checked").value;
  const guestRank = document.querySelector("input[name='write-guest-rank']:checked").value;
  const stamp1 = document.getElementById("write-stamp-type-1").checked;
  const stamp2 = document.getElementById("write-stamp-type-2").checked;
  const stamp3 = document.getElementById("write-stamp-type-3").checked;

  return {
    roomId,
    isVeteranRoom,
    isMVRoom,
    allowPlayForStaminaEmpty,
    allowEasyModeWithAFK,
    limitMusic,
    playsRemaining,
    playersNeeded,
    hostStat: hostRank,
    guestStat: guestRank,
    stamp1,
    stamp2,
    stamp3,
  }
}

function getRoomModalValues() {
  const playsRemaining = document.querySelector("input[name='room-plays-remaining']:checked").value;
  const playersNeeded = document.querySelector("input[name='room-player-needed']:checked").value;

  return {
    playsRemaining,
    playersNeeded,
  }
}

function createRoomContent() {
  const {
    roomId,
    isVeteranRoom,
    limitMusic,
    isMVRoom,
    allowPlayForStaminaEmpty,
    allowEasyModeWithAFK,
    playsRemaining,
    playersNeeded,
    hostStat,
    guestStat,
    stamp1,
    stamp2,
    stamp3,
  } = __room__;

  let text = "";
  if (isVeteranRoom) {
    text += "ベテラン ";
  }
  if (isMVRoom) {
    text += "3DMV ";
  }
  if (!allowPlayForStaminaEmpty) {
    text += "火消し❌ ";
  }
  if (allowEasyModeWithAFK) {
    text += "いじぺち ";
  }
  if (limitMusic && limitMusic !== "") {
    text += `${limitMusic} `;
  }
  text += playsRemaining + "\n\n";
  text += `🔑 ${roomId} ${playersNeeded}\n`
  text += `主 : ${hostStat}\n`;
  text += `募 : ${guestStat}\n\n`;

  if (stamp1) {
    text += `一時的な退室 : もう一回みのり\n`;
  }
  if (stamp2) {
    text += `解散(主)           : 乙咲希\n`;
  }
  if (stamp3) {
    text += `抜ける              : またね系\n\n`;
  }

  // text += `Posted by pjsk public room\n\n`;

  text += "#プロセカ募集 #プロセカ協力";

  __room__.content = text;
}

function setRoomPlayersNeeded() {
  if (!/@([1-4])+/.test(__room__.content)) {
    __room__.content = `${__room__.playersNeeded}\n${__room__.content}`;
  } else {
    __room__.content = __room__.content
      .replace(/@[1-4]+/, __room__.playersNeeded);
  }
}

function setRoomPlaysRemainging() {
  if (!/周回|([^もう])[0-9]+回/.test(__room__.content)) {
    __room__.content = __room__.content
      .relace(/@[1-4]+/, 
        (e) => `${e} ${__room__.playsRemaining}`);
  } else {
    __room__.content = __room__.content
      .replace(/周回|([^もう])[0-9]+回/, 
        (s, s1) => `${s1 || ""}${__room__.playsRemaining}`);
  }
}

function checkRoomContent() {
  let content = __room__.content;

  // fix dupe error
  let count = 0;
  if (/@([0-9])/.test(content)) {
    while(__contents__.indexOf(content) > -1) {
      content = content.replace(/@([1-4])/, (s, n) => `${s}${n}`);
      count++;
    }
  } else {
    content += "\n" + util.id();
  }

  __contents__.push(content);

  __room__.content = content;
}

function renderRoomModal() {
  let {
    roomId,
    isVeteranRoom,
    isMVRoom,
    limitMusic,
    allowPlayForStaminaEmpty,
    allowEasyModeWithAFK,
    playsRemaining,
    playersNeeded,
    hostStat,
    guestStat,
    stamp1,
    stamp2,
    stamp3,
  } = __room__;

  const titleElem = document.getElementById("room-modal-title");
  titleElem.innerHTML = `🔑 ${roomId}`;

  const bodyElem = document.getElementById("room-modal-body");
  bodyElem.innerHTML = "";

  const container = document.createElement("div");
  
  const optElem = document.createElement("div");
  optElem.className = "mb-2";
  let opt = "";

  // room settings
  if (isVeteranRoom) {
    opt += `<span class="badge text-bg-primary">ベテラン</span>\n`;
  }
  if (isMVRoom) {
    opt += `<span class="badge text-bg-primary">3DMV</span>\n`;
  }
  if (!allowPlayForStaminaEmpty) {
    opt += `<span class="badge text-bg-primary">火消し❌</span>\n`;
  }
  if (allowEasyModeWithAFK) {
    opt += `<span class="badge text-bg-primary">いじぺち</span>\n`;
  }
  if (limitMusic) {
    opt += `<span class="badge text-bg-primary">${limitMusic}</span>\n`;
  }

  // stats
  if (hostStat && hostStat.trim() !== "") {
    opt += `<span class="badge text-bg-warning">主 ${hostStat.trim()}</span>\n`;
  }
  if (guestStat && guestStat.trim() !== "") {
    opt += `<span class="badge text-bg-warning">募 ${guestStat.trim()}</span>\n`;
  }

  // stamps
  if (stamp1) {
    opt += `<span class="badge text-bg-secondary">もう一回</span>\n`;
  }
  if (stamp2) {
    opt += `<span class="badge text-bg-secondary">乙咲希</span>\n`;
  }
  if (stamp3) {
    opt += `<span class="badge text-bg-secondary">またね</span>\n`;
  }

  optElem.innerHTML = opt;

  const playsRemainingElem = document.createElement("div");
  playsRemainingElem.className = "mb-2";

  let playsRemainingChecked = false;
  for (let i = 1; i < 11; i++) {
    playsRemainingElem.innerHTML += `
<div class="form-check form-check-inline">
  <input 
    class="form-check-input" 
    type="radio"
    id="room-plays-remaining-${i}"
    name="room-plays-remaining" 
    value="${i+"回"}" ${playsRemaining === i+"回" ? "checked": ""}>
  <label class="form-check-label" for="room-plays-remaining-${i}">${i}回</label>
</div>
    `.trim() + "\n";

    if (!playsRemainingChecked) {
      playsRemainingChecked = playsRemaining === i+"回";
    }
  }
  playsRemainingElem.innerHTML += `
<div class="form-check form-check-inline">
  <input 
    class="form-check-input" 
    type="radio"
    id="room-plays-remaining-11"
    name="room-plays-remaining" 
    value="周回" ${playsRemaining === "周回" || !playsRemainingChecked ? "checked": ""}>
  <label class="form-check-label" for="room-plays-remaining-11">周回</label>
</div>
  `.trim() + "\n";

  let playersNeededChecked = /@[1-4]/.test(playersNeeded);
  const playersNeededElem = document.createElement("div");
  playersNeededElem.innerHTML = `
<div class="form-check form-check-inline">
  <input 
    class="form-check-input" 
    type="radio"
    id="room-player-needed-1"
    name="room-player-needed" 
    value="@1" ${playersNeeded === "@1" ? "checked": ""}>
  <label class="form-check-label" for="room-player-needed-1">@1</label>
</div>
<div class="form-check form-check-inline">
  <input 
    class="form-check-input" 
    type="radio"
    id="room-player-needed-2"
    name="room-player-needed" 
    value="@2" ${playersNeeded === "@2" ? "checked": ""}>
  <label class="form-check-label" for="room-player-needed-2">@2</label>
</div>
<div class="form-check form-check-inline">
  <input 
    class="form-check-input" 
    type="radio"
    id="room-player-needed-3"
    name="room-player-needed" 
    value="@3" ${playersNeeded === "@3" ? "checked": ""}>
  <label class="form-check-label" for="room-player-needed-3">@3</label>
</div>
<div class="form-check form-check-inline">
  <input 
    class="form-check-input" 
    type="radio"
    id="room-player-needed-4"
    name="room-player-needed" 
    value="@4" ${playersNeeded === "@4" || !playersNeededChecked ? "checked": ""}>
  <label class="form-check-label" for="room-player-needed-4">@4</label>
</div>
  `.trim() + "\n";

  container.appendChild(optElem);
  container.appendChild(playsRemainingElem);
  container.appendChild(playersNeededElem);
  bodyElem.appendChild(container);
}

function showErr(text) {
  document.getElementById('error-toast-body').innerHTML = text;
  errorToast.show();
}

function showMsg(text) {
  document.getElementById('message-toast-body').innerHTML = text;
  messageToast.show();
}

function removeExpiredPosts() {
  let ids = [];
  for (const post of __table__.getData()) {
    if (post.time + EXPIRE_TIME < Date.now()) {
      ids.push(post.roomId);
    }
  }

  if (ids.length > 0) {
    __table__.deleteRow(ids);
    console.log(`${ids.length} posts has been expired.`);
  }
}

function loading(elem, count) {
  let orig = elem.innerHTML;
  let timer = null;
  (function countdown() {
    if (count > 0) {
      timer = setTimeout(countdown, 1000);
      elem.disabled = true;
      elem.innerHTML = count;
    } else {
      elem.disabled = false;
      elem.innerHTML = orig;
    }
    count -= 1;
  })();
}

function resumeCollector() {
  sendMsg("set-collector", true);
}

function pauseCollector() {
  sendMsg("set-collector", false);
}

function writePost() {
  console.log("write:\n", __room__.content);
  if (DEBUG) {
    writeModal.hide();

    // stop collect
    pauseCollector();

    // render room modal comtent
    renderRoomModal();

    // create room modal timer
    const timeElem = document.getElementById("room-modal-time");
    const startedAt = moment();
    __roomModalTimer__ = setInterval(function() {
      timeElem.innerHTML = moment.utc(moment.duration(moment().diff(startedAt)).valueOf()).format("HH:mm:ss");
    });

    roomModal.show();

    loading(document.getElementById("room-update"), 5);
  } else {
    sendMsg("write-post", __room__.content);
  }
}

function updatePost() {
  console.log("update:\n", __room__.content);
  if (DEBUG) {
    showMsg("The room has been updated.");
  } else {
    sendMsg("update-post", __room__.content);
  }
}

function saveCookies(arr) {
  sendMsg("set-cookies", arr);
}

getMsg("get-cookies", function(err, req) {
  if (err) {
    console.error(err);
    showErr(err.message);
  } else {
    console.log("get-cookies", req);

    const values = [
      req.find((e) => e.name === "power-1")?.value,
      req.find((e) => e.name === "power-2")?.value,
      req.find((e) => e.name === "power-3")?.value,
      req.find((e) => e.name === "power-4")?.value,
      req.find((e) => e.name === "power-5")?.value,
    ];

    document.getElementById("power-input-1").value = values[0] || "";
    document.getElementById("power-input-2").value = values[1] || "";
    document.getElementById("power-input-3").value = values[2] || "";
    document.getElementById("power-input-4").value = values[3] || "";
    document.getElementById("power-input-5").value = values[4] || "";

    setPowers();
  }
});

// get collect response
getMsg("collect", function(err, req, event) {
  if (err) {
    console.error(err);
    return;
  }

  const oldPosts = __table__.getData();

  // covert new posts
  let newPosts = req.map(function(post) {
    // set time
    post.time = moment(post.date).valueOf();

    return Object.assign(post, parsePostContent(post.content));
  });

  // remove dupe in new posts
  newPosts = newPosts.reduce(function(prev, curr) {
    if (!curr.roomId) {
      return prev;
    }
    if (
      !prev[curr.roomId] || 
      prev[curr.roomId].time < curr.time
    ) {
      prev[curr.roomId] = curr;
    }
    return prev;
  }, {});

  newPosts = Object.values(newPosts);

  newPosts = newPosts.filter(function(newPost) {
    // expired
    if (newPost.time + EXPIRE_TIME < Date.now()) {
      return false;
    }
    const oldPost = oldPosts.find(function(p) {
      return p.roomId === newPost.roomId;
    });
    // new post
    if (!oldPost) {
      return true;
    }
    // update post
    if (oldPost.time < newPost.time) {
      return true;
    }
    // invalid post
    return false;
  });


  if (newPosts.length > 0) {
    console.log("New Posts:", newPosts);
    __table__.updateOrAddData(newPosts)
      .then(function() {
        // refresh sort
        __table__.setSort(INITIAL_SORT);
      });
  }
});

// get write response
getMsg("write", function(err, req) {
  writeModal.hide();

  if (err) {
    console.error(err);
    roomModal.hide();
  } else {
    // stop collect
    pauseCollector();

    // render room modal comtent
    renderRoomModal();

    // create room modal timer
    const timeElem = document.getElementById("room-modal-time");
    const startedAt = moment();
    __roomModalTimer__ = setInterval(function() {
      timeElem.innerHTML = moment.utc(moment.duration(moment().diff(startedAt)).valueOf()).format("HH:mm:ss");
    });

    roomModal.show();

    loading(document.getElementById("room-update"), 5);
  }
});

// get update response
getMsg("update", function(err, req) {
  if (err) {
    console.error(err);
    showErr(err.message);
  } else {
    showMsg("The room has been updated.");
  }
  loading(document.getElementById("room-update"), 5);
});

// open write modal
document.getElementById("write-modal").addEventListener('shown.bs.modal', function(e) {
  // focus to room id input
  document.getElementById("write-room-id").focus();
});

// close write modal
// document.getElementById("write-cancel").addEventListener("click", function(e) {
//   ...
// });

// write post
document.getElementById("write-submit").addEventListener("click", function(e) {
  __room__ = getWriteModalValues();

  // room id validation
  if (
    __room__.roomId.length !== 5 || 
    !util.isNumeric(__room__.roomId)
  ) {
    showErr('Room ID must be 5 numbers.');
    return;
  }

  // create content
  createRoomContent();

  // check dupe
  checkRoomContent();

  writePost();
});

// open room modal
// document.getElementById("room-modal").addEventListener('show.bs.modal', function(e) {
//   ...
// });

// close room modal
document.getElementById("room-close").addEventListener("click", function(e) {
  // clear room modal timer
  if (__roomModalTimer__) {
    clearInterval(__roomModalTimer__);
    __roomModalTimer__ = null;
  }

  // resume collector
  resumeCollector();
});

// update room
document.getElementById("room-update").addEventListener("click", function(e) {
  const { playsRemaining, playersNeeded } = getRoomModalValues();

  // update room data
  __room__.playersNeeded = playersNeeded;
  __room__.playsRemaining = playsRemaining;

  // update room content
  setRoomPlayersNeeded();
  setRoomPlaysRemainging();

  // check dupe
  checkRoomContent();

  updatePost();
});

document.getElementById("open-git").addEventListener("click", function(e) {
  sendMsg("open-git");
});

function calcPowerRange() {
  const values = [
    document.getElementById("power-input-1").value,
    document.getElementById("power-input-2").value,
    document.getElementById("power-input-3").value,
    document.getElementById("power-input-4").value,
    document.getElementById("power-input-5").value,
  ];
  
  const ranges = values.map(function(item) {
    return util.isNumeric(item) ? [parseInt(item), parseInt(item)] : [MIN_POWER, MAX_POWER];
  });

  saveCookies(values.map(function(v, i) {
    return {
      key: `power-${i + 1}`,
      value: v,
    }
  }));

  let readerPower;
  let minPowers = [
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
  ];
  let maxPowers = [
    Number.MIN_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
  ];
  for (let i = 0; i < ranges.length; i++) {
    const rate = POWER_RATES[i];
    const mnp = ranges[i][0] * rate;
    const mxp = ranges[i][1] * rate;
    if (i === 0) {
      readerPower = mnp === mxp ? mnp : null;
    }
    if (minPowers[i] > mnp) {
      minPowers[i] = mnp;
    }
    if (maxPowers[i] < mxp) {
      maxPowers[i] = mxp;
    }
  }

  return [
    readerPower,
    Math.round(minPowers.reduce((p, c) => p + c, 0)),
    Math.round(maxPowers.reduce((p, c) => p + c, 0)),
  ];
}

function setPowers() {
  const input = document.getElementById("power-input-6");
  const [r, a, b] = calcPowerRange();

  // set reader power
  __readerPower__ = r;

  // set applied power
  if (a === b) {
    input.value = `${a}%`;
    __appliedPower__ = a;
  } else {
    input.value = `${a}% ~ ${b}%`;
    __appliedPower__ = b;
  }

  // redraw
  __table__.redraw(true);
}

[
  document.getElementById("power-input-1"),
  document.getElementById("power-input-2"),
  document.getElementById("power-input-3"),
  document.getElementById("power-input-4"),
  document.getElementById("power-input-5"),
].forEach(function(elem, idx) {
  elem.addEventListener("input", setPowers);
});

document.addEventListener("keydown", function(e) {
  const { shiftKey, key } = e;
  const ctrlKey = e.ctrlKey || e.metaKey;
  if (ctrlKey && shiftKey && key.toLowerCase() === "i") {
    e.preventDefault();
    e.stopPropagation();
    sendMsg("console");
  }
});

createTable();

// if (DEBUG) {
//   // room modal debug
//   __room__ = getWriteModalValues();
//   __room__.roomId = "39393";
//   __room__.content = ``;
//   renderRoomModal();
//   roomModal.show()
// }