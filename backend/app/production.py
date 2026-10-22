from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from .auth import current_user
from .db import execute, fetch_all, fetch_one

router = APIRouter(prefix="/production", tags=["production"], dependencies=[Depends(current_user)])

# Costs are derived, never stored: EB units = end - start, EB cost = units * rate,
# material cost = qty used * the Tally closing rate captured when the entry was saved.
EB_COST = "(eb_end - eb_start) * eb_rate"
MATERIAL_COST = "(preform_qty * COALESCE(preform_rate, 0) + cap_qty * COALESCE(cap_rate, 0))"
TOTAL_COST = f"({MATERIAL_COST} + {EB_COST} + labour_cost)"
COLUMNS = (
    "id, prod_date, output_item, output_qty, preform_item, preform_qty, preform_rate, "
    "cap_item, cap_qty, cap_rate, wastage_qty, eb_start, eb_end, eb_rate, labour_cost, notes, "
    f"(eb_end - eb_start) AS eb_units, {EB_COST} AS eb_cost, "
    f"{MATERIAL_COST} AS material_cost, {TOTAL_COST} AS total_cost"
)
LATEST_PERIOD = "(SELECT MAX(period_to) FROM tallysync_stocksummary)"


class ProductionIn(BaseModel):
    prod_date: date
    output_item: str = Field(min_length=1)
    output_qty: Decimal = Field(gt=0)
    preform_item: Optional[str] = None
    preform_qty: Decimal = Field(default=0, ge=0)
    cap_item: Optional[str] = None
    cap_qty: Decimal = Field(default=0, ge=0)
    wastage_qty: Decimal = Field(default=0, ge=0)
    eb_start: Decimal = Field(ge=0)
    eb_end: Decimal = Field(ge=0)
    eb_rate: Decimal = Field(ge=0)
    labour_cost: Decimal = Field(default=0, ge=0)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def check_reading(self):
        if self.eb_end < self.eb_start:
            raise ValueError("EB end reading cannot be less than start reading")
        return self


def _closing_rate(item):
    if not item:
        return None
    row = fetch_one(
        "SELECT closing_rate FROM tallysync_stocksummary WHERE stock_item = :i "
        "ORDER BY period_to DESC, period_from DESC LIMIT 1",
        i=item,
    )
    return row["closing_rate"] if row else None


def _rates(body, old=None):
    # Keep the rate an entry was saved with unless its material changed.
    def rate(kind):
        item = getattr(body, f"{kind}_item")
        if old and old[f"{kind}_item"] == item:
            return old[f"{kind}_rate"]
        return _closing_rate(item)

    return {"preform_rate": rate("preform"), "cap_rate": rate("cap")}


def _with_unit_cost(row):
    row["cost_per_unit"] = row["total_cost"] / row["output_qty"] if row["output_qty"] else None
    return row


def _filters(date_from, date_to, q):
    where, params = ["1=1"], {}
    if date_from:
        where.append("prod_date >= :df")
        params["df"] = date_from
    if date_to:
        where.append("prod_date <= :dt")
        params["dt"] = date_to
    if q:
        where.append("(output_item LIKE :q OR preform_item LIKE :q OR cap_item LIKE :q)")
        params["q"] = f"%{q}%"
    return " AND ".join(where), params


@router.get("/items")
def items():
    # Stock items for the pickers, grouped so the form can offer preforms / caps / products.
    return fetch_all(
        "SELECT i.stock_item AS name, i.stock_group AS `group`, MAX(s.closing_rate) AS rate "
        "FROM tallysync_inventory i LEFT JOIN tallysync_stocksummary s "
        f"ON s.stock_item = i.stock_item AND s.period_to = {LATEST_PERIOD} "
        "GROUP BY i.stock_item, i.stock_group ORDER BY i.stock_group, i.stock_item"
    )


@router.get("/summary")
def summary(date_from: Optional[date] = None, date_to: Optional[date] = None):
    where, params = _filters(date_from, date_to, None)
    totals = fetch_one(
        "SELECT COUNT(*) AS entries, COALESCE(SUM(output_qty),0) AS output_qty, "
        "COALESCE(SUM(wastage_qty),0) AS wastage_qty, "
        "COALESCE(SUM(eb_end - eb_start),0) AS eb_units, "
        f"COALESCE(SUM({EB_COST}),0) AS eb_cost, "
        f"COALESCE(SUM({MATERIAL_COST}),0) AS material_cost, "
        "COALESCE(SUM(labour_cost),0) AS labour_cost, "
        f"COALESCE(SUM({TOTAL_COST}),0) AS total_cost "
        f"FROM app_production WHERE {where}",
        **params,
    )
    by_item = fetch_all(
        "SELECT output_item AS name, SUM(output_qty) AS qty, "
        f"SUM({TOTAL_COST}) AS cost "
        f"FROM app_production WHERE {where} GROUP BY output_item ORDER BY qty DESC LIMIT 10",
        **params,
    )
    materials = fetch_all(
        f"SELECT preform_item AS name, SUM(preform_qty) AS qty FROM app_production "
        f"WHERE {where} AND preform_item IS NOT NULL GROUP BY preform_item "
        f"UNION ALL SELECT cap_item, SUM(cap_qty) FROM app_production "
        f"WHERE {where} AND cap_item IS NOT NULL GROUP BY cap_item ORDER BY qty DESC",
        **params,
    )
    return {"totals": totals, "by_item": by_item, "materials": materials}


@router.get("")
def list_entries(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 30,
):
    where, params = _filters(date_from, date_to, q)
    params.update(limit=min(page_size, 100), offset=(max(page, 1) - 1) * page_size)
    rows = fetch_all(
        f"SELECT {COLUMNS} FROM app_production WHERE {where} "
        "ORDER BY prod_date DESC, id DESC LIMIT :limit OFFSET :offset",
        **params,
    )
    return [_with_unit_cost(r) for r in rows]


def _get(entry_id: int):
    row = fetch_one(f"SELECT {COLUMNS} FROM app_production WHERE id = :id", id=entry_id)
    if not row:
        raise HTTPException(404, "Production entry not found")
    return _with_unit_cost(row)


@router.get("/{entry_id}")
def get_entry(entry_id: int):
    return _get(entry_id)


@router.post("")
def create_entry(body: ProductionIn, user=Depends(current_user)):
    fields = {**body.model_dump(), **_rates(body)}
    cols = ", ".join(fields)
    vals = ", ".join(f":{k}" for k in fields)
    new_id = execute(
        f"INSERT INTO app_production ({cols}, created_by) VALUES ({vals}, :uid)",
        **fields,
        uid=user["id"],
    )
    return _get(new_id)


@router.put("/{entry_id}")
def update_entry(entry_id: int, body: ProductionIn):
    old = _get(entry_id)
    fields = {**body.model_dump(), **_rates(body, old)}
    sets = ", ".join(f"{k} = :{k}" for k in fields)
    execute(f"UPDATE app_production SET {sets} WHERE id = :id", **fields, id=entry_id)
    return _get(entry_id)


@router.delete("/{entry_id}")
def delete_entry(entry_id: int):
    _get(entry_id)
    execute("DELETE FROM app_production WHERE id = :id", id=entry_id)
    return {"ok": True}
