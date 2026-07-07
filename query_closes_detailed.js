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

async function run() {
  try {
    console.log("Fetching detailed bill closings...");
    const closesSnap = await getDocs(collection(db, "f_bill_closings"));
    closesSnap.forEach(d => {
      const data = d.data();
      console.log(`Close: ID=${d.id}, farmerName=${data.farmerName}, fromDate=${data.fromDate}, toDate=${data.toDate}, commissionAmount=${data.commissionAmount}, otherCharges=${data.otherCharges}, timestamp=${data.timestamp}`);
    });
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err);
    process.exit(1);
  }
}

run();
