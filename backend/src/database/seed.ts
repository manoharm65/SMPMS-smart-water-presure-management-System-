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
    { nodeId: 'DMA_01', name: 'District Meter Area 1', location: 'Zone A' },
    { nodeId: 'DMA_02', name: 'District Meter Area 2', location: 'Zone B' },
    { nodeId: 'DMA_03', name: 'District Meter Area 3', location: 'Zone C' },
    { nodeId: 'DMA_04', name: 'District Meter Area 4', location: 'Zone D' },
    { nodeId: 'DMA_05', name: 'District Meter Area 5', location: 'Zone E' },
  ];

  for (const nodeData of defaultNodes) {
    const existing = nodeRepository.findByNodeId(nodeData.nodeId);
    if (!existing) {
      const node = nodeRepository.create(nodeData.nodeId, nodeData.name, nodeData.location);
      console.log(`✅ Created node: ${node.nodeId} (${node.name})`);
    } else {
      console.log(`ℹ️  Node already exists: ${existing.nodeId}`);
    }
  }

  console.log('\n🌱 Seed completed!');
  console.log('\n📋 Default credentials:');
  console.log(`   Username: ${adminUsername}`);
  console.log(`   Password: ${adminPassword}`);
}

seed().catch(console.error);
