import { Router, Response } from 'express';
import { validateDto } from '../../utils/validators.js';
import { RegisterIwedsDeviceDto } from './dto/register-device.dto.js';
import { CreateHouseholdFlowDto } from './dto/create-household-flow.dto.js';
import { iwedsService } from './iweds.service.js';
import { iwedsAuthMiddleware, IwedsAuthenticatedRequest } from './iweds-auth.middleware.js';

const router = Router();

router.post('/device/register', async (req: IwedsAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dto = await validateDto(RegisterIwedsDeviceDto, req.body);
    const result = iwedsService.registerDevice({
      householdId: dto.household_id,
      dmaId: dto.dma_id,
      pipeDiameterMm: dto.pipe_diameter_mm,
      address: dto.address,
      consumerId: dto.consumer_id,
    });

    res.status(201).json({
      household_id: result.householdId,
      api_key: result.apiKey,
      pipe_area_m2: result.pipeAreaM2,
      warn_threshold_lps: result.warnThresholdLps,
      alert_threshold_lps: result.alertThresholdLps,
      confirm_window_sec: result.confirmWindowSec,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/household/flow', iwedsAuthMiddleware, async (req: IwedsAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dto = await validateDto(CreateHouseholdFlowDto, req.body);
    if (req.iwedsHouseholdId && req.iwedsHouseholdId !== dto.household_id) {
      res.status(403).json({ error: 'household_id does not match API key scope' });
      return;
    }

    const result = await iwedsService.ingestFlow({
      householdId: dto.household_id,
      dmaId: dto.dma_id,
      timestamp: dto.timestamp,
      flowRateLps: dto.flow_rate_lps,
      signalQuality: dto.signal_quality,
      rssiDbm: dto.rssi_dbm,
      firmwareVersion: dto.firmware_version,
    });

    res.status(200).json({
      status: result.status,
      detection_result: result.detectionResult,
      severity: result.severity,
      q_theoretical_lps: result.qTheoreticalLps,
      q_excess_lps: result.qExcessLps,
      webhook_fired: result.webhookFired,
    });
  } catch (err: any) {
    const status = err.statusCode || err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

router.get('/status/:householdId', async (req: IwedsAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const status = iwedsService.getStatus(req.params.householdId);
    res.status(200).json({
      household_id: status.householdId,
      current_state: status.currentState,
      last_reading_at: status.lastReadingAt,
      last_q_actual_lps: status.lastQActualLps,
      last_q_theoretical_lps: status.lastQTheoreticalLps,
      active_alert: status.activeAlert,
      total_alerts_30d: status.totalAlerts30d,
    });
  } catch (err: any) {
    const status = err.statusCode || err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

router.get('/alerts', async (req: IwedsAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = iwedsService.getAlerts({
      dmaId: req.query.dma_id as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      severity: req.query.severity as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.status(200).json(result);
  } catch (err: any) {
    const status = err.statusCode || err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

export default router;
