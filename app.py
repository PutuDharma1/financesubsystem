import os
from flask import Flask, send_from_directory, request, jsonify
from datetime import datetime, date
import itertools
import json

app = Flask(__name__)

# FORCE Flask to use the correct UI directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UI_DIR = os.path.join(BASE_DIR, "ui")
print("SERVING UI FROM:", UI_DIR)

DATA_DIR = os.path.join(BASE_DIR, "data")
SALES_FILE = os.path.join(DATA_DIR, "sales.json")

os.makedirs(DATA_DIR, exist_ok=True)

def load_sales():
    if not os.path.exists(SALES_FILE):
        return []
    try:
        with open(SALES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_sales(sales):
    with open(SALES_FILE, "w", encoding="utf-8") as f:
        json.dump(sales, f, ensure_ascii=False, indent=2)

# ----------------------
# In-memory "database"
# ----------------------
orders = {}
kitchen_tickets = {}

order_counter = itertools.count(1)
kitchen_counter = itertools.count(1)


# ----------------------
# ID generators
# ----------------------
def generate_order_id():
    today = date.today().strftime("%Y-%m-%d")
    seq = next(order_counter)
    return f"ORD-{today}-{seq:05d}"


def generate_kitchen_ticket_id():
    seq = next(kitchen_counter)
    return f"KT-{seq:04d}"


def parse_iso_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


# ----------------------
# Serve UI
# ----------------------
@app.route("/ui")
def ui_home():
    return send_from_directory(UI_DIR, "index.html")


@app.route("/ui/<path:filename>")
def ui_files(filename):
    return send_from_directory(UI_DIR, filename)


# ----------------------
# Homepage
# ----------------------
@app.route("/")
def home():
    return {
        "status": "running",
        "service": "Dago Coffee Integrated System (Sales + Finance)",
        "endpoints": [
            "/api/createOrder",
            "/api/confirmPayment",
            "/api/sendToKitchen",
            "/api/reportSales",
            "/api/receivePaymentGateway",
            "/api/getSalesReport",
            "/api/generateFinanceReport",
            "/api/createPaymentInvoice",
            "/api/getRawMaterialLog",
            "/api/recordProcurement",
            "/api/paySupplier"
        ],
        "ui": "/ui"
    }


# ----------------------
# POST /api/createOrder
# ----------------------
@app.route("/api/createOrder", methods=["POST"])
def create_order():
    payload = request.get_json(force=True)

    new_order_id = generate_order_id()
    created_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"

    orders[new_order_id] = {
        "orderId": new_order_id,
        "cartOrderRef": payload.get("orderId"),
        "cartId": payload.get("cartId"),
        "productList": payload.get("productList", []),
        "totalPrice": payload.get("totalPrice", {}),
        "currency": payload.get("currency", "IDR"),
        "channel": payload.get("channel", "CART"),
        "status": "PENDING_PAYMENT",
        "createdAt": created_at,
        "payment": None,
        "paidAt": None,
        "kitchenTicketId": None,
    }

    return jsonify({
        "orderId": new_order_id,
        "status": "PENDING_PAYMENT",
        "createdAt": created_at
    }), 201


# ----------------------
# POST /api/confirmPayment
# ----------------------
@app.route("/api/confirmPayment", methods=["POST"])
def confirm_payment():
    payload = request.get_json(force=True)
    order_id = payload.get("orderId")

    if order_id not in orders:
        return jsonify({"error": "ORDER_NOT_FOUND"}), 404

    order = orders[order_id]

    amount = payload.get("amount")
    expected = order.get("totalPrice", {}).get("grandTotal")

    if expected is not None and amount != expected:
        return jsonify({"error": "AMOUNT_MISMATCH"}), 400

    order["payment"] = {
        "transactionId": payload.get("transactionId"),
        "amount": amount,
        "method": payload.get("method"),
        "status": payload.get("status"),
        "paidAt": payload.get("paidAt"),
    }

    order["status"] = "PAID" if payload.get("status") == "CAPTURED" else "PENDING_PAYMENT"
    order["paidAt"] = payload.get("paidAt")

    return jsonify({
        "orderId": order_id,
        "orderStatus": order["status"]
    })


# ----------------------
# POST /api/sendToKitchen
# ----------------------
@app.route("/api/sendToKitchen", methods=["POST"])
def send_to_kitchen():
    payload = request.get_json(force=True)
    order_id = payload.get("orderId")
    idem = payload.get("idempotencyKey")

    if order_id not in orders:
        return jsonify({"error": "ORDER_NOT_FOUND"}), 404

    order = orders[order_id]

    if idem and idem in kitchen_tickets:
        return jsonify(kitchen_tickets[idem])

    if order["status"] != "PAID":
        return jsonify({"error": "ORDER_NOT_PAID"}), 400

    ticket_id = generate_kitchen_ticket_id()
    order["kitchenTicketId"] = ticket_id

    response = {
        "orderId": order_id,
        "accepted": True,
        "kitchenTicketId": ticket_id
    }

    if idem:
        kitchen_tickets[idem] = response

    # Persist to sales.json
    sales = load_sales()
    amount = (
        (order.get("payment") or {}).get("amount")
        or order.get("totalPrice", {}).get("grandTotal", 0)
    )
    sale_record = {
        "orderId": order["orderId"],
        "paidAt": order.get("paidAt"),
        "cartId": order.get("cartId"),
        "amount": amount,
        "method": (order.get("payment") or {}).get("method"),
        "status": order.get("status"),
        "items": order.get("productList", []),
        "kitchenTicketId": ticket_id,
    }
    sales.append(sale_record)
    save_sales(sales)

    return jsonify(response)


# ----------------------
# GET /api/reportSales
# ----------------------
@app.route("/api/reportSales", methods=["GET"])
def report_sales():
    start_str = request.args.get("start")
    end_str = request.args.get("end")
    cart_id = request.args.get("cartId")
    payment_method = request.args.get("paymentMethod")
    page = int(request.args.get("page", 1))
    page_size = int(request.args.get("pageSize", 50))

    sales = load_sales()

    # Filter
    filtered = sales

    if start_str:
        start_date = datetime.fromisoformat(start_str).date()
        filtered = [
            s for s in filtered
            if s.get("paidAt") and parse_iso_datetime(s["paidAt"]).date() >= start_date
        ]

    if end_str:
        end_date = datetime.fromisoformat(end_str).date()
        filtered = [
            s for s in filtered
            if s.get("paidAt") and parse_iso_datetime(s["paidAt"]).date() <= end_date
        ]

    if cart_id:
        filtered = [s for s in filtered if s.get("cartId") == cart_id]

    if payment_method:
        filtered = [s for s in filtered if s.get("method") == payment_method]

    total_rows = len(filtered)
    total_pages = max(1, (total_rows + page_size - 1) // page_size)

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_items = filtered[start_idx:end_idx]

    total_revenue = sum(s.get("amount", 0) for s in filtered)

    summary = {
        "orders": total_rows,
        "paidOrders": total_rows,
        "revenue": total_revenue,
        "currency": "IDR",
        "totalRows": total_rows,
        "pageSize": page_size,
        "totalPages": total_pages
    }

    return jsonify({
        "summary": summary,
        "rows": page_items,
        "page": page,
        "hasMore": page < total_pages
    })

# =====================================================================
# FINANCE SUBSYSTEM (ADDED BELOW)
# =====================================================================

FINANCE_FILE = os.path.join(DATA_DIR, "finance_data.json")

# ----------------------
# Finance Helpers
# ----------------------
def load_finance():
    default_data = {
        "paymentGatewayLogs": [],
        "financeReports": [],
        "invoices": [],
        "rawMaterialLogs": [],
        "procurementLogs": [],
        "supplierPayments": []
    }
    if not os.path.exists(FINANCE_FILE):
        return default_data
    try:
        with open(FINANCE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Ensure keys exist
            for key in default_data:
                if key not in data:
                    data[key] = []
            return data
    except Exception:
        return default_data

def save_finance(data):
    with open(FINANCE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_utc_now():
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"

# ----------------------
# Finance Variables
# ----------------------
invoice_counter = itertools.count(1)

def generate_invoice_id():
    seq = next(invoice_counter)
    return f"INV-{seq:05d}"

# ----------------------
# POST /api/receivePaymentGateway
# ----------------------
@app.route("/api/receivePaymentGateway", methods=["POST"])
def receive_payment_gateway():
    payload = request.get_json(force=True)
    finance_data = load_finance()

    log_entry = {
        "transactionId": payload.get("transactionId"),
        "orders": payload.get("orders", []),
        "amount": payload.get("amount"),
        "method": payload.get("method"),
        "settledAt": payload.get("settledAt"),
        "reference": payload.get("reference"),
        "receivedAt": get_utc_now()
    }

    finance_data["paymentGatewayLogs"].append(log_entry)
    save_finance(finance_data)

    return jsonify({
        "status": "RECEIVED",
        "data": log_entry
    }), 201

# ----------------------
# GET /api/getSalesReport
# ----------------------
@app.route("/api/getSalesReport", methods=["GET"])
def get_sales_report():
    # Proxies to the existing Sales API internally
    return report_sales()

# ----------------------
# GET /api/generateFinanceReport
# ----------------------
@app.route("/api/generateFinanceReport", methods=["GET"])
def generate_finance_report():
    finance_data = load_finance()

    summary = {
        "totalPayments": len(finance_data.get("paymentGatewayLogs", [])),
        "procurementCount": len(finance_data.get("procurementLogs", [])),
        "supplierPayments": len(finance_data.get("supplierPayments", [])),
        "rawMaterialLogCount": len(finance_data.get("rawMaterialLogs", []))
    }

    report = {
        "generatedAt": get_utc_now(),
        "salesSummary": summary,
        "rawMaterialLogs": finance_data.get("rawMaterialLogs", [])
    }

    finance_data["financeReports"].append(report)
    save_finance(finance_data)

    return jsonify(report)

# ----------------------
# POST /api/createPaymentInvoice
# ----------------------
@app.route("/api/createPaymentInvoice", methods=["POST"])
def create_payment_invoice():
    payload = request.get_json(force=True)
    finance_data = load_finance()

    new_invoice_id = generate_invoice_id()
    created_at = get_utc_now()

    invoice = {
        "invoiceId": new_invoice_id,
        "supplierId": payload.get("supplierId"),
        "details": payload.get("details", []),
        "totalAmount": payload.get("totalAmount"),
        "dueDate": payload.get("dueDate"),
        "createdAt": created_at
    }

    finance_data["invoices"].append(invoice)
    save_finance(finance_data)

    return jsonify(invoice), 201

# ----------------------
# GET /api/getRawMaterialLog
# ----------------------
@app.route("/api/getRawMaterialLog", methods=["GET"])
def get_raw_material_log():
    finance_data = load_finance()
    logs = finance_data.get("rawMaterialLogs", [])
    return jsonify(logs)

# ----------------------
# POST /api/recordProcurement
# ----------------------
@app.route("/api/recordProcurement", methods=["POST"])
def record_procurement():
    payload = request.get_json(force=True)
    finance_data = load_finance()

    procurement = {
        "procurementId": payload.get("procurementId"),
        "supplierId": payload.get("supplierId"),
        "items": payload.get("items", []),
        "totalCost": payload.get("totalCost"),
        "timestamp": payload.get("timestamp"),
        "recordedAt": get_utc_now()
    }

    finance_data["procurementLogs"].append(procurement)
    save_finance(finance_data)

    return jsonify({
        "status": "RECORDED",
        "data": procurement
    }), 201

# ----------------------
# POST /api/paySupplier
# ----------------------
@app.route("/api/paySupplier", methods=["POST"])
def pay_supplier():
    payload = request.get_json(force=True)
    finance_data = load_finance()

    payment = {
        "supplierId": payload.get("supplierId"),
        "procurementId": payload.get("procurementId"),
        "amount": payload.get("amount"),
        "reference": payload.get("reference"),
        "paidAt": get_utc_now()
    }

    finance_data["supplierPayments"].append(payment)
    save_finance(finance_data)

    return jsonify({
        "status": "PAID",
        "data": payment
    }), 201

if __name__ == "__main__":
    app.run(debug=True)