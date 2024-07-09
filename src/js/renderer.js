const { sendMsg, sendErr, getMsg, waitMsg } = window.electron;
// init error toast
const errorToast = bootstrap.Toast.getOrCreateInstance(document.getElementById('error-toast'));
// init message toast
const messageToast = bootstrap.Toast.getOrCreateInstance(document.getElementById('message-toast'));
// init write modal
const writeModal = new bootstrap.Modal('#write-modal', { keyboard: false });
// init room modal
const roomModal = new bootstrap.Modal('#room-modal', { keyboard: false });
// init luxon.js
window.DateTime = luxon.DateTime;
window.Interval = luxon.Interval;
const ROW_BACKGROUND_COLORSET= ["#bcbcbc", "#ffabab", "#ffbcbc", "#ffcdcd", "#ffdfdf"];
const EXPIRE_TIME = 1000 * 60 * 60; // a hour
const EXPIRE_DELAY = 1000 * 30; // 30 sec
const BOOLEAN_OPTIONS = {
  sorter: "boolean",
  formatter: "tickCross",
  hozAlign:"center",
  headerFilterParams:{
    "tristate": true
  }
};
const DATE_OPTIONS = {
  sorter: "datetime",
  sorterParams:{
    format:"iso",
    alignEmptyValues: "bottom",
  },
  formatter: "datetime",
  formatterParams: {
    inputFormat: "iso",
    outputFormat: "HH:mm:ss",
  }
};
const ROW_CLICK_POPUP = {
  rowClickPopup: function(e, row, onRendered) {
    const data = row.getData();

    let container = document.createElement("pre");
    container.innerHTML = data.html.replace(/href="[^"]+"/g, "");

    return container;
  }
};
const ROW_FORMATTER = {
  // rowFormatter: function(row) {
  //   const data = row.getData();

  //   // expired
  //   if (DateTime.fromISO(data.date).valueOf() + EXPIRE_TIME < Date.now()) {
  //     row.getElement().style.backgroundColor = ROW_BACKGROUND_COLORSET[0];
  //   } 

  //   // players
  //   else if (/1/.test(data.playersNeeded)) {
  //     row.getElement().style.backgroundColor = ROW_BACKGROUND_COLORSET[1];
  //   } else if (/2/.test(data.playersNeeded)) {
  //     row.getElement().style.backgroundColor = ROW_BACKGROUND_COLORSET[2];
  //   } else if (/3/.test(data.playersNeeded)) {
  //     row.getElement().style.backgroundColor = ROW_BACKGROUND_COLORSET[3];
  //   } else if (/4|5/.test(data.playersNeeded)) {
  //     row.getElement().style.backgroundColor = ROW_BACKGROUND_COLORSET[4];
  //   } else {
  //     row.getElement().style.backgroundColor = ROW_BACKGROUND_COLORSET[0];
  //   }
    
  // }
}

const STAMP_URLS = [
  "https://github.com/shinich39/pyjs/blob/main/src/img/stamp0011.png", // mouikkai
  "https://github.com/shinich39/pyjs/blob/main/src/img/stamp0421.png", // otsusaki
];

let roomModalTimer,
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
      hozAlign: "center",
    },
    initialSort:[
      {column: "date", dir: "desc"},
    ],
    ...ROW_FORMATTER,
    ...ROW_CLICK_POPUP,
    columns: [
      {title: "📅", field: "date", width: 64, ...DATE_OPTIONS},
      {title: "🔑", field: "roomId", sorter: "string", width: 64,},
      {title: "ベテラン", field: "isVeteranRoom", width: 68, ...BOOLEAN_OPTIONS},
      {title: "🦐",field: "isEnvyRoom", width: 48, ...BOOLEAN_OPTIONS},
      {title: "おまかせ", field: "isRandomSong", width: 68, ...BOOLEAN_OPTIONS},
      {title: "MV", field: "isMVRoom", width: 48, ...BOOLEAN_OPTIONS},
      {title: "火消し", field: "isEnergyUseAllowed", width: 56, ...BOOLEAN_OPTIONS},
      {title: "回", field: "maxPlay", width: 48, sorter: "string",},
      {title: "@", field: "playersNeeded", width: 48, sorter: "string",},
      {title: "主", field: "hostStat", sorter: "string", hozAlign: "left"},
      {title: "募", field: "guestStat", sorter: "string", hozAlign: "left"},
      // {title: "Type", headerPopup: "Room type", field: "roomType", sorter: "string",},
      // {title: "User", headerPopup: "Host name", field: "hostName", sorter: "string",},
      // {title: "主", headerPopup: "Host name, 主", field: "hostName", sorter: "string",},
      // {title: "主星", headerPopup: "Host rank, 主星", field: "hostRank", sorter: "string",},
      // {title: "主%", headerPopup: "Host power, 主リーダースキル倍率", field: "hostPower", sorter: "string",},
      // {title: "募星", headerPopup: "Guest rank required, 募集星", field: "guestRank", sorter: "string",},
      // {title: "募%", headerPopup: "Guest power required, 募集リーダースキル倍率", field: "guestPower", sorter: "string",},
      // {title: "SF", headerPopup: "Allow super ferver, SF", field: "AllowSuperFever", ...BOOLEAN_OPTIONS},
      // {title: "いじぺち", headerPopup: "Allow easy mode, いじぺち", field: "AllowEasyMode", ...BOOLEAN_OPTIONS},
      // {title: "選曲", headerPopup: "Allow select song, 選曲", field: "AllowSelectSong", ...BOOLEAN_OPTIONS},
      // {title: "火消し", headerPopup: "Allow play for use energy, 火消し", field: "AllowUseEnergy", ...BOOLEAN_OPTIONS},
    ]
  });

  __table__.on("rowUpdated", function(row){
    const element = row.getElement();
    if (element.style.backgroundColor !== "#fcffcf") {
      const tmp = element.style.backgroundColor;
      element.style.backgroundColor = "#fcffcf";
      setTimeout(function() {
        element.style.backgroundColor = tmp;
      }, 256);
    }
  });

  setInterval(removeExpiredPosts, EXPIRE_DELAY);
}

function parsePostContent(str) {

  function getHeader(str) {
    const re = /\n(募|求)[^\n]+\n/g;
    return !re.test(str) ? str : str.substring(0, re.lastIndex);
  } 

  // normalize
  str = util.toHalfWidth(str)
    .toLowerCase()
    // .getHeader(str)
    .replace(/[･・┆┊︎꒰꒱|_\-=[\]()*&\$<>{}\:\^!?]/g, "")
    .replace(/[🙅🙅‍♂️🙅‍♀️⛔🚫✕]/g, "❌")
    
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, "\n");

  const roomId = /[^@0-9]([0-9][0-9][0-9][0-9][0-9])[^回0-9]/.exec(str)?.[1];
  const isVeteranRoom = /ベテラン/.test(str);
  const isEnvyRoom = /(🦐|エビ|エンヴィー)/.test(str) && !/(🦐|エビ|エンヴィー)[^\n]{0,2}(不|x|no|❌)/.test(str);
  const isEnergyUseAllowed = /(火消し)/.test(str) && !/(火消し)[^\n]{0,2}(不|x|no|❌)/.test(str);
  const isMVRoom = /(3dmv|mv)/.test(str) && !/(3dmv|mv)[^\n]{0,2}(不|x|no|❌)/.test(str);
  const isSelectSong = /(選曲)/.test(str) && !/(選曲)[^\n]{0,2}(不|x|no|❌)/.test(str);
  const isRandomSong = /(おまかせ)/.test(str) && !/(おまかせ)[^\n]{0,2}(不|x|no|❌)/.test(str);
  const maxPlay = /([0-9]+)[^\S\r\n]*回/.exec(str)?.[1];
  const playersNeeded = /@[^\S\r\n]*([0-9])+/.exec(str)?.[1];
  const hostStat = /\n.?(?:主)([^\n]+)\n/.exec(str)?.[1]?.trim();
  const guestStat = /\n.?(?:募|求)([^\n]+)\n/.exec(str)?.[1].trim();

  return {
    roomId,
    isVeteranRoom,
    isEnvyRoom,
    isEnergyUseAllowed,
    isMVRoom,
    isSelectSong,
    isRandomSong,
    maxPlay,
    playersNeeded,
    hostStat,
    guestStat,
  }
}

function getWriteModalValues() {
  const roomId = document.getElementById("write-room-id").value;
  const isVeteranRoom = document.getElementById("write-room-type-1").checked;
  const isRandomRoom = document.getElementById("write-room-type-2").checked;
  const isEnvyRoom = document.getElementById("write-room-type-3").checked;
  const isMVRoom = document.getElementById("write-room-type-4").checked;
  const isEnergyUseAllowed = document.getElementById("write-room-type-5").checked;
  const maxPlay = document.querySelector("input[name='write-max-play']:checked").value;
  const playersNeeded = document.querySelector("input[name='write-players-needed']:checked").value;
  const hostRank = document.querySelector("input[name='write-host-rank']:checked").value;
  const guestRank = document.querySelector("input[name='write-guest-rank']:checked").value;
  const stamp1 = document.getElementById("write-stamp-type-1").checked;
  const stamp2 = document.getElementById("write-stamp-type-2").checked;
  const stamp3 = document.getElementById("write-stamp-type-3").checked;

  return {
    roomId,
    isVeteranRoom,
    isRandomRoom,
    isEnvyRoom,
    isMVRoom,
    isEnergyUseAllowed,
    maxPlay,
    playersNeeded,
    hostRank,
    guestRank,
    stamp1,
    stamp2,
    stamp3,
  }
}

function clearWriteModalValues() {
  document.getElementById("write-room-id").value = ""; // roomId
  document.getElementById("write-room-type-1").checked = true; // isVeteranRoom
  document.getElementById("write-room-type-2").checked = false; // isRandomRoom
  document.getElementById("write-room-type-3").checked = false; // isEnvyRoom
  document.getElementById("write-room-type-4").checked = false; // isMVRoom
  document.getElementById("write-room-type-5").checked = true; // isEnergyUseAllowed
  document.querySelectorAll("input[name='write-max-play']").forEach(e => e.checked = false);
  document.querySelectorAll("input[name='write-players-needed']").forEach(e => e.checked = false);
  document.querySelectorAll("input[name='write-host-rank']").forEach(e => e.checked = false);
  document.querySelectorAll("input[name='write-guest-rank']").forEach(e => e.checked = false);
  document.querySelectorAll("input[name='write-max-play']")[2].checked = true; // maxPlay
  document.querySelectorAll("input[name='write-players-needed']")[3].checked = true; // playersNeeded
  document.querySelectorAll("input[name='write-host-rank']")[4].checked = true; // hostRank
  document.querySelectorAll("input[name='write-guest-rank']")[0].checked = true; // guestRank

  document.getElementById("write-stamp-type-1").checked = true;
  document.getElementById("write-stamp-type-2").checked = true;
  document.getElementById("write-stamp-type-3").checked = true;
}

function getRoomModalValues() {
  const maxPlay = document.querySelector("input[name='room-max-play']:checked").value;
  const playersNeeded = document.querySelector("input[name='room-player-needed']:checked").value;

  return {
    maxPlay,
    playersNeeded,
  }
}

function createPostContent() {
  const {
    roomId,
    isVeteranRoom,
    isRandomRoom,
    isEnvyRoom,
    isMVRoom,
    isEnergyUseAllowed,
    maxPlay,
    playersNeeded,
    hostRank,
    guestRank,
  } = __room__;

  let text = "";
  if (isVeteranRoom) {
    text += "ベテラン ";
  }
  if (isMVRoom) {
    text += "3DMV ";
  }
  if (isEnvyRoom) {
    text += "🦐 ";
  }
  if (isRandomRoom) {
    text += "おまかせ ";
  }
  if (isEnergyUseAllowed) {
    text += "火消し ";
  }
  text += maxPlay + "\n\n";
  text += `🔑 ${roomId} ${playersNeeded}\n`
  text += `主 : ${hostRank}\n`;
  text += `募 : ${guestRank}\n\n`;

  text += `一時的な退室 : もう一回みのり\n`;
  text += `解散(主)           : 乙咲希\n`;
  text += `抜ける              : またね系\n\n`;

  // text += `Posted by pjsk pr\n\n`;

  return text;
}

function checkPostContent(content) {
  // fix dupe error
  let count = 0;
  if (/@([0-9])/.test(content)) {
    while(__contents__.indexOf(content) > -1) {
      content = content.replace(/@([0-9])/, function(str, num) {
        return str + num;
      });
  
      count++;
    }
  } else {
    content += "\n" + util.id();
  }

  __contents__.push(content);

  return content;
}

function renderRoomModal() {
  const {
    roomId,
    isVeteranRoom,
    isRandomRoom,
    isEnvyRoom,
    isMVRoom,
    isEnergyUseAllowed,
    maxPlay,
    playersNeeded,
    hostRank,
    guestRank,
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
  optElem.className = "mb-3";
  let opt = "";

  // room settings
  if (isVeteranRoom) {
    opt += `<span class="badge text-bg-primary">ベテラン</span>\n`;
  }
  if (isMVRoom) {
    opt += `<span class="badge text-bg-primary">3DMV</span>\n`;
  }
  if (isEnvyRoom) {
    opt += `<span class="badge text-bg-primary">🦐</span>\n`;
  }
  if (isRandomRoom) {
    opt += `<span class="badge text-bg-primary">おまかせ</span>\n`;
  }
  if (isEnergyUseAllowed) {
    opt += `<span class="badge text-bg-primary">火消し</span>\n`;
  }

  // stats
  opt += `<span class="badge text-bg-warning">主 ${hostRank}</span>\n`;
  opt += `<span class="badge text-bg-warning">募 ${guestRank}</span>\n`;

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

  const maxPlayElem = document.createElement("div");
  maxPlayElem.className = "mb-3";
  for (let i = 1; i < 11; i++) {
    maxPlayElem.innerHTML += `
<div class="form-check form-check-inline">
  <input 
    class="form-check-input" 
    type="radio"
    id="room-max-play-${i}"
    name="room-max-play" 
    value="${i+"回"}" ${maxPlay === i+"回" ? "checked": ""}>
  <label class="form-check-label" for="room-max-play-${i}">${i}回</label>
</div>
    `.trim() + "\n";
  }
  maxPlayElem.innerHTML += `
<div class="form-check form-check-inline">
  <input 
    class="form-check-input" 
    type="radio"
    id="room-max-play-11"
    name="room-max-play" 
    value="周回" ${maxPlay === "周回" ? "checked": ""}>
  <label class="form-check-label" for="room-max-play-11">周回</label>
</div>
  `.trim() + "\n";

  const playersElem = document.createElement("div");
  playersElem.innerHTML = `
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
    value="@4" ${playersNeeded === "@4" ? "checked": ""}>
  <label class="form-check-label" for="room-player-needed-4">@4</label>
</div>
  `.trim() + "\n";

  container.appendChild(optElem);
  container.appendChild(maxPlayElem);
  container.appendChild(playersElem);
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
    if (moment(post.date).valueOf() + EXPIRE_TIME < Date.now()) {
      ids.push(post.roomId);
    }
  }

  __table__.deleteRow(ids);

  if (ids.length > 0) {
    console.log(`${ids.length} posts has been expired.`);
  }
}

function resumeCollector() {
  sendMsg("set-collector", true);
}

function pauseCollector() {
  sendMsg("set-collector", false);
}

function writePost() {
  let content = createPostContent();

  content = checkPostContent(content);

  sendMsg("write-post", content);
}

function updatePost() {
  let content = createPostContent();

  content = checkPostContent(content);

  sendMsg("update-post", content);
}

// get collect response
getMsg("collect", function(err, req, event) {
  if (err) {
    console.error(err);
    return;
  }

  const oldPosts = __table__.getData();

  // covert new posts
  let newPosts = req.map(function(post) {
    return Object.assign(post, parsePostContent(post.content));
  });

  // remove dupe in new posts
  newPosts = newPosts.reduce(function(prev, curr) {
    if (!curr.roomId) {
      return prev;
    }

    if (
      !prev[curr.roomId] || 
      moment(prev[curr.roomId].date).valueOf() < moment(curr.date).valueOf()
    ) {
      prev[curr.roomId] = curr;
    }

    return prev;
  }, {});

  newPosts = Object.values(newPosts);

  newPosts = newPosts.filter(function(newPost) {
    // expired
    if (moment(newPost.date).valueOf() + EXPIRE_TIME < Date.now()) {
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
    if (moment(oldPost.date).valueOf() < moment(newPost.date).valueOf()) {
      return true;
    }
    // invalid post
    return false;
  });

  // console.log("New Posts:", newPosts);

  __table__.updateOrAddData(newPosts);
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
    roomModalTimer = setInterval(function() {
      timeElem.innerHTML = moment.utc(moment.duration(moment().diff(startedAt)).valueOf()).format("HH:mm:ss");
    });

    roomModal.show();
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
});

// open write modal
document.getElementById("write-modal").addEventListener('shown.bs.modal', function(e) {
  // reset input values
  // clearWriteModalValues();
  
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

  writePost();
});

// open room modal
// document.getElementById("room-modal").addEventListener('shown.bs.modal', function(e) {
//   ...
// });

// close room modal
document.getElementById("room-close").addEventListener("click", function(e) {
  // clear room modal timer
  if (roomModalTimer) {
    clearInterval(roomModalTimer);
    roomModalTimer = null;
  }

  resumeCollector();
});

// update room
document.getElementById("room-update").addEventListener("click", function(e) {
  const { maxPlay, playersNeeded } = getRoomModalValues();

  // update
  __room__.maxPlay = maxPlay;
  __room__.playersNeeded = playersNeeded;

  updatePost();
});

document.getElementById("open-git").addEventListener("click", function(e) {
  sendMsg("open-git");
});

document.addEventListener("keydown", function(e) {
  const { shiftKey, key } = e;
  const ctrlKey = e.ctrlKey || e.metaKey;
  if (ctrlKey && !shiftKey && key === "d") {
    e.preventDefault();
    e.stopPropagation();
    sendMsg("debug");
  } else if (ctrlKey && shiftKey && key.toLowerCase() === "i") {
    e.preventDefault();
    e.stopPropagation();
    sendMsg("console");
  }
});

createTable();

// room modal debug
// __room__ = getWriteModalValues();
// __room__.roomId = "39393";
// renderRoomModal();
// roomModal.show()