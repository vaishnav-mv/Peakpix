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

// Prevent caching by setting headers
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
})

// Configure session middleware with MongoDB store
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 24 * 60 * 60, // Session TTL (1 day)
        autoRemove: 'native',
        touchAfter: 24 * 3600 // Time period in seconds between session updates
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        domain: process.env.NODE_ENV === 'production' ? '.peakpix.shop' : undefined
    },
    name: 'sessionId'
}));

// Session debugging middleware
app.use((req, res, next) => {
    console.log('Session Data:', {
        sessionID: req.sessionID,
        user: req.session.user,
        tempUser: req.session.tempUser,
        otp: req.session.otp,
        otpExpiry: req.session.otpExpiry,
        cookie: req.session.cookie
    });
    next();
});

// Session initialization check
app.use((req, res, next) => {
    if (!req.session) {
        return next(new Error('Session initialization failed'));
    }
    next();
});

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
    app.listen(PORT, () => {
        console.log(`Server is running on https://peakpix.shop/`);
    })
})
.catch(err => {
    console.error("Database connection failed:", err)
    process.exit(1)
})
