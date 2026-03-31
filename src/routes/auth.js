const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

const validateRegister = [
  body('name').trim().notEmpty().withMessage('Le nom est requis.'),
  body('email').isEmail().withMessage('Email invalide.'),
  body('password').isLength({ min: 6 }).withMessage('Mot de passe trop court (min 6 caractères).'),
];

const validateLogin = [
  body('email').isEmail().withMessage('Email invalide.'),
  body('password').notEmpty().withMessage('Mot de passe requis.'),
];

router.post('/register',         validateRegister, ctrl.register);
router.post('/login',            validateLogin,    ctrl.login);
router.post('/refresh',                            ctrl.refresh);
router.post('/logout',                             ctrl.logout);
router.get ('/me',               authenticate,     ctrl.me);
router.put ('/profile',          authenticate, upload.single('avatar'), ctrl.updateProfile);
router.put ('/change-password',  authenticate,     ctrl.changePassword);

module.exports = router;
