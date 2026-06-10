import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCcHIE9K6ZEY3y4guae0u8ibhuktxoB7OI",
  authDomain: "reviel-574aa.firebaseapp.com",
  projectId: "reviel-574aa",
  storageBucket: "reviel-574aa.firebasestorage.app",
  messagingSenderId: "652017628908",
  appId: "1:652017628908:web:090bb341e64b20d290d7c9",
  measurementId: "G-DPQV1HEQ1R",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
