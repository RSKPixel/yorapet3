from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from .auth import current_user
from .db import fetch_all, fetch_one

router = APIRouter(dependencies=[Depends(current_user)])

# Sales and purchases share a shape: one row per voucher line item.
TABLES = {"sales": "tallysync_sales", "purchases": "tallysync_purchases"}


def _table(kind: str) -> str:
    if kind not in TABLES:
        raise HTTPException(404, "Unknown report")
    return TABLES[kind]


def _filters(date_from, date_to, q):
    where, params = ["1=1"], {}
    if date_from:
        where.append("voucher_date >= :df")
        params["df"] = date_from
    if date_to:
        where.append("voucher_date < DATE_ADD(:dt, INTERVAL 1 DAY)")
        params["dt"] = date_to
    if q:
        where.append("(ledger_name LIKE :q OR voucher_no LIKE :q OR stock_item LIKE :q)")
        params["q"] = f"%{q}%"
    return " AND ".join(where), params


@router.get("/{kind}/summary")
def summary(kind: str, date_from: Optional[date] = None, date_to: Optional[date] = None):
    t = _table(kind)
    where, params = _filters(date_from, date_to, None)
    totals = fetch_one(
        f"SELECT COALESCE(SUM(amount),0) AS amount, COALESCE(SUM(qty),0) AS qty, "
        f"COUNT(DISTINCT voucher_no) AS vouchers FROM {t} WHERE {where}",
        **params,
    )
    top_parties = fetch_all(
        f"SELECT ledger_name AS name, SUM(amount) AS amount FROM {t} WHERE {where} "
        f"GROUP BY ledger_name ORDER BY amount DESC LIMIT 10",
        **params,
    )
    top_items = fetch_all(
        f"SELECT stock_item AS name, SUM(qty) AS qty, SUM(amount) AS amount FROM {t} "
        f"WHERE {where} GROUP BY stock_item ORDER BY amount DESC LIMIT 10",
        **params,
    )
    daily = fetch_all(
        f"SELECT DATE(voucher_date) AS day, SUM(amount) AS amount FROM {t} WHERE {where} "
        f"GROUP BY DATE(voucher_date) ORDER BY day",
        **params,
    )
    return {"totals": totals, "top_parties": top_parties, "top_items": top_items, "daily": daily}


@router.get("/{kind}/vouchers")
def vouchers(
    kind: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 30,
):
    t = _table(kind)
    where, params = _filters(date_from, date_to, q)
    params.update(limit=min(page_size, 100), offset=(max(page, 1) - 1) * page_size)
    return fetch_all(
        f"SELECT voucher_no, DATE(MIN(voucher_date)) AS voucher_date, MIN(ledger_name) AS party, "
        f"COUNT(*) AS line_count, SUM(qty) AS qty, SUM(amount) AS amount FROM {t} WHERE {where} "
        f"GROUP BY voucher_no ORDER BY MIN(voucher_date) DESC, voucher_no DESC "
        f"LIMIT :limit OFFSET :offset",
        **params,
    )


@router.get("/{kind}/vouchers/{voucher_no}")
def voucher_detail(kind: str, voucher_no: str):
    t = _table(kind)
    lines = fetch_all(
        f"SELECT stock_item, brand, packing, qty, rate, amount FROM {t} "
        f"WHERE voucher_no = :v ORDER BY id",
        v=voucher_no,
    )
    if not lines:
        raise HTTPException(404, "Voucher not found")
    head = fetch_one(
        f"SELECT voucher_no, DATE(voucher_date) AS voucher_date, ledger_name AS party, broker "
        f"FROM {t} WHERE voucher_no = :v LIMIT 1",
        v=voucher_no,
    )
    return {**head, "total": sum(l["amount"] or 0 for l in lines), "lines": lines}


@router.get("/stock")
def stock(q: Optional[str] = None, group: Optional[str] = None):
    # Show the most recent synced period only.
    period = fetch_one(
        "SELECT period_from, period_to FROM tallysync_stocksummary "
        "ORDER BY period_to DESC, period_from DESC LIMIT 1"
    )
    if not period:
        return {"period": None, "groups": [], "items": []}
    where = ["period_from = :pf", "period_to = :pt"]
    params = {"pf": period["period_from"], "pt": period["period_to"]}
    if q:
        where.append("stock_item LIKE :q")
        params["q"] = f"%{q}%"
    if group:
        where.append("stock_group = :g")
        params["g"] = group
    items = fetch_all(
        "SELECT stock_group, stock_item, closing, closing_alt, alternate_unit, "
        "closing_rate, -closing_value AS closing_value FROM tallysync_stocksummary "
        f"WHERE {' AND '.join(where)} ORDER BY stock_group, stock_item",
        **params,
    )
    groups = fetch_all(
        "SELECT stock_group AS name, -SUM(closing_value) AS value FROM tallysync_stocksummary "
        "WHERE period_from = :pf AND period_to = :pt GROUP BY stock_group ORDER BY value DESC",
        pf=period["period_from"],
        pt=period["period_to"],
    )
    return {"period": period, "groups": groups, "items": items}
