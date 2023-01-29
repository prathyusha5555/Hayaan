const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
let database;
const dbpath = path.join(__dirname, "twitterClone.db");
const app = express();
app.use(express.json());

const initializeDBandServer = async () => {
  try {
    database = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log(`Server Running at http://localhost:3000/`)
    );
  } catch (e) {
    console.log(`DB Error:'${e.message}'`);
    process.exit(1);
  }
};
initializeDBandServer();
//user registration api
app.post("/register/", async (request, response) => {
  const { name, username, password, gender } = request.body;
  const selectUserQuery = `SELECT * FROM user where username='${username}';`;
  const userObj = await database.get(selectUserQuery);
  if (userObj !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hasedPassword = await bcrypt.hash(password, 10);
      const addUseQuery = `INSERT INTO user(name,username,password,gender)
            VALUES ('${name}','${username}','${hasedPassword}','${gender}');`;
      await database.run(addUseQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});
//user login api
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user where username='${username}';`;
  const userObj = await database.get(selectUserQuery);
  if (userObj !== undefined) {
    let isPasswordMatch = await bcrypt.compare(password, userObj.password);
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secret");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});
//authentication with jwt token
const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "secret", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};
//3 tweets api
app.get("/user/tweets/feed/", authentication, async (request, response) => {
  try {
    let { username } = request;
    const getUserIdQuery = `SELECT user_id from user
    where username='${username}';`;
    const userIdObj = await database.get(getUserIdQuery);
    //console.log(userId);
    let userId = userIdObj.user_id;
    const tweetsQuery = `SELECT user.username as username,tweet,date_time as dateTime
    from (follower inner join tweet on follower.following_user_id=tweet.user_id)as T 
    inner join user on T.user_id=user.user_id
    where T.follower_user_id='${userId}'
    order by date_time desc
    limit 4;`;
    const result = await database.all(tweetsQuery);
    //console.log(result);
    response.send(result);
  } catch (e) {
    console.log(e.message);
  }
});
//get all names of people whom the user follows api
app.get("/user/following/", authentication, async (request, response) => {
  try {
    let { username } = request;
    const getUserIdQuery = `SELECT user_id from user
    where username='${username}';`;
    const userIdObj = await database.get(getUserIdQuery);
    let userId = userIdObj.user_id;
    const getAllNamesUserFollowsQuery = `SELECT name
     from user inner join follower on user.user_id=follower.following_user_id
     where follower.follower_user_id='${userId}';`;
    const resultArray = await database.all(getAllNamesUserFollowsQuery);
    response.send(resultArray);
  } catch (e) {
    console.log(e.message);
  }
});
//get followers api5
app.get("/user/followers/", authentication, async (request, response) => {
  try {
    let { username } = request;
    const getUserIdQuery = `SELECT user_id from user
    where username='${username}';`;
    const userIdObj = await database.get(getUserIdQuery);
    let userId = userIdObj.user_id;
    const getAllNamesUserFollowersQuery = `SELECT name
     from user inner join follower on user.user_id=follower.follower_user_id
     where follower.following_user_id='${userId}';`;
    const resultArray = await database.all(getAllNamesUserFollowersQuery);
    response.send(resultArray);
  } catch (e) {
    console.log(e.message);
  }
});
//api 6 get tweet info
const api6Output = (tweetData, likesCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.date_time,
  };
};

app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;
  let { username } = request;
  const getUserIdQuery = `SELECT user_id from user
    where username='${username}';`;
  const userIdObj = await database.get(getUserIdQuery);
  let userId = userIdObj.user_id;
  const getTweetsIdsQuery = `select tweet_id
    from tweet inner join follower on tweet.user_id=follower.following_user_id
    where follower.follower_user_id='${userId}';`;
  const tweetIdsArray = await database.all(getTweetsIdsQuery);
  //console.log(tweetIdsArray);

  const followingTweetIds = tweetIdsArray.map((eachId) => {
    return eachId.tweet_id;
  });
  //console.log(followingTweetIds);
  //console.log(followingTweetIds.includes(parseInt(tweetId)));
  if (followingTweetIds.includes(parseInt(tweetId))) {
    const likesCountQuery = `select count(user_id) as likes
      from like
      where tweet_id=${tweetId};`;
    const likesCount = await database.get(likesCountQuery);
    console.log(likesCount);

    const replyCountQuery = `select count(user_id) as replies
      from reply
      where tweet_id=${tweetId};`;
    const replyCount = await database.get(replyCountQuery);
    console.log(replyCount);

    const tweet_tweetDateQuery = `select tweet,date_time
      from tweet
      where tweet_id=${tweetId};`;
    const tweet_tweetDate = await database.get(tweet_tweetDateQuery);
    console.log(tweet_tweetDate);
    response.send(api6Output(tweet_tweetDate, likesCount, replyCount));
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
//get list of users likes tweet api7
const getApi7ResponsiveObj = (array) => {
  return { likes: array };
};

app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const getUserIdQuery = `SELECT user_id from user
    where username='${username}';`;
    const userIdObj = await database.get(getUserIdQuery);
    let userId = userIdObj.user_id;
    const getTweetsIdsQuery = `select tweet_id
    from tweet inner join follower on tweet.user_id=follower.following_user_id
    where follower.follower_user_id='${userId}';`;
    const tweetIdsArray = await database.all(getTweetsIdsQuery);
    //console.log(tweetIdsArray);

    const followingTweetIds = tweetIdsArray.map((eachId) => {
      return eachId.tweet_id;
    });
    //console.log(followingTweetIds);
    //console.log(followingTweetIds.includes(parseInt(tweetId)));
    if (followingTweetIds.includes(parseInt(tweetId))) {
      const getUsersLikeTweetQuery = `SELECT username
      from user inner join like on user.user_id=like.user_id
      where like.tweet_id=${tweetId};`;
      const namesObjArray = await database.all(getUsersLikeTweetQuery);
      //console.log(namesArray);
      const namesArray = namesObjArray.map((eachObj) => {
        return eachObj.username;
      });
      console.log(namesArray);
      response.send(getApi7ResponsiveObj(namesArray));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
//get replies for a tweet api 8
const getApi8ResponsiveObj = (array) => {
  return { replies: array };
};

app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const getUserIdQuery = `SELECT user_id from user
    where username='${username}';`;
    const userIdObj = await database.get(getUserIdQuery);
    let userId = userIdObj.user_id;
    const getTweetsIdsQuery = `select tweet_id
    from tweet inner join follower on tweet.user_id=follower.following_user_id
    where follower.follower_user_id='${userId}';`;
    const tweetIdsArray = await database.all(getTweetsIdsQuery);
    //console.log(tweetIdsArray);

    const followingTweetIds = tweetIdsArray.map((eachId) => {
      return eachId.tweet_id;
    });
    //console.log(followingTweetIds);
    //console.log(followingTweetIds.includes(parseInt(tweetId)));
    if (followingTweetIds.includes(parseInt(tweetId))) {
      const getRepliesOnTweetQuery = `SELECT username as name,reply
      from user inner join reply on user.user_id=reply.user_id
      where reply.tweet_id=${tweetId};`;
      const obj = await database.all(getRepliesOnTweetQuery);
      //console.log(obj);
      response.send(getApi8ResponsiveObj(obj));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
//api9 list of tweets of user
app.get("/user/tweets/", authentication, async (request, response) => {
  try {
    let { username } = request;
    const getUserIdQuery = `SELECT user_id from user
    where username='${username}';`;
    const userIdObj = await database.get(getUserIdQuery);
    let userId = userIdObj.user_id;
    const getTweetsQuery = `select tweet,count(T.user_id) as likes,
    count(reply.user_id) as replies,tweet.date_time as dateTime 
    FROM (tweet inner join like on tweet.tweet_id=like.tweet_id) as T 
    inner join reply on T.tweet_id=reply.tweet_id
    where tweet.user_id=${userId}
    group by tweet.tweet_id;`;
    let obj = await database.all(getTweetsQuery);
    response.send(obj);
  } catch (e) {
    console.log(e.message);
  }
});
//add tweet
app.post("/user/tweets/", authentication, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await database.get(getUserIdQuery);
  //console.log(getUserId.user_id);
  const { tweet } = request.body;
  //console.log(tweet);
  //const currentDate = format(new Date(), "yyyy-MM-dd HH-mm-ss");
  const currentDate = new Date();
  console.log(currentDate.toISOString().replace("T", " "));

  const postRequestQuery = `insert into tweet(tweet, user_id, date_time) values ("${tweet}", ${getUserId.user_id}, '${currentDate}');`;

  const responseResult = await database.run(postRequestQuery);
  const tweet_id = responseResult.lastID;
  response.send("Created a Tweet");
});
//API11
app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;
  //console.log(tweetId);
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await database.get(getUserIdQuery);
  //console.log(getUserId.user_id);
  //tweets made by the user
  const getUserTweetsListQuery = `select tweet_id from tweet where user_id=${getUserId.user_id};`;
  const getUserTweetsListArray = await database.all(getUserTweetsListQuery);
  const getUserTweetsList = getUserTweetsListArray.map((eachTweetId) => {
    return eachTweetId.tweet_id;
  });
  console.log(getUserTweetsList);
  if (getUserTweetsList.includes(parseInt(tweetId))) {
    const deleteTweetQuery = `delete from tweet where tweet_id=${tweetId};`;
    await database.run(deleteTweetQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
