import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDgqKxRv4DoIRDKY_A4pTzet66Dp8ICLr0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'maa-bhawani-catering.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://maa-bhawani-catering-default-rtdb.firebaseio.com/',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'maa-bhawani-catering',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'maa-bhawani-catering.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '816368894543',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:816368894543:web:1e5792d112f80c50fd603a'
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const firestoreDb = getFirestore(app);
