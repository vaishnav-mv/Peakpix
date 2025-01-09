const setHeader = (req, res, next) => {
    res.locals.header = req.session.user ? "partials/login_header" : "partials/header";
    next();
};

module.exports = { setHeader };
