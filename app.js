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
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        secure: process.env.NODE_ENV === 'production', // Only set to true if using HTTPS
        httpOnly: true,
        sameSite: 'lax',
        domain: process.env.NODE_ENV === 'production' ? '.peakpix.shop' : undefined // Add your domain in production
    },
    name: 'sessionId', // Custom name for the session cookie
}));

// Add this middleware to log session data (for debugging)
app.use((req, res, next) => {
    console.log('Session Data:', {
        sessionID: req.sessionID,
        user: req.session.user,
        tempUser: req.session.tempUser,
        otp: req.session.otp,
        otpExpiry: req.session.otpExpiry
    });
    next();
});

// Add this before your routes
app.use((req, res, next) => {
    if (!req.session) {
        return next(new Error('Session initialization failed'));
    }
    next();
});
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
        console.log(`Server is running on https://peakpix.shop/`);
      })
})
