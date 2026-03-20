import { Router, Response } from 'express';
import { telemetryService } from './telemetry.service.js';
import { authMiddleware, AuthenticatedRequest } from '../auth/auth.middleware.js';
import { CreateTelemetryDto } from './dto/create-telemetry.dto.js';
import { validateDto } from '../../utils/validators.js';

const router = Router();

// POST /telemetry (ESP32 push)
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dto = await validateDto(CreateTelemetryDto, req.body);
    const telemetry = await telemetryService.create(dto);
    res.status(201).json(telemetry);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /telemetry/latest
router.get('/latest', authMiddleware, (_req: AuthenticatedRequest, res: Response): void => {
  const latest = telemetryService.getLatest();
  res.json(latest);
});

// GET /telemetry/:nodeId
router.get('/:nodeId', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { nodeId } = req.params;
  const { limit } = req.query;
  const telemetry = telemetryService.getByNodeId(nodeId, limit ? parseInt(limit as string, 10) : 100);
  res.json(telemetry);
});

export default router;
