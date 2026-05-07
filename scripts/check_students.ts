
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, addDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkStudents() {
  console.log("Attempting to create a test student...");
  try {
    const testDoc = await addDoc(collection(db, "students"), {
      name: "Teste de Sistema",
      ra: "999999",
      schoolId: "test-school-id",
      ownerId: "system-test", // Note: This might fail if rules are strict about request.auth.uid
      createdAt: new Date()
    });
    console.log(`Test student created with ID: ${testDoc.id}`);
  } catch (err) {
    console.error("Failed to create test student:", err);
  }

  console.log("Checking all students regardless of filters...");
  const q = collection(db, "students");
  const snapshot = await getDocs(q);
  
  console.log(`Total students found: ${snapshot.size}`);

  if (snapshot.empty) {
    console.log("No students found in the database.");
    return;
  }

  const last10 = snapshot.docs.slice(-10);
  last10.forEach(doc => {
    console.log(`ID: ${doc.id}, Name: ${doc.data().name}, Unit: ${doc.data().unit}, SchoolId: ${doc.data().schoolId}, Owner: ${doc.data().ownerId}`);
  });
}

checkStudents().catch(console.error);
