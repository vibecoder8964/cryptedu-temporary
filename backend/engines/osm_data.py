"""
CryptEdu OSM Real-World Data Engine — Global school, tower, and elevation queries.
Uses OpenStreetMap Overpass API + Open Topo Data API for real-world hub placement.
"""
import math
import hashlib
import json
import logging
import time
import requests
from typing import List, Dict, Tuple, Optional

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    OVERPASS_URL, OPENTOPODATA_URL,
    TOWER_COVERAGE_RADIUS_KM, COVERAGE_THRESHOLD_PCT,
    MAX_HABITABLE_ELEVATION_M, STEEP_SLOPE_THRESHOLD_M,
    DEFAULT_STUDENTS_PRIMARY, DEFAULT_STUDENTS_SECONDARY, DEFAULT_STUDENTS_UNKNOWN,
    FALLBACK_POPULATION_DENSITY_PER_KM2, FALLBACK_STUDENT_RATIO,
    FALLBACK_EXISTING_COVERAGE_FILTER, FALLBACK_TERRAIN_PENALTY,
    HUB_CAPACITY,
)

logger = logging.getLogger(__name__)

# ── In-memory cache (polygon hash → results) ─────────────
_cache: Dict[str, dict] = {}


def _polygon_hash(ring: list) -> str:
    """Create a stable hash for a polygon ring to use as cache key."""
    raw = json.dumps(ring, sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()


def _ring_to_overpass_poly(ring: list) -> str:
    """Convert GeoJSON [lng, lat] ring to Overpass poly format 'lat lng lat lng ...'"""
    parts = []
    for coord in ring:
        lng, lat = coord[0], coord[1]
        parts.append(f"{lat} {lng}")
    return " ".join(parts)


def _ring_to_bbox(ring: list) -> Tuple[float, float, float, float]:
    """Get bounding box (south, west, north, east) from ring."""
    lats = [c[1] for c in ring]
    lngs = [c[0] for c in ring]
    return (min(lats), min(lngs), max(lats), max(lngs))


def haversine(la1: float, lo1: float, la2: float, lo2: float) -> float:
    """Haversine distance in km."""
    R = 6371
    r = math.radians
    a = math.sin(r(la2 - la1) / 2) ** 2 + math.cos(r(la1)) * math.cos(r(la2)) * math.sin(r(lo2 - lo1) / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


# ── OSM Overpass Queries ──────────────────────────────────

def query_schools(ring: list) -> List[Dict]:
    """
    Query OpenStreetMap for real school locations inside a polygon.
    Returns list of {lat, lng, name, estimated_students, school_type}.
    """
    cache_key = f"schools_{_polygon_hash(ring)}"
    if cache_key in _cache:
        logger.info(f"Cache hit for schools query")
        return _cache[cache_key]

    poly_str = _ring_to_overpass_poly(ring)
    south, west, north, east = _ring_to_bbox(ring)

    # Use bounding box for speed, then filter by polygon in post-processing
    query = f"""
    [out:json][timeout:30];
    (
      node["amenity"="school"]({south},{west},{north},{east});
      way["amenity"="school"]({south},{west},{north},{east});
      relation["amenity"="school"]({south},{west},{north},{east});
    );
    out center;
    """

    try:
        logger.info(f"Querying Overpass for schools in bbox ({south:.3f},{west:.3f},{north:.3f},{east:.3f})")
        resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=35,
                             headers={"User-Agent": "CryptEdu/1.0 (educational research)", "Accept": "*/*"})
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
        logger.info(f"Overpass returned {len(elements)} school elements")
    except Exception as e:
        logger.error(f"Overpass school query failed: {e}")
        return []

    schools = []
    for el in elements:
        # Get coordinates (nodes have lat/lon directly, ways/relations have center)
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lng = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None or lng is None:
            continue

        tags = el.get("tags", {})
        name = tags.get("name", tags.get("name:en", "Unknown School"))

        # Estimate student count
        capacity = tags.get("capacity") or tags.get("students")
        if capacity:
            try:
                estimated_students = int(capacity)
            except (ValueError, TypeError):
                estimated_students = DEFAULT_STUDENTS_UNKNOWN
        else:
            # Determine school type for better estimate
            school_type = tags.get("school:type", tags.get("isced:level", "")).lower()
            if any(kw in name.lower() for kw in ["secondary", "smk", "menengah", "high school", "lycee"]):
                estimated_students = DEFAULT_STUDENTS_SECONDARY
                school_type = "secondary"
            elif any(kw in name.lower() for kw in ["primary", "sk ", "sjk", "rendah", "elementary"]):
                estimated_students = DEFAULT_STUDENTS_PRIMARY
                school_type = "primary"
            else:
                estimated_students = DEFAULT_STUDENTS_UNKNOWN
                school_type = "unknown"

        schools.append({
            "lat": lat,
            "lng": lng,
            "name": name,
            "estimated_students": estimated_students,
            "school_type": school_type if 'school_type' in dir() else "unknown",
        })

    _cache[cache_key] = schools
    return schools


def query_cell_towers(ring: list) -> List[Dict]:
    """
    Query OpenStreetMap for cell tower / communication mast locations inside a polygon.
    Returns list of {lat, lng, type}.
    """
    cache_key = f"towers_{_polygon_hash(ring)}"
    if cache_key in _cache:
        logger.info(f"Cache hit for towers query")
        return _cache[cache_key]

    south, west, north, east = _ring_to_bbox(ring)

    query = f"""
    [out:json][timeout:30];
    (
      node["man_made"="mast"]({south},{west},{north},{east});
      node["man_made"="tower"]["tower:type"="communication"]({south},{west},{north},{east});
      node["man_made"="communications_tower"]({south},{west},{north},{east});
      way["man_made"="mast"]({south},{west},{north},{east});
      way["man_made"="tower"]["tower:type"="communication"]({south},{west},{north},{east});
    );
    out center;
    """

    try:
        logger.info(f"Querying Overpass for cell towers in bbox ({south:.3f},{west:.3f},{north:.3f},{east:.3f})")
        resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=35,
                             headers={"User-Agent": "CryptEdu/1.0 (educational research)", "Accept": "*/*"})
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
        logger.info(f"Overpass returned {len(elements)} tower elements")
    except Exception as e:
        logger.error(f"Overpass tower query failed: {e}")
        return []

    towers = []
    for el in elements:
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lng = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None or lng is None:
            continue

        tags = el.get("tags", {})
        tower_type = tags.get("tower:type", tags.get("man_made", "mast"))
        towers.append({"lat": lat, "lng": lng, "type": tower_type})

    _cache[cache_key] = towers
    return towers


# ── Exclusion Zones (water, forest, military, unsuitable land) ──

def query_exclusion_zones(ring: list) -> List[Dict]:
    """
    Query OpenStreetMap for uninhabitable zones where hubs MUST NOT be placed.
    Includes: water bodies (seas/rivers/lakes), forests, military zones, nature reserves.
    Returns list of {type, bounds: (min_lat, min_lng, max_lat, max_lng), center: (lat, lng)}.
    We use bounding-box approximation for fast point-in-exclusion checks.
    """
    cache_key = f"exclusions_{_polygon_hash(ring)}"
    if cache_key in _cache:
        logger.info("Cache hit for exclusion zones query")
        return _cache[cache_key]

    south, west, north, east = _ring_to_bbox(ring)

    # Query water, forest, military, nature reserves
    query = f"""
    [out:json][timeout:45];
    (
      way["natural"="water"]({south},{west},{north},{east});
      way["natural"="wood"]({south},{west},{north},{east});
      way["natural"="scrub"]({south},{west},{north},{east});
      way["natural"="wetland"]({south},{west},{north},{east});
      way["natural"="bare_rock"]({south},{west},{north},{east});
      way["natural"="cliff"]({south},{west},{north},{east});
      way["natural"="glacier"]({south},{west},{north},{east});
      way["landuse"="forest"]({south},{west},{north},{east});
      way["landuse"="military"]({south},{west},{north},{east});
      way["landuse"="nature_reserve"]({south},{west},{north},{east});
      way["landuse"="reservoir"]({south},{west},{north},{east});
      way["boundary"="protected_area"]({south},{west},{north},{east});
      way["waterway"="riverbank"]({south},{west},{north},{east});
      relation["natural"="water"]({south},{west},{north},{east});
      relation["natural"="wood"]({south},{west},{north},{east});
      relation["landuse"="forest"]({south},{west},{north},{east});
      relation["landuse"="military"]({south},{west},{north},{east});
      relation["boundary"="protected_area"]({south},{west},{north},{east});
    );
    out geom;
    """

    try:
        logger.info(f"Querying Overpass for exclusion zones in bbox ({south:.3f},{west:.3f},{north:.3f},{east:.3f})")
        resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=60,
                             headers={"User-Agent": "CryptEdu/1.0 (educational research)", "Accept": "*/*"})
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
        logger.info(f"Overpass returned {len(elements)} exclusion zone elements")
    except Exception as e:
        logger.error(f"Overpass exclusion query failed: {e}")
        _cache[cache_key] = []
        return []

    zones = []
    for el in elements:
        tags = el.get("tags", {})
        # Identify exclusion type for logging/metadata
        zone_type = (
            tags.get("natural") or tags.get("landuse") or
            tags.get("boundary") or tags.get("waterway") or "unknown"
        )

        # Extract geometry bounds
        geom = el.get("geometry", [])
        if not geom:
            # For relations without direct geometry, try bounds
            bounds = el.get("bounds")
            if bounds:
                zones.append({
                    "type": zone_type,
                    "bounds": (bounds["minlat"], bounds["minlon"], bounds["maxlat"], bounds["maxlon"]),
                    "polygon": None,
                })
            continue

        # Build polygon ring from geometry (list of {lat, lon} objects)
        poly = [(pt["lat"], pt["lon"]) for pt in geom if "lat" in pt and "lon" in pt]
        if len(poly) < 3:
            continue

        lats = [p[0] for p in poly]
        lngs = [p[1] for p in poly]
        zones.append({
            "type": zone_type,
            "bounds": (min(lats), min(lngs), max(lats), max(lngs)),
            "polygon": poly,
        })

    logger.info(f"Parsed {len(zones)} exclusion zones (water/forest/military/reserves)")
    _cache[cache_key] = zones
    return zones


def _point_in_zone_polygon(lat: float, lng: float, poly: List[Tuple[float, float]]) -> bool:
    """Ray-casting point-in-polygon for OSM zone polygons (lat, lng tuples)."""
    x, y, inside = lng, lat, False
    n = len(poly)
    j = n - 1
    for i in range(n):
        yi, xi = poly[i]   # (lat, lng)
        yj, xj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def is_in_exclusion_zone(lat: float, lng: float, zones: List[Dict]) -> Tuple[bool, str]:
    """
    Check if a point falls inside any exclusion zone (water, forest, military).
    Returns (is_excluded, zone_type). Uses bounding-box pre-filter then polygon test.
    """
    for zone in zones:
        bmin_lat, bmin_lng, bmax_lat, bmax_lng = zone["bounds"]
        # Quick bounding-box reject
        if lat < bmin_lat or lat > bmax_lat or lng < bmin_lng or lng > bmax_lng:
            continue
        # If polygon known, do precise test; otherwise bbox match is enough
        poly = zone.get("polygon")
        if poly is None or _point_in_zone_polygon(lat, lng, poly):
            return True, zone["type"]
    return False, ""


# ── Elevation API ─────────────────────────────────────────

def query_elevation(points: List[Tuple[float, float]]) -> List[Dict]:
    """
    Query Open Topo Data for elevation at given (lat, lng) points.
    Batches into groups of 100 (API limit). Rate-limited to 1 req/sec.
    Returns list of {lat, lng, elevation}.
    """
    if not points:
        return []

    cache_key = f"elev_{hashlib.md5(json.dumps(points).encode()).hexdigest()}"
    if cache_key in _cache:
        return _cache[cache_key]

    results = []
    batch_size = 100

    for i in range(0, len(points), batch_size):
        batch = points[i:i + batch_size]
        locations = "|".join(f"{lat},{lng}" for lat, lng in batch)

        try:
            logger.info(f"Querying elevation for {len(batch)} points (batch {i // batch_size + 1})")
            resp = requests.get(
                OPENTOPODATA_URL,
                params={"locations": locations},
                timeout=15
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get("status") == "OK":
                for r in data.get("results", []):
                    results.append({
                        "lat": r["location"]["lat"],
                        "lng": r["location"]["lng"],
                        "elevation": r.get("elevation", 0) or 0,
                    })
            else:
                logger.warning(f"Elevation API returned status: {data.get('status')}")
                # Fill with 0 elevation as fallback
                for lat, lng in batch:
                    results.append({"lat": lat, "lng": lng, "elevation": 0})

        except Exception as e:
            logger.error(f"Elevation query failed: {e}")
            # Fill with 0 elevation as fallback
            for lat, lng in batch:
                results.append({"lat": lat, "lng": lng, "elevation": 0})

        # Rate limit: 1 request per second
        if i + batch_size < len(points):
            time.sleep(1.1)

    _cache[cache_key] = results
    return results


# ── Coverage Analysis ─────────────────────────────────────

def calculate_coverage_pct(ring: list, towers: List[Dict], area_km2: float) -> float:
    """
    Calculate what percentage of the polygon area is within TOWER_COVERAGE_RADIUS_KM
    of any cell tower. Uses grid sampling inside the polygon.
    Returns float 0-100.
    """
    if not towers or area_km2 <= 0:
        return 0.0

    from engines.geo_engine import point_in_polygon

    # Sample a grid of points inside the polygon
    lats = [c[1] for c in ring]
    lngs = [c[0] for c in ring]
    min_lat, max_lat = min(lats), max(lats)
    min_lng, max_lng = min(lngs), max(lngs)

    # Grid resolution: ~1km spacing
    lat_step = 0.009  # ~1km
    lng_step = 0.009 / max(0.1, math.cos(math.radians((min_lat + max_lat) / 2)))

    total_inside = 0
    covered = 0

    lat = min_lat
    while lat <= max_lat:
        lng = min_lng
        while lng <= max_lng:
            if point_in_polygon(lat, lng, ring):
                total_inside += 1
                # Check if this point is within range of any tower
                for t in towers:
                    if haversine(lat, lng, t["lat"], t["lng"]) <= TOWER_COVERAGE_RADIUS_KM:
                        covered += 1
                        break
            lng += lng_step
        lat += lat_step

    if total_inside == 0:
        return 0.0

    return round((covered / total_inside) * 100, 1)


def filter_schools_by_coverage(schools: List[Dict], towers: List[Dict]) -> List[Dict]:
    """
    Remove schools that are already within cell tower coverage range.
    These schools already have connectivity — no hub needed.
    """
    if not towers:
        return schools

    eligible = []
    for school in schools:
        is_covered = False
        for tower in towers:
            dist = haversine(school["lat"], school["lng"], tower["lat"], tower["lng"])
            if dist <= TOWER_COVERAGE_RADIUS_KM:
                is_covered = True
                break
        if not is_covered:
            eligible.append(school)

    logger.info(f"Coverage filter: {len(schools)} schools → {len(eligible)} eligible (removed {len(schools) - len(eligible)} covered)")
    return eligible


def filter_schools_by_terrain(schools: List[Dict], elevations: Dict[str, float]) -> List[Dict]:
    """
    Remove schools in terrain-unsuitable zones (elevation > MAX_HABITABLE_ELEVATION_M).
    The elevations dict maps 'lat,lng' → elevation.
    """
    eligible = []
    for school in schools:
        # Find nearest elevation sample
        key = f"{school['lat']:.4f},{school['lng']:.4f}"
        elev = elevations.get(key, 0)

        # Also check nearby samples
        if elev > MAX_HABITABLE_ELEVATION_M:
            logger.info(f"Terrain filter: removed {school['name']} at {elev}m")
            continue
        school["elevation"] = elev
        eligible.append(school)

    logger.info(f"Terrain filter: {len(schools)} → {len(eligible)} schools")
    return eligible


# ── Village / Kampung Discovery ───────────────────────────

# Default population estimates when OSM has no population tag
_PLACE_POPULATION_DEFAULTS = {
    "village": 500,
    "kampung": 300,
    "hamlet": 150,
    "isolated_dwelling": 30,
}


def query_villages(ring: list) -> List[Dict]:
    """
    Query OpenStreetMap for villages, kampungs, hamlets, and isolated dwellings
    inside a polygon. These represent settlements with citizens who may lack
    5G/4G connectivity.
    Returns list of {lat, lng, name, estimated_population, place_type}.
    """
    cache_key = f"villages_{_polygon_hash(ring)}"
    if cache_key in _cache:
        logger.info("Cache hit for villages query")
        return _cache[cache_key]

    south, west, north, east = _ring_to_bbox(ring)

    query = f"""
    [out:json][timeout:30];
    (
      node["place"="village"]({south},{west},{north},{east});
      node["place"="hamlet"]({south},{west},{north},{east});
      node["place"="kampung"]({south},{west},{north},{east});
      node["place"="isolated_dwelling"]({south},{west},{north},{east});
      way["place"="village"]({south},{west},{north},{east});
      way["place"="hamlet"]({south},{west},{north},{east});
      way["place"="kampung"]({south},{west},{north},{east});
    );
    out center;
    """

    try:
        logger.info(f"Querying Overpass for villages/kampungs in bbox ({south:.3f},{west:.3f},{north:.3f},{east:.3f})")
        resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=35,
                             headers={"User-Agent": "CryptEdu/1.0 (educational research)", "Accept": "*/*"})
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
        logger.info(f"Overpass returned {len(elements)} village/kampung elements")
    except Exception as e:
        logger.error(f"Overpass village query failed: {e}")
        return []

    villages = []
    for el in elements:
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lng = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None or lng is None:
            continue

        tags = el.get("tags", {})
        name = tags.get("name", tags.get("name:en", "Unknown Settlement"))
        place_type = tags.get("place", "village")

        # Use OSM population tag if available, otherwise estimate
        pop_tag = tags.get("population")
        if pop_tag:
            try:
                estimated_population = int(pop_tag)
            except (ValueError, TypeError):
                estimated_population = _PLACE_POPULATION_DEFAULTS.get(place_type, 200)
        else:
            estimated_population = _PLACE_POPULATION_DEFAULTS.get(place_type, 200)

        villages.append({
            "lat": lat,
            "lng": lng,
            "name": name,
            "estimated_population": estimated_population,
            "place_type": place_type,
        })

    _cache[cache_key] = villages
    return villages


def filter_villages_by_coverage(villages: List[Dict], towers: List[Dict]) -> List[Dict]:
    """
    Remove villages that are already within cell tower coverage range.
    These villages already have 4G/5G connectivity — no hub needed.
    """
    if not towers:
        return villages

    eligible = []
    for village in villages:
        is_covered = False
        for tower in towers:
            dist = haversine(village["lat"], village["lng"], tower["lat"], tower["lng"])
            if dist <= TOWER_COVERAGE_RADIUS_KM:
                is_covered = True
                break
        if not is_covered:
            eligible.append(village)

    logger.info(f"Village coverage filter: {len(villages)} villages → {len(eligible)} eligible (removed {len(villages) - len(eligible)} covered)")
    return eligible


def filter_villages_by_terrain(villages: List[Dict], elevations: Dict[str, float]) -> List[Dict]:
    """
    Remove villages in terrain-unsuitable zones (elevation > MAX_HABITABLE_ELEVATION_M).
    """
    eligible = []
    for village in villages:
        key = f"{village['lat']:.4f},{village['lng']:.4f}"
        elev = elevations.get(key, 0)
        if elev > MAX_HABITABLE_ELEVATION_M:
            logger.info(f"Terrain filter: removed village {village['name']} at {elev}m")
            continue
        village["elevation"] = elev
        eligible.append(village)

    logger.info(f"Village terrain filter: {len(villages)} → {len(eligible)} villages")
    return eligible


def estimate_population_density(area_km2: float, schools: List[Dict], villages: List[Dict]) -> float:
    """
    Estimate population density (people per km²) from discovered schools and villages.
    Used to determine if an area is too sparsely populated for hub placement.
    """
    if area_km2 <= 0:
        return 0.0

    total_population = 0
    for s in schools:
        total_population += s.get("estimated_students", 0) * 3  # students → total pop estimate
    for v in villages:
        total_population += v.get("estimated_population", 0)

    density = total_population / area_km2
    logger.info(f"Estimated population density: {total_population} people / {area_km2:.1f} km² = {density:.1f} per km²")
    return density


# ── Demographic Fallback ──────────────────────────────────

def estimate_fallback_students(area_km2: float) -> int:
    """
    When OSM has no school data, estimate student count from area using
    global rural demographic statistics.
    """
    eligible_area = area_km2 * (1 - FALLBACK_EXISTING_COVERAGE_FILTER) * (1 - FALLBACK_TERRAIN_PENALTY)
    population = eligible_area * FALLBACK_POPULATION_DENSITY_PER_KM2
    students = int(population * FALLBACK_STUDENT_RATIO)
    logger.info(f"Demographic fallback: {area_km2} km² → {eligible_area:.0f} km² eligible → {students} estimated students")
    return students


def generate_fallback_school_points(ring: list, area_km2: float, num_points: int = 25) -> List[Dict]:
    """
    Generate simulated school locations inside the polygon when OSM has no data.
    Uses clustered random placement with realistic spacing.
    """
    import random
    from engines.geo_engine import point_in_polygon

    rng = random.Random(42)
    lats = [c[1] for c in ring]
    lngs = [c[0] for c in ring]
    min_lat, max_lat = min(lats), max(lats)
    min_lng, max_lng = min(lngs), max(lngs)

    total_students = estimate_fallback_students(area_km2)
    students_per_school = max(50, total_students // max(1, num_points))

    schools = []
    attempts = 0
    max_attempts = num_points * 50

    while len(schools) < num_points and attempts < max_attempts:
        attempts += 1
        lat = rng.uniform(min_lat, max_lat)
        lng = rng.uniform(min_lng, max_lng)

        if not point_in_polygon(lat, lng, ring):
            continue

        # Check minimum spacing from existing schools (at least 2km)
        too_close = False
        for existing in schools:
            if haversine(lat, lng, existing["lat"], existing["lng"]) < 2.0:
                too_close = True
                break
        if too_close:
            continue

        schools.append({
            "lat": lat,
            "lng": lng,
            "name": f"Estimated Settlement {len(schools) + 1}",
            "estimated_students": students_per_school + rng.randint(-30, 30),
            "school_type": "fallback_estimate",
        })

    logger.info(f"Fallback: generated {len(schools)} estimated school points")
    return schools


# ── Main Intelligence Pipeline ────────────────────────────

def gather_real_world_data(ring: list, area_km2: float) -> Dict:
    """
    Main entry point: gather all real-world data for a polygon.
    Returns a dict with schools, towers, elevations, coverage, and metadata.
    """
    cache_key = f"full_{_polygon_hash(ring)}"
    if cache_key in _cache:
        logger.info("Full data cache hit")
        return _cache[cache_key]

    # Step 1: Query real schools from OSM
    schools = query_schools(ring)
    logger.info(f"Found {len(schools)} schools in OSM")

    # Step 2: Query cell towers from OSM
    towers = query_cell_towers(ring)
    logger.info(f"Found {len(towers)} cell towers in OSM")

    # Step 3: Calculate existing coverage percentage
    coverage_pct = calculate_coverage_pct(ring, towers, area_km2)
    logger.info(f"Existing cellular coverage: {coverage_pct}%")

    # Step 4: If coverage > threshold, area is already connected
    if coverage_pct >= COVERAGE_THRESHOLD_PCT:
        result = {
            "schools_raw": schools,
            "schools_eligible": [],
            "towers": towers,
            "coverage_pct": coverage_pct,
            "fully_connected": True,
            "elevation_data": {},
            "exclusion_zones": [],
            "data_source": "OpenStreetMap + OpenTopoData",
            "using_fallback": False,
        }
        _cache[cache_key] = result
        return result

    # Step 5: Filter schools by tower coverage
    eligible_schools = filter_schools_by_coverage(schools, towers)

    # Step 5a: Query villages/kampungs from OSM (always active)
    villages_raw = query_villages(ring)
    logger.info(f"Found {len(villages_raw)} villages/kampungs in OSM")

    # Step 5b: Filter villages by tower coverage (remove those with 4G/5G)
    eligible_villages = filter_villages_by_coverage(villages_raw, towers)

    # Step 5c: Query exclusion zones (water, forest, military, etc.)
    exclusion_zones = query_exclusion_zones(ring)
    logger.info(f"Loaded {len(exclusion_zones)} exclusion zones for geographic filtering")

    # Step 5d: Filter schools that fall inside exclusion zones
    if exclusion_zones:
        pre_excl = len(eligible_schools)
        eligible_schools = [
            s for s in eligible_schools
            if not is_in_exclusion_zone(s["lat"], s["lng"], exclusion_zones)[0]
        ]
        logger.info(f"Exclusion zone filter: {pre_excl} → {len(eligible_schools)} schools")

        # Also filter villages by exclusion zones
        pre_excl_v = len(eligible_villages)
        eligible_villages = [
            v for v in eligible_villages
            if not is_in_exclusion_zone(v["lat"], v["lng"], exclusion_zones)[0]
        ]
        logger.info(f"Village exclusion zone filter: {pre_excl_v} → {len(eligible_villages)} villages")

    # Step 6: If no schools found in OSM, use demographic fallback
    using_fallback = False
    if len(eligible_schools) == 0 and len(schools) == 0 and len(eligible_villages) == 0:
        logger.info("No schools or villages in OSM — using demographic fallback")
        eligible_schools = generate_fallback_school_points(ring, area_km2)
        using_fallback = True

    # Step 7: Query elevation for school + village locations + grid samples
    elevation_points = [(s["lat"], s["lng"]) for s in eligible_schools]
    elevation_points += [(v["lat"], v["lng"]) for v in eligible_villages]

    # Add grid samples for master hub placement (find highest point)
    lats = [c[1] for c in ring]
    lngs = [c[0] for c in ring]
    lat_step = (max(lats) - min(lats)) / 5
    lng_step = (max(lngs) - min(lngs)) / 5
    from engines.geo_engine import point_in_polygon
    for i in range(6):
        for j in range(6):
            lat = min(lats) + i * lat_step
            lng = min(lngs) + j * lng_step
            if point_in_polygon(lat, lng, ring):
                elevation_points.append((lat, lng))

    # Deduplicate and limit to 100 points
    seen = set()
    unique_points = []
    for p in elevation_points:
        key = f"{p[0]:.4f},{p[1]:.4f}"
        if key not in seen:
            seen.add(key)
            unique_points.append(p)
    unique_points = unique_points[:100]

    elev_results = query_elevation(unique_points)
    elevation_map = {}
    for er in elev_results:
        key = f"{er['lat']:.4f},{er['lng']:.4f}"
        elevation_map[key] = er["elevation"]

    # Step 8: Filter schools and villages by terrain
    eligible_schools = filter_schools_by_terrain(eligible_schools, elevation_map)
    eligible_villages = filter_villages_by_terrain(eligible_villages, elevation_map)

    # Step 9: Estimate population density
    pop_density = estimate_population_density(area_km2, eligible_schools, eligible_villages)

    result = {
        "schools_raw": schools,
        "schools_eligible": eligible_schools,
        "villages_raw": villages_raw,
        "villages_eligible": eligible_villages,
        "towers": towers,
        "coverage_pct": coverage_pct,
        "fully_connected": False,
        "elevation_data": elevation_map,
        "exclusion_zones": exclusion_zones,
        "population_density_per_km2": pop_density,
        "data_source": "OpenStreetMap + OpenTopoData",
        "using_fallback": using_fallback,
    }

    _cache[cache_key] = result
    return result
