import { Router, Response } from 'express';
import { EspAuthenticatedRequest } from './esp-auth.middleware.js';
import { validateDto } from '../../utils/validators.js';
import { CreateEspTelemetryDto } from './dto/create-esp-telemetry.dto.js';
import { SyncTelemetryDto } from './dto/sync-telemetry.dto.js';
import { telemetryService } from '../telemetry/telemetry.service.js';

const router = Router();

// POST /api/v1/esp/telemetry (ESP push — piggybacks command in response)
router.post('/', async (req: EspAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dto = await validateDto(CreateEspTelemetryDto, req.body);
    const result = await telemetryService.createForEsp(dto);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/v1/esp/telemetry/sync (buffered readings after reconnect)
router.post('/sync', async (req: EspAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dto = await validateDto(SyncTelemetryDto, req.body);
    const synced = await telemetryService.syncBuffered(dto);
    res.json({ synced });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
