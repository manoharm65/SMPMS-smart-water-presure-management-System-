import KPIBar from '../components/layout/KPIBar'
import ZoneTable from '../components/dashboard/ZoneTable'
import PressureChart from '../components/dashboard/PressureChart'

export default function Overview() {
  return (
    <div className="flex h-full flex-col">
      <KPIBar
        items={[
          { label: 'Active zones', value: '—', tone: 'accent' },
          { label: 'Avg pressure', value: '—', tone: 'info' },
          { label: 'Critical zones', value: '—', tone: 'critical' },
          { label: 'Leaks detected', value: '—', tone: 'warning' },
          { label: 'Valve ops today', value: '—', tone: 'accent' },
        ]}
      />
      <div className="grid flex-1 grid-cols-1 gap-2 p-2 lg:grid-cols-2">
        <ZoneTable />
        <PressureChart />
      </div>
    </div>
  )
}
