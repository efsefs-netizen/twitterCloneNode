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

app.post('/register/', authenticateToken, async (request, response) => {
  const {username, name, password, gender, location} = request.body
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
      const dbResponse = await db.run(createUserQuery)
      //const newUserId = dbResponse.lastID
      response.send(`User created successfully`)
    } else {
      response.status(400)
      response.send('Password is too short')
    }
  } else {
    response.status = 400
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
    response.send('Invalid User')
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
      response.send('Invalid Password')
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
   WHERE tweet.user_id IN (${userIDs})`
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

