"""JSON encoding of table rows for backups, driven by each column's SQL type.

UUIDs become strings and dates/datetimes ISO 8601; arrays are encoded element by element; JSON,
strings, numbers and booleans pass through. decode_row is the exact inverse. Values that are not
strings where a UUID is expected (the platform reference markers) are left untouched by decode_row.
"""
import uuid
from collections.abc import Mapping
from datetime import date, datetime
from typing import Any

from sqlalchemy import ARRAY, Date, DateTime, Table, Uuid
from sqlalchemy.types import TypeEngine


def _encode(col_type: TypeEngine, value: Any) -> Any:
    if value is None:
        return None
    if isinstance(col_type, ARRAY):
        return [_encode(col_type.item_type, item) for item in value]
    if isinstance(col_type, Uuid):
        return str(value)
    if isinstance(col_type, (DateTime, Date)):
        return value.isoformat()
    return value


def _decode(col_type: TypeEngine, value: Any) -> Any:
    if value is None:
        return None
    if isinstance(col_type, ARRAY):
        return [_decode(col_type.item_type, item) for item in value]
    if isinstance(col_type, Uuid):
        return uuid.UUID(value) if isinstance(value, str) else value
    if isinstance(col_type, DateTime):
        return datetime.fromisoformat(value)
    if isinstance(col_type, Date):
        return date.fromisoformat(value)
    return value


def encode_row(table: Table, row: Mapping) -> dict:
    return {name: _encode(table.c[name].type, value) for name, value in row.items()}


def decode_row(table: Table, data: dict) -> dict:
    return {name: _decode(table.c[name].type, value) for name, value in data.items()}
