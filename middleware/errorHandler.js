const notFound = (req,res,next)=>{
    res.status(404)
    const error = new Error(`Not Found:${req.originalUrl}`)
    next(error)
}

const errorHandler = async(err,req,res,next)=>{
    const statusCode = res.statusCode
    if(statusCode===404){
        res.render('404',{ title: '404 - Page Not Found', errorMessage: err.message })
    }else{
        console.log('error.message:',err);
        console.log('errorstack.message:',err.stack);
        res.render('error', { title: '500 - Server Error', errorMessage: err.message, stack: process.env.NODE_ENV === 'production' ? null : err.stack })
    }
}

module.exports = {notFound,errorHandler}