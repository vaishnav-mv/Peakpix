const express = require('express')
const path = require('path')
const connectDB = require('./config/database')
const session = require("express-session")
require('dotenv').config()
const {notFound,errorHandler} = require('./middleware/errorHandler')
const userRouter = require('./routes/user')
const accountRouter = require('./routes/account')
const adminRouter = require('./routes/admin')
const shopRouter = require('./routes/shop')
const checkoutRouter = require('./routes/checkout')


const PORT = process.env.PORT || 3000
const app = express()

app.set('view engine','ejs')
app.set('views',path.join(__dirname,'views'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, "public")))


// Prevent caching by setting headers
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  })

//configure session middleware
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:false,
    cookie:{
        maxAge:1000*60*60*24,
        secure:process.env.NODE_ENV==='production',
        httpOnly:true
    }
}))

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.use('/',userRouter)
app.use('/account',accountRouter)
app.use('/admin',adminRouter)
app.use('/shop',shopRouter)
app.use('/checkout', checkoutRouter)

app.use(errorHandler)
app.use(notFound)



connectDB()
.then(()=>{
    console.log("Database connection established")
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
      })
})
