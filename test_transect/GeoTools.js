// ????
var M_PI = 3.14159265358979323846;
var M_DEG_TO_RAD = M_PI / 180.0;
var CONSTANTS_RADIUS_OF_EARTH = 6371000;			/* meters (m)		*/
var DBL_EPSILON = Number.EPSILON;//2.2204460492503131e-016; 
var M_RAD_TO_DEG = (180.0 / M_PI);
var M_2PI = 6.28318530717958647692528676655900576;
var qgeocoordinate_EARTH_MEAN_RADIUS = 6371.0072;

// CoordTypeEnum
var CoordType = {};
CoordType.CoordTypeInterior = 0;
CoordType.CoordTypeInteriorHoverTrigger = 1;
CoordType.CoordTypeInteriorTerrainAdded = 2;
CoordType.CoordTypeSurveyEdge = 3
CoordType.CoordTypeTurnaround = 4

// EntryLocationType
var EntryLocation = new Object();
EntryLocation.type = {
    EntryLocationFirst: 0,
    EntryLocationTopLeft: 1,
    EntryLocationFirst: 1,
    EntryLocationTopRight: 2,
    EntryLocationBottomLeft: 3,
    EntryLocationBottomRight: 4,
    EntryLocationLast: 5,
    EntryLocationBottomRight: 5
};


class Options { // ?????
    constructor() {
        // Camera
        this.camera = new Object();
        this.camera.altitude = 50
        this.camera.triggerDist = 25
        this.camera.spacing = 25

        // Transects
        this.transects = new Object();
        this.transects.angle = 0
        this.transects.turnAroundDist = 10
        this.transects.hoverAndCapture = false
        this.transects.reflyAtNTDegOffset = false
        this.transects.imgInTurnAround = true
        this.transects.relativeAltitude = true

        // Terrain
        this.terrain = new Object();
        this.terrain.vehicleFllowTerrain = false
    }
}

// Some class
class _Point {
    constructor(x, y, z) {
        this.lng = x;
        this.lat = y;
        this.z = z;
    }
}

class _Polyline {
    constructor() {
        this.points = new Array(_Point);
        this.points.shift();
    }
}

class _Line {
    constructor() {
        this.p1 = new _Point(0, 0, 0);
        this.p2 = new _Point(0, 0, 0);
        this.length = 0;
        this.angle = 0;
    }
}

class _Polygon {
    constructor() {
        this.points = new Array(_Point);
        this.points.shift();
    }
}

class _CoordInfo {
    constructor() {
        this.type = CoordType.CoordTypeInterior;
        this.coord = new _Point(0, 0, 0);
    }
}

class _PathHeightInfo {
    constructor() {
        this.latStep = 0.0;    ///< Amount of latitudinal distance between each returned height
        this.lonStep = 0.0;    ///< Amount of longitudinal distance between each returned height
        this.heights = new Array();    /// double< Terrain heights along path 
    }
}

class _ItemCase {
    constructor() {
        this.doJumpId = -1;
        this.command = -1;
        this.frame = -1;
        this.params = [];
        this.autoContinue = false;
        this.isCurrentItem = false;
        this.type = "";
    }
}

class _CameraCalc {
    constructor(jsonStr) {
        var jsonobj = JSON.parse(jsonStr);
        this.Vehicle = jsonobj.Vehicle;
        this.IsManual = false;
        this.Dirty = false;
        this.DisableRecalc = false;
        this.DistanceToSurfaceRelative = true;
        this.SideOverlap = 70;
        this.FrontalOverlap = 70;
        this.LandScape = false;
        //this._metaDataMap                  =FactMetaData::createMapFromJsonFile=QStringLiteral=":/json/CameraCalc.FactMetaData.json";this.this;;
        this.CameraName = jsonobj.CameraName;
        this.ValueSetIsDistance = jsonobj.ValueSetIsDistance;
        this.DistanceToSurface = jsonobj.DistanceToSurface;
        this.ImageDensity = jsonobj.ImageDensity;
        this.FrontalOverlap = jsonobj.FrontalOverlap;
        this.SideOverlap = jsonobj.SideOverlap;
        this.AdjustedFootprintSide = jsonobj.AdjustedFootprintSide;
        this.AdjustedFootprintFrontal = jsonobj.AdjustedFootprintFrontal;
    }
}


function latLng2WebMercator(srcpoint) {//[114.32894, 30.585748]
    var dst = new _Point(0, 0, 0);
    var earthRad = 6378137.0;
    dst.lng = srcpoint.lng * Math.PI / 180 * earthRad;
    var a = srcpoint.lat * Math.PI / 180;
    dst.lat = earthRad / 2 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a)));
    return dst; //[12727039.383734727, 3579066.6894065146]
}
function webMercator2LngLat(srcpoint) {//[12727039.383734727, 3579066.6894065146]
    var dst = new _Point(0, 0, 0);
    dst.lng = srcpoint.lng / 20037508.34 * 180;
    dst.lat = srcpoint.lat / 20037508.34 * 180;
    dst.lat = 180 / Math.PI * (2 * Math.atan(Math.exp(dst.lat * Math.PI / 180)) - Math.PI / 2);

    return dst; //[114.32894001591471, 30.58574800385281]
}

function calcPolygonCornor(centerPoint, width, height, isMec = false) {
    var poly = new _Polygon();
    var mecarr = latLng2WebMercator(centerPoint);
    if (isMec) {
        width = Math.min(width, 3000);
        height = Math.min(height, 3000);
        width *= 0.75;
        height *= 0.75;
        var rectx = mecarr.lng - width / 2;
        var recty = mecarr.lat + height / 2;
        poly.points.push(webMercator2LngLat(new _Point(rectx, recty, 0)));
        poly.points.push(webMercator2LngLat(new _Point(rectx + width, recty, 0)));
        poly.points.push(webMercator2LngLat(new _Point(rectx + width, recty - height, 0)));
        poly.points.push(webMercator2LngLat(new _Point(rectx, recty - height, 0)));

    }
    else {
        var ltPoint = new _Point(0, 0, 0);
        var lbPoint = new _Point(0, 0, 0);
        var rtPoint = new _Point(0, 0, 0);
        ltPoint.lng = centerPoint.lng - width / 2;
        ltPoint.lat = centerPoint.lat + height / 2;
        lbPoint.lng = centerPoint.lng - width / 2;
        lbPoint.lat = centerPoint.lat - height / 2;
        rtPoint.lng = centerPoint.lng + width / 2;
        rtPoint.lat = centerPoint.lat + height / 2;

        var mwidht = distanceTo(ltPoint, rtPoint);
        var mheight = distanceTo(ltPoint, lbPoint);
        mwidht = Math.min(mwidht, 3000);
        mheight = Math.min(mheight, 300)
        mwidht *= 0.75;
        mheight *= 0.75;
        var rectx = mecarr.lng - mwidht / 2;
        var recty = mecarr.lat + mheight / 2;
        poly.points.push(webMercator2LngLat(new _Point(rectx, recty, 0)));
        poly.points.push(webMercator2LngLat(new _Point(rectx + mwidht, recty, 0)));
        poly.points.push(webMercator2LngLat(new _Point(rectx + mwidht, recty - mheight, 0)));
        poly.points.push(webMercator2LngLat(new _Point(rectx, recty - mheight, 0)));
    }

    return poly;
}

function calcAreaCorner(centerPoint, width, height) { // ????????
    var retval = new Array;
    var mecarr = latLng2WebMercator(centerPoint);
    //centerPoint.lng = mecarr[0]
    //centerPoint.lat = mecarr[1]
    //centerPoint.lng += (width * 0.25) / 2;
    //centerPoint.lat += (height * 0.25) / 2;

    width *= 0.75;
    height *= 0.75;
    var rectx = mecarr.lng - width / 2;
    var recty = mecarr.lat + height / 2;

    //_centerCoord = new _Point(rectx + (width / 2), recty + (height / 2), 0); /* clipToViewPort */
    //_centerCoord = new _Point(rectx, recty, 0);
    var topLeftCoord = webMercator2LngLat(new _Point(rectx, recty, 0)); /* clipToViewPort */
    var topRightCoord = webMercator2LngLat(new _Point(rectx + width, recty, 0)); /* clipToViewPort */
    var bottomLeftCoord = webMercator2LngLat(new _Point(rectx, recty - height, 0)); /* clipToViewPort */
    var bottomRightCoord = webMercator2LngLat(new _Point(rectx + width, recty - height, 0)); /* clipToViewPort */
    retval.push(topLeftCoord);
    retval.push(topRightCoord);
    retval.push(bottomLeftCoord);
    retval.push(bottomRightCoord);
    return retval;
    // Initial polygon has max width and height of 3000 meters
    var halfWidthMeters = Math.min(distanceTo(topLeftCoord, topRightCoord), 3000) / 2
    var halfHeightMeters = Math.min(distanceTo(topLeftCoord, bottomLeftCoord), 3000) / 2
    //topLeftCoord = atDistanceAndAzimuth(atDistanceAndAzimuth(_centerCoord, halfWidthMeters, -90), halfHeightMeters, 0)
    retval.push(atDistanceAndAzimuth(atDistanceAndAzimuth(centerPoint, halfWidthMeters, -90), halfHeightMeters, 0));
    //topRightCoord = atDistanceAndAzimuth(atDistanceAndAzimuth(_centerCoord, halfWidthMeters, 90), halfHeightMeters, 0)
    retval.push(atDistanceAndAzimuth(atDistanceAndAzimuth(centerPoint, halfWidthMeters, 90), halfHeightMeters, 0));
    //bottomLeftCoord = atDistanceAndAzimuth(atDistanceAndAzimuth(_centerCoord, halfWidthMeters, -90), halfHeightMeters, 180)
    retval.push(atDistanceAndAzimuth(atDistanceAndAzimuth(centerPoint, halfWidthMeters, -90), halfHeightMeters, 180));
    //bottomRightCoord = atDistanceAndAzimuth(atDistanceAndAzimuth(_centerCoord, halfWidthMeters, 90), halfHeightMeters, 180)
    retval.push(atDistanceAndAzimuth(atDistanceAndAzimuth(centerPoint, halfWidthMeters, 90), halfHeightMeters, 180));
    return retval;
}

function calcArea(polygon) {
    var area = 0.0;
    if (polygon.points.length < 3) return area;

    for (var i = 0; i < polygon.points.length; ++i) {
        if (i != 0) {
            area += polygon.points[i - 1].lng * polygon.points[i].lat - polygon.points[i].lng * polygon.points[i - 1].lat;
        }
        else {
            area += polygon.points[polygon.points.length - 1].lng * polygon.points[i].lat - polygon.points[i].lng * polygon.points[polygon.points.length - 1].lat;
        }
    }

    return 0.5 * Math.abs(area);
}


function rotateEntryPoint(args) { //TODO:????
    return null;
}

function _rotatePoint(point, origin, angle) {
    var radians = (M_PI / 180.0) * -angle;

    var lng = ((point.lng - origin.lng) * Math.cos(radians)) - ((point.lat - origin.lat) * Math.sin(radians)) + origin.lng;
    var lat = ((point.lng - origin.lng) * Math.sin(radians)) + ((point.lat - origin.lat) * Math.cos(radians)) + origin.lat;

    return new _Point(lng, lat, 0);
}

function atDistanceAndAzimuth(coord, distance, azimuth, distanceUp = 0) {
    distanceUp = 0.0;

    var resultLon, resultLat;
    //QGeoCoordinatePrivate::atDistanceAndAzimuth(*this, distance, azimuth,&resultLon, &resultLat);
    var latRad = qDegreesToRadians(coord.lat);//coord.d->lat
    var lonRad = qDegreesToRadians(coord.lng);//coord.d->lng
    var cosLatRad = Math.cos(latRad);
    var sinLatRad = Math.sin(latRad);

    var azimuthRad = qDegreesToRadians(azimuth);

    var ratio = (distance / (qgeocoordinate_EARTH_MEAN_RADIUS * 1000.0));
    var cosRatio = Math.cos(ratio);
    var sinRatio = Math.sin(ratio);

    var resultLatRad = Math.asin(sinLatRad * cosRatio
        + cosLatRad * sinRatio * Math.cos(azimuthRad));
    var resultLonRad = lonRad + Math.atan2(Math.sin(azimuthRad) * sinRatio * cosLatRad,
        cosRatio - sinLatRad * Math.sin(resultLatRad));

    resultLat = qRadiansToDegrees(resultLatRad);
    resultLon = qRadiansToDegrees(resultLonRad);

    var resultAlt = coord.z + distanceUp;
    return new _Point(resultLon, resultLat, resultAlt);
}

function azimuthTo(the, other) {
    var dlon = qDegreesToRadians(other.lng - the.lng);//other.d->lng - d->lng
    var lat1Rad = qDegreesToRadians(the.lat);//d->lat
    var lat2Rad = qDegreesToRadians(other.lat);//other.d->lat

    var y = Math.sin(dlon) * Math.cos(lat2Rad);
    var x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dlon);

    var azimuth = qRadiansToDegrees(Math.atan2(y, x)) + 360.0;
    //var whole;
    var valarr = JSModf(azimuth);
    return (parseInt(valarr[0] + 360) % 360) + valarr[1];
}

function JSModf(val) { // rst[0] ???? rst[1] ????
    var rst = [];
    rst.push(val / 1.0);
    rst.push(val % 1.0);
    return rst;
}

function qRadiansToDegrees(d) {
    return d * 180.0 / M_PI;
}

function qDegreesToRadians(degrees) {
    return degrees * (M_PI / 180);
}

function distanceTo(the, other) {
    // Haversine formula
    var dlat = qDegreesToRadians(other.lat - the.lat); //other.d->lat - d->lat
    var dlon = qDegreesToRadians(other.lng - the.lng); //other.d->lng - d->lng
    var haversine_dlat = Math.sin(dlat / 2.0);
    haversine_dlat *= haversine_dlat;
    var haversine_dlon = Math.sin(dlon / 2.0);
    haversine_dlon *= haversine_dlon;
    var y = haversine_dlat
        + Math.cos(qDegreesToRadians(the.lat))//d->lat
        * Math.cos(qDegreesToRadians(other.lat))//other.d->lat
        * haversine_dlon;
    var x = 2 * Math.asin(Math.sqrt(y));
    return x * qgeocoordinate_EARTH_MEAN_RADIUS * 1000;
}

function _clampGridAngle90(gridAngle) {
    // Clamp grid angle to -90<->90. This prevents transects from being rotated to a reversed order.
    // ?????-90?90?????????????????????
    if (gridAngle > 90.0) {
        gridAngle -= 180.0;
    } else if (gridAngle < -90.0) {
        gridAngle += 180;
    }
    return gridAngle;
}

//TODO ????
function _intersectLinesWithPolygon(lineList, polygon) {
    var resultLines = new Array(_Line); //?????
    resultLines.shift();

    for (var i = 0; i < lineList.length; i++) {
        var line = lineList[i];
        var intersections = new Array(_Point);  // QList<QPointF>
        intersections.shift();
        // Intersect the line with all the polygon edges
        // ?????????
        for (var j = 0; j < polygon.points.length - 1; j++) {
            var intersectPoint = new _Point(0, 0, 0); //QPointF
            var tmpline = new _Line();
            tmpline.p1 = polygon.points[j];
            tmpline.p2 = polygon.points[j + 1]; //QLineF
            if (lineIntersect(line, tmpline, null) == 1) {
                intersectPoint = lineIntersect(line, tmpline, intersectPoint);
                if (!listHasPoint(intersections, intersectPoint)) {
                    intersections.push(intersectPoint);
                }
            }

        }

        // We now have one or more intersection points all along the same line. Find the two
        // which are furthest away from each other to form the transect.
        // ???????????????????????????????????????????
        if (intersections.length > 1) {
            var firstPoint = new _Point(0, 0, 0); //QPointF
            var secondPoint = new _Point(0, 0, 0); //QPointF
            var currentMaxDistance = 0;//double

            for (var k = 0; k < intersections.length; k++) {
                for (var j = 0; j < intersections.length; j++) {
                    var newMaxDistance = getDistBetweenPoints(intersections[k], intersections[j]); //?????????
                    if (newMaxDistance > currentMaxDistance) {
                        firstPoint = intersections[k];
                        secondPoint = intersections[j];
                        currentMaxDistance = newMaxDistance;
                    }
                }
            }
            var tmpLine = new _Line;
            tmpLine.p1 = firstPoint;
            tmpLine.p2 = secondPoint;
            resultLines.push(tmpLine);
        }
    }

    return resultLines;
}

function getDistBetweenPoints(p1, p2) {
    // 
    var xdist = p1.lng - p2.lng;
    var ydist = p1.lat - p2.lat;
    return Math.sqrt(xdist * xdist + ydist * ydist);
}

// Adjust the line segments such that they are all going the same direction with respect to going from P1->P2
// ???????????P1-> - P2????????
function _adjustLineDirection(lineList) {
    var resultLines = new Array(_Line);
    resultLines.shift();
    var firstAngle = 0;    //?????????? qreal
    for (var i = 0; i < lineList.length; i++) {
        var line = lineList[i]; //const QLineF&
        var adjustedLine = new Array(_Line); //QLineF
        adjustedLine.shift();
        var tmpAngle = angle(line);
        if (i == 0) {
            firstAngle = tmpAngle;  //???????????????firstAngle
        }

        if (Math.abs(tmpAngle - firstAngle) > 1.0) { //TODO ????  qAbs????return t >= 0 ? t : -t; ?????
            // adjustedLine.setP1(line.p2());
            // adjustedLine.setP2(line.p1());
            adjustedLine.p1 = line.p2;
            adjustedLine.p2 = line.p1;
        } else {
            adjustedLine = line;
        }

        resultLines.push(adjustedLine);
    }
    return resultLines;
}

function angle(line) {
    var dx = line.p2.lat - line.p1.lat;
    var dy = line.p2.lng - line.p1.lng;

    var theta = Math.atan2(-dy, dx) * 360.0 / M_2PI;

    var theta_normalized = theta < 0 ? theta + 360 : theta;

    if (theta_normalized = 360.0)
        return 0.0;
    else
        return theta_normalized;
}


//#define CONSTANTS_RADIUS_OF_EARTH			6371000			/* meters (m)		*/
//#define M_DEG_TO_RAD (M_PI / 180.0)
//#define M_PI (3.14159265358979323846)
//#define M_RAD_TO_DEG (180.0 / M_PI)
//TODO ????   ?Ned???Geo
function convertNedToGeo(x, y, z, origin) {
    var x_rad = x / CONSTANTS_RADIUS_OF_EARTH;
    var y_rad = y / CONSTANTS_RADIUS_OF_EARTH;
    var c = Math.sqrt(x_rad * x_rad + y_rad * y_rad);
    var sin_c = Math.sin(c);
    var cos_c = Math.cos(c);

    var ref_lon_rad = origin.lng * M_DEG_TO_RAD; //longitude ??
    var ref_lat_rad = origin.lat * M_DEG_TO_RAD; //latitude  ??

    var ref_sin_lat = Math.sin(ref_lat_rad);
    var ref_cos_lat = Math.cos(ref_lat_rad);

    var lat_rad;
    var lon_rad;

    if (Math.abs(c) > DBL_EPSILON) {
        lat_rad = Math.asin(cos_c * ref_sin_lat + (x_rad * sin_c * ref_cos_lat) / c);
        lon_rad = (ref_lon_rad + Math.atan2(y_rad * sin_c, c * ref_cos_lat * cos_c - x_rad * ref_sin_lat * sin_c));

    } else {
        lat_rad = ref_lat_rad;
        lon_rad = ref_lon_rad;
    }
    // coord->setLatitude(lat_rad * M_RAD_TO_DEG); //??
    // coord->setLongitude(lon_rad * M_RAD_TO_DEG); //??
    // coord->setAltitude(-z + origin.altitude()); //??
    return new _Point(lon_rad * M_RAD_TO_DEG, lat_rad * M_RAD_TO_DEG, -z + origin.z);
}

//#define M_DEG_TO_RAD (M_PI / 180.0)
//#define CONSTANTS_RADIUS_OF_EARTH			6371000			/* meters (m)		*/
//epsilon  #define DBL_EPSILON      2.2204460492503131e-016 // smallest such that 1.0+DBL_EPSILON != 1.0
//?Geo???Ned
function convertGeoToNed(coord, origin) {
    if (coord.lat == origin.lat && coord.lng == origin.lng) {
        // Short circuit to prevent NaNs in calculation
        // ?????????NaNs
        return new _Point(0, 0, 0);   //??????x,y,z  
    }

    //???????double??
    var lat_rad = coord.lat * M_DEG_TO_RAD;  //latitude??*M_DEG_TO_RAD
    var lon_rad = coord.lng * M_DEG_TO_RAD; //longitude??*M_DEG_TO_RAD

    var ref_lon_rad = origin.lng * M_DEG_TO_RAD;//longitude??*M_DEG_TO_RAD
    var ref_lat_rad = origin.lat * M_DEG_TO_RAD;//latitude??*M_DEG_TO_RAD

    var sin_lat = Math.sin(lat_rad);
    var cos_lat = Math.cos(lat_rad);
    var cos_d_lon = Math.cos(lon_rad - ref_lon_rad);

    var ref_sin_lat = Math.sin(ref_lat_rad);
    var ref_cos_lat = Math.cos(ref_lat_rad);

    var c = Math.acos(ref_sin_lat * sin_lat + ref_cos_lat * cos_lat * cos_d_lon);
    var k = (Math.abs(c) < DBL_EPSILON) ? 1.0 : (c / Math.sin(c));   //TODO ?fabs()??Math.abs()?????????

    var lat = k * (ref_cos_lat * sin_lat - ref_sin_lat * cos_lat * cos_d_lon) * CONSTANTS_RADIUS_OF_EARTH;
    var lng = k * cos_lat * Math.sin(lon_rad - ref_lon_rad) * CONSTANTS_RADIUS_OF_EARTH;
    var z = -(coord.z - origin.z);

    return new _Point(lng, lat, z);
}

//???????????
function _adjustTransectsToEntryPointLocation(transects) {
    if (transects.length == 0) {
        return;
    }

    var reversePoints = false;
    var reverseTransects = false;
    var _entyrLocation;

    if (_entyrLocation == EntryLocation.type.EntryLocationBottomLeft || _entyrLocation == EntryLocation.type.EntryLocationBottomRight) {
        reversePoints = true;
    }
    if (_entyrLocation == EntryLocation.type.EntryLocationTopRight || _entyrLocation == EntryLocation.type.EntryLocationBottomRight) {
        reverseTransects = true;
    }

    if (reversePoints) {
        _reverseInternalTransectPoints(transects);  //??????
    }
    if (reverseTransects) {
        console.log("_adjustTransectsToEntryPointLocation Reverse Transects");
        _reverseTransectOrder(transects); //???????
    }

    console.log("_adjustTransectsToEntryPointLocation Modified entry point:entryLocation" + transects);
}

function addInitionalPolyline(centerPoint, width, height, isMec = false) {
    // ignore isMec for template
    var retline = new _Line();

    var x = centerPoint.lng + (width / 2);
    var yInset = height / 4;
    var topPointCoord = new _Point(x, centerPoint.lat + yInset);
    var bottomPointCoord = new _Point(x, centerPoint.lat + height - yInset);

    retline.p1 = topPointCoord;
    retline.p2 = bottomPointCoord;
    return retline;
}

// Reverse the order of all points withing each transect, First point becomes last and so forth.
// ??????????????????????????????
function _reverseInternalTransectPoints(transects) {
    for (var i = 0; i < transects.length; i++) {
        var rgReversedCoords = []; //QList<QGeoCoordinate>
        var rgOriginalCoords = transects[i];//QList<QGeoCoordinate>&
        for (var j = rgOriginalCoords.length - 1; j >= 0; j--) {
            rgReversedCoords.push(rgOriginalCoords[j]);
        }
        transects[i] = rgReversedCoords;
    }
}

// Reverse the order of the transects. First transect becomes last and so forth.
// ???????????????????????????
function _reverseTransectOrder(transects) {
    var rgReversedTransects = [];//QList<QList<QGeoCoordinate>>
    for (var i = transects.length - 1; i >= 0; i--) {
        rgReversedTransects.push(transects[i]);
    }
    transects = rgReversedTransects;
}


// Reorders the transects such that the first transect is the shortest distance to the specified coordinate
// and the first point within that transect is the shortest distance to the specified coordinate.
//     @param distanceCoord Coordinate to measure distance against
//    @param transects Transects to test and reorder
// ??????????????????????????
// ????????????????????
// @param ???????????
// @param ?????????????
function _optimizeTransectsForShortestDistance(distanceCoord, transects) {
    var rgTransectDistance = new Array();
    rgTransectDistance[0] = distanceTo(transects[0][0], distanceCoord); // transects.first().first().distanceTo(distanceCoord);
    rgTransectDistance[1] = distanceTo(transects[0][transects[0].length - 1], distanceCoord);//transects.first().last().distanceTo(distanceCoord);
    rgTransectDistance[2] = distanceTo(transects[transects.length - 1][0], distanceCoord);//transects.last().first().distanceTo(distanceCoord);
    rgTransectDistance[3] = distanceTo(transects[transects.length - 1][transects[transects[transects.length - 1].length - 1].length - 1], distanceCoord);//transects.last().last().distanceTo(distanceCoord)

    var shortestIndex = 0;
    var shortestDistance = rgTransectDistance[0];
    for (var i = 1; i < 3; i++) {
        if (rgTransectDistance[i] < shortestDistance) {
            shortestIndex = i;
            shortestDistance = rgTransectDistance[i];
        }
    }

    if (shortestIndex > 1) {
        // We need to reverse the order of segments
        // ??????????
        _reverseTransectOrder(transects);
    }
    if (shortestIndex & 1) {
        // We need to reverse the points within each segment
        // ?????????????
        _reverseInternalTransectPoints(transects);
    }
}


function _hasTurnaround() {
    return _turnaroundDistance() > 0;
}

function _turnaroundDistance() {
    return _turnAroundDistanceFact.rawValue().toDouble();
}


function qMax(boundingRectWidth, boundingRectHeight) {
    if (boundingRectWidth > boundingRectHeight) {
        return boundingRectWidth;
    }
    return boundingRectHeight;
}

function lineIntersect(srcline, cmpline, intersectPt) {

    //var a = new _Point((srcline.points[1].lng - srcline.points[0].lng), (srcline.points[1].lat - srcline.points[0].lat), 0);
    //var b = new _Point((cmpline.points[0].lng - cmpline.points[1].lng), (cmpline.points[0].lat - cmpline.points[1].lat), 0);
    //var c = new _Point((srcline.points[0].lng - cmpline.points[0].lng), (srcline.points[0].lat - cmpline.points[0].lat), 0);
    var a = new _Point((srcline.p2.lng - srcline.p1.lng), (srcline.p2.lat - srcline.p1.lat), 0);
    var b = new _Point((cmpline.p1.lng - cmpline.p2.lng), (cmpline.p1.lat - cmpline.p2.lat), 0);
    var c = new _Point((srcline.p1.lng - cmpline.p1.lng), (srcline.p1.lat - cmpline.p1.lat), 0);

    var denominator = a.lat * b.lng - a.lng * b.lat;
    if (denominator == 0 || !isFinite(denominator))
        return 0;

    var reciprocal = 1 / denominator;
    var na = (b.lat * c.lng - b.lng * c.lat) * reciprocal;
    if (intersectPt != null) {
        var nlng = srcline.p1.lng + a.lng * na;
        var nlat = srcline.p1.lat + a.lat * na;
        parseFloat

        intersectionPoint = new _Point(parseFloat(nlng.toFixed(9)), parseFloat(nlat.toFixed(9)), 0);// = pt1 + a * na;
        return intersectionPoint;
    }


    if (na < 0 || na > 1)
        return 2;

    var nb = (a.lng * c.lat - a.lat * c.lng) * reciprocal;
    if (nb < 0 || nb > 1)
        return 2;

    return 1;
}

function listHasPoint(list, point) {
    for (var i = 0; i < list.length; ++i) {
        if (list[i].lat == point.lat && list[i].lng == point.lng) {
            return true;
        }
    }
    return false;
}
function qAbs(t) {
    return t >= 0 ? t : -t;
}

function nedPolyline(polyline) {
    //QList<QPointF>  nedPolyline;
    var nedPolyline = new Array(_Point);
    nedPolyline.shift();

    if (polyline.points.length > 0) {
        var tangentOrigin = polyline.points[0];
        for (var i = 0; i < polyline.points.length; i++) {
            var geoToNedResult;
            var vertex = polyline.points[i];
            if (i == 0) {
                geoToNedResult = new _Point(0, 0, 0);
            } else {
                geoToNedResult = convertGeoToNed(vertex, tangentOrigin);
            }
            nedPolyline.push(geoToNedResult);
        }
    }
    return nedPolyline;
}

function setLineAngel(line, angle) {
    var angleR = angle * M_2PI / 360.0;
    var l = distanceTo(line.p1, line.p2);

    var dx = Math.cos(angleR) * l;
    var dy = -Math.sin(angleR) * l;

    line.pt2.lng = line.pt1.lng + dx;
    line.pt2.lat = line.pt1.lng + dy;
}

function offsetPolyline(line, distance) {
    //QList<QGeoCoordinate> rgNewPolyline;
    var rgNewPolyline = new _Polyline;

    // I'm sure there is some beautiful famous algorithm to do this, but here is a brute force method

    if (line.points.length > 1) {
        // Convert the polygon to NED
        //QList<QPointF> rgNedVertices = nedPolyline();
        var rgNedVertices = nedPolyline(line);


        // Walk the edges, offsetting by the specified distance
        var rgOffsetEdges = new Array(_Line);
        rgOffsetEdges.shift();
        for (var i = 0; i < rgNedVertices.length - 1; i++) {
            //QLineF  offsetEdge;
            var offsetEdge = new _Line();
            //QLineF  originalEdge(rgNedVertices[i], rgNedVertices[i + 1]);
            var originalEdge = new _Line();
            originalEdge.p1 = rgNedVertices[i];
            originalEdge.p2 = rgNedVertices[i + 1]


            var workerLine1 = originalEdge;
            workerLine1.length = distanceTo(workerLine1.p1, workerLine1.p2);
            //workerLine1.angle =  workerLine1.angle - 90.0;
            setLineAngel(workerLine1, workerLine1.angle - 90.0);
            offsetEdge.p1 = workerLine1.p2;

            var workerLine2 = originalEdge;
            workerLine2.length = distanceTo(workerLine2.p1, workerLine2.p2);
            setLineAngle(workerLine2, workerLine2.angle + 90.0);
            offsetEdge.p2 = workerLine2.p2;

            rgOffsetEdges.append(offsetEdge);
        }

        //QGeoCoordinate  tangentOrigin = vertexCoordinate(0);
        var tangentOrigin = line.points[0];

        // Add first vertex
        //QGeoCoordinate coord;
        var coord1 = convertNedToGeo(rgOffsetEdges[0].p1.lat, rgOffsetEdges[0].p1.lng, 0, tangentOrigin);
        rgNewPolyline.append(coord1);

        // Intersect the offset edges to generate new central vertices
        var newVertex = new _Point(0, 0, 0);
        for (var i = 1; i < rgOffsetEdges.length; i++) {
            if (lineIntersect(rgOffsetEdges[i - 1], rgOffsetEdges[i], newVertex) == 0) {
                // Two lines are colinear
                newVertex = rgOffsetEdges[i].p2;
            }
            rgNewPolyline.append(convertNedToGeo(newVertex.lat, newVertex.lng, 0, tangentOrigin));
        }

        // Add last vertex
        var lastIndex = rgOffsetEdges.length - 1;
        var coord2 = convertNedToGeo(rgOffsetEdges[lastIndex].p2.lat, rgOffsetEdges[lastIndex].p2.lng, 0, tangentOrigin);
        rgNewPolyline.append(coord2);
    }

    return rgNewPolyline;
}