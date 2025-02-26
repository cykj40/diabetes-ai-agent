import { Router } from 'express';
import dexcomRoutes from './dexcom.routes';
import aiRoutes from './ai.routes';
import testRoutes from './test.routes';

const router = Router();

// Register all routes
router.use('/dexcom', dexcomRoutes);
router.use('/ai', aiRoutes);
router.use('/test', testRoutes);

export default router; 