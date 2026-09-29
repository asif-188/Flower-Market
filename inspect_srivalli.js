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

async function inspect() {
  console.log("=== BUYER DOC FOR SRI VALLI ===");
  const buyersSnap = await getDocs(collection(db, "buyers"));
  buyersSnap.forEach(d => {
    const data = d.data();
    if (data.name?.toLowerCase().includes("valli") || data.displayId == 258 || data.displayId == "258") {
      console.log("ID:", d.id, JSON.stringify(data, null, 2));
    }
  });

  console.log("\n=== CUSTOMER EDIT/ADD HISTORY LOGS ===");
  const histSnap = await getDocs(collection(db, "history"));
  histSnap.forEach(d => {
    const data = d.data();
    if (data.entityType === 'Customer' && (JSON.stringify(data).toLowerCase().includes("valli") || JSON.stringify(data).includes("258"))) {
      console.log("CUSTOMER LOG:", JSON.stringify(data));
    }
  });
}

inspect().then(() => process.exit(0)).catch(console.error);
