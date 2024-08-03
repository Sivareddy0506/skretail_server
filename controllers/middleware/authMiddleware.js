// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'Mwx0uSd0fF5hGNDWZ3T+ohGZFhMOn+RwF30jO39n+5w='; // Replace with your secret key for JWT


const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Token verification error:', err);
            return res.sendStatus(403); // Forbidden
        }
        req.user = user;
        next();
    });
};

module.exports = authenticateToken;
