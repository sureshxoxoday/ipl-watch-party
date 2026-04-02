const { Router } = require('express');
const router = Router();

router.use('/auth', require('./auth.routes'));
router.use('/rooms', require('./rooms.routes'));
router.use('/payments', require('./payments.routes'));

module.exports = router;
