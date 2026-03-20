import { Router, Response } from 'express';
import { commandService } from './command.service.js';
import { authMiddleware, AuthenticatedRequest } from '../auth/auth.middleware.js';
import { validateDto } from '../../utils/validators.js';
import { IsString, IsIn } from 'class-validator';

class CreateCommandDto {
  @IsString()
  nodeId!: string;

  @IsString()
  @IsIn(['REDUCE_FLOW', 'INCREASE_FLOW', 'NONE'])
  command!: string;
}

const router = Router();

// POST /commands (manual override)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dto = await validateDto(CreateCommandDto, req.body);
    const command = commandService.create(dto.nodeId, dto.command);
    res.status(201).json(command);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /commands
router.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { limit, offset } = req.query;
  const commands = commandService.findAll(
    limit ? parseInt(limit as string, 10) : 100,
    offset ? parseInt(offset as string, 10) : 0
  );
  res.json(commands);
});

// GET /commands/:nodeId
router.get('/:nodeId', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { nodeId } = req.params;
  const { limit } = req.query;
  const commands = commandService.findByNodeId(nodeId, limit ? parseInt(limit as string, 10) : 50);
  res.json(commands);
});

export default router;
