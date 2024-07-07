const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const app = express()
app.use(express.json())

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbPath = path.join(__dirname, 'twitterClone.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

//api1

app.post('/register/', async (request, response) => {
  const {username, name, password, gender} = request.body
  const hashedPassword = await bcrypt.hash(request.body.password, 10)
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    if (password.length > 6) {
      const createUserQuery = `
        INSERT INTO 
          user (username, name, password, gender) 
        VALUES 
          (
            '${username}', 
            '${name}',
            '${hashedPassword}', 
            '${gender}'
          )`
      await db.run(createUserQuery)

      response.status(200)
      response.send(`User created successfully`)
    } else {
      response.status(400)
      response.send('Password is too short')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

//api2

app.post('/login', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//api3

app.get('/user/tweets/feed', authenticateToken, async (request, response) => {
  const {username} = request
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const getUser = await db.get(getUserQuery)
  //response.send(getUser)
  const isFollowingQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = '${getUser.user_id}'`
  const isFollowing = await db.all(isFollowingQuery)
  //response.send(isFollowing)
  let userIDs = []
  for (let userId of isFollowing) {
    userIDs.push(userId.following_user_id)
  }
  const getTweetsQuery = `SELECT username,tweet,date_time FROM tweet
   inner join user on tweet.user_id = user.user_id
   WHERE tweet.user_id IN (${userIDs}) ORDER BY date_time DESC LIMIT 4`
  const getTweets = await db.all(getTweetsQuery)
  response.send(getTweets)
})

//api4

app.get('/user/following/', authenticateToken, async (request, response) => {
  const {username} = request
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const getUser = await db.get(getUserQuery)
  //response.send(getUser)
  const isFollowingQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = '${getUser.user_id}'`
  const isFollowing = await db.all(isFollowingQuery)
  //response.send(isFollowing)
  let userIDs = []
  for (let userId of isFollowing) {
    userIDs.push(userId.following_user_id)
  }
  const getTweetsQuery = `SELECT name FROM user
   WHERE user_id IN (${userIDs})`
  const getTweets = await db.all(getTweetsQuery)
  response.send(getTweets)
})

//api5

app.get('/user/followers/', authenticateToken, async (request, response) => {
  const {username} = request
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const getUser = await db.get(getUserQuery)
  //response.send(getUser)
  const isFollowingQuery = `SELECT follower_user_id FROM follower WHERE following_user_id = '${getUser.user_id}'`
  const isFollowing = await db.all(isFollowingQuery)
  //response.send(isFollowing)
  let userIDs = []
  for (let userId of isFollowing) {
    userIDs.push(userId.follower_user_id)
  }
  const getTweetsQuery = `SELECT name FROM user
   WHERE user_id IN (${userIDs})`
  const getTweets = await db.all(getTweetsQuery)
  response.send(getTweets)
})

//api6

app.get('/tweets/:tweetId/', authenticateToken, async (request, response) => {
  const {username} = request
  const tweetId = request.params.tweetId
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const getUser = await db.get(getUserQuery)
  //response.send(getUser)
  const isFollowingQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = '${getUser.user_id}'`
  const isFollowing = await db.all(isFollowingQuery)
  //response.send(isFollowing)

  if (isFollowing === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    const getTweetQuery = `SELECT tweet,date_time as dateTime FROM tweet WHERE tweet_id = ${tweetId}`
    const tweetobj = await db.get(getTweetQuery)
    //response.send(tweetobj)

    const getLikesQuery = `SELECT count(*) AS likes from like WHERE tweet_id = ${tweetId}`
    const likeObj = await db.get(getLikesQuery)
    //response.send(likeObj)

    const getRepliesQuery = `SELECT count(*) as replies from reply WHERE tweet_id = ${tweetId}`
    const repliesObj = await db.get(getRepliesQuery)
    //response.send(repliesObj)

    response.send({
      tweet: tweetobj.tweet,
      likes: likeObj.likes,
      replies: repliesObj.replies,
      dateTime: tweetobj.dateTime,
    })
  }
})

//api7
app.get(
  '/tweets/:tweetId/likes',
  authenticateToken,
  async (request, response) => {
    const {username} = request
    const tweetId = request.params.tweetId
    const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`
    const getUser = await db.get(getUserQuery)
    //response.send(getUser)
    const isFollowingQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = '${getUser.user_id}'`
    const isFollowing = await db.all(isFollowingQuery)
    //response.send(isFollowing)

    if (isFollowing === undefined) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const getLikesQuery = `SELECT user_id from like WHERE tweet_id = ${tweetId}`
      const likeObj = await db.all(getLikesQuery)
      //response.send(likeObj)

      let userIDs = []
      for (let userId of likeObj) {
        userIDs.push(userId.user_id)
      }

      const getTweetsQuery = `SELECT name FROM user
      WHERE user_id IN (${userIDs})`
      let getTweets = await db.all(getTweetsQuery)
      getTweets = getTweets.map(getName => {
        return getName.name
      })
      response.send({
        name: getTweets,
      })
    }
  },
)

//api8

app.get(
  '/tweets/:tweetId/replies',
  authenticateToken,
  async (request, response) => {
    const {username} = request
    const tweetId = request.params.tweetId
    const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`
    const getUser = await db.get(getUserQuery)
    //response.send(getUser)
    const isFollowingQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = '${getUser.user_id}'`
    const isFollowing = await db.all(isFollowingQuery)
    //response.send(isFollowing)

    if (isFollowing === undefined) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const getRepliesQuery = `SELECT name,reply from reply
      INNER JOIN user on reply.user_id = user.user_id
      WHERE tweet_id = ${tweetId}`
      const repliesObj = await db.all(getRepliesQuery)
      response.send({replies: repliesObj})
    }
  },
)

//api9

app.get('/user/tweets/', authenticateToken, async (request, response) => {
  const {username} = request

  const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const getUser = await db.get(getUserQuery)
  //response.send(getUser)

  const getTweetQuery = `SELECT tweet_id,tweet,date_time as dateTime FROM tweet WHERE user_id = ${getUser.user_id}`
  const tweetobj = await db.all(getTweetQuery)
  //response.send(tweetobj)
  let userTweets = []
  for (let tweet of tweetobj) {
    //console.log(tweet)
    const getLikesQuery = `SELECT count(*) AS likes from like WHERE tweet_id = ${tweet.tweet_id}`
    const likeObj = await db.get(getLikesQuery)
    //response.send(likeObj)

    const getRepliesQuery = `SELECT count(*) as replies from reply WHERE tweet_id = ${tweet.tweet_id}`
    const repliesObj = await db.get(getRepliesQuery)
    //response.send(repliesObj)

    userTweets.push({
      tweet: tweet.tweet,
      likes: likeObj.likes,
      replies: repliesObj.replies,
      dateTime: tweet.dateTime,
    })
  }

  response.send(userTweets)
})

//api10

app.post('/user/tweets/', authenticateToken, async (request, response) => {
  const {username} = request
  const {tweet} = request.body

  const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const getUser = await db.get(getUserQuery)
  //response.send(getUser)

  const createTweetQuery = `INSERT INTO tweet(tweet,user_id) VALUES('${tweet.tweet}',${getUser.user_id})`
  await db.run(createTweetQuery)

  response.send('Created a Tweet')
})

//api11

app.delete(
  '/tweets/:tweetId/',
  authenticateToken,
  async (request, response) => {
    const {username} = request
    const tweetId = request.params.tweetId

    const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`
    const getUser = await db.get(getUserQuery)

    const getTweetQuery = `SELECT * FROM tweet WHERE tweet_id = ${tweetId}`
    const tweet = await db.get(getTweetQuery)
    if (tweet.user_id === getUser.user_id) {
      const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id = ${tweetId}`
      await db.run(deleteTweetQuery)
      response.send('Tweet Removed')
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

module.exports = app
