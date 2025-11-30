# ☕ **Dago Coffee - Sales & Order Subsystem API**

### System Integration Final Project

* **Author:** Group 1 (Leonard, Abi, Gabby)
* **Subsystem:** *Sales & Order*

*(Part of the Dago Coffee Integrated System: Sales/Order, Inventory+Procurement, Finance, Kitchen)*

This API provides the **Sales & Ordering** capabilities for the Dago Coffee ecosystem.
It connects with other subsystems (Finance, Kitchen, Inventory/Procurement) through well-structured endpoints using standard JSON payloads.

---

The subsystem handles:

✔ Customer order creation
✔ Payment confirmation
✔ Sending orders to the kitchen
✔ Persisting completed sales records
✔ Providing full reporting functionality

This API is designed for **easy integration** across all teams.

---

# 📌 **Related Subsystems (Based on Business Process Diagram)**

| Team                       | Subsystem                              | Description                                              |
| -------------------------- | -------------------------------------- | -------------------------------------------------------- |
| **Group 1 (My Team)** | **Sales / Order Subsystem (THIS API)** | Creates orders, processes payment info, sends to Kitchen |
| Group 2                 | Inventory + Procurement                | Tracks raw materials, receives alerts from Kitchen       |
| Group 3                 | Finance                                | Monitors payments, revenue, validation                   |
| Group 4                 | Kitchen                                | Receives kitchen tickets and prepares beverages          |

---

# ⭐ **Core Features of This API**

### 1️⃣ **Order Handling**

* Create new customer orders via `/api/createOrder`
* Store all order data in memory until paid

### 2️⃣ **Payment Confirmation**

* Finance Team or Payment Gateway should call `/api/confirmPayment`
* Validates amount and updates order status to `PAID`

### 3️⃣ **Kitchen Ticket Creation**

* Kitchen Team receives order via `/api/sendToKitchen`
* Generates a unique `kitchenTicketId`
* Persist sale record into `/data/sales.json` permanently

### 4️⃣ **Reporting**

* `/api/reportSales` gives full analytics:

  * Revenue
  * Order count
  * Filter by date range, cartId, paymentMethod

### 5️⃣ **Permanent Storage**

All **completed orders (PAID + sent to Kitchen)** are saved in:

```
/data/sales.json
```

This ensures reporting always works even after backend restart.

---

# 📁 **Project Structure**

```
project/
│
├── app.py                 → Main Flask backend
├── ui/                    → Frontend UI (Create Order & Report)
│    ├── index.html
│    ├── script.js
│    ├── style.css
│    └── img/
│
└── data/
     └── sales.json        → Persistent storage for completed sales
```

---

# 🚀 **Run the Server**

```bash
python app.py
```

Server runs at:

```
http://127.0.0.1:5000
```

UI available at:

```
http://127.0.0.1:5000/ui
```

---

# 📌 **API Endpoints Overview**

## 🔶 1. Create Order

### **POST** `/api/createOrder`

Creates a new order from the cart (Sales subsystem).

### Expected Request (createOrder.json)

```json
{
  "orderId": "CART-CLIENT-REF",
  "cartId": "CART-07",
  "productList": [
    { "sku": "LATTE-M", "qty": 2, "unitPrice": 25000 }
  ],
  "totalPrice": {
    "subtotal": 50000,
    "discount": 0,
    "tax": 0,
    "serviceFee": 0,
    "grandTotal": 50000
  },
  "currency": "IDR",
  "channel": "CART"
}
```

### Response

```json
{
  "orderId": "ORD-2025-11-30-00001",
  "status": "PENDING_PAYMENT",
  "createdAt": "2025-11-30T17:22:15Z"
}
```
This **orderId** must be used by **Finance** and **Kitchen**.

---

## 🔶 2. Confirm Payment

### **POST** `/api/confirmPayment`

To be called by **Finance subsystem** or payment gateway.

### Expected Request (confirmPayment.json)

```json
{
  "orderId": "ORD-2025-11-30-00001",
  "transactionId": "TXN-987654321",
  "amount": 50000,
  "method": "QRIS",
  "status": "CAPTURED",
  "paidAt": "2025-11-30T17:23:12Z"
}
```

### Response

```json
{
  "orderId": "ORD-2025-11-30-00001",
  "orderStatus": "PAID"
}
```
Only **PAID** orders can be sent to the **kitchen**.

---

## 🔶 3. Send to Kitchen

### **POST** `/api/sendToKitchen`

To be called by **Kitchen subsystem** after PAID status is confirmed.

### Clean Minimal Request (sendToKitchen.json)

```json
{
  "orderId": "ORD-2025-11-30-00001",
  "idempotencyKey": "ORD-2025-11-30-00001-K1"
}
```

### Response

```json
{
  "orderId": "ORD-2025-11-30-00001",
  "accepted": true,
  "kitchenTicketId": "KT-0001"
}
```

🎯 At this point, the following record is **saved to `/data/sales.json` permanently.**

---

## 🔶 4. Sales Reporting

### **GET** `/api/reportSales`

Parameters can be sent in query string:

Example request:

```
/api/reportSales?start=2025-11-01&end=2025-11-30&paymentMethod=QRIS&page=1&pageSize=20
```

Or JSON input (reportSales.json used by frontend):

```json
{
  "start": "2025-11-30",
  "end": "2025-11-30",
  "cartId": "CART-07",
  "paymentMethod": "QRIS",
  "page": 1,
  "pageSize": 50
}
```

### Example Response

```json
{
  "summary": {
    "orders": 1,
    "paidOrders": 1,
    "revenue": 62000,
    "currency": "IDR",
    "totalRows": 1,
    "pageSize": 50,
    "totalPages": 1
  },
  "rows": [
    {
      "orderId": "ORD-2025-11-30-00001",
      "paidAt": "2025-11-30T17:23:12Z",
      "cartId": "CART-07",
      "amount": 62000,
      "method": "CASH",
      "status": "PAID",
      "items": [
        { "sku": "LATTE-M", "qty": 1 },
        { "sku": "MACCHIATO", "qty": 1 }
      ],
      "kitchenTicketId": "KT-0001"
    }
  ],
  "page": 1,
  "hasMore": false
}
```

---

# 🧠 **Data Persistence Explained (Important for All Teams)**

### ☑ Temporary (Memory only)

* Orders created
* Payment confirmation

If server restarts → data gone

### ☑ Permanent (Stored in `/data/sales.json`)

* ONLY when Kitchen accepts the order
* Because this means:

  * Finance validated the payment
  * Kitchen accepts the order
  * Workflow is complete

This record persists forever.
