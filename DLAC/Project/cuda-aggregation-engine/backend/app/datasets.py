"""Dataset generation, CSV validation and the in-memory dataset store."""
from __future__ import annotations

import csv
import threading
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
import psutil

from . import config
from .errors import ApiError

F32_MAX = float(np.finfo(np.float32).max)
DISTRIBUTIONS = {
    "integers": "Random integers 1-1000 (same generator as the notebook)",
    "uniform": "Uniform random decimals 0-1000",
    "normal": "Normal distribution, mean 500, std-dev 100",
}
PRESETS = {
    "small": {"label": "Small", "size": 100_000},
    "medium": {"label": "Medium", "size": 1_000_000},
    "large": {"label": "Large", "size": 10_000_000},
    "xlarge": {"label": "Extra large", "size": 50_000_000},
}


@dataclass
class Dataset:
    id: str
    name: str
    source: str            # preset | generated | csv
    data: np.ndarray       # float32, 1-D, C-contiguous
    stats: dict            # float64 reference statistics (computed independently of the GPU)
    report: dict | None = None
    created: float = field(default_factory=time.time)

    def public(self) -> dict:
        n = int(self.data.size)
        return {
            "id": self.id, "name": self.name, "source": self.source, "size": n,
            "bytes": int(self.data.nbytes), "created": self.created,
            "min": self.stats["min"], "max": self.stats["max"],
            "report": self.report,
        }


def compute_stats(data: np.ndarray) -> dict:
    """Float64 reference statistics, computed chunk-wise to bound memory."""
    n = int(data.size)
    s = sa = 0.0
    mn, mx = np.inf, -np.inf
    step = 4_000_000
    for i in range(0, n, step):
        c = data[i:i + step]
        s += float(np.sum(c, dtype=np.float64))
        sa += float(np.sum(np.abs(c), dtype=np.float64))
        mn = min(mn, float(c.min()))
        mx = max(mx, float(c.max()))
    return {"n": n, "sum": s, "sum_abs": sa, "min": mn, "max": mx}


def check_memory(n: int, factor: float, what: str) -> None:
    """Refuse (clearly) rather than let the process be OOM-killed."""
    if n > config.MAX_ELEMENTS:
        raise ApiError(413, "dataset_too_large",
                       f"{n:,} elements exceeds this server's limit of {config.MAX_ELEMENTS:,}.",
                       "Choose a smaller size, or raise MAX_ELEMENTS before starting the backend.")
    need = int(n * 4 * factor)
    avail = psutil.virtual_memory().available
    if need > avail * 0.85:
        raise ApiError(507, "insufficient_host_memory",
                       f"{what} needs about {need / 2**30:.2f} GB of RAM but only "
                       f"{avail / 2**30:.2f} GB is free on the Colab machine.",
                       "Pick a smaller dataset, delete stored datasets, or restart the Colab runtime.")


class Store:
    """Keeps a few datasets in RAM; the least recently used one is evicted."""

    def __init__(self) -> None:
        self._items: "OrderedDict[str, Dataset]" = OrderedDict()
        self._lock = threading.Lock()

    def add(self, ds: Dataset) -> list[str]:
        evicted = []
        with self._lock:
            self._items[ds.id] = ds
            while len(self._items) > config.MAX_STORED_DATASETS:
                _, old = self._items.popitem(last=False)
                evicted.append(old.name)
        return evicted

    def get(self, ds_id: str) -> Dataset:
        with self._lock:
            ds = self._items.get(ds_id)
            if ds is None:
                raise ApiError(404, "dataset_not_found",
                               "That dataset is not on the backend (the Colab runtime may have restarted, "
                               "or it was evicted to free memory).",
                               "Generate or upload the dataset again.")
            self._items.move_to_end(ds_id)
            return ds

    def delete(self, ds_id: str) -> None:
        with self._lock:
            if self._items.pop(ds_id, None) is None:
                raise ApiError(404, "dataset_not_found", "Dataset not found.")

    def list(self) -> list[dict]:
        with self._lock:
            return [d.public() for d in reversed(self._items.values())]

    def find_preset(self, key: str) -> Dataset | None:
        with self._lock:
            for d in self._items.values():
                if d.source == "preset" and d.name == key:
                    return d
        return None


