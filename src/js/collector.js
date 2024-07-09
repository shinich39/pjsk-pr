const {
  contextBridge,
  ipcRenderer,
} = require('electron');

const LOADING_TIME = 2000;
const MIN_INIT_TIME = 3000;
const MAX_INIT_TIME = 6000;
const MIN_REFRESH_TIME = 4000;
const MAX_REFRESH_TIME = 12000;

let inProgress = false,
    toggle = false, 
    count = 0,
    COUNT_RELOAD = 39;

window.addEventListener('DOMContentLoaded', async function() {
  // init
  inProgress = true;
  
  await wait(Math.floor(random(MIN_INIT_TIME, MAX_INIT_TIME)));

  while(count < 4) {
    if (inProgress) {
      down(Math.floor(random(1024, 2048)));
      await wait(LOADING_TIME);
      await sendPosts();
      count++;
    }
    await wait(Math.floor(random(MIN_INIT_TIME, MAX_INIT_TIME)));
  }

  down(Math.floor(random(1024, 2048)));
  await wait(LOADING_TIME);
  await sendPosts();

  toggle = false;
  count = 0;
  while(true) {
    if (inProgress) {
      if (count < 4) {
        if (toggle) {
          scrollToBottom();
        } else {
          scrollToTop();
        }

        await wait(LOADING_TIME);
        await sendPosts();
      } else {
        if (toggle) {
          down(Math.floor(random(1024, 2048)));
        } else {
          scrollToTop();
          await wait(LOADING_TIME);
          await sendPosts();
        }
      }

      toggle = !toggle;
      count++;
      
      if (count > COUNT_RELOAD) {
        location.reload();
      }
    }
    await wait(Math.floor(random(MIN_REFRESH_TIME, MAX_REFRESH_TIME)));
  }
});

getMsg("set-collector", function(err, req) {
  inProgress = !!req;
  if (inProgress) {
    console.log("Resume a process.");
  } else {
    console.log("Pause a process.");
  }
});

function sendMsg(channel, req) {
  ipcRenderer.send(channel, null, req);
}

function sendErr(channel, err) {
  ipcRenderer.send(channel, err);
}

function getMsg(channel, listener) {
  ipcRenderer.on(channel, function(event, err, req) {
    return listener(err, req, event);
  });
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function getCurrentPosition() {
  return document.documentElement.scrollTop || document.body.scrollTop;
}

function up(n) {
  window.scrollTo({
    top: getCurrentPosition() - n,
    behavior: 'smooth',
  });
}

function down(n) {
  window.scrollTo({
    top: getCurrentPosition() + n,
    behavior: 'smooth',
  });
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
}

function scrollToBottom() {
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: 'smooth',
  });
}

function wait(delay) {
  return new Promise(function(resolve) {
    return setTimeout(resolve, delay);
  });
}

async function sendPosts() {
  const posts = await getPosts();
  sendMsg("collect", posts);
  console.log(`Sent ${posts.length} posts`);
}

async function getPosts() {
  function getPostId(post) {
    const elem = Array.prototype.slice.call(post.querySelectorAll("a[role='link']"))
      .find(function(item) {
        return /\/status\/[0-9]+$/.test(item.href);
      });
  
    return elem ? elem.href.replace(/.+\/status\//, "") : null;
  }

  function getUser(post) {
    const elem = post.querySelector("div[data-testid='User-Name']");

    const username = elem.children[0]?.innerText;
    const userId = elem.children[1]?.children[0]?.children[0]?.innerText;

    return {
      userId,
      username,
    }
  }

  function getDate(post) {
    const elem = post.querySelector("time");
    return elem ? elem.getAttribute("datetime") : null;
  }
  
  function getContentText(post) {
    const elem = post.querySelector("div[data-testid='tweetText']");
    return elem ? elem.innerText : null;
  }

  function getContentHTML(post) {
    const elem = post.querySelector("div[data-testid='tweetText']");
    return elem ? elem.innerHTML : null;
  }

  const posts = document.querySelectorAll("article[role='article']");
  const result = [];
  for (const post of posts) {
    const postId = getPostId(post);
    const { userId, username } = getUser(post);
    const content = getContentText(post);
    const html = getContentHTML(post);
    const date = getDate(post);
    if (postId && userId.indexOf("@") === 0 && date) {
      result.push({ postId, userId, username, content, html, date });
    }
  }

  return result;
}