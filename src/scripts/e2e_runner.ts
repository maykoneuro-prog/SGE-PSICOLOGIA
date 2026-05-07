
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  deleteUser
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  where,
  doc,
  getDoc
} from 'firebase/firestore';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Note: We need to import the config directly because we are in a node script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, '../../firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Import API but we need to make sure it uses the same auth/db instances
// Since api.ts imports from '../firebase', we might need to be careful.
// To keep it simple and robust for the script, we will re-implement minimal API logic or use it if possible.
// Because api.ts is ESM, we can import it.

import { api } from '../lib/api.js';

const USERS = [
  { email: `psicologo1_${Date.now()}@test.com`, password: 'password123', school: 'Escola A', students: ['Aluno A1', 'Aluno A2', 'Aluno A3'] },
  { email: `psicologo2_${Date.now()}@test.com`, password: 'password123', school: 'Escola B', students: ['Aluno B1', 'Aluno B2', 'Aluno B3'] },
  { email: `psicologo3_${Date.now()}@test.com`, password: 'password123', school: 'Escola C', students: ['Aluno C1', 'Aluno C2', 'Aluno C3'] },
];

async function runTest() {
  console.log('🚀 Starting E2E SaaS Multi-tenant Test...');
  const results: any = {};

  for (const userData of USERS) {
    console.log(`\n👤 Testing User: ${userData.email}`);
    
    try {
      // 1. Sign Up / Sign In
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        console.log('✅ User registered');
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          userCredential = await signInWithEmailAndPassword(auth, userData.email, userData.password);
          console.log('✅ User signed in (already exists)');
        } else {
          throw err;
        }
      }

      const user = userCredential.user;

      // 2. Initialize Trial
      await api.users.initializeTrial(user);
      console.log('✅ Trial initialized');

      // 3. Create School
      const school = await api.schools.create({
        name: userData.school,
        cnpj: '00.000.000/0001-00',
        email: userData.email,
        unit: userData.school,
        ownerId: user.uid
      });
      console.log(`✅ School created: ${school.name} (ID: ${school.id})`);

      // 4. Create Students
      const studentIds = [];
      for (const studentName of userData.students) {
        const student = await api.students.create({
          name: studentName,
          ra: Math.random().toString(36).substring(7),
          schoolId: school.id,
          unit: school.unit,
          ownerId: user.uid
        });
        studentIds.push(student.id);
        console.log(`   ✅ Student created: ${student.name}`);
      }

      // 5. Create Records
      for (const studentId of studentIds) {
        await api.documents.create({
          title: 'Registro de Atendimento',
          type: 'psychological_listening',
          studentId: studentId,
          content: 'Atendimento inicial para avaliação.',
          ownerId: user.uid,
          date: new Date().toISOString().split('T')[0]
        });
      }
      console.log('✅ 3 Records created');

      // 6. Validate Dashboard Stats
      const studentCount = await api.students.count({ isAdmin: false });
      const documents = await api.documents.list({ isAdmin: false });
      const recordCount = documents.length;
      
      console.log(`📊 Stats: Students=${studentCount}, Records=${recordCount}`);
      
      if (studentCount !== 3 || recordCount !== 3) {
        throw new Error(`Invalid stats for ${userData.email}: Expected 3/3, got ${studentCount}/${recordCount}`);
      }

      // Check for usage logic (simulated equivalent of usageService)
      const trialLimit = 10;
      const usagePercentage = (recordCount / trialLimit) * 100;
      console.log(`💳 Usage Check: ${recordCount}/${trialLimit} (${usagePercentage}%)`);
      if (usagePercentage !== 30) {
        throw new Error(`Usage percentage mismatch: Expected 30%, got ${usagePercentage}%`);
      }

      // 7. Test Anonymous Report
      const report = await api.anonymousReports.create({
        schoolId: school.id,
        content: `Denúncia de teste para ${userData.school}`,
        status: 'pending',
        unit: school.unit,
        ownerId: user.uid
      });
      console.log(`✅ Anonymous Report created for ${userData.school}`);

      results[userData.email] = { schoolId: school.id, studentIds, studentCount, recordCount, reportId: report.id };

      await signOut(auth);
    } catch (error) {
      console.error(`❌ Error testing user ${userData.email}:`, error);
      process.exit(1);
    }
  }

  // 8. Security/Isolation Check
  console.log('\n🔐 Testing Data Isolation...');
  
  // Sign back as User 1
  await signInWithEmailAndPassword(auth, USERS[0].email, USERS[0].password);
  const u1_id = auth.currentUser?.uid;
  
  // Try to access User 2's school
  const u2_schoolId = results[USERS[1].email].schoolId;
  const u2_reportId = results[USERS[1].email].reportId;
  console.log(`🕵️ User 1 attempting to access User 2's data...`);
  
  try {
    // 1. Schools list
    const schools = await api.schools.list({ isAdmin: false });
    if (schools.some((s: any) => s.id === u2_schoolId)) {
       throw new Error('❌ SECURITY BREACH: User 1 can see User 2 school in list!');
    }
    
    // 2. Students list
    const students = await api.students.list({ isAdmin: false });
    if (students.some((s: any) => results[USERS[1].email].studentIds.includes(s.id))) {
       throw new Error('❌ SECURITY BREACH: User 1 can see User 2 students!');
    }

    // 3. Anonymous Reports list
    const reports = await api.anonymousReports.list({ isAdmin: false });
    if (reports.some((r: any) => r.id === u2_reportId)) {
       throw new Error('❌ SECURITY BREACH: User 1 can see User 2 anonymous report!');
    }

    console.log('✅ Isolation test PASSED: User 1 cannot see any User 2 data.');
  } catch (err) {
    console.error('❌ Isolation test FAILED with error:', err);
    process.exit(1);
  }

  // Cross-check all users
  for(let i=0; i<USERS.length; i++) {
    console.log(`\n验证 User ${i+1} (${USERS[i].email}) again...`);
    await signInWithEmailAndPassword(auth, USERS[i].email, USERS[i].password);
    const students = await api.students.list({ isAdmin: false });
    const docs = await api.documents.list({ isAdmin: false });
    const reports = await api.anonymousReports.list({ isAdmin: false });
    
    if (students.length !== 3) throw new Error(`Isolation failed for User ${i+1}: Found ${students.length} students instead of 3`);
    if (docs.length !== 3) throw new Error(`Isolation failed for User ${i+1}: Found ${docs.length} documents instead of 3`);
    if (reports.length !== 1) throw new Error(`Isolation failed for User ${i+1}: Found ${reports.length} reports instead of 1`);
    
    console.log(`✅ User ${i+1} isolation confirmed: 3 students, 3 records, 1 report.`);
    await signOut(auth);
  }

  console.log('\n✅ ALL E2E TESTS PASSED SUCCESSFULLY! 🚀');
}

runTest().catch(console.error);
