"""
Mining Service
==============
Implements the core data mining algorithms for Phase 4.
"""
import pandas as pd
import numpy as np
from datetime import datetime

# Optional imports handled gracefully
try:
    from sklearn.cluster import KMeans
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
except ImportError:
    pass

try:
    from mlxtend.frequent_patterns import fpgrowth, association_rules
except ImportError:
    pass


def run_rfm(df: pd.DataFrame, mapping: dict) -> list:
    """
    Computes RFM (Recency, Frequency, Monetary) for each customer.
    Requires: customer_id, date, and (total_amount OR (quantity AND unit_price)).
    """
    cust_col = mapping.get("customer_id")
    date_col = mapping.get("date")
    
    if not cust_col or not date_col or cust_col not in df.columns or date_col not in df.columns:
        return []

    # Calculate monetary value
    if mapping.get("total_amount") and mapping["total_amount"] in df.columns:
        val_col = mapping["total_amount"]
        df["_monetary"] = pd.to_numeric(df[val_col], errors="coerce")
    elif mapping.get("quantity") and mapping.get("unit_price"):
        qty = pd.to_numeric(df[mapping["quantity"]], errors="coerce")
        price = pd.to_numeric(df[mapping["unit_price"]], errors="coerce")
        df["_monetary"] = qty * price
    else:
        return []

    df["_date"] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=["_date", "_monetary", cust_col])

    if df.empty:
        return []

    # Compute RFM
    reference_date = df["_date"].max()
    
    rfm = df.groupby(cust_col).agg(
        Recency=("_date", lambda x: (reference_date - x.max()).days),
        Frequency=(cust_col, "count"),
        Monetary=("_monetary", "sum")
    ).reset_index()

    # Score RFM (1-5 scale) using qcut
    for col in ["Recency", "Frequency", "Monetary"]:
        try:
            # For Recency, lower is better (5 is best)
            # For F and M, higher is better
            labels = [5, 4, 3, 2, 1] if col == "Recency" else [1, 2, 3, 4, 5]
            # Handle duplicates by dropping them
            rfm[f"{col[0]}_Score"] = pd.qcut(rfm[col].rank(method="first"), q=5, labels=labels).astype(int)
        except Exception:
            rfm[f"{col[0]}_Score"] = 3 # fallback if qcut fails

    # Calculate RFM Score
    rfm["RFM_Score"] = rfm["R_Score"] * 100 + rfm["F_Score"] * 10 + rfm["M_Score"]

    # Assign Segments
    def segment(score):
        if score >= 444: return "Champions"
        if score >= 333: return "Loyal Customers"
        if score >= 222: return "Potential Loyalists"
        if score >= 111: return "At Risk"
        return "Lost"

    rfm["Segment"] = rfm["RFM_Score"].apply(segment)
    
    # Rename cust_col to customer_id for standard output
    rfm = rfm.rename(columns={cust_col: "customer_id"})
    
    # Fill NA and convert to dict
    return rfm.fillna(0).to_dict(orient="records")


def run_clustering(df: pd.DataFrame, mapping: dict) -> dict:
    """
    Uses K-Means to cluster customers based on spending behaviour.
    Requires: customer_id, date, and (total_amount OR unit_price).
    """
    cust_col = mapping.get("customer_id")
    date_col = mapping.get("date")
    
    if not cust_col or not date_col or cust_col not in df.columns or date_col not in df.columns:
        return {}

    # Get a value column
    if mapping.get("total_amount") and mapping["total_amount"] in df.columns:
        val_col = mapping["total_amount"]
        df["_val"] = pd.to_numeric(df[val_col], errors="coerce")
    elif mapping.get("unit_price") and mapping["unit_price"] in df.columns:
        val_col = mapping["unit_price"]
        df["_val"] = pd.to_numeric(df[val_col], errors="coerce")
    else:
        return {}

    df["_date"] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=["_date", "_val", cust_col])

    if df.empty:
        return {}

    # Aggregate per customer
    customer_data = df.groupby(cust_col).agg(
        purchases=(cust_col, "count"),
        total_spent=("_val", "sum"),
        avg_spent=("_val", "mean")
    ).reset_index()

    if len(customer_data) < 5:
        return {} # Not enough data to cluster

    # Prepare features
    features = customer_data[["purchases", "total_spent", "avg_spent"]].fillna(0)
    
    try:
        scaler = StandardScaler()
        scaled_features = scaler.fit_transform(features)
        
        # Determine k (up to 4)
        k = min(4, len(customer_data) // 2)
        if k < 2:
            return {}
            
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        customer_data["cluster"] = kmeans.fit_predict(scaled_features)
    except Exception:
        return {}

    # Generate insights per cluster
    clusters = []
    for c in sorted(customer_data["cluster"].unique()):
        subset = customer_data[customer_data["cluster"] == c]
        avg_purchases = float(subset["purchases"].mean())
        avg_spend = float(subset["total_spent"].mean())
        size = len(subset)
        
        # Name the cluster based on heuristics
        if avg_spend > customer_data["total_spent"].mean() * 1.5:
            name = "High Rollers"
            desc = "Customers who spend significantly more than average."
        elif avg_purchases > customer_data["purchases"].mean() * 1.5:
            name = "Frequent Buyers"
            desc = "Customers who buy often but may have lower basket sizes."
        elif avg_purchases <= 1.2:
            name = "One-Time Shoppers"
            desc = "Customers who made a single purchase."
        else:
            name = "Standard Customers"
            desc = "Average frequency and spending behaviour."

        clusters.append({
            "cluster_id": int(c),
            "name": name,
            "description": desc,
            "size": size,
            "avg_purchases": round(avg_purchases, 2),
            "avg_spend": round(avg_spend, 2)
        })

    return {"clusters": clusters, "total_customers": len(customer_data)}


def run_association_rules(df: pd.DataFrame, mapping: dict) -> list:
    """
    Finds product associations (Market Basket Analysis).
    Requires: transaction_id, product.
    """
    tx_col = mapping.get("transaction_id")
    prod_col = mapping.get("product")
    
    if not tx_col or not prod_col or tx_col not in df.columns or prod_col not in df.columns:
        return []

    # Clean data
    df = df.dropna(subset=[tx_col, prod_col])
    df[prod_col] = df[prod_col].astype(str).str.strip()
    
    if df.empty:
        return []

    # Group by transaction
    # Since mlxtend fpgrowth takes a one-hot encoded dataframe, we'll build it
    basket = df.groupby([tx_col, prod_col])[prod_col].count().unstack(fill_value=0)
    
    if basket.shape[1] > 1000:
        # Too many unique products, take top 200 by frequency to avoid memory explosion
        top_prods = df[prod_col].value_counts().nlargest(200).index
        basket = df[df[prod_col].isin(top_prods)].groupby([tx_col, prod_col])[prod_col].count().unstack(fill_value=0)

    # Convert to boolean
    basket_bool = (basket > 0).astype(bool)

    if basket_bool.shape[0] < 5:
        return [] # Too few transactions

    try:
        # Min support: 1% or at least 2 transactions
        min_sup = max(0.01, 2.0 / len(basket_bool))
        
        frequent_itemsets = fpgrowth(basket_bool, min_support=min_sup, use_colnames=True)
        if frequent_itemsets.empty:
            return []

        rules = association_rules(frequent_itemsets, metric="lift", min_threshold=1.2)
        
        # Format output
        results = []
        for _, row in rules.iterrows():
            ant = list(row['antecedents'])
            con = list(row['consequents'])
            if len(ant) == 1 and len(con) == 1: # Keep it simple: 1 to 1 rules
                results.append({
                    "antecedent": ant[0],
                    "consequent": con[0],
                    "support": round(row['support'], 4),
                    "confidence": round(row['confidence'], 4),
                    "lift": round(row['lift'], 4)
                })
        
        # Sort by lift and take top 50
        results = sorted(results, key=lambda x: x["lift"], reverse=True)[:50]
        return results
    except Exception:
        return []


def run_sales_patterns(df: pd.DataFrame, mapping: dict) -> list:
    """
    Aggregates sales by date to find patterns.
    Requires: date and revenue (total_amount OR qty*price).
    """
    date_col = mapping.get("date")
    
    if not date_col or date_col not in df.columns:
        return []

    df["_date"] = pd.to_datetime(df[date_col], errors="coerce").dt.date

    # Revenue
    if mapping.get("total_amount") and mapping["total_amount"] in df.columns:
        df["_rev"] = pd.to_numeric(df[mapping["total_amount"]], errors="coerce")
    elif mapping.get("quantity") and mapping.get("unit_price"):
        qty = pd.to_numeric(df[mapping["quantity"]], errors="coerce")
        price = pd.to_numeric(df[mapping["unit_price"]], errors="coerce")
        df["_rev"] = qty * price
    else:
        return []

    df = df.dropna(subset=["_date", "_rev"])
    if df.empty:
        return []

    daily = df.groupby("_date")["_rev"].sum().reset_index()
    daily = daily.sort_values("_date")
    
    # Format output
    return [{"date": row["_date"].isoformat(), "revenue": round(row["_rev"], 2)} for _, row in daily.iterrows()]


def run_anomaly_detection(df: pd.DataFrame, mapping: dict) -> list:
    """
    Finds anomalous sales days using Isolation Forest.
    """
    date_col = mapping.get("date")
    
    if not date_col or date_col not in df.columns:
        return []

    df["_date"] = pd.to_datetime(df[date_col], errors="coerce").dt.date

    # Metric
    if mapping.get("total_amount") and mapping["total_amount"] in df.columns:
        df["_metric"] = pd.to_numeric(df[mapping["total_amount"]], errors="coerce")
    elif mapping.get("quantity") and mapping["quantity"] in df.columns:
        df["_metric"] = pd.to_numeric(df[mapping["quantity"]], errors="coerce")
    else:
        return []

    df = df.dropna(subset=["_date", "_metric"])
    if df.empty:
        return []

    daily = df.groupby("_date")["_metric"].sum().reset_index()
    
    if len(daily) < 14:
        return [] # Need at least 2 weeks of data

    try:
        model = IsolationForest(contamination=0.05, random_state=42)
        daily["anomaly"] = model.fit_predict(daily[["_metric"]])
        
        # -1 indicates anomaly
        anomalies = daily[daily["anomaly"] == -1]
        avg_val = float(daily["_metric"].mean())
        results = []
        for _, row in anomalies.iterrows():
            val = round(float(row["_metric"]), 2)
            pct_diff = round(((val - avg_val) / max(avg_val, 1)) * 100)
            if val >= avg_val:
                anomaly_type = "surge"
                title = f"Sales Surge (+{pct_diff}% above average)"
                reason = f"Sales of ₹{val:,.2f} were {abs(pct_diff)}% higher than your daily average of ₹{avg_val:,.0f}. Standout high sales day!"
            else:
                anomaly_type = "dip"
                title = f"Sales Dip ({pct_diff}% below average)"
                reason = f"Sales of ₹{val:,.2f} were {abs(pct_diff)}% lower than your daily average of ₹{avg_val:,.0f}. Check if store was closed or items were out of stock."

            results.append({
                "date": row["_date"].isoformat(),
                "value": val,
                "type": anomaly_type,
                "title": title,
                "reason": reason,
                "avg_value": round(avg_val, 2),
                "pct_diff": pct_diff,
            })
        return results
    except Exception:
        return []


def run_product_performance(df: pd.DataFrame, mapping: dict) -> dict:
    """
    Computes top and bottom selling products.
    """
    prod_col = mapping.get("product")
    qty_col = mapping.get("quantity")
    rev_col = mapping.get("total_amount")
    price_col = mapping.get("unit_price")

    if not prod_col or prod_col not in df.columns:
        return {}

    df = df.dropna(subset=[prod_col])
    df[prod_col] = df[prod_col].astype(str).str.strip()
    
    # Calculate revenue if missing but qty & price exist
    if not rev_col and (qty_col and price_col):
        qty_s = pd.to_numeric(df[qty_col], errors='coerce')
        price_s = pd.to_numeric(df[price_col], errors='coerce')
        df["_computed_rev"] = qty_s * price_s
        rev_col = "_computed_rev"

    agg_dict = {}
    if qty_col and qty_col in df.columns:
        df["_qty"] = pd.to_numeric(df[qty_col], errors='coerce').fillna(1)
        agg_dict["_qty"] = "sum"
    else:
        df["_qty"] = 1
        agg_dict["_qty"] = "sum"

    if rev_col and rev_col in df.columns:
        df["_rev"] = pd.to_numeric(df[rev_col], errors='coerce').fillna(0)
        agg_dict["_rev"] = "sum"
    
    grouped = df.groupby(prod_col).agg(agg_dict).reset_index()
    grouped.columns = [prod_col, "qty", "rev"] if "_rev" in agg_dict else [prod_col, "qty"]

    # Filter out negative quantities/revenues (returns)
    grouped = grouped[grouped["qty"] > 0]

    # Top and Bottom by Quantity
    top_qty = grouped.nlargest(10, "qty").to_dict(orient="records")
    bottom_qty = grouped.nsmallest(10, "qty").to_dict(orient="records")

    result = {
        "top_by_qty": [{"product": r[prod_col], "quantity": round(r["qty"], 2), "revenue": round(r.get("rev", 0), 2)} for r in top_qty],
        "bottom_by_qty": [{"product": r[prod_col], "quantity": round(r["qty"], 2), "revenue": round(r.get("rev", 0), 2)} for r in bottom_qty]
    }

    if "_rev" in agg_dict:
        top_rev = grouped.nlargest(10, "rev").to_dict(orient="records")
        bottom_rev = grouped.nsmallest(10, "rev").to_dict(orient="records")
        result["top_by_revenue"] = [{"product": r[prod_col], "quantity": round(r["qty"], 2), "revenue": round(r["rev"], 2)} for r in top_rev]
        result["bottom_by_revenue"] = [{"product": r[prod_col], "quantity": round(r["qty"], 2), "revenue": round(r["rev"], 2)} for r in bottom_rev]
    
    return result
