# ☕ **Dago Coffee — Sales & Order Subsystem API**

### System Integration Final Project

**Author:** Group 1 (Leonard, Abi, Gabby) – Information Systems, Sampoerna University
**Subsystem:** *Sales & Order*

---

# 📌 Overview

The **Sales & Order Subsystem** is the core service that connects:

* 🛒 Cart Team
* 💵 Finance/Payment Team
* 👨‍🍳 Kitchen Team
* 📊 Reporting/Back Office

This subsystem is responsible for:

* Creating orders
* Confirming payments
* Generating kitchen tickets
* Persisting sales records
* Providing filterable sales reports

This API is built using:

* **Flask (Python)**
* **JSON persistent storage (`data/sales.json`)**
* **In-memory temporary order store**
* **REST API design**
* **UI frontend (HTML + JS)** served at `/ui`

---

# 🗂 Directory Structure

```
project/
│
├── app.py                 # Main Flask backend
├── data/
│   └── sales.json         # Persistent sales storage
└── ui/
    ├── index.html         # Web UI
    ├── style.css
    ├── script.js
    └── img/               # Product images
```

`sales.json` persists **all completed + paid orders**, surviving restarts.

---

# 🚀 Getting Started

### 1. Install dependencies

```bash
pip install flask
```

### 2. Run the server

```bash
python app.py
```

Server will start at:

```
http://127.0.0.1:5000
```

### 3. Access Web UI

```
http://127.0.0.1:5000/ui
```

---

# 🔌 API ENDPOINTS OVERVIEW

| Method   | Endpoint              | Description                            |
| -------- | --------------------- | -------------------------------------- |
| **POST** | `/api/createOrder`    | Cart → Sales: creates order            |
| **POST** | `/api/confirmPayment` | Finance → Sales: confirm payment       |
| **POST** | `/api/sendToKitchen`  | Sales → Kitchen: send order to kitchen |
| **GET**  | `/api/reportSales`    | Reporting: filter + fetch sales data   |

---

# 🧩 1. **CREATE ORDER**

### `POST /api/createOrder`

Used by **Cart Team** to send an order to Sales.

### ✔ Required JSON Body

```json
{
  "orderId": "CUST-07",
  "cartId": "CART-07",
  "productList": [
    { "sku": "LATTE-M", "qty": 2, "unitPrice": 25000 },
    { "sku": "ESPRESSO", "qty": 1, "unitPrice": 15000 }
  ],
  "totalPrice": {
    "subtotal": 65000,
    "discount": 0,
    "tax": 0,
    "serviceFee": 0,
    "grandTotal": 65000
  },
  "currency": "IDR",
  "channel": "CART"
}
```

### ✔ Response Example

```json
{
  "orderId": "ORD-2025-11-30-00001",
  "status": "PENDING_PAYMENT",
  "createdAt": "2025-11-30T12:44:12Z"
}
```

📝 Order is stored **in memory only** until payment.

---

# 💵 2. **CONFIRM PAYMENT**

### `POST /api/confirmPayment`

Used by **Finance Team**.

### ✔ Required JSON Body

```json
{
  "orderId": "ORD-2025-11-30-00001",
  "transactionId": "TXN-987654321",
  "amount": 65000,
  "method": "QRIS",
  "status": "CAPTURED",
  "paidAt": "2025-11-30T12:45:55Z"
}
```

### ✔ Response Example

```json
{
  "orderId": "ORD-2025-11-30-00001",
  "orderStatus": "PAID"
}
```

🔍 On success, the order becomes `PAID`.

---

# 👨‍🍳 3. **SEND TO KITCHEN**

### `POST /api/sendToKitchen`

Used by the **Sales system** after payment is confirmed.

### ✔ Minimal Clean JSON Body

```json
{
  "orderId": "ORD-2025-11-30-00001",
  "idempotencyKey": "ORD-2025-11-30-00001-F1"
}
```

### Why idempotencyKey?

Prevents duplicate kitchen tickets:

* Same request multiple times → same ticket
* New key → new ticket

### ✔ Response Example

```json
{
  "orderId": "ORD-2025-11-30-00001",
  "accepted": true,
  "kitchenTicketId": "KT-0001"
}
```

### 📌 IMPORTANT:

When kitchen ticket is created, the system **persists to `data/sales.json`**:

```json
{
  "orderId": "ORD-2025-11-30-00001",
  "paidAt": "2025-11-30T12:45:55Z",
  "cartId": "CART-07",
  "amount": 65000,
  "method": "QRIS",
  "status": "PAID",
  "items": [...],
  "kitchenTicketId": "KT-0001"
}
```

---

# 📊 4. **REPORT SALES**

### `GET /api/reportSales`

Supports:

* Date range filtering
* Cart ID filtering
* Payment method filtering
* Pagination

### ✔ Query Parameters (optional)

| Param           | Type     | Example      |
| --------------- | -------- | ------------ |
| `start`         | ISO date | `2025-10-09` |
| `end`           | ISO date | `2025-10-09` |
| `cartId`        | string   | `CART-07`    |
| `paymentMethod` | string   | `QRIS`       |
| `page`          | int      | `1`          |
| `pageSize`      | int      | `50`         |

### Example Query

```
/api/reportSales?start=2025-10-09&end=2025-10-09&cartId=CART-07&paymentMethod=QRIS&page=1&pageSize=50
```

### ✔ Response Example

```json
{
  "summary": {
    "orders": 1,
    "paidOrders": 1,
    "revenue": 65000,
    "currency": "IDR",
    "totalRows": 1,
    "pageSize": 50,
    "totalPages": 1
  },
  "rows": [
    {
      "orderId": "ORD-2025-11-30-00001",
      "paidAt": "2025-11-30T12:45:55Z",
      "cartId": "CART-07",
      "amount": 65000,
      "method": "QRIS",
      "status": "PAID",
      "items": [...]
    }
  ],
  "page": 1,
  "hasMore": false
}
```

---

# 🧪 HOW TO TEST THE API (Using Git Bash)

---

## ✔ Test 1: Create Order

```bash
curl -X POST -H "Content-Type: application/json" \
-d @createOrder.json \
http://127.0.0.1:5000/api/createOrder
```

---

## ✔ Test 2: Confirm Payment

```bash
curl -X POST -H "Content-Type: application/json" \
-d @confirmPayment.json \
http://127.0.0.1:5000/api/confirmPayment
```

---

## ✔ Test 3: Send to Kitchen

```bash
curl -X POST -H "Content-Type: application/json" \
-d @sendToKitchen.json \
http://127.0.0.1:5000/api/sendToKitchen
```

---

## ✔ Test 4: Report Sales

```bash
curl "http://127.0.0.1:5000/api/reportSales?start=2025-10-09&end=2025-10-09"
```

---

# 💾 DATA PERSISTENCE

Only **completed & paid orders** are persisted in:

```
/data/sales.json
```

Temporary orders (before payment) exist only **in memory** and do not survive server restarts.

---

# 🔄 Data Flow Summary

### 1. Cart → Sales

`/api/createOrder`
System creates Sales Order ID.

### 2. Finance → Sales

`/api/confirmPayment`
Order becomes PAID.

### 3. Sales → Kitchen

`/api/sendToKitchen`
Generates Kitchen Ticket → stored in `sales.json`.

### 4. Admin → Reporting

`/api/reportSales`
Retrieve history and analytics.

---

# 🏁 Limitations

* No authentication (open API)
* sales.json can grow large (not for production)
* Orders before payment are not saved permanently
* No retry queue or async processing
