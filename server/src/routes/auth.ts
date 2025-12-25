import { Router } from 'express';
import * as AuthController from '../controllers/auth.controller';

const router = Router();

router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/demo', AuthController.demo);
router.post('/student/signup', AuthController.studentSignup);
router.post('/student/login', AuthController.studentLogin);

export default router;
