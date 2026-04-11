import { loadEnv } from '../core/config.js';
import { initDatabase } from './db.js';
import { userRepository } from '../repositories/user.repository.js';
import { nodeRepository } from '../repositories/node.repository.js';
import bcrypt from 'bcryptjs';

loadEnv();

async function seed() {
  console.log('🌱 Starting database seed...\n');

  // Initialize database first
  await initDatabase();

  // Create admin user
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin@123';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';

  const existingAdmin = userRepository.findByUsername(adminUsername);
  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);
    const user = userRepository.create(adminUsername, adminEmail, passwordHash);
    console.log(`✅ Created admin user: ${user.username}`);
  } else {
    console.log(`ℹ️  Admin user already exists: ${existingAdmin.username}`);
  }

  // Create default nodes
  const defaultNodes = [
    { nodeId: 'valve_1', name: 'DMA Zone 1 - North', location: 'Zone A', elevation: 10 },
    { nodeId: 'valve_2', name: 'DMA Zone 2 - South', location: 'Zone B', elevation: 45 },
    { nodeId: 'valve_3', name: 'DMA Zone 3 - East', location: 'Zone C', elevation: 20 },
    { nodeId: 'valve_4', name: 'DMA Zone 4 - West', location: 'Zone D', elevation: 15 },
    { nodeId: 'valve_5', name: 'DMA Zone 5 - Central', location: 'Zone E', elevation: 30 },
    { nodeId: 'valve_6', name: 'DMA Zone 6 - Industrial', location: 'Zone F', elevation: 5 },
  ];

  const telemetryRepository = (await import('../repositories/telemetry.repository.js')).telemetryRepository;

  for (const nodeData of defaultNodes) {
    const existing = nodeRepository.findByNodeId(nodeData.nodeId);
    if (!existing) {
      const node = nodeRepository.create(nodeData.nodeId, nodeData.name, nodeData.location);
      console.log(`✅ Created node: ${node.nodeId} (${node.name})`);
    } else {
      console.log(`ℹ️  Node already exists: ${existing.nodeId}`);
    }
    
    // Add recent telemetry readings for demo
    const pressures = [3.2, 3.5, 2.8, 3.1, 2.9, 3.4];
    const idx = parseInt(nodeData.nodeId.replace('valve_', '')) - 1;
    const basePressure = pressures[idx % pressures.length];
    
    // Add 24 hours of telemetry data
    for (let h = 0; h < 24; h++) {
      const timestamp = new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
      const pressure = basePressure + (Math.random() - 0.5) * 0.4;
      telemetryRepository.create({
        nodeId: nodeData.nodeId,
        pressure: Math.round(pressure * 100) / 100,
        flowRate: 10 + Math.random() * 5,
        temperature: 22 + Math.random() * 3,
        batteryLevel: 85 + Math.random() * 15,
        timestamp,
      });
    }
  }

  console.log('\n🌱 Seed completed!');
  console.log('\n📋 Default credentials:');
  console.log(`   Username: ${adminUsername}`);
  console.log(`   Password: ${adminPassword}`);
}

seed().catch(console.error);
