import { serviceStatus } from '@/lib/data';
import type { ComponentStatus, ToolOutcome } from '@/lib/types';

export function getServiceStatus(): ToolOutcome<{ components: ComponentStatus[]; degraded: string[] }> {
  const degraded = serviceStatus.filter((s) => s.state !== 'operational').map((s) => s.component);
  const output = { components: serviceStatus, degraded };
  if (degraded.length === 0) return { ok: true, output, summary: 'All systems operational', tone: 'ok' };
  return { ok: true, output, summary: `${degraded.join(', ')} ${degraded.length > 1 ? 'are' : 'is'} degraded`, tone: 'danger' };
}
