import { Router, Response } from 'express';
import { EspAuthenticatedRequest } from './esp-auth.middleware.js';
import { commandService } from '../command/command.service.js';
import { IsString, IsBoolean, IsNumber } from 'class-validator';
import { validateDto } from '../../utils/validators.js';

class AckCommandDto {
  @IsString()
  nodeId!: string;

  @IsBoolean()
  executed!: boolean;

  @IsNumber()
  actualPosition!: number;

  @IsString()
  timestamp!: string;
}

const router = Router();

// POST /api/v1/esp/commands/:commandId/ack
router.post('/:commandId/ack', async (req: EspAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dto = await validateDto(AckCommandDto, req.body);
    commandService.acknowledge(req.params.commandId, dto.nodeId, dto.executed, dto.actualPosition, dto.timestamp);
    res.json({ acknowledged: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
