const fs = require('fs');

// Fix Overview.tsx
let ov = fs.readFileSync('src/pages/Overview.tsx', 'utf8');

if (!ov.includes('const fetchMpc =')) {
  ov = ov.replace(/const fetchKpi = useCallback\(async \(\) => \{[\s\S]*?\}, \[\]\)/, (match) => {
    return match + '\n\n  const fetchMpc = useCallback(async () => {\n    try {\n      const data = await getMpcStatus()\n      setMpcStatus(data)\n    } catch (err) {\n      console.error(\'Failed to fetch MPC\', err)\n    }\n  }, [])';
  });
}

if (!ov.includes('fetchMpc()')) {
  ov = ov.replace(/await Promise\.all\(\[fetchZones\(\), fetchKpi\(\)\]\)/, 'await Promise.all([fetchZones(), fetchKpi(), fetchMpc()])');
  ov = ov.replace(/\[fetchZones, fetchKpi, fetchPressureHistory, selectedDma\]/, '[fetchZones, fetchKpi, fetchMpc, fetchPressureHistory, selectedDma]');
}

if (!ov.includes('MPC {mpcStatus')) {
  ov = ov.replace(/<span className="font-condensed text-\[10px\] uppercase tracking-wider text-ink">\s*Live Feed\s*<\/span>\s*<\/div>/, (match) => {
    return match + '\n            {mpcStatus && (\n              <div className="flex items-center gap-2 px-3 py-1 border border-rule rounded-full bg-paper">\n                <span className={`w-2 h-2 rounded-full ${mpcStatus.isRunning ? \'bg-pass\' : \'bg-[#E8001D]\'}`} />\n                <span className="font-condensed text-[10px] uppercase tracking-wider text-ink">\n                  MPC {mpcStatus.isRunning ? \'Active\' : \'Offline\'}\n                </span>\n                {mpcStatus.status && (\n                   <span className="font-condensed text-[10px] text-dim border-l pl-2 border-rule\">Status: {mpcStatus.status}</span>\n                )}\n              </div>\n            )}';
  });
}

fs.writeFileSync('src/pages/Overview.tsx', ov);

// Fix ZoneDetail.tsx
let zd = fs.readFileSync('src/pages/ZoneDetail.tsx', 'utf8');

if (!zd.includes('getMpcStatus,')) {
  zd = zd.replace(/usePolling,/, 'usePolling,\n  getMpcStatus,\n  runMpcNow,');
  zd = zd.replace(/MlRuntimeStatus }/, 'MlRuntimeStatus,\n  MpcStatus\n}');
}

if (!zd.includes('const fetchMpcStatus')) {
  zd = zd.replace(/  \/\/ Fetch ML runtime status/, '  const fetchMpcStatus = async () => {\n    try {\n      const data = await getMpcStatus()\n      setMpcStatus(data)\n    } catch (err) {\n      console.error(\'Failed to load MPC status:\', err)\n    }\n  }\n\n  // Fetch ML runtime status');
}

if (!zd.includes('fetchMpcStatus()')) {
  zd = zd.replace(/fetchMlStatus\(\)\n  \}, \[zoneId\]\)/, 'fetchMlStatus()\n    fetchMpcStatus()\n  }, [zoneId])');
  zd = zd.replace(/usePolling\(fetchMlStatus, 30000, true\)/, 'usePolling(fetchMlStatus, 30000, true)\n  usePolling(fetchMpcStatus, 30000, true)');
}

if (!zd.includes('const handleRunMpcNow')) {
  zd = zd.replace(/  const handleRunMlNow/, '  const handleRunMpcNow = async () => {\n    setMpcRunning(true)\n    try {\n      await runMpcNow()\n      await fetchMpcStatus()\n    } catch (err) {\n      console.error(\'Failed to run MPC now:\', err)\n    } finally {\n      setMpcRunning(false)\n    }\n  }\n\n  const handleRunMlNow');
}

if (!zd.includes('MPC Target (Optimal)')) {
  zd = zd.replace(/<span className="font-mono text-\[16px\] text-pass">\{zoneData\?\.ai_recommendation \?\? \'--\'\}%<\/span>\s*<\/div>/, (match) => {
    return match + '\n\n          {/* MPC Recommendation */}\n          <div className="flex items-center justify-between mb-4 p-2 border border-rule bg-paper">\n            <div className="flex flex-col">\n              <span className="font-condensed text-[10px] uppercase tracking-wider text-dim">\n                MPC Target (Optimal)\n              </span>\n              <button onClick={handleRunMpcNow} disabled={mpcRunning} className="text-[9px] underline mt-1 text-dim text-left hover:text-ink">\n                {mpcRunning ? \'Optimizing...\' : \'Optimize Now\'}\n              </button>\n            </div>\n            {mpcStatus ? (\n              <div className="text-right">\n                <span className="font-mono text-[16px] text-ink">{mpcStatus.status}</span>\n              </div>\n            ) : (\n              <span className="font-mono text-[16px] text-dim\">--</span>\n            )}\n          </div>';
  });
}

fs.writeFileSync('src/pages/ZoneDetail.tsx', zd);
