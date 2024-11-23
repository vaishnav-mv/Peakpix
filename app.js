const express = require('express')
const app = express()
const path = require('path')
const env = require('dotenv').config()
const db = require('./config/db')
const userRouter = require('./routes/userRouter')
db()

app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.set('view engine','ejs')
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')])
app.use(express.static(path.join(__dirname,'public')))

app.use('/',userRouter)

const PORT = 3000 || process.env.PORT
app.listen(PORT,()=>{
    console.log("server running")
}) 

module.exports = app