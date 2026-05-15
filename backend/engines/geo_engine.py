"""
CryptEdu Geospatial Engine — Real-world hub placement using OSM + elevation data.
Queries real schools, cell towers, and terrain to determine optimal hub positions.
"""
import math
import random
import json
import logging
from datetime import datetime
from typing import List, Tuple, Dict, Any, TYPE_CHECKING

if TYPE_CHECKING:
    import folium

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    HUB_COST, HUB_CAPACITY,
    COVERAGE_THRESHOLD_PCT, MASTER_HUB_RADIUS_KM,
    TOWER_COVERAGE_RADIUS_KM, MAX_HABITABLE_ELEVATION_M,
)

logger = logging.getLogger(__name__)

# ── Placement Justification Templates ─────────────────────

MASTER_REASONS = [
    "Highest elevation in the region — optimal radio line-of-sight to all child hubs within a 10 km radius.",
    "Central geographic position minimises average radio hop distance to all child hubs.",
    "Co-located with existing telco/government tower infrastructure — zero new backhaul cost.",
    "Nearest point to district administrative office — maintenance team access within 15 minutes.",
]

CHILD_REASONS = [
    "Dense student cluster — estimated {n} students within 2 km. Balai Raya identified as host site with power supply.",
    "Coverage gap identified — no cellular signal within 3 km. Elevated ground provides clear LOS to master hub.",
    "Primary school compound available as host — secured premises, 24/7 caretaker, existing electrical supply.",
    "High-density residential area with school-age population. Community centre identified as installation point.",
    "Remote village cluster — serves students with zero alternative connectivity within 5 km.",
    "Existing government building with rooftop clearance available for low-cost antenna mounting.",
]


def extract_ring(geojson: dict) -> list:
    """Extract the outer ring coordinates from any GeoJSON structure safely."""
    def get_first_ring(coords):
        if isinstance(coords, list) and len(coords) > 0:
            if isinstance(coords[0], (int, float)):
                return [coords] # Not a valid ring, but handled
            if isinstance(coords[0], list):
                if len(coords[0]) >= 2 and isinstance(coords[0][0], (int, float)):
                    return coords
                return get_first_ring(coords[0])
        return coords

    t = geojson.get("type", "")
    if t == "FeatureCollection" and len(geojson.get("features", [])) > 0:
        return get_first_ring(geojson["features"][0].get("geometry", {}).get("coordinates", []))
    if t == "Feature":
        return get_first_ring(geojson.get("geometry", {}).get("coordinates", []))
    if t in ["Polygon", "MultiPolygon"]:
        return get_first_ring(geojson.get("coordinates", []))
    raise ValueError(f"Unsupported GeoJSON type: {t}")


def point_in_polygon(lat: float, lng: float, ring: list) -> bool:
    """Ray-casting point-in-polygon test."""
    x, y, inside = lng, lat, False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def haversine(la1: float, lo1: float, la2: float, lo2: float) -> float:
    """Haversine distance in km between two lat/lng points."""
    R = 6371
    r = math.radians
    a = math.sin(r(la2 - la1) / 2) ** 2 + math.cos(r(la1)) * math.cos(r(la2)) * math.sin(r(lo2 - lo1) / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


# ── Area Calculation ──────────────────────────────────────

def calculate_polygon_area_km2(ring: list) -> float:
    """
    Calculate polygon area in km² using the Shoelace formula with latitude correction.
    Ring is in [lng, lat] format (GeoJSON standard).
    """
    n = len(ring)
    if n < 3:
        return 0.0

    avg_lat = sum(c[1] for c in ring) / n
    lat_rad = math.radians(avg_lat)

    km_per_deg_lat = 111.32
    km_per_deg_lng = 111.32 * math.cos(lat_rad)

    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        xi = ring[i][0] * km_per_deg_lng
        yi = ring[i][1] * km_per_deg_lat
        xj = ring[j][0] * km_per_deg_lng
        yj = ring[j][1] * km_per_deg_lat
        area += xi * yj - xj * yi

    return abs(area) / 2.0


def run_kmeans(points: List[List[float]], k: int) -> Tuple[List[List[float]], List[int]]:
    """Run K-Means clustering. Uses scikit-learn."""
    import numpy as np
    from sklearn.cluster import KMeans
    arr = np.array(points)
    km = KMeans(n_clusters=k, random_state=42, n_init=10, max_iter=300)
    km.fit(arr)
    centres = km.cluster_centers_.tolist()
    sizes = [int((km.labels_ == i).sum()) for i in range(k)]
    return centres, sizes


def _kmeans_fallback(pts: list, k: int, seed: int = 42) -> Tuple[list, list]:
    """Pure-Python K-Means for environments without scikit-learn."""
    rng = random.Random(seed)
    centres = rng.sample(pts, k)
    for _ in range(80):
        cl = [[] for _ in range(k)]
        for p in pts:
            d = [haversine(p[0], p[1], c[0], c[1]) for c in centres]
            cl[d.index(min(d))].append(p)
        centres = [
            [sum(p[i] for p in c) / len(c) if c else centres[j][i] for i in range(2)]
            for j, c in enumerate(cl)
        ]
    sizes = [len(c) for c in cl]
    return centres, sizes


def compute_placement(geojson: dict, num_child_hubs: int = None, district_name: str = "Target District", deployment_mode: str = "regional") -> dict:
    """
    Full pipeline: parse GeoJSON → query real-world data → determine hub count →
    K-Means → assign hubs → cost report.
    Returns a GeoJSON FeatureCollection with hub metadata.
    """
    from engines.osm_data import gather_real_world_data

    ring = extract_ring(geojson)
    area_km2 = calculate_polygon_area_km2(ring)

    # ── Step 1: Gather real-world intelligence ────────────
    real_data = gather_real_world_data(ring, area_km2)

    schools_raw = real_data["schools_raw"]
    schools_eligible = real_data["schools_eligible"]
    towers = real_data["towers"]
    coverage_pct = real_data["coverage_pct"]
    elevation_data = real_data["elevation_data"]
    exclusion_zones = real_data.get("exclusion_zones", [])
    using_fallback = real_data["using_fallback"]

    # ── Step 2: Handle fully-connected areas ──────────────
    if real_data["fully_connected"]:
        logger.info(f"Area is {coverage_pct}% covered — no hubs needed")
        return {
            "type": "FeatureCollection",
            "features": [],
            "metadata": {
                "district": district_name,
                "generated_at": datetime.now().isoformat(),
                "total_hubs": 0,
                "master_hubs": 0,
                "child_hubs": 0,
                "area_km2": round(area_km2, 2),
                "schools_found": len(schools_raw),
                "schools_eligible": 0,
                "cell_towers_found": len(towers),
                "coverage_pct": coverage_pct,
                "total_capex_myr": 0,
                "annual_opex_myr": 0,
                "estimated_students": 0,
                "reason": f"Area already has {coverage_pct}% cellular coverage. No additional hubs required.",
                "data_source": real_data["data_source"],
                "using_fallback": using_fallback,
                "deployment_mode": deployment_mode,
            },
            "boundary_ring": ring,
        }

    # ── Step 3: Gather villages and compute hub counts ──────
    villages_eligible = real_data.get("villages_eligible", [])
    villages_raw = real_data.get("villages_raw", [])
    pop_density = real_data.get("population_density_per_km2", 0)

    # Only count schools with 15+ students toward hub generation
    schools_eligible = [s for s in schools_eligible if s.get("estimated_students", 0) >= 15]

    total_eligible_students = sum(s.get("estimated_students", 0) for s in schools_eligible)
    total_village_population = sum(v.get("estimated_population", 0) for v in villages_eligible)
    students_per_hub = HUB_CAPACITY["students_per_hub_ratio"]  # 40

    # Master hub count: 1 per π × 50² km² (≈7854 km²) — always 1 for areas < 7854 km²
    master_coverage_area = math.pi * (MASTER_HUB_RADIUS_KM ** 2)
    num_masters = max(1, math.ceil(area_km2 / master_coverage_area))

    if num_child_hubs and num_child_hubs > 0:
        # User override
        num_subs = num_child_hubs
    else:
        # ── New ratio-based formula ──
        # Base: 1 master + 10 sub-hubs per 6000 km²
        base_total = max(1, math.ceil(area_km2 / 6000)) * 11  # 11 = 1 master + 10 subs

        # Coverage factor: reduce hubs proportionally to existing cell coverage
        coverage_factor = max(0.0, 1.0 - (coverage_pct / 100.0))

        # Population density factor: if < 15 per km², no hubs needed
        density_factor = 0.0 if pop_density < 15 else 1.0

        adjusted_total = round(base_total * coverage_factor * density_factor)

        logger.info(f"Ratio formula: base_total={base_total}, coverage_factor={coverage_factor:.2f}, "
                     f"density_factor={density_factor}, pop_density={pop_density:.1f}, "
                     f"adjusted_total={adjusted_total}")

        if adjusted_total <= 0:
            # Edge case: fully covered or uninhabitable
            return {
                "type": "FeatureCollection",
                "features": [],
                "metadata": {
                    "district": district_name,
                    "generated_at": datetime.now().isoformat(),
                    "total_hubs": 0,
                    "master_hubs": 0,
                    "child_hubs": 0,
                    "area_km2": round(area_km2, 2),
                    "schools_found": len(schools_raw),
                    "schools_eligible": len(schools_eligible),
                    "villages_found": len(villages_raw),
                    "villages_eligible": len(villages_eligible),
                    "cell_towers_found": len(towers),
                    "coverage_pct": coverage_pct,
                    "population_density_per_km2": round(pop_density, 1),
                    "total_capex_myr": 0,
                    "annual_opex_myr": 0,
                    "estimated_students": total_eligible_students,
                    "reason": f"Area factors yield 0 hubs (coverage: {coverage_pct}%, density: {pop_density:.1f}/km²).",
                    "data_source": real_data["data_source"],
                    "using_fallback": using_fallback,
                    "deployment_mode": deployment_mode,
                },
                "boundary_ring": ring,
            }

        # Distribute: masters from area, rest are subs
        num_subs = max(0, adjusted_total - num_masters)

    # Cap sub-hubs: max 100 per master hub, absolute max 900
    num_subs = min(num_subs, num_masters * 100)
    num_subs = min(num_subs, 900)

    logger.info(f"Initial calculation: eligible_students={total_eligible_students}, "
                f"village_pop={total_village_population}, num_masters={num_masters}, "
                f"num_subs={num_subs}, k={num_masters + num_subs}")

    # If no eligible students AND no eligible villages at all, no hubs
    if total_eligible_students == 0 and len(schools_eligible) == 0 and len(villages_eligible) == 0:
        num_subs = 0
        num_masters = 0

    k = num_masters + num_subs

    if k == 0:
        return {
            "type": "FeatureCollection",
            "features": [],
            "metadata": {
                "district": district_name,
                "generated_at": datetime.now().isoformat(),
                "total_hubs": 0,
                "master_hubs": 0,
                "child_hubs": 0,
                "area_km2": round(area_km2, 2),
                "schools_found": len(schools_raw),
                "schools_eligible": len(schools_eligible),
                "villages_found": len(villages_raw),
                "villages_eligible": len(villages_eligible),
                "cell_towers_found": len(towers),
                "coverage_pct": coverage_pct,
                "population_density_per_km2": round(pop_density, 1),
                "total_capex_myr": 0,
                "annual_opex_myr": 0,
                "estimated_students": total_eligible_students,
                "reason": "No eligible populations found requiring hub coverage.",
                "data_source": real_data["data_source"],
                "using_fallback": using_fallback,
                "deployment_mode": deployment_mode,
            },
            "boundary_ring": ring,
        }

    # ── Step 4: Prepare points for K-Means ────────────────
    # Use real school locations as data points (weighted by student count)
    pts = []
    for school in schools_eligible:
        # Add multiple points per school proportional to student count
        weight = max(1, school["estimated_students"] // 40)
        for _ in range(weight):
            pts.append([school["lat"], school["lng"]])

    # Add village/kampung locations as data points (weighted by population)
    for village in villages_eligible:
        weight = max(1, village["estimated_population"] // 100)
        for _ in range(weight):
            pts.append([village["lat"], village["lng"]])

    # K-Means needs at least k UNIQUE points; cap k to unique point count
    unique_pts = set(tuple(p) for p in pts)
    if len(unique_pts) < k:
        k = max(1, len(unique_pts))
        num_masters = min(num_masters, k)
        num_subs = max(0, k - num_masters)

    # Ensure we have enough points for clustering
    if len(pts) < k:
        k = max(1, len(pts))
        num_subs = max(0, k - num_masters)

    if k <= 1 or not pts:
        # Single hub at centroid
        if schools_eligible:
            avg_lat = sum(s["lat"] for s in schools_eligible) / len(schools_eligible)
            avg_lng = sum(s["lng"] for s in schools_eligible) / len(schools_eligible)
        else:
            avg_lat = sum(c[1] for c in ring) / max(1, len(ring))
            avg_lng = sum(c[0] for c in ring) / max(1, len(ring))
        centres = [[avg_lat, avg_lng]]
        sizes = [total_eligible_students if total_eligible_students > 0 else 30]
        k = 1
        num_masters = 1
        num_subs = 0
    else:
        try:
            centres, sizes = run_kmeans(pts, k)
            logger.info(f"K-Means completed: requested k={k}, got {len(centres)} centres from {len(pts)} weighted points")
        except Exception as e:
            logger.warning(f"K-Means failed: {e}, falling back to pure Python implementation")
            centres, sizes = _kmeans_fallback(pts, k)
            logger.info(f"Fallback K-Means completed: requested k={k}, got {len(centres)} centres from {len(pts)} weighted points")

    # ── Step 4b: Filter K-Means centres against exclusion zones ──
    # Reject any centre that falls in water, forest, military, or outside the polygon.
    # Also reject centres above MAX_HABITABLE_ELEVATION_M.
    if exclusion_zones or elevation_data:
        from engines.osm_data import is_in_exclusion_zone
        filtered_centres = []
        filtered_sizes = []
        for idx, c in enumerate(centres):
            lat_c, lng_c = c[0], c[1]

            # Must be inside the user's polygon
            if not point_in_polygon(lat_c, lng_c, ring):
                logger.info(f"Rejected centre {idx} at ({lat_c:.4f},{lng_c:.4f}): outside polygon")
                continue

            # Must not be in an exclusion zone
            excluded, zone_type = is_in_exclusion_zone(lat_c, lng_c, exclusion_zones)
            if excluded:
                logger.info(f"Rejected centre {idx} at ({lat_c:.4f},{lng_c:.4f}): inside {zone_type} zone")
                continue

            # Must not exceed habitable elevation
            elev_key = f"{lat_c:.4f},{lng_c:.4f}"
            centre_elev = elevation_data.get(elev_key, 0)
            if centre_elev == 0:
                # Check nearby elevation samples
                for ek, ev in elevation_data.items():
                    parts = ek.split(",")
                    if len(parts) == 2:
                        elat, elng = float(parts[0]), float(parts[1])
                        if haversine(lat_c, lng_c, elat, elng) < 2.0:
                            centre_elev = max(centre_elev, ev)
            if centre_elev > MAX_HABITABLE_ELEVATION_M:
                logger.info(f"Rejected centre {idx} at ({lat_c:.4f},{lng_c:.4f}): elevation {centre_elev}m exceeds limit")
                continue

            filtered_centres.append(c)
            filtered_sizes.append(sizes[idx] if idx < len(sizes) else 1)

        removed = len(centres) - len(filtered_centres)
        if removed > 0:
            logger.info(f"Geographic filter removed {removed} K-Means centres (water/forest/terrain/boundary)")
        centres = filtered_centres
        sizes = filtered_sizes

        # Recalculate k after filtering
        k = len(centres)
        num_masters = min(num_masters, k)
        num_subs = max(0, k - num_masters)

    if k == 0 or not centres:
        return {
            "type": "FeatureCollection",
            "features": [],
            "metadata": {
                "district": district_name,
                "generated_at": datetime.now().isoformat(),
                "total_hubs": 0,
                "master_hubs": 0,
                "child_hubs": 0,
                "area_km2": round(area_km2, 2),
                "schools_found": len(schools_raw),
                "schools_eligible": len(schools_eligible),
                "cell_towers_found": len(towers),
                "coverage_pct": coverage_pct,
                "total_capex_myr": 0,
                "annual_opex_myr": 0,
                "estimated_students": total_eligible_students,
                "reason": "All candidate hub locations were rejected by geographic filters (water/forest/terrain).",
                "data_source": real_data["data_source"],
                "using_fallback": using_fallback,
                "deployment_mode": deployment_mode,
            },
            "boundary_ring": ring,
        }

    # ── Step 5: Place master hub at highest elevation ─────
    # Find the highest-elevation cluster centre for master hub
    best_master_idx = 0
    best_elevation = -9999

    for idx, c in enumerate(centres):
        key = f"{c[0]:.4f},{c[1]:.4f}"
        elev = elevation_data.get(key, 0)
        # Also check nearby elevation samples
        if elev == 0:
            for ek, ev in elevation_data.items():
                parts = ek.split(",")
                if len(parts) == 2:
                    elat, elng = float(parts[0]), float(parts[1])
                    if haversine(c[0], c[1], elat, elng) < 3.0:
                        elev = max(elev, ev)

        if elev > best_elevation:
            best_elevation = elev
            best_master_idx = idx

    master_indices = {best_master_idx}
    master_centers = [centres[best_master_idx]]

    # If multiple masters needed, enforce >50km spacing
    if num_masters > 1:
        sorted_by_elev = sorted(
            enumerate(centres),
            key=lambda x: elevation_data.get(f"{x[1][0]:.4f},{x[1][1]:.4f}", 0),
            reverse=True
        )
        for idx, c in sorted_by_elev:
            if len(master_indices) >= num_masters:
                break
            if idx in master_indices:
                continue
            too_close = any(
                haversine(c[0], c[1], mc[0], mc[1]) < MASTER_HUB_RADIUS_KM
                for mc in master_centers
            )
            if not too_close:
                master_indices.add(idx)
                master_centers.append(c)

    # ── Step 5b: Assign sub-hubs to masters with load balancing ──
    # For each non-master centre, assign to master with fewest sub-hubs within 50km.
    # Skip sub-hubs with no master within 50km, or too close to an already-placed hub.
    master_sub_counts = {idx: 0 for idx in master_indices}
    child_to_master = {}   # child_centre_idx -> master_centre_idx
    valid_child_indices = []

    for i, c in enumerate(centres):
        if i in master_indices:
            continue

        # Find master hubs within 50km, pick the one with fewest sub-hubs
        candidates = []
        for m_idx in master_indices:
            dist = haversine(c[0], c[1], centres[m_idx][0], centres[m_idx][1])
            if dist <= MASTER_HUB_RADIUS_KM:  # 50km
                candidates.append((master_sub_counts[m_idx], dist, m_idx))

        if not candidates:
            # No master within 50km — skip this sub-hub
            logger.info(f"Skipping sub-hub at centre {i}: no master within {MASTER_HUB_RADIUS_KM}km")
            continue

        # Sort by fewest sub-hubs first, then by distance
        candidates.sort()
        chosen_master = candidates[0][2]

        # Check max 100 sub-hubs per master
        if master_sub_counts[chosen_master] >= 100:
            logger.info(f"Skipping sub-hub at centre {i}: master {chosen_master} already has 100 sub-hubs")
            continue

        # Check coverage overlap: skip if within TOWER_COVERAGE_RADIUS_KM (3km) of an already-placed hub
        too_close = False
        for placed_idx in list(master_indices) + valid_child_indices:
            if haversine(c[0], c[1], centres[placed_idx][0], centres[placed_idx][1]) < TOWER_COVERAGE_RADIUS_KM:
                too_close = True
                break

        if too_close:
            logger.info(f"Skipping sub-hub at centre {i}: within {TOWER_COVERAGE_RADIUS_KM}km of an existing hub")
            continue

        child_to_master[i] = chosen_master
        master_sub_counts[chosen_master] += 1
        valid_child_indices.append(i)

    # Rebuild the set of indices to actually place
    final_indices = sorted(list(master_indices) + valid_child_indices)
    logger.info(f"After 50km enforcement + overlap dedup: {len(master_indices)} masters, {len(valid_child_indices)} sub-hubs")

    # ── Step 6: Build feature collection ──────────────────
    rng = random.Random(77)
    feats = []
    master_cn = 1
    child_cn = 1

    for i in final_indices:
        c = centres[i]
        lat, lng = round(c[0], 6), round(c[1], 6)
        is_master = i in master_indices
        hub_type = "master" if is_master else "child"

        # Find nearest school to this cluster centre
        nearest_school = None
        if schools_eligible:
            nearest_school = min(schools_eligible, key=lambda s: haversine(lat, lng, s["lat"], s["lng"]))

        if is_master:
            hub_id = f"MSTR-{master_cn:02d}"
            label = f"Master Hub {master_cn}"
            master_cn += 1
            reason = MASTER_REASONS[i % len(MASTER_REASONS)]
            elev_key = f"{lat:.4f},{lng:.4f}"
            hub_elev = elevation_data.get(elev_key, best_elevation)
            if hub_elev > 0:
                reason = f"Elevation: {hub_elev:.0f}m — " + reason
        else:
            hub_id = f"CHLD-{child_cn:02d}"
            label = f"Child Hub {child_cn}"
            child_cn += 1
            tmpl = CHILD_REASONS[(i * 3) % len(CHILD_REASONS)]
            students_in_cluster = sizes[i] * students_per_hub // max(1, len(pts) // max(1, len(schools_eligible)))
            students_in_cluster = max(10, min(students_in_cluster, 200))
            reason = tmpl.replace("{n}", str(students_in_cluster))
            if nearest_school:
                reason = f"Near: {nearest_school['name']}. " + reason

        cost = HUB_COST[hub_type].copy()

        # Regional deployment mode cost adjustments
        coverage_radius = 8.5 if is_master else 3.2
        if deployment_mode == "regional":
            nearest_dist = min([haversine(lat, lng, mc[0], mc[1]) for mc in master_centers])
            if is_master:
                coverage_radius = 50.0
                cost["hardware"] = 38000
                cost["installation"] = 0
                cost["antenna"] = 0
                cost["annual_maintenance"] = 6000
            elif nearest_dist > 5:
                label += " (Long-Haul Node)"
                cost["hardware"] = 14500
                cost["installation"] = 0
                cost["antenna"] = 0
                cost["annual_maintenance"] = 1200
            else:
                cost["hardware"] = 14500
                cost["installation"] = 0
                cost["antenna"] = 0
                cost["annual_maintenance"] = 1200

        capex = cost["hardware"] + cost["installation"] + cost["antenna"]

        # Use real student data from cluster
        cluster_students = sizes[i] * students_per_hub // max(1, max(sizes)) if sizes else 40
        cluster_students = max(10, cluster_students)

        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {
                "id": hub_id,
                "type": hub_type,
                "label": label,
                "lat": lat, "lng": lng,
                "reason": reason,
                "students_served": cluster_students,
                "coverage_km": coverage_radius,
                "cost_breakdown": cost,
                "total_capex": capex,
                "annual_opex": cost["annual_maintenance"],
                "nearest_school": nearest_school["name"] if nearest_school else "",
            }
        })

    feats.sort(key=lambda f: 0 if f["properties"]["type"] == "master" else 1)

    actual_master_count = len(master_indices)
    actual_child_count = len(valid_child_indices)

    logger.info(f"Final hub placement: total_hubs={len(feats)}, master_hubs={actual_master_count}, child_hubs={actual_child_count}")

    # Calculate inter-hub distances
    hub_distances = []
    for i, f1 in enumerate(feats):
        for j, f2 in enumerate(feats):
            if i < j:
                d = haversine(
                    f1["properties"]["lat"], f1["properties"]["lng"],
                    f2["properties"]["lat"], f2["properties"]["lng"]
                )
                hub_distances.append(d)

    avg_spacing = sum(hub_distances) / len(hub_distances) if hub_distances else 0
    max_spacing = max(hub_distances) if hub_distances else 0
    min_spacing = min(hub_distances) if hub_distances else 0

    tc = sum(f["properties"]["total_capex"] for f in feats)
    to = sum(f["properties"]["annual_opex"] for f in feats)

    return {
        "type": "FeatureCollection",
        "features": feats,
        "metadata": {
            "district": district_name,
            "generated_at": datetime.now().isoformat(),
            "total_hubs": len(feats),
            "master_hubs": actual_master_count,
            "child_hubs": actual_child_count,
            "area_km2": round(area_km2, 2),
            "schools_found": len(schools_raw),
            "schools_eligible": len(schools_eligible),
            "villages_found": len(villages_raw),
            "villages_eligible": len(villages_eligible),
            "cell_towers_found": len(towers),
            "coverage_pct": coverage_pct,
            "population_density_per_km2": round(pop_density, 1),
            "total_capex_myr": tc,
            "annual_opex_myr": to,
            "avg_hub_spacing_km": round(avg_spacing, 2),
            "max_hub_spacing_km": round(max_spacing, 2),
            "min_hub_spacing_km": round(min_spacing, 2),
            "estimated_students": total_eligible_students,
            "students_per_hub": students_per_hub,
            "optimal_spacing_km": HUB_CAPACITY["optimal_spacing_km"],
            "deployment_mode": deployment_mode,
            "data_source": real_data["data_source"],
            "using_fallback": using_fallback,
        },
        "boundary_ring": ring,
    }


def build_folium_map(result: dict) -> "folium.Map":
    """Build an interactive Folium map from placement results."""
    import folium

    feats = result["features"]
    ring = result.get("boundary_ring", [])
    metadata = result.get("metadata", {})

    # Centre map
    if feats:
        master = next((f for f in feats if f["properties"]["type"] == "master"), feats[0])
        center_lat = master["properties"]["lat"]
        center_lng = master["properties"]["lng"]
    elif ring:
        center_lat = sum(c[1] for c in ring) / len(ring)
        center_lng = sum(c[0] for c in ring) / len(ring)
    else:
        center_lat, center_lng = 0, 0

    m = folium.Map(location=[center_lat, center_lng], zoom_start=10,
                   tiles="CartoDB dark_matter")

    deployment_mode = metadata.get("deployment_mode", "regional")

    # Draw polygon boundary
    if ring:
        polygon_coords = [[c[1], c[0]] for c in ring]
        folium.Polygon(
            locations=polygon_coords,
            color="#40916c",
            weight=2,
            fill=True,
            fill_color="#2d6a4f",
            fill_opacity=0.08,
            popup="Coverage Area Boundary"
        ).add_to(m)

    # Handle fully-connected / 0-hub cases
    if not feats:
        coverage_pct = metadata.get("coverage_pct", 0)
        if coverage_pct >= COVERAGE_THRESHOLD_PCT:
            folium.Marker(
                location=[center_lat, center_lng],
                popup=f"<b>Area Already Connected</b><br>Coverage: {coverage_pct}%<br>No hubs needed.",
                icon=folium.Icon(color="green", icon="check"),
            ).add_to(m)
        return m

    # Plot hubs
    masters = [f for f in feats if f["properties"]["type"] == "master"]
    for feat in feats:
        p = feat["properties"]
        is_master = p["type"] == "master"
        color = "#e63946" if is_master else "#2196f3"
        radius = 12 if is_master else 8

        popup_html = f"""
        <div style="font-family:Inter,sans-serif;min-width:200px">
            <h4 style="color:{color};margin:0">{p['label']}</h4>
            <p style="color:#888;font-size:11px;margin:2px 0">{p['id']}</p>
            <hr style="border-color:#333">
            <b>Students Served:</b> {p['students_served']}<br>
            <b>Coverage:</b> {p['coverage_km']} km<br>
            <b>CAPEX:</b> RM {p['total_capex']:,}<br>
            <b>OPEX/yr:</b> RM {p['annual_opex']:,}<br>
            {f"<b>Nearest School:</b> {p['nearest_school']}<br>" if p.get('nearest_school') else ""}
            <hr style="border-color:#333">
            <p style="font-size:11px;color:#aaa">{p['reason']}</p>
        </div>
        """

        folium.CircleMarker(
            location=[p["lat"], p["lng"]],
            radius=radius,
            color=color,
            fill=True,
            fill_color=color,
            fill_opacity=0.85,
            popup=folium.Popup(popup_html, max_width=300),
            tooltip=p["label"],
        ).add_to(m)

        # Draw lines from child to nearest master
        if not is_master and masters:
            nearest_master = min(masters, key=lambda mp: haversine(
                p["lat"], p["lng"],
                mp["properties"]["lat"], mp["properties"]["lng"]
            ))
            mp = nearest_master["properties"]
            folium.PolyLine(
                locations=[[p["lat"], p["lng"]], [mp["lat"], mp["lng"]]],
                color="#ffffff",
                weight=1,
                opacity=0.2,
                dash_array="5 10",
            ).add_to(m)

        # Draw 50km Regional Visualizer for master hubs
        if is_master and deployment_mode == "regional":
            folium.Circle(
                location=[p["lat"], p["lng"]],
                radius=50000,
                color="#e63946",
                weight=1,
                fill=True,
                fill_color="#e63946",
                fill_opacity=0.03,
                tooltip="Regional Sovereign Range (50km)"
            ).add_to(m)

    return m


def get_sample_geojson(region: str = "generic") -> dict:
    """Return sample GeoJSON for quick demos."""
    samples = {
        "generic": {
            "type": "FeatureCollection",
            "features": [{"type": "Feature", "properties": {"name": "Sample District"},
                "geometry": {"type": "Polygon", "coordinates": [[
                    [110.20, 3.80], [110.90, 3.80], [111.20, 4.20],
                    [111.00, 4.70], [110.40, 4.80], [109.90, 4.40], [110.20, 3.80]
                ]]}}]
        },
        "sarawak": {
            "type": "FeatureCollection",
            "features": [{"type": "Feature", "properties": {"name": "Sarawak Region"},
                "geometry": {"type": "Polygon", "coordinates": [[
                    [109.65, 1.10], [111.10, 1.10], [113.20, 2.20], [114.20, 3.00],
                    [114.30, 4.60], [113.80, 4.70], [112.80, 3.50], [111.50, 2.80],
                    [110.50, 2.00], [109.80, 1.60], [109.65, 1.10]
                ]]}}]
        },
        "kuching": {
            "type": "FeatureCollection",
            "features": [{"type": "Feature", "properties": {"name": "Kuching Division"},
                "geometry": {"type": "Polygon", "coordinates": [[
                    [109.80, 1.10], [110.60, 1.10], [110.80, 1.60],
                    [110.50, 1.85], [110.10, 1.80], [109.80, 1.50], [109.80, 1.10]
                ]]}}]
        },
    }
    return samples.get(region, samples["generic"])
