function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Please login first.');
    return res.redirect('/login');
  }
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      req.flash('error', 'You are not authorised to access this page.');
      return res.redirect('/dashboard');
    }
    next();
  };
}
function redirectIfAuth(req, res, next) {
  if (req.session.user) return res.redirect('/dashboard');
  next();
}
module.exports = { requireAuth, requireRole, redirectIfAuth };
