import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

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

async function calc() {
  const buyerId = "t7A9phcCTc1sPYzIKtRr";
  
  // Sales
  const salesSnap = await getDocs(query(collection(db, "sales"), where("buyerId", "==", buyerId)));
  let totalSales = 0;
  let salesCount = 0;
  salesSnap.forEach(d => {
    const s = d.data();
    totalSales += Number(s.grandTotal || 0);
    salesCount++;
  });

  // Payments
  const paySnap = await getDocs(collection(db, "payments"));
  let totalPay = 0;
  let totalLess = 0;
  let payCount = 0;
  paySnap.forEach(d => {
    const p = d.data();
    if (p.entityId === buyerId && p.type === 'buyer') {
      totalPay += Number(p.amount || 0);
      totalLess += Number(p.cashLess || 0);
      payCount++;
    }
  });

  console.log("Sales count:", salesCount, "Total Sales:", totalSales);
  console.log("Pay count:", payCount, "Total Paid:", totalPay, "Total Less:", totalLess);
  console.log("Calculated Balance (Sales - Paid - Less):", totalSales - totalPay - totalLess);
  
  const buyerSnap = await getDocs(collection(db, "buyers"));
  buyerSnap.forEach(d => {
    if (d.id === buyerId) {
      console.log("Doc Balance in Firestore:", d.data().balance);
    }
  });
}

calc().then(() => process.exit(0)).catch(console.error);
