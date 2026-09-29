import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAwwHJCS42BWTOp9udAmBvFyAGJzQO2700",
  authDomain: "poovanam-24ba8.firebaseapp.com",
  projectId: "poovanam-24ba8",
  storageBucket: "poovanam-24ba8.firebasestorage.app",
  messagingSenderId: "555385420169",
  appId: "1:555385420169:web:824144f55979d076060958"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkHistory() {
  const histSnap = await getDocs(collection(db, "history"));
  console.log("=== ALL LOGS FOR SRI VALLI ===");
  histSnap.forEach(d => {
    const data = d.data();
    if (JSON.stringify(data).toLowerCase().includes("valli")) {
      console.log(data.date, data.time, "|", data.actionType || data.action, "|", data.entityType, "|", data.details);
    }
  });
}

checkHistory().then(() => process.exit(0)).catch(console.error);
