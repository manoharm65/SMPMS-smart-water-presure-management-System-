import { HttpError } from '../../middleware/error-handler.js';
import { randomUUID } from 'crypto';
import {
  IwedsSeverity,
  iwedsRepository,
  generateIwedsApiKey,
  HouseholdConnection,
} from '../../repositories/iweds.repository.js';

const DISCHARGE_COEFFICIENT = 0.62;
const WATER_DENSITY = 1000;
const BAR_TO_PASCAL = 100000;

interface DetectFlowInput {
  householdId: string;
  dmaId: string;
  timestamp: string;
  flowRateLps: number;
  signalQuality: 'GOOD' | 'POOR' | 'LOST';
  rssiDbm?: number;
  firmwareVersion: string;
}

interface RegisterInput {
  householdId: string;
  dmaId: string;
  pipeDiameterMm: number;
  address: string;
  consumerId: string;
}

interface DetectResult {
  status: 'received';
  detectionResult: 'NORMAL' | 'SUSPECT' | 'ILLEGAL';
  severity: IwedsSeverity;
  qTheoreticalLps: number;
  qExcessLps: number;
  webhookFired: boolean;
}

interface WebhookPayload {
  event: 'ILLEGAL_EXTRACTION_DETECTED';
  event_id: string;
  household_id: string;
  dma_id: string;
  consumer_id: string;
  address: string;
  onset_time: string;
  q_actual_lps: number;
  q_theoretical_lps: number;
  q_excess_lps: number;
  severity: NonNullable<IwedsSeverity>;
  severity_score: number;
  supply_pressure_bar: number;
  confirm_duration_sec: number;
  zone_pressure_source: string;
  webhook_version: 'v1';
}

function toFixedNumber(value: number, decimals = 4): number {
  return Number(value.toFixed(decimals));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class IwedsService {
  registerDevice(input: RegisterInput): {
    householdId: string;
    apiKey: string;
    pipeAreaM2: number;
    warnThresholdLps: number;
    alertThresholdLps: number;
    confirmWindowSec: number;
  } {
    const diameterM = input.pipeDiameterMm / 1000;
    const pipeAreaM2 = Math.PI * Math.pow(diameterM / 2, 2);
    const apiKey = generateIwedsApiKey();

    const registered = iwedsRepository.registerHousehold({
      householdId: input.householdId,
      dmaId: input.dmaId,
      consumerId: input.consumerId,
      address: input.address,
      pipeDiameterMm: input.pipeDiameterMm,
      pipeAreaM2,
      warnThresholdLps: 0.08,
      alertThresholdLps: 0.15,
      confirmWindowSec: 120,
      cooldownSec: 600,
      apiKey,
    });

    return {
      householdId: registered.householdId,
      apiKey,
      pipeAreaM2: toFixedNumber(registered.pipeAreaM2, 9),
      warnThresholdLps: registered.warnThresholdLps,
      alertThresholdLps: registered.alertThresholdLps,
      confirmWindowSec: registered.confirmWindowSec,
    };
  }

  async ingestFlow(input: DetectFlowInput): Promise<DetectResult> {
    const household = iwedsRepository.getHouseholdById(input.householdId);
    if (!household || !household.isActive) {
      throw new HttpError(404, `Household ${input.householdId} not registered`);
    }
    if (household.dmaId !== input.dmaId) {
      throw new HttpError(400, 'dma_id does not match registered household DMA');
    }

    const pressure = iwedsRepository.findLatestPressureByDma(input.dmaId);
    if (!pressure) {
      throw new HttpError(503, 'PRESSURE_STALE: no pressure available for dma_id');
    }

    const eventTs = new Date(input.timestamp);
    const pressureTs = new Date(pressure.timestamp);
    if (Number.isNaN(eventTs.getTime()) || Number.isNaN(pressureTs.getTime())) {
      throw new HttpError(400, 'Invalid timestamp format');
    }

    if (eventTs.getTime() - pressureTs.getTime() > 60_000) {
      throw new HttpError(503, 'PRESSURE_STALE: latest pressure is older than 60 seconds');
    }

    const qTheoreticalLps = this.computeTheoreticalFlowLps(pressure.pressureBar, household.pipeAreaM2);
    const qExcessLps = toFixedNumber(input.flowRateLps - qTheoreticalLps, 4);
    const detection = this.resolveDetectionState(qExcessLps, household.warnThresholdLps, household.alertThresholdLps);
    const severityScore = qTheoreticalLps <= 0 ? 1 : Math.max(0, input.flowRateLps - qTheoreticalLps) / qTheoreticalLps;
    const severity = this.resolveSeverity(severityScore);

    iwedsRepository.createFlowReading({
      householdId: input.householdId,
      dmaId: input.dmaId,
      timestamp: eventTs.toISOString(),
      flowRateLps: input.flowRateLps,
      qTheoreticalLps,
      qExcessLps,
      detectionState: detection,
      severityScore: toFixedNumber(severityScore, 4),
      signalQuality: input.signalQuality,
      pressureSourceBar: pressure.pressureBar,
      rssiDbm: input.rssiDbm,
      firmwareVersion: input.firmwareVersion,
    });

    let webhookFired = false;

    if (detection === 'ILLEGAL') {
      const onsetTime = this.findConfirmedOnsetTime(
        household,
        eventTs.toISOString(),
        household.alertThresholdLps
      );

      if (onsetTime && this.canFireByCooldown(household, eventTs.toISOString())) {
        const webhookResult = await this.dispatchWebhook({
          household,
          onsetTime,
          qActualLps: input.flowRateLps,
          qTheoreticalLps,
          qExcessLps,
          severity: severity ?? 'LOW',
          severityScore: toFixedNumber(severityScore, 4),
          supplyPressureBar: pressure.pressureBar,
          zonePressureSource: pressure.sourceNodeId ?? input.dmaId,
        });

        iwedsRepository.createIllegalEvent({
          householdId: household.householdId,
          dmaId: household.dmaId,
          onsetTime,
          qExcessLps,
          severity: severity ?? 'LOW',
          severityScore: toFixedNumber(severityScore, 4),
          webhookFired: webhookResult.success,
          webhookAttempts: webhookResult.attempts,
          webhookStatus: webhookResult.status,
        });

        webhookFired = webhookResult.success;
      }
    }

    return {
      status: 'received',
      detectionResult: detection,
      severity,
      qTheoreticalLps,
      qExcessLps,
      webhookFired,
    };
  }

  getStatus(householdId: string): {
    householdId: string;
    currentState: 'NORMAL' | 'SUSPECT' | 'ILLEGAL';
    lastReadingAt: string | null;
    lastQActualLps: number | null;
    lastQTheoreticalLps: number | null;
    activeAlert: boolean;
    totalAlerts30d: number;
  } {
    const household = iwedsRepository.getHouseholdById(householdId);
    if (!household) {
      throw new HttpError(404, `Household ${householdId} not found`);
    }

    const latest = iwedsRepository.getLatestFlowReading(householdId);
    const latestEvent = iwedsRepository.getLastIllegalEvent(householdId);
    const totalAlerts30d = iwedsRepository.countAlertsForLastDays(householdId, 30);

    return {
      householdId,
      currentState: latest?.detectionState ?? 'NORMAL',
      lastReadingAt: latest?.time ?? null,
      lastQActualLps: latest?.flowRateLps ?? null,
      lastQTheoreticalLps: latest?.qTheoreticalLps ?? null,
      activeAlert: !!latestEvent && !latestEvent.resolved,
      totalAlerts30d,
    };
  }

  getAlerts(filters: {
    dmaId?: string;
    from?: string;
    to?: string;
    severity?: string;
    limit?: number;
  }): { total: number; alerts: Array<Record<string, unknown>> } {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 500);
    const events = iwedsRepository.listAlerts({
      dmaId: filters.dmaId,
      from: filters.from,
      to: filters.to,
      severity: filters.severity,
      limit,
    });

    return {
      total: events.length,
      alerts: events.map((event) => ({
        event_id: event.id,
        household_id: event.householdId,
        dma_id: event.dmaId,
        onset_time: event.onsetTime,
        q_excess_lps: event.qExcessLps,
        severity: event.severity,
        webhook_fired: event.webhookFired,
        resolved: event.resolved,
      })),
    };
  }

  private computeTheoreticalFlowLps(pressureBar: number, pipeAreaM2: number): number {
    const pressurePa = pressureBar * BAR_TO_PASCAL;
    const flowM3PerSec = DISCHARGE_COEFFICIENT * pipeAreaM2 * Math.sqrt((2 * pressurePa) / WATER_DENSITY);
    const flowLps = flowM3PerSec * 1000;
    return toFixedNumber(flowLps, 4);
  }

  private resolveDetectionState(
    qExcessLps: number,
    warnThresholdLps: number,
    alertThresholdLps: number
  ): 'NORMAL' | 'SUSPECT' | 'ILLEGAL' {
    if (qExcessLps <= 0) {
      return 'NORMAL';
    }
    if (qExcessLps <= warnThresholdLps) {
      return 'SUSPECT';
    }
    if (qExcessLps > alertThresholdLps) {
      return 'ILLEGAL';
    }
    return 'SUSPECT';
  }

  private resolveSeverity(score: number): IwedsSeverity {
    if (score <= 0) {
      return null;
    }
    if (score <= 0.2) {
      return 'LOW';
    }
    if (score <= 0.5) {
      return 'MEDIUM';
    }
    return 'HIGH';
  }

  private findConfirmedOnsetTime(
    household: HouseholdConnection,
    eventTimestampIso: string,
    alertThresholdLps: number
  ): string | null {
    const since = new Date(new Date(eventTimestampIso).getTime() - household.confirmWindowSec * 1000).toISOString();
    const readings = iwedsRepository.getRecentFlowReadings(household.householdId, since);
    if (readings.length === 0) {
      return null;
    }

    const first = readings[0];
    const last = readings[readings.length - 1];
    const durationSec = (new Date(last.time).getTime() - new Date(first.time).getTime()) / 1000;

    const allAbove = readings.every((r) => r.qExcessLps > alertThresholdLps);
    if (!allAbove || durationSec < household.confirmWindowSec) {
      return null;
    }
    return first.time;
  }

  private canFireByCooldown(household: HouseholdConnection, currentTimestampIso: string): boolean {
    const lastEvent = iwedsRepository.getLastIllegalEvent(household.householdId);
    if (!lastEvent) {
      return true;
    }
    const deltaSec =
      (new Date(currentTimestampIso).getTime() - new Date(lastEvent.onsetTime).getTime()) / 1000;
    return deltaSec >= household.cooldownSec;
  }

  private async dispatchWebhook(input: {
    household: HouseholdConnection;
    onsetTime: string;
    qActualLps: number;
    qTheoreticalLps: number;
    qExcessLps: number;
    severity: NonNullable<IwedsSeverity>;
    severityScore: number;
    supplyPressureBar: number;
    zonePressureSource: string;
  }): Promise<{ success: boolean; attempts: number; status: string }> {
    const webhookUrl = process.env.IWEDS_WEBHOOK_URL || '';
    if (!webhookUrl) {
      return { success: false, attempts: 0, status: 'WEBHOOK_NOT_CONFIGURED' };
    }

    const payload: WebhookPayload = {
      event: 'ILLEGAL_EXTRACTION_DETECTED',
      event_id: randomUUID(),
      household_id: input.household.householdId,
      dma_id: input.household.dmaId,
      consumer_id: input.household.consumerId,
      address: input.household.address,
      onset_time: input.onsetTime,
      q_actual_lps: input.qActualLps,
      q_theoretical_lps: input.qTheoreticalLps,
      q_excess_lps: input.qExcessLps,
      severity: input.severity,
      severity_score: input.severityScore,
      supply_pressure_bar: input.supplyPressureBar,
      confirm_duration_sec: input.household.confirmWindowSec,
      zone_pressure_source: input.zonePressureSource,
      webhook_version: 'v1',
    };

    const delaysMs = [0, 10000, 30000, 90000];
    let lastStatus = 'WEBHOOK_FAILED';
    for (let attempt = 1; attempt <= delaysMs.length; attempt++) {
      const delay = delaysMs[attempt - 1];
      if (delay > 0) {
        await sleep(delay);
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          return { success: true, attempts: attempt, status: `WEBHOOK_DELIVERED_${response.status}` };
        }
        lastStatus = `WEBHOOK_HTTP_${response.status}`;
      } catch (_error) {
        lastStatus = 'WEBHOOK_NETWORK_ERROR';
      }
    }

    return { success: false, attempts: delaysMs.length, status: lastStatus };
  }
}

export const iwedsService = new IwedsService();
