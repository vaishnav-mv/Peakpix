const express = require('express')
const path = require('path')
const connectDB = require('./config/database')
const session = require("express-session")
const MongoStore = require('connect-mongo')
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



// Configure session middleware with MongoDB store
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
    },
    
}));


app.get('/favicon.ico', (req, res) => res.status(204).end());

// Routes
app.use('/', userRouter)
app.use('/account', accountRouter)
app.use('/admin', adminRouter)
app.use('/shop', shopRouter)
app.use('/checkout', checkoutRouter)


app.use(errorHandler)
app.use(notFound)

// Connect to database and start server
connectDB()
.then(() => {
    console.log("Database connection established")
    console.log("MongoDB URL:", process.env.MONGODB_URL);
    app.listen(PORT, () => {
        console.log(`Server is running on https://peakpix.shop/`);
    })
})
.catch(err => {
    console.error("Database connection failed:", err)
    process.exit(1)
})
