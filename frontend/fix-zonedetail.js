const fs = require('fs');
let c = fs.readFileSync('src/pages/ZoneDetail.tsx', 'utf8');

const oldCode = `const handleRunMlNow = async () => {
    setMlRunning(true)
    try {
      const status = await runMlNow()
      setMlStatus(status)
      await fetchAnomalies()
    } catch (err) {
      console.error("Failed to run ML now:", err)
    } finally {
      setMlRunning(false)
    }
  }`;

const newCode = `const handleRunMlNow = async () => {
    setMlRunning(true)
    try {
      const status = await runMlNow()
      setMlStatus(status)
      await fetchAnomalies()
    } catch (err) {
      console.error("Failed to run ML now:", err)
    } finally {
      setMlRunning(false)
    }
  }

  const handleRunMpcNow = async () => {
    setMpcOptimizing(true)
    try {
      await runMpcNow()
      await fetchMpcStatus()
    } catch (err) {
      console.error("Failed to run MPC now:", err)
    } finally {
      setMpcOptimizing(false)
    }
  }

  const fetchMpcStatus = async () => {
    try {
      const status = await getMpcStatus()
      setMpcStatus(status)
    } catch (err) {
      console.error("Failed to fetch MPC status:", err)
    }
  }`;

c = c.replace(oldCode, newCode);
fs.writeFileSync('src/pages/ZoneDetail.tsx', c);
console.log('Done');