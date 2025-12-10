// ----- DRINK DATA -----
const DRINKS = [
  { id: "LATTE", name: "Latte", price: 25000, image: "/ui/img/latte.png", qty: 0 },
  { id: "CAPPUCCINO", name: "Cappuccino", price: 27000, image: "/ui/img/cappuccino.png", qty: 0 },
  { id: "AMERICANO", name: "Americano", price: 20000, image: "/ui/img/americano.png", qty: 0 },
  { id: "MATCHA", name: "Matcha", price: 28000, image: "/ui/img/matcha.png", qty: 0 },
  { id: "JASMINE", name: "Jasmine Tea", price: 15000, image: "/ui/img/jasmine.png", qty: 0 },
  { id: "MACCHIATO", name: "Macchiato", price: 22000, image: "/ui/img/macchiato.png", qty: 0 },
];

// ----- VIEWS -----
const VIEWS = {
  home: document.getElementById("homeView"),
  order: document.getElementById("orderView"),
  report: document.getElementById("reportView"),
  finance: document.getElementById("financeView"), // New View
};

// ----- ELEMENTS -----
const drinksGrid = document.getElementById("drinksGrid");
const totalAmountEl = document.getElementById("totalAmount");

// Modals
const paymentModal = document.getElementById("paymentModal");
const cashModal = document.getElementById("cashModal");
const qrisModal = document.getElementById("qrisModal");
const passwordModal = document.getElementById("passwordModal");

// New Modals for Finance
const procurementModal = document.getElementById("procurementModal");
const invoiceModal = document.getElementById("invoiceModal");
const paySupplierModal = document.getElementById("paySupplierModal");

// Password Input
const reportPasswordInput = document.getElementById("reportPasswordInput");
const passwordError = document.getElementById("passwordError");

// Report Elements
const reportSummary = document.getElementById("reportSummary");
const reportTableBody = document.getElementById("reportTableBody");

// Finance Elements
const finRevenue = document.getElementById("finRevenue");
const finMaterialCount = document.getElementById("finMaterialCount");
const materialLogBody = document.getElementById("materialLogBody");

// Toast
const toastEl = document.getElementById("toast");

// Shared Password for Report & Finance
const PASSWORD = "12345";

// Track what we are unlocking with password ('report' or 'finance')
let passwordTarget = "report"; 

// ----- HELPERS -----

function showView(name) {
  Object.values(VIEWS).forEach((v) => v.classList.remove("active-view"));
  VIEWS[name].classList.add("active-view");
}

function formatIDR(n) {
  return "IDR " + n.toLocaleString("id-ID");
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 2500);
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

function resetCart() {
  DRINKS.forEach((d) => (d.qty = 0));
  renderDrinks();
  updateTotal();
}

// ----- SALES LOGIC -----

function renderDrinks() {
  drinksGrid.innerHTML = "";
  DRINKS.forEach((drink, index) => {
    const card = document.createElement("div");
    card.className = "drink-card";

    const img = document.createElement("img");
    img.className = "drink-image";
    img.src = drink.image;
    img.alt = drink.name;
    card.appendChild(img);

    const name = document.createElement("div");
    name.className = "drink-name";
    name.textContent = drink.name;
    card.appendChild(name);

    const price = document.createElement("div");
    price.className = "drink-price";
    price.textContent = formatIDR(drink.price);
    card.appendChild(price);

    const qtyRow = document.createElement("div");
    qtyRow.className = "quantity-row";
    const label = document.createElement("div");
    label.textContent = "Qty";
    qtyRow.appendChild(label);

    const controls = document.createElement("div");
    controls.className = "qty-controls";

    const btnMinus = document.createElement("button");
    btnMinus.className = "qty-btn";
    btnMinus.textContent = "-";
    btnMinus.onclick = () => changeQty(index, -1);

    const qtyVal = document.createElement("span");
    qtyVal.className = "qty-value";
    qtyVal.textContent = drink.qty;

    const btnPlus = document.createElement("button");
    btnPlus.className = "qty-btn";
    btnPlus.textContent = "+";
    btnPlus.onclick = () => changeQty(index, 1);

    controls.appendChild(btnMinus);
    controls.appendChild(qtyVal);
    controls.appendChild(btnPlus);
    qtyRow.appendChild(controls);

    card.appendChild(qtyRow);
    drinksGrid.appendChild(card);
  });
}

function changeQty(index, delta) {
  const drink = DRINKS[index];
  const newQty = Math.max(0, drink.qty + delta);
  drink.qty = newQty;
  renderDrinks();
  updateTotal();
}

function updateTotal() {
  const total = DRINKS.reduce((sum, d) => sum + d.qty * d.price, 0);
  totalAmountEl.textContent = formatIDR(total);
}

// ----- API CALLS (SALES) -----

async function createOrder() {
  const items = DRINKS.filter((d) => d.qty > 0).map((d) => ({
    sku: d.id,
    name: d.name,
    qty: d.qty,
    unitPrice: d.price,
  }));
  const subtotal = items.reduce((s, item) => s + item.qty * item.unitPrice, 0);

  const payload = {
    orderId: null,
    cartId: "CART-WEB",
    productList: items,
    totalPrice: { subtotal, grandTotal: subtotal },
    currency: "IDR",
    channel: "WEB",
  };

  const res = await fetch("/api/createOrder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Create order failed");
  return res.json();
}

async function confirmPayment(orderId, amount, method) {
  const now = new Date().toISOString();
  const payload = {
    orderId,
    transactionId: "TXN-" + Date.now(),
    amount,
    method,
    status: "CAPTURED",
    paidAt: now,
  };
  const res = await fetch("/api/confirmPayment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Confirm payment failed");
  return res.json();
}

async function sendToKitchen(orderId, amount, method) {
  const now = new Date().toISOString();
  const items = DRINKS.filter((d) => d.qty > 0).map((d) => ({
    sku: d.id,
    qty: d.qty,
  }));
  const payload = {
    orderId,
    cartId: "CART-WEB",
    payment: { status: "CAPTURED", method, transactionId: "TXN-" + Date.now() },
    items,
    eventType: "FULFILLMENT",
    fulfilledAt: now,
    idempotencyKey: orderId + "-F1",
  };
  const res = await fetch("/api/sendToKitchen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Send to kitchen failed");
  return res.json();
}

async function loadReport() {
  const res = await fetch("/api/reportSales");
  if (!res.ok) throw new Error("Failed to load report");
  const data = await res.json();
  renderReport(data);
}

function renderReport(data) {
  const summary = data.summary || {};
  reportSummary.textContent = `Orders: ${summary.orders || 0}  •  Revenue: ${
    summary.revenue ? formatIDR(summary.revenue) : "IDR 0"
  }  •  Paid Orders: ${summary.paidOrders || 0}`;

  reportTableBody.innerHTML = "";
  (data.rows || []).forEach((row) => {
    const tr = document.createElement("tr");
    const itemsText = (row.items || [])
      .map((item) => `${item.qty}x ${item.name || item.sku}`)
      .join(", ");
    tr.innerHTML = `
      <td>${row.orderId}</td>
      <td>${row.paidAt || ""}</td>
      <td>${itemsText}</td>
      <td>${formatIDR(row.amount || 0)}</td>
      <td>${row.method || ""}</td>
      <td>${row.kitchenTicketId || ""}</td>
    `;
    reportTableBody.appendChild(tr);
  });
}

// ----- FINANCE LOGIC -----

async function loadFinanceDashboard() {
  // 1. Get Revenue via proxy
  try {
    const resSales = await fetch("/api/getSalesReport");
    const salesData = await resSales.json();
    const rev = salesData.summary ? salesData.summary.revenue : 0;
    finRevenue.textContent = formatIDR(rev);
  } catch (e) {
    console.error(e);
    finRevenue.textContent = "Error";
  }

  // 2. Get Raw Material Logs
  try {
    const resMat = await fetch("/api/getRawMaterialLog");
    const logs = await resMat.json();
    
    finMaterialCount.textContent = logs.length + " Batches";
    materialLogBody.innerHTML = "";
    
    logs.slice().reverse().forEach(log => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${log.batchId || "-"}</td>
        <td>${log.sku || "-"}</td>
        <td>${log.quantity || 0}</td>
        <td>${log.timestamp || "-"}</td>
      `;
      materialLogBody.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
  }
}

// API Calls for Forms

async function submitProcurement() {
  const supplierId = document.getElementById("procSupplier").value;
  const cost = parseInt(document.getElementById("procCost").value) || 0;
  
  if(!supplierId || cost <= 0) {
    showToast("Invalid Input");
    return;
  }

  const payload = {
    procurementId: "PROC-" + Date.now(),
    supplierId: supplierId,
    items: [{ sku: "GENERAL-STOCK", qty: 1, cost: cost }], // Simplified
    totalCost: cost,
    timestamp: new Date().toISOString()
  };

  try {
    await fetch("/api/recordProcurement", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showToast("Procurement Recorded!");
    closeModal(procurementModal);
    loadFinanceDashboard(); // Refresh
  } catch(e) {
    showToast("Error recording");
  }
}

async function submitInvoice() {
  const supplierId = document.getElementById("invSupplier").value;
  const amount = parseInt(document.getElementById("invAmount").value) || 0;
  const dateVal = document.getElementById("invDueDate").value;

  if(!supplierId || amount <= 0) return showToast("Invalid Input");

  const payload = {
    supplierId: supplierId,
    details: [{ description: "General Invoice", amount: amount }],
    totalAmount: amount,
    dueDate: dateVal
  };

  try {
    await fetch("/api/createPaymentInvoice", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showToast("Invoice Created!");
    closeModal(invoiceModal);
  } catch(e) {
    showToast("Error creating invoice");
  }
}

async function submitPaySupplier() {
  const suppId = document.getElementById("paySuppId").value;
  const procId = document.getElementById("payProcId").value;
  const amount = parseInt(document.getElementById("payAmount").value) || 0;

  if(!suppId || amount <= 0) return showToast("Invalid Input");

  const payload = {
    supplierId: suppId,
    procurementId: procId,
    amount: amount,
    reference: "BANK-" + Date.now()
  };

  try {
    await fetch("/api/paySupplier", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showToast("Payment Recorded!");
    closeModal(paySupplierModal);
  } catch(e) {
    showToast("Payment Failed");
  }
}


// ----- PAYMENT FLOW (SALES) -----

async function handleCashPaid() {
  try {
    const total = DRINKS.reduce((sum, d) => sum + d.qty * d.price, 0);
    if (total === 0) {
      showToast("Cart is empty");
      return;
    }
    closeModal(cashModal);
    closeModal(paymentModal);
    showToast("Processing...");

    const order = await createOrder();
    await confirmPayment(order.orderId, total, "CASH");
    await sendToKitchen(order.orderId, total, "CASH");

    showToast("Order Sent to Kitchen!");
    resetCart();
    showView("home");
  } catch (err) {
    console.error(err);
    showToast("Error completing order");
  }
}

function handleCashCancel() {
  resetCart();
  closeModal(cashModal);
  closeModal(paymentModal);
  showToast("Cancelled");
}

// ----- PASSWORD FLOW -----

function openPasswordModal(target) {
  passwordTarget = target;
  passwordError.textContent = "";
  reportPasswordInput.value = "";
  openModal(passwordModal);
}

async function handlePasswordSubmit() {
  if (reportPasswordInput.value !== PASSWORD) {
    passwordError.textContent = "Incorrect password.";
    return;
  }
  closeModal(passwordModal);
  
  if (passwordTarget === "report") {
    showView("report");
    loadReport();
  } else if (passwordTarget === "finance") {
    showView("finance");
    loadFinanceDashboard();
  }
}

// ----- EVENT BINDINGS -----

// Home Navigation
document.getElementById("btnCreateOrder").addEventListener("click", () => showView("order"));
document.getElementById("btnReportSales").addEventListener("click", () => openPasswordModal("report"));
document.getElementById("btnFinanceDashboard").addEventListener("click", () => openPasswordModal("finance"));

// Back Buttons
document.getElementById("btnBackFromOrder").addEventListener("click", () => showView("home"));
document.getElementById("btnBackFromReport").addEventListener("click", () => showView("home"));
document.getElementById("btnBackFromFinance").addEventListener("click", () => showView("home"));

// Sales Buttons
document.getElementById("btnSubmitOrder").addEventListener("click", () => {
  const total = DRINKS.reduce((s, d) => s + d.qty * d.price, 0);
  if (total === 0) return showToast("Empty Cart");
  openModal(paymentModal);
});
document.getElementById("btnClosePaymentModal").addEventListener("click", () => closeModal(paymentModal));
document.getElementById("btnPayCash").addEventListener("click", () => {
  closeModal(paymentModal);
  openModal(cashModal);
});
document.getElementById("btnPayQris").addEventListener("click", () => {
  closeModal(paymentModal);
  openModal(qrisModal);
});
document.getElementById("btnCashPaid").addEventListener("click", handleCashPaid);
document.getElementById("btnCashCancel").addEventListener("click", handleCashCancel);
document.getElementById("btnQrisBack").addEventListener("click", () => {
  closeModal(qrisModal);
  openModal(paymentModal);
});

// Password Buttons
document.getElementById("btnSubmitPassword").addEventListener("click", handlePasswordSubmit);
document.getElementById("btnCancelPassword").addEventListener("click", () => closeModal(passwordModal));

// Finance Action Buttons
document.getElementById("btnOpenProcurement").addEventListener("click", () => openModal(procurementModal));
document.getElementById("btnOpenInvoice").addEventListener("click", () => openModal(invoiceModal));
document.getElementById("btnOpenPaySupplier").addEventListener("click", () => openModal(paySupplierModal));

// Finance Form Buttons
document.getElementById("btnSubmitProcurement").addEventListener("click", submitProcurement);
document.getElementById("btnCloseProcurement").addEventListener("click", () => closeModal(procurementModal));

document.getElementById("btnSubmitInvoice").addEventListener("click", submitInvoice);
document.getElementById("btnCloseInvoice").addEventListener("click", () => closeModal(invoiceModal));

document.getElementById("btnSubmitPaySupplier").addEventListener("click", submitPaySupplier);
document.getElementById("btnClosePaySupplier").addEventListener("click", () => closeModal(paySupplierModal));

// ----- INIT -----
renderDrinks();
updateTotal();
showView("home");