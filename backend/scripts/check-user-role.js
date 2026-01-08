
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
// Also try .env.local if available
try { require('dotenv').config({ path: path.join(__dirname, '../../.env.local'), override: true }); } catch (e) {}

const { Sequelize, DataTypes } = require('sequelize');
const db = require('../src/models');

async function checkUserRole() {
  try {
    const email = 'admin@pos.com';
    console.log(`Checking role for user: ${email}`);
    
    const user = await db.User.findOne({ where: { email } });
    
    if (!user) {
      console.log('User not found!');
    } else {
      console.log('User found:');
      console.log(`ID: ${user.id}`);
      console.log(`Name: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.role}`);
      
      if (user.role !== 'ADMIN') {
        console.log('---');
        console.log('WARNING: Role is NOT ADMIN.');
        console.log('Do you want to update it to ADMIN? (Run with --fix to update)');
        
        if (process.argv.includes('--fix')) {
           user.role = 'ADMIN';
           await user.save();
           console.log('✅ Role updated to ADMIN successfully.');
        }
      } else {
        console.log('✅ Role is correctly set to ADMIN.');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.sequelize.close();
  }
}

checkUserRole();
