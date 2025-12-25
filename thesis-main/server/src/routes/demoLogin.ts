import { Router } from 'express';
import { signAccessToken } from '../utils/jwt';
import { createSuccessResponse } from '../utils/apiResponse';

const router = Router();

router.post('/demo/login', async (_req, res) => {
  const payload = {
    sub: 'demo-student',
    email: 'demo@spellwise.local',
    username: 'demo-student',
    role: 'student',
    demo: true,
  };
  const accessToken = signAccessToken(payload, '2h');
  return res.json(
    createSuccessResponse({
      accessToken,
      role: 'student',
      email: payload.email,
      username: payload.username,
      demo: true,
    })
  );
});

export default router;
