export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    if (!env.ASSETS) {
      return new Response(
        "ASSETS binding is missing.",
        {
          status: 500,
          headers: { "Content-Type": "text/plain" }
        }
      );
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleApi(request, env, url) {
  const path = url.pathname.slice(5);
  const parts = path.split("/").filter(Boolean);

  const resource = parts[0];
  const id = parts[1];

  try {

    // =========================================================
    // HEALTH
    // =========================================================

    if (resource === "health" && request.method === "GET") {
      await env.DB.prepare("SELECT 1").first();

      return json({
        ok: true,
        service: "SALTAN FASION",
        database: "connected",
        time: new Date().toISOString()
      });
    }


    // =========================================================
    // PRODUCTS
    // =========================================================

    if (resource === "products") {

      if (request.method === "GET") {
        const { results } = await env.DB
          .prepare(`
            SELECT *
            FROM products
            ORDER BY updated_at DESC
          `)
          .all();

        return json({
          ok: true,
          data: results || []
        });
      }

      if (request.method === "POST") {
        const body = await readJson(request);

        const productId = body.id || crypto.randomUUID();
        const timestamp = new Date().toISOString();

        await env.DB.prepare(`
          INSERT INTO products (
            id,
            name,
            cost,
            stock,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)

          ON CONFLICT(id)
          DO UPDATE SET
            name = excluded.name,
            cost = excluded.cost,
            stock = excluded.stock,
            updated_at = excluded.updated_at
        `).bind(
          productId,
          String(body.name || ""),
          number(body.cost),
          Math.max(0, Math.trunc(number(body.stock))),
          timestamp,
          timestamp
        ).run();

        return json({
          ok: true,
          id: productId
        }, 201);
      }

      if (request.method === "DELETE" && id) {
        await env.DB.prepare(`
          DELETE FROM products
          WHERE id = ?
        `).bind(id).run();

        return json({
          ok: true
        });
      }
    }


    // =========================================================
    // ORDERS
    // =========================================================

    if (resource === "orders") {

      if (request.method === "GET") {

        const { results } = await env.DB
          .prepare(`
            SELECT *
            FROM orders
            ORDER BY order_no DESC
          `)
          .all();

        return json({
          ok: true,
          data: results || []
        });
      }

      if (request.method === "POST") {

        const body = await readJson(request);

        const orderId = body.id || crypto.randomUUID();
        const timestamp = new Date().toISOString();

        await env.DB.prepare(`
          INSERT INTO orders (
            id,
            order_no,
            product_id,
            product_name,
            price,
            cost,
            delivery_cost,
            other_expense,
            status,
            order_date,
            customer_name,
            customer_phone,
            customer_location,
            payment_status,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

          ON CONFLICT(id)
          DO UPDATE SET
            order_no = excluded.order_no,
            product_id = excluded.product_id,
            product_name = excluded.product_name,
            price = excluded.price,
            cost = excluded.cost,
            delivery_cost = excluded.delivery_cost,
            other_expense = excluded.other_expense,
            status = excluded.status,
            order_date = excluded.order_date,
            customer_name = excluded.customer_name,
            customer_phone = excluded.customer_phone,
            customer_location = excluded.customer_location,
            payment_status = excluded.payment_status,
            updated_at = excluded.updated_at
        `).bind(
          orderId,
          Math.trunc(number(body.orderNo)),
          body.productId || null,
          String(body.productName || ""),
          number(body.price),
          number(body.cost),
          number(body.deliveryCost),
          number(body.otherExpense),
          body.status || "Pending",
          body.orderDate ||
            body.date ||
            timestamp.slice(0, 10),
          body.customerName || null,
          body.customerPhone || null,
          body.customerLocation || null,
          body.paymentStatus || body.payment || "Unpaid",
          timestamp,
          timestamp
        ).run();

        return json({
          ok: true,
          id: orderId
        }, 201);
      }

      if (request.method === "DELETE" && id) {

        await env.DB.prepare(`
          DELETE FROM orders
          WHERE id = ?
        `).bind(id).run();

        return json({
          ok: true
        });
      }
    }


    // =========================================================
    // PURCHASES
    // =========================================================

    if (resource === "purchases") {

      if (request.method === "GET") {

        const { results } = await env.DB
          .prepare(`
            SELECT *
            FROM purchases
            ORDER BY purchase_date DESC
          `)
          .all();

        return json({
          ok: true,
          data: results || []
        });
      }

      if (request.method === "POST") {

        const body = await readJson(request);

        const purchaseId = body.id || crypto.randomUUID();
        const timestamp = new Date().toISOString();

        await env.DB.prepare(`
          INSERT INTO purchases (
            id,
            product_id,
            product_name,
            quantity,
            cost_each,
            total,
            purchase_date,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)

          ON CONFLICT(id)
          DO UPDATE SET
            product_id = excluded.product_id,
            product_name = excluded.product_name,
            quantity = excluded.quantity,
            cost_each = excluded.cost_each,
            total = excluded.total,
            purchase_date = excluded.purchase_date
        `).bind(
          purchaseId,
          body.productId || null,
          String(body.productName || ""),
          Math.trunc(number(body.quantity)),
          number(body.costEach),
          number(body.total),
          body.purchaseDate ||
            body.date ||
            timestamp.slice(0, 10),
          timestamp
        ).run();

        return json({
          ok: true,
          id: purchaseId
        }, 201);
      }

      if (request.method === "DELETE" && id) {

        await env.DB.prepare(`
          DELETE FROM purchases
          WHERE id = ?
        `).bind(id).run();

        return json({
          ok: true
        });
      }
    }


    // =========================================================
    // EXPENSES
    // =========================================================

    if (resource === "expenses") {

      if (request.method === "GET") {

        const { results } = await env.DB
          .prepare(`
            SELECT *
            FROM expenses
            ORDER BY expense_date DESC
          `)
          .all();

        return json({
          ok: true,
          data: results || []
        });
      }

      if (request.method === "POST") {

        const body = await readJson(request);

        const expenseId = body.id || crypto.randomUUID();
        const timestamp = new Date().toISOString();

        await env.DB.prepare(`
          INSERT INTO expenses (
            id,
            title,
            amount,
            category,
            expense_date,
            notes,
            description,
            payment_method,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

          ON CONFLICT(id)
          DO UPDATE SET
            title = excluded.title,
            amount = excluded.amount,
            category = excluded.category,
            expense_date = excluded.expense_date,
            notes = excluded.notes,
            description = excluded.description,
            payment_method = excluded.payment_method,
            updated_at = excluded.updated_at
        `).bind(
          expenseId,
          String(body.title || body.description || ""),
          number(body.amount),
          body.category || "Other",
          body.expenseDate ||
            body.date ||
            timestamp.slice(0, 10),
          body.notes || "",
          body.description || body.title || "",
          body.paymentMethod || "Cash",
          timestamp,
          timestamp
        ).run();

        return json({
          ok: true,
          id: expenseId
        }, 201);
      }

      if (request.method === "DELETE" && id) {

        await env.DB.prepare(`
          DELETE FROM expenses
          WHERE id = ?
        `).bind(id).run();

        return json({
          ok: true
        });
      }
    }


    // =========================================================
    // SETTINGS
    // =========================================================

    if (resource === "settings") {

      if (request.method === "GET") {

        const row = await env.DB
          .prepare(`
            SELECT *
            FROM settings
            WHERE id = 'main'
            LIMIT 1
          `)
          .first();

        return json({
          ok: true,
          data: row || null
        });
      }

      if (request.method === "POST") {

        const body = await readJson(request);

        const timestamp = new Date().toISOString();

        await env.DB.prepare(`
          INSERT INTO settings (
            id,
            company_name,
            phone,
            whatsapp,
            address,
            email,
            logo,
            currency,
            updated_at
          )
          VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?)

          ON CONFLICT(id)
          DO UPDATE SET
            company_name = excluded.company_name,
            phone = excluded.phone,
            whatsapp = excluded.whatsapp,
            address = excluded.address,
            email = excluded.email,
            logo = excluded.logo,
            currency = excluded.currency,
            updated_at = excluded.updated_at
        `).bind(
          body.companyName || "",
          body.phone || "",
          body.whatsapp || "",
          body.address || "",
          body.email || "",
          body.logo || "",
          body.currency || "AED",
          timestamp
        ).run();

        return json({
          ok: true
        }, 201);
      }
    }


    return json({
      ok: false,
      error: "API route not found"
    }, 404);

  } catch (error) {

    return json({
      ok: false,
      error: error.message
    }, 500);
  }
}


async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}


function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}


function json(data, status = 200) {

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    }
  );
}