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

async function checkEdits() {
  const histSnap = await getDocs(collection(db, "history"));
  console.log("=== CUSTOMER EDITS OR BALANCE LOGS ===");
  histSnap.forEach(d => {
    const data = d.data();
    const str = JSON.stringify(data);
    if (str.includes("Customer") || str.includes("balance") || str.includes("16200") || str.includes("Sri valli") || str.includes("valli")) {
      if (data.entityType === 'Customer' || str.includes("Edit") || str.includes("Update") || str.includes("16200") || str.includes("balance")) {
        console.log(data.date || data.createdAt, "|", data.actionType || data.action, "|", data.entityType, "|", data.details);
      }
    }
  });
}

checkEdits().then(() => process.exit(0)).catch(console.error);
