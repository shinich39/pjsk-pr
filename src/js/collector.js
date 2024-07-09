const {
  contextBridge,
  ipcRenderer,
} = require('electron');

const LOADING_TIME = 1000 * 2;
const MIN_REFRESH_TIME = 1000 * 5;
const MAX_REFRESH_TIME = 1000 * 20;
const MIN_RESTING_TIME = 1000 * 60 * 2; // 2 min
const MAX_RESTING_TIME = 1000 * 60 * 4; // 4 min
const RESTING_UNIT = 1000 * 60; // 1 min
const EXPIRE_TIME = 1000 * 60 * 60; // a hour

let body,
    inProgress = true,
    isExpiredOldPost = false, 
    isScrollUp = false,
    countNotChanged = 0,
    newestPost = null,
    oldestPost = null,
    isUpdatedNewPost = false,
    isUpdatedOldPost = false;

window.addEventListener('DOMContentLoaded', async function() {
  console.log("Collector loaded.");

  // set scroll target
  body = document.querySelector('main[role="main"]');
  if (!body) {
    body = window;
  }

  await wait(LOADING_TIME);

  while(true) {
    // reset
    isUpdatedNewPost = false;
    isUpdatedOldPost = false;

    if (inProgress) {

      // scroll
      if (!isScrollUp) {
        if (isExpiredOldPost) {
          scrollDown(Math.floor(random(1024, 2048)));
        } else {
          scrollToBottom();
        }
        // console.log("Scroll down.");
      } else {
        scrollToTop();
        // console.log("Scroll up.");
      }

      // send posts
      await wait(LOADING_TIME);
      const posts = await getPosts();
      sendMsg("collect", posts);
      console.log(`Sent ${posts.length} posts.`);

      // logging
      if (isScrollUp) {
        if (isUpdatedNewPost) {
          console.log("New posts has been updated.");
        } else {
          console.log(`New posts not updated.`);
        }
      } else {
        if (isUpdatedOldPost) {
          console.log("Old posts has been updated.");
        } else {
          if (!isExpiredOldPost) {
            console.log(`Old posts not updated.`);
          } else {
            console.log("No more update old post.");
          }
        }
      }

      isScrollUp = !isScrollUp;
    } else {
      console.log("Not in progess.");
    }

    console.log(`Count left ${countNotChanged} until resting time.`);

    if (!isUpdatedNewPost && !isUpdatedOldPost && countNotChanged > 2) {
      countNotChanged = 0;
      const t = Math.floor(random(MIN_RESTING_TIME, MAX_RESTING_TIME));
      console.log(`Getting resting time. ${t} ms`);
      await wait(t);
    } else {
      const t = Math.floor(random(MIN_REFRESH_TIME, MAX_REFRESH_TIME));
      console.log(`Getting refresh time. ${t} ms`);
      await wait(t);
    }
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

function scrollUp(n) {
  body.scrollTo({
    top: getCurrentPosition() - n,
    behavior: 'smooth',
  });
}

function scrollDown(n) {
  body.scrollTo({
    top: getCurrentPosition() + n,
    behavior: 'smooth',
  });
}

function scrollToTop() {
  body.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
}

function scrollToBottom() {
  body.scrollTo({
    top: document.body.scrollHeight,
    behavior: 'smooth',
  });
}

function wait(delay) {
  return new Promise(function(resolve) {
    return setTimeout(resolve, delay);
  });
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

  function parseImg(post) {
    const imgs = post.querySelectorAll("img");
    for (const img of imgs) {
      const alt = img.getAttribute("alt");
      if (alt) {
        const span = document.createElement("span");
        span.innerHTML = alt;
        img.replaceWith(span);
      }
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
    parseImg(post);
    const postId = getPostId(post);
    const { userId, username } = getUser(post);
    const content = getContentText(post);
    const html = getContentHTML(post);
    const date = getDate(post);
    if (postId && userId.indexOf("@") === 0 && date) {
      const newPost = { postId, userId, username, content, html, date };
      
      if (!newestPost || new Date(newestPost.date).valueOf() < new Date(newPost.date).valueOf()) {
        newestPost = newPost;
        isUpdatedNewPost = true;
      }

      if (!isExpiredOldPost) {
        if (!oldestPost || new Date(oldestPost.date).valueOf() > new Date(newPost.date).valueOf()) {
          oldestPost = newPost;
          isUpdatedOldPost = true;
          if (new Date(newPost.date).valueOf() + EXPIRE_TIME < new Date().valueOf()) {
            isExpiredOldPost = true;
          }
        }
      }

      // add a new post
      result.push(newPost);
    }
  }

  if (isScrollUp) {
    if (isUpdatedNewPost) {
      countNotChanged = 0;
    } else {
      countNotChanged += 1;
    }
  } else if (!isScrollUp && !isExpiredOldPost) {
    if (isUpdatedOldPost) {
      countNotChanged = 0;
    } else {
      countNotChanged += 1;
    }
  }

  return result;
}