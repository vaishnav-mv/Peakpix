const express = require('express')
const userRouter = express.Router()
const passport = require("passport")
const {userAuth} = require("../middleware/userAuth")
const User = require('../models/user.js')

require('../services/passport.js')

const {sendOtp,resendOtp,verifyAndSignUp,successGoogleLogin,failureGoogleLogin,loginUser,logoutUser,resetPassword} = require('../controllers/userController')


userRouter.use(passport.initialize())
userRouter.use(passport.session())

// Google OAuth routes
userRouter.get('/auth/google' , passport.authenticate('google', { scope: 
	[ 'email', 'profile' ] 
})); 

// Auth Callback 
userRouter.get('/auth/google/callback', 
	passport.authenticate( 'google', { 
		successRedirect: '/success', 
		failureRedirect: '/failure'
}));

// Success 
userRouter.get('/success' , successGoogleLogin); 

// failure 
userRouter.get('/failure' , failureGoogleLogin);

userRouter.get('/',(req,res)=>{
    res.render('layout',{
        title:'Peakpix',
        header:req.session.user ? 'partials/login_header' : 'partials/header',
        viewName: 'user/home',
        activePage: 'home',
        isAdmin: false
    })
})

userRouter.get('/signup',(req,res)=>{
    if(req.session.user){
        return res.redirect('/') //if return is not given, it will execute the remaining code
    }
    res.render('layout',{
        title:'Sign Up',
        header:'partials/header',
        viewName:'user/signup',
        activePage:'home',
        isAdmin:false
    })
})

userRouter.post('/signup',sendOtp)

userRouter.get('/signup/resend-otp', resendOtp)

userRouter.post('/verify-otp',verifyAndSignUp)

userRouter.get("/login", (req, res) => {
    if (req.session.user) {
      return res.redirect("/");
    }
    res.render("layout", {
      title: "Login",
      header: "partials/header",
      viewName: "user/login",
      activePage: "home",
      isAdmin: false,
    });
  });
  
userRouter.post("/login", loginUser);

userRouter.get('/login/forgot-password', (req, res) => {
    res.render("layout", {
      title: "Login",
      header: "partials/header",
      viewName: "user/forgotPassword",
      activePage: "home",
      isAdmin: false,
    });
  });
  
  
userRouter.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    req.session.email = email;
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).send('Email not found');
      }
      
      res.render("layout", {
        title: "Login",
        header: "partials/header",
        viewName: "user/resetPassword",
        activePage: "home",
        isAdmin: false,
      });
    } catch (err) {
      res.status(500).send('Server error');
    }
  });

userRouter.post('/login/reset-password', resetPassword)

userRouter.post("/logout", userAuth, logoutUser)

module.exports = userRouter