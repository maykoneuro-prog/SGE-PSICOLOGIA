import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './firebase';

async function testConnection() {
  try {
    const config = await import('../firebase-applet-config.json');
    console.log("Testing Firestore Connection to Database ID:", config.default.firestoreDatabaseId);
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful to:", config.default.firestoreDatabaseId);
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration: Client is offline.");
    } else {
      console.error("Firestore connection error details:", error);
    }
  }
}
testConnection();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
