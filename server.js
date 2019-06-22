const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track', { useNewUrlParser: true });

// Check if mongoose up and running
console.log(mongoose.connection.readyState);

// User Schema & Model
const userSchema = new mongoose.Schema({ 
  username: String 
});
const UserModel = mongoose.model('UserModel', userSchema);

// Exercise Schema & Model
const exerciseSchema = new mongoose.Schema({ 
  userId: String,
  description: String, 
  duration: Number,
  date: String
});
const ExerciseModel = mongoose.model('ExerciseModel', exerciseSchema);

// Tomorrow calculation
const today = new Date();
const tomorrow = new Date();
tomorrow.setDate(today.getDate()+1);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// Create New User Endpoint
app.post('/api/exercise/new-user', (req, res) => {
  const { body: { username }} = req
  
  const user = new UserModel({ username: username });
  
  user
    .save()
    .then(({ username, _id }) => { res.json({ username, _id }) })
    .catch(error => { console.log('error: ', error); res.json({ error }); })
})

// Fetch All Users Endpoint
app.get('/api/exercise/users', (req, res) => {
  UserModel
    .find({})
    .select('-__v')
    .then(users => { res.json(users) })
    .catch(error => { console.log('error: ', error); res.json({ error }); })
})

// Add New Exercise Endpoint
app.post('/api/exercise/add', async (req, res) => {
  const { body: { userId, description, duration, date }} = req;
  
  // Handle date value 
  const dateSource = date === '' ? new Date : new Date(date)
  const dateTimeStamp = dateSource.getTime();
  
  // Initiate base result data
  let result = { description, duration, date: dateSource.toISOString().substring(0, 10) };
  
  await UserModel
    .findById(userId)
    .then(({ _id, username }) => { result._id = _id; result.username = username; })
    .catch(error => { console.log('error: ', error); res.json({ error }); return; })
  
  const exercise = new ExerciseModel({ userId, description, duration, date: dateTimeStamp });
  
  exercise
    .save()
    .then(() => { res.json(result) })
    .catch(error => { console.log('error: ', error); res.json({ error }); })
})

// Log Exercises Endpoint
app.get('/api/exercise/log', async (req, res) => {
  const { query: { userId, from = '1970-01-01', to = tomorrow, limit = 0 } } = req
  
  // Initiate base result data
  let result = { _id: userId }
  
  await UserModel
    .findById(userId)
    .then(({ username }) => { result.username = username })
    .catch(error => { console.log('error 1: ', error); res.json({ error }); return; })
  
  // Date Timestamp to partial ISO converter
  const exerciseDateFormatHandler = ({ exercises }) => (
    exercises.map(({ date, description, duration }) => ({ date: new Date(parseInt(date)).toISOString().substring(0, 10), description, duration }))
  )
  
  await ExerciseModel
    .find({ userId, date: { "$gte": new Date(from).getTime(), "$lt": new Date(to).getTime() } })
    .limit(parseInt(limit))
    .select('-_id -userId -__v')
    .sort({ date: 'asc' })
    .then(exercises => { result.count = exercises.length; result.log = exerciseDateFormatHandler({ exercises }) })
    .catch(error => { console.log('error 2: ', error); res.json({ error }); return; })
  
  res.json({ ...result })
})

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