STORE = Store()


# --------------------------------------------------------------------------
# Generators
# --------------------------------------------------------------------------
def generate_array(n: int, distribution: str, seed: int | None) -> np.ndarray:
    if distribution not in DISTRIBUTIONS:
        raise ApiError(422, "bad_distribution", f"Unknown distribution '{distribution}'.",
                       "Use one of: " + ", ".join(DISTRIBUTIONS))
    if n < 1:
        raise ApiError(422, "bad_size", "Dataset size must be at least 1 element.")
    check_memory(n, 3.0, f"Generating {n:,} values")
    rng = np.random.default_rng(seed)
    if distribution == "integers":
        arr = rng.integers(1, 1001, size=n, dtype=np.int32).astype(np.float32)
    elif distribution == "uniform":
        arr = (rng.random(n, dtype=np.float32) * np.float32(1000.0))
    else:
        arr = rng.normal(500.0, 100.0, size=n).astype(np.float32)
    return np.ascontiguousarray(arr)


def create_generated(n: int, distribution: str, seed: int | None, name: str | None,
                     source: str = "generated", persist: bool = True) -> tuple[Dataset, list[str]]:
    arr = generate_array(n, distribution, seed)
    ds = Dataset(uuid.uuid4().hex[:10], name or f"{n:,} {distribution}", source, arr,
                 compute_stats(arr))
    evicted = STORE.add(ds) if persist else []
    return ds, evicted


# --------------------------------------------------------------------------
# CSV validation
# --------------------------------------------------------------------------
def _is_number(tok: str) -> bool:
    try:
        v = float(tok.strip())
        return np.isfinite(v)
    except ValueError:
        return False


def parse_csv(path: str, filename: str, column: str | None, on_invalid: str) -> tuple[np.ndarray, dict]:
    """Parse one numeric column out of a CSV file and describe every rejection."""
    with open(path, "rb") as fh:
        head = fh.read(65536)
    if not head.strip():
        raise ApiError(422, "empty_file", "The file is empty.", "Upload a CSV that contains numbers.")
    if b"\x00" in head:
        raise ApiError(415, "unsupported_file",
                       "This looks like a binary file (it contains NUL bytes), not a text CSV.",
                       "Export your data as plain-text CSV and upload that.")
    try:
        text_head = head.decode("utf-8-sig", errors="strict")
    except UnicodeDecodeError as exc:
        if exc.start >= len(head) - 4:   # cut mid-character by our 64 KB read: harmless
            text_head = head[:exc.start].decode("utf-8-sig")
        else:
            raise ApiError(415, "unsupported_encoding",
                           "The file is not valid UTF-8 text.",
                           "Re-save the CSV as 'CSV UTF-8' and upload it again.")
    lines = [ln for ln in text_head.splitlines() if ln.strip()][:200]
    if not lines:
        raise ApiError(422, "empty_file", "The file has no data rows.")
    try:
        dialect = csv.Sniffer().sniff("\n".join(lines[:50]), delimiters=",;\t|")
        delim = dialect.delimiter
    except csv.Error:
        delim = ","
    rows = list(csv.reader(lines, delimiter=delim))
    ncols = max(len(r) for r in rows)

    # ---- choose the column --------------------------------------------------
    first = rows[0]
    first_is_header = not any(_is_number(c) for c in first if c.strip()) and len(first) > 0
    names = [c.strip() for c in first] if first_is_header else [f"column {i + 1}" for i in range(ncols)]
    col_idx: int | None = None
    if column not in (None, ""):
        if column in names:
            col_idx = names.index(column)
        elif str(column).isdigit() and 1 <= int(column) <= ncols:
            col_idx = int(column) - 1
        else:
            raise ApiError(422, "column_not_found", f"Column '{column}' was not found.",
                           "Available columns: " + ", ".join(names))
    else:
        body = rows[1:] if first_is_header else rows
        best = 0
        for ci in range(ncols):   # pick the column with the most numeric values in the sample
            hits = sum(_is_number(r[ci]) for r in body if len(r) > ci and r[ci].strip())
            if hits > best:
                best, col_idx = hits, ci
        if col_idx is None:
            raise ApiError(422, "no_numeric_column",
                           "No column in this file contains numbers.",
                           "Check that the file has numeric values. Columns found: " + ", ".join(names))

    # ---- stream the file in chunks -------------------------------------------
    skiprows = 1 if first_is_header else 0
    # Blank lines are skipped by pandas, so remember they exist but do not count them as rows.
    reader = pd.read_csv(path, sep=delim, header=None, usecols=[col_idx], dtype=str,
                         skiprows=skiprows, keep_default_na=False, na_filter=False,
                         chunksize=2_000_000, encoding="utf-8-sig", engine="c",
                         skip_blank_lines=True, on_bad_lines="skip")
    parts: list[np.ndarray] = []
    total = missing = invalid = overflow = 0
    examples: list[dict] = []
    row_offset = 1  # data-row numbers are counted after the header
    for chunk in reader:
        s = chunk.iloc[:, 0].str.strip()
        total += len(s)
        is_missing = (s == "") | s.str.lower().isin(["na", "n/a", "nan", "null", "none", "-"])
        num = pd.to_numeric(s.where(~is_missing), errors="coerce")
        finite = np.isfinite(num.to_numpy(dtype=np.float64, na_value=np.nan))
        too_big = finite & (np.abs(num.to_numpy(dtype=np.float64, na_value=0.0)) > F32_MAX)
        bad_text = (~is_missing) & (~finite)
        good = finite & ~too_big
        missing += int(is_missing.sum())
        invalid += int(bad_text.sum())
        overflow += int(too_big.sum())
        if len(examples) < 10:
            for pos in np.flatnonzero(~good)[: 10 - len(examples)]:
                why = ("missing value" if is_missing.iloc[pos]
                       else "outside float32 range" if too_big[pos] else "not a finite number")
                examples.append({"row": int(row_offset + chunk.index[pos]), "value": str(s.iloc[pos])[:40],
                                 "reason": why})
        parts.append(num.to_numpy(dtype=np.float64, na_value=np.nan)[good].astype(np.float32))
    rejected = missing + invalid + overflow
    if total == 0:
        raise ApiError(422, "empty_file", "The file contains a header but no data rows.")
    if rejected and on_invalid == "reject":
        raise ApiError(422, "invalid_values",
                       f"File rejected: {rejected:,} of {total:,} rows are not usable numbers "
                       f"({missing:,} missing, {invalid:,} non-numeric, {overflow:,} out of float32 range).",
                       "Fix the rows listed below, or upload again with 'Skip bad values' selected.")
    data = np.concatenate(parts) if parts else np.empty(0, dtype=np.float32)
    if data.size == 0:
        raise ApiError(422, "no_valid_values",
                       f"None of the {total:,} rows contained a usable number.",
                       "Check the selected column and the file format.")
    report = {
        "filename": filename, "delimiter": delim, "header_detected": first_is_header,
        "column_used": names[col_idx], "columns_found": names,
        "rows_read": total, "values_accepted": int(data.size), "rows_rejected": rejected,
        "missing": missing, "non_numeric": invalid, "out_of_range": overflow,
        "policy": on_invalid, "examples": examples,
    }
    return np.ascontiguousarray(data), report


def create_from_csv(path: str, filename: str, column: str | None, on_invalid: str):
    arr, report = parse_csv(path, filename, column, on_invalid)
    check_memory(arr.size, 1.0, "Storing this dataset")
    ds = Dataset(uuid.uuid4().hex[:10], filename, "csv", arr, compute_stats(arr), report)
    return ds, STORE.add(ds)
