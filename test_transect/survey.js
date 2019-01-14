var _ignoreRecalc;  //忽略重新计算，布尔类型
var _loadedMissionItemsParent;  //TODO 暂时不知道是干什么的   QObject*
var _loadedMissionItems;	//TODO 暂时不知道是干什么的  QList<MissionItem*>
var _transects;  //线的数组   QList<QList<CoordInfo_t>>  
var _transectsPathHeightInfo; //高度的数组  QList<QList<TerrainPathQuery::PathHeightInfo_t>>

// 部分常量
var M_PI = 3.14159265358979323846;
var M_DEG_TO_RAD = M_PI / 180.0;
var CONSTANTS_RADIUS_OF_EARTH = 6371000;			/* meters (m)		*/
var DBL_EPSILON = Number.EPSILON;//2.2204460492503131e-016; 
var M_RAD_TO_DEG = (180.0 / M_PI);
var M_2PI = 6.28318530717958647692528676655900576;
var qgeocoordinate_EARTH_MEAN_RADIUS = 6371.0072;


// params

var _cameraCalc = 25;  //double型   相机对象，里面保存了相机的各种参数
var _flyAlternateTransectsFactBool = 0;  //TODO 暂时不知道是干什么


//常用结构
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


//输入参数
var __altitude = 50; //高度
var __triggerDist = 25; //
var __spacing = 25; // 间距
var __angle = 0; // 角度
var __turnaroundDist = 10; //_hasTurnaround() {return __turnaroundDist > 0s}
var __centerPoint = new _Point(0, 0, 0);
var __mapWidht = 100;
var __mapHeight = 100;

var __hoverANdCaptureImage = false;
var __reflyAt90DegOffSet = false;
var __imagesInTurnarounds = true;
var __relativeAltitude = true;
var __cameraTriggerInTurnAround = false;

// 输出
var _visualTransectPoints = [];
var _surveyAreaPolygon = new _Polygon();
var _centerCoord = new _Point(0, 0, 0);
var _coordinate = new _Point(0, 0, 0); //entry point 
var _exitCoordinate = new _Point(0, 0, 0); // exit point
var _transects = new Array(); // fly path
var _surveyArea = 0; // 调查区域面积
var _photoCount = 0; // 拍照数量
var _flightDist = 0; // 飞行距离

// paramaters format.
/*
    {
    "center_point":[],
    "height":120,
    "width":120,
    "altitude":25,
    "trigger_dist":25,
    "spacing":10,
    "angle":0,
    "turnaround_dist":10
}
*/
function isJsonString(str) { //判断字符串是否能转为json对象
    try {
        if (typeof JSON.parse(str) == "object") {
            return true;
        }
    } catch (e) {
    }
    return false;
}

function intiFromParam(params) { //控制参数初始化
    if (!isJsonString(params)) {
        return false;
    }
    var paramJsonObject = JSON.parse(params);
    if (paramJsonObject.hasOwnProperty("center_point")) {
        __centerPoint = paramJsonObject["center_point"];
    } else { return false; }
    if (paramJsonObject.hasOwnProperty("center_point")) {
        __centerPoint = paramJsonObject["center_point"];
    } else { return false; }
    if (paramJsonObject.hasOwnProperty("altitude")) __altitude = paramJsonObject["altitude"];
    if (paramJsonObject.hasOwnProperty("trigger_dist")) __triggerDist = paramJsonObject["trigger_dist"];
    if (paramJsonObject.hasOwnProperty("spacing")) __spacing = paramJsonObject["spacing"];
    if (paramJsonObject.hasOwnProperty("angle")) __angle = paramJsonObject["angle"];
    if (paramJsonObject.hasOwnProperty("turnaround_dist")) __turnaroundDist = paramJsonObject["turnaround_dist"];

    return true;
}

function getOutParams() {
    //var out_params = [];
    //out_params.push({"entry_poit": _coordinate});
    //out_params.push({"exit_point": _exitCoordinate});
    //out_params.push({"flight_path": _transects});
    //out_params.push({"photo_count": _photoCount});
    //out_params.push({"filght_dist": _flightDist});
    //out_params.push({"survey_area": _surveyArea});
    var out_params = {
        "entry_poit": _coordinate, "exit_point": _exitCoordinate, "flight_path": _transects,
        "photo_count": _photoCount, "filght_dist": _flightDist, "survey_area": _surveyArea
    };

    return JSON.stringify(out_params);
}

function calcAreaCorner(centerPoint, width, height) { // 计算四个角点位置
    var retval = new Array;
    centerPoint.lng += (width * 0.25) / 2;
    centerPoint.lat += (height * 0.25) / 2;
    var rectx = centerPoint.lng;
    var recty = centerPoint.lat;
    width *= 0.75;
    height *= 0.75;

    //_centerCoord = new _Point(rectx + (width / 2), recty + (height / 2), 0); /* clipToViewPort */
    _centerCoord = new _Point(rectx, recty, 0);
    var topLeftCoord = new _Point(rectx, recty, 0); /* clipToViewPort */
    var topRightCoord = new _Point(rectx + width, recty, 0); /* clipToViewPort */
    var bottomLeftCoord = new _Point(rectx, recty + height, 0); /* clipToViewPort */
    var bottomRightCoord = new _Point(rectx + width, recty + height, 0); /* clipToViewPort */

    // Initial polygon has max width and height of 3000 meters
    var halfWidthMeters = Math.min(distanceTo(topLeftCoord, topRightCoord), 3000) / 2
    var halfHeightMeters = Math.min(distanceTo(topLeftCoord, bottomLeftCoord), 3000) / 2
    //topLeftCoord = atDistanceAndAzimuth(atDistanceAndAzimuth(_centerCoord, halfWidthMeters, -90), halfHeightMeters, 0)
    retval.push(atDistanceAndAzimuth(atDistanceAndAzimuth(_centerCoord, halfWidthMeters, -90), halfHeightMeters, 0));
    //topRightCoord = atDistanceAndAzimuth(atDistanceAndAzimuth(_centerCoord, halfWidthMeters, 90), halfHeightMeters, 0)
    retval.push(atDistanceAndAzimuth(atDistanceAndAzimuth(_centerCoord, halfWidthMeters, 90), halfHeightMeters, 0));
    //bottomLeftCoord = atDistanceAndAzimuth(atDistanceAndAzimuth(_centerCoord, halfWidthMeters, -90), halfHeightMeters, 180)
    retval.push(atDistanceAndAzimuth(atDistanceAndAzimuth(_centerCoord, halfWidthMeters, -90), halfHeightMeters, 180));
    //bottomRightCoord = atDistanceAndAzimuth(atDistanceAndAzimuth(_centerCoord, halfWidthMeters, 90), halfHeightMeters, 180)
    retval.push(atDistanceAndAzimuth(atDistanceAndAzimuth(_centerCoord, halfWidthMeters, 90), halfHeightMeters, 180));
    return retval;
}

function calcRoutineLen(paths) // 计算路径经过的长度
{
    var totallen = 0;
    for (var i = 0; i < paths.length - 1; ++i) {
        totallen += distanceTo(paths[i], paths[i + 1]);
    }

    return totallen;
}

function converStrToPoints(points_str) {

    var retPoints = [];
    if (isJsonString(points_str)) {
        var points = JSON.parse(points_str);
        for (var i = 0; i < points.length; ++i) {
            if (points[i].length < 2) {
                console.log("Maybe invalid param format.");
                return retPoints;
            }
            var tmpPoint;
            if (points[i].length == 2) tmpPoint = new _Point(points[i][0], points[i][1], 0);
            if (points[i].length == 3) tmpPoint = new _Point(points[i][0], points[i][1], points[i][2]);
            retPoints.push(tmpPoint);
        }
    } else { return retPoints; }
    return retPoints;
}

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

function rebuildTransectsPhase1Worker(refly) {
    _transects = [];
    // Convert polygon to NED
    // 将多边形转换为NED
    //if (!JSON.parse(args).hasOwnProperty("surveyAreaPolygon")) return;
    //var argsjsonobj = JSON.parse(args);
    //var pointsstrs = argsjsonobj["surveyAreaPolygon"];
    _surveyAreaPolygon.points.push(new _Point(115.99505953, 40.002826142, 0))
    _surveyAreaPolygon.points.push(new _Point(116.00352426, 40.002826142, 0))
    _surveyAreaPolygon.points.push(new _Point(116.00352426, 39.997617517, 0))
    _surveyAreaPolygon.points.push(new _Point(115.99505953, 39.997617517, 0))
    for (var i = 0; i < _visualTransectPoints.length; ++i) {
        _surveyAreaPolygon.points.push(_visualTransectPoints[i]);
    }
    var polygonPoints = new Array(_Point);
    polygonPoints.shift();  //点数组  QList<QPointF>  结构类似于[[24.3,111],[34.5,233]];
    var tangentOrigin = _surveyAreaPolygon.points[0]; //这里是取第一个点的信息 QGeoCoordinate  结构类似于[23.5,111,50]
    console.log("_rebuildTransectsPhase1 Convert polygon to NED - _surveyAreaPolygon.length:tangentOrigin" + _surveyAreaPolygon.length + tangentOrigin); //打印数据
    for (var i = 0; i < _surveyAreaPolygon.points.length; i++) {
        var geoToNedResult;
        var vertex = _surveyAreaPolygon.points[i]; //这里是取第i个点的信息  QGeoCoordinate  结构类似于[23.5,111,50]
        if (i == 0) {
            // This avoids a nan calculation that comes out of convertGeoToNed
            // 这就避免了转换地形后的nan计算
            geoToNedResult = new _Point(0, 0, 0);
        } else {
            geoToNedResult = convertGeoToNed(vertex, tangentOrigin); //将Geo转换成Ned
        }
        polygonPoints.push(geoToNedResult);  //polygonPoints点数组中添加转换后的点
        if (polygonPoints.length != (i + 1)) {
            console.log("Convert Geo to NED failed.");
            //return _transects;
        }
        console.log("_rebuildTransectsPhase1 vertex:x:y" + vertex + polygonPoints[polygonPoints.length - 1]);
    }

    // Generate transects
    // 生成横断面

    __angle = _clampGridAngle90(__angle);  //这里调用格式化角度的函数
    __angle += refly ? 90 : 0;    //根据refly的值来调整角度的值
    console.log("_rebuildTransectsPhase1 Clamped grid angle" + __angle);

    console.log("_rebuildTransectsPhase1 gridSpacing:gridAngle:refly" + __spacing + __angle + refly);
    // Convert polygon to bounding rect
    // 将多边形转换为包围矩形
    console.log("_rebuildTransectsPhase1 Polygon");
    var polygon = new _Polygon;
    for (var i = 0; i < polygonPoints.length; i++) {
        console.log("Vertex" + polygonPoints[i]);
        polygon.points.push(polygonPoints[i]);
    }
    polygon.points.push(polygonPoints[0]); //这里是为了形成闭合的图形
    //QRectF boundingRect = polygon.boundingRect(); //获取到矩形
    //QPointF boundingCenter = boundingRect.center(); //计算出中心点
    //TODO 这里需要算出矩形的宽度、高度和中心点
    var maxX = polygonPoints[0].lng; //最大经度
    var minX = polygonPoints[0].lng; //最小经度
    var maxY = polygonPoints[0].lat; //最大纬度
    var minY = polygonPoints[0].lat; //最小纬度
    for (var i = 1; i < polygonPoints.length; i++) {
        var tmpX = polygonPoints[i].lng;
        var tmpY = polygonPoints[i].lat;
        if (maxX < tmpX) {
            maxX = tmpX;
        }
        if (minX > tmpX) {
            minX = tmpX;
        }
        if (maxY < tmpY) {
            maxY = tmpY;
        }
        if (minY > tmpY) {
            minY = tmpY;
        }
    }
    var boundingCenter = new _Point((maxX + minX) / 2, (maxY + minY) / 2, 0);
    var boundingRect = [];
    boundingRect.push(maxX - minX);
    boundingRect.push(maxY - minY);
    //  qCDebug(SurveyComplexItemLog) << "Bounding rect" << boundingRect.topLeft().x() << boundingRect.topLeft().y() << boundingRect.bottomRight().x() << boundingRect.bottomRight().y(); //打印数据

    // Create set of rotated parallel lines within the expanded bounding rect. Make the lines larger than the
    // bounding box to guarantee intersection.
    //在展开边界矩形内创建一组旋转平行线边界框保证相交。
    var lineList = new Array();   //线数组  QList<QLineF>  结构类似于  [[[23.1,111],[23.4,102]],[[23.2,100],[34.7,130]],[[12.2,131],[42.4,121]]]

    // Transects are generated to be as long as the largest width/height of the bounding rect plus some fudge factor.
    // This way they will always be guaranteed to intersect with a polygon edge no matter what angle they are rotated to.
    // They are initially generated with the transects flowing from west to east and then points within the transect north to south.
    // 生成的横断面与边界矩形的最大宽度/高度一样长，加上一些模糊因子。
    // 这样，无论旋转到什么角度，它们都保证与多边形边缘相交。
    // 它们最初是由横断面由西向东流动产生的，然后在横断面内由北向南指向点。
    var maxWidth = qMax(boundingRect[0], boundingRect[1]) + 2000.0; // 最大宽度，qMax函数是执行 return (a < b) ? b : a; 查找最大值
    var halfWidth = maxWidth / 2.0; //最大宽度的一半
    var transectX = boundingCenter.lng - halfWidth;  //TODO 这里不懂,算出来的是什么
    var transectXMax = transectX + maxWidth; //TODO 这里不懂
    while (transectX < transectXMax) { //TODO 符合条件就进行计算  这里不懂
        var transectYTop = boundingCenter.lat - halfWidth;
        var transectYBottom = boundingCenter.lat + halfWidth;
        var tmpLine = new _Polyline;

        tmpLine.points.push(_rotatePoint(new _Point(transectX, transectYTop, 0), boundingCenter, __angle));
        tmpLine.points.push(_rotatePoint(new _Point(transectX, transectYBottom, 0), boundingCenter, __angle));

        transectX += __spacing;
        lineList.push(tmpLine);
    }


    // Now intersect the lines with the polygon
    // 现在与多边形相交
    //; //线数组 QList<QLineF>
    var intersectLines = _intersectLinesWithPolygon(lineList, polygon);


    // Less than two transects intersected with the polygon:
    //      Create a single transect which goes through the center of the polygon
    //      Intersect it with the polygon
    // 与多边形相交的截面积小于两个截面积:
    // 创建一个通过多边形中心的横断面
    // 与多边形相交
    if (intersectLines.length < 2) {
        //_surveyAreaPolygon.center();  //TODO 不知道这里是做什么 
        var firstLine = lineList[0]; //QLineF  取第一条线
        var lineCenter = [(firstLine[0][0] + firstLine[1][0]) / 2, (firstLine[0][1] + firstLine[1][1]) / 2]; //QPointF 获取两点的中心点
        var centerOffset = [boundingCenter[0][0] - lineCenter[0][1], boundingCenter[0][0] - lineCenter[0][1]]; //TODO QPointF 这里不知道算的对不对
        // firstLine.translate(centerOffset);
        firstLine[0] = [[firstLine[0][0][0] + centerOffset[0][0], firstLine[0][0][1] + centerOffset[0][1]], [firstLine[0][1][0] + centerOffset[0][0], firstLine[0][1][1] + centerOffset[0][1]]];
        firstLine[1] = [[firstLine[1][0][0] + centerOffset[0][0], firstLine[1][0][1] + centerOffset[0][1]], [firstLine[1][1][0] + centerOffset[0][0], firstLine[1][1][1] + centerOffset[0][1]]];
        lineList = new Array(); //清理
        lineList.push(firstLine);
        intersectLines = lineList;
        _intersectLinesWithPolygon(lineList, polygon, intersectLines);
    }

    // Make sure all lines are going the same direction. Polygon intersection leads to lines which
    // can be in varied directions depending on the order of the intesecting sides.
    // 确保所有的线都沿着相同的方向。多边形相交产生的直线可根据安装方向的不同而有不同的方向。
    //var resultLines;   //QList<QLineF>   线数组
    var resultLines = _adjustLineDirection(intersectLines);  //这里是调整线的函数,确认到这一步没有错


    // Convert from NED to Geo
    // 从NED转换为Geo
    var transects = [];   //线数组 QList<QList<QGeoCoordinate>>
    for (var ind = 0; ind < resultLines.length; ind++) {  //遍历线数组resultLines
        var tmpLine = resultLines[ind];  //QGeoCoordinate
        var transect = [];//QList<QGeoCoordinate>
        transect.push(convertNedToGeo(tmpLine.points[0].lat, tmpLine.points[0].lng, 0, tangentOrigin)); //将Ned转换成Geo
        transect.push(convertNedToGeo(tmpLine.points[1].lat, tmpLine.points[1].lng, 0, tangentOrigin)); //将Ned转换成Geo
        transects.push(transect);
    }

    _adjustTransectsToEntryPointLocation(transects); //调整横断面到入口点位置

    if (refly) {
        _optimizeTransectsForShortestDistance(_transects[_transects.length - 1][_transects[_transects.length - 1].length - 1], transects);
    }

    if (_flyAlternateTransectsFactBool) { // 
        var alternatingTransects = []; //QList<QList<QGeoCoordinate>>
        for (var i = 0; i < transects.length; i++) {
            if (!(i & 1)) {
                alternatingTransects.push(transects[i]);
            }
        }
        for (var i = transects.length - 1; i > 0; i--) {
            if (i & 1) {
                alternatingTransects.push(transects[i]);
            }
        }
        transects = alternatingTransects;
    }

    // Adjust to lawnmower pattern
    // 调整到割草机模式
    var reverseVertices = false;
    for (var i = 0; i < transects.length; i++) {
        // We must reverse the vertices for every other transect in order to make a lawnmower pattern
        // 为了做出割草机的图案，我们必须对每一个其他切面翻转顶点
        var transectVertices = transects[i]; //QList<QGeoCoordinate>
        if (reverseVertices) {
            reverseVertices = false;
            var reversedVertices = []; //QList<QGeoCoordinate>
            for (var j = transectVertices.length - 1; j >= 0; j--) {
                reversedVertices.push(transectVertices[j]);
            }
            transectVertices = reversedVertices;
        } else {
            reverseVertices = true;
        }
        transects[i] = transectVertices;
    }

    // Convert to CoordInfo transects and append to _transects
    // 转换为坐标横断面和追加到_transect
    for (var ind = 0; ind < transects.length; ind++) { //const QList<QGeoCoordinate>&  transect的结构[[x,y,z],[x,y,z]]
        var coord; //QGeoCoordinate
        var coordInfoTransect = new Array(_CoordInfo); //QList<TransectStyleComplexItem::CoordInfo_t>
        coordInfoTransect.shift();
        var coordInfo1 = new _CoordInfo(); //TransectStyleComplexItem::CoordInfo_t 
        var transect = transects[ind];
        coordInfo1.coord = transect[0];
        coordInfo1.type = CoordType.CoordTypeSurveyEdge;
        coordInfoTransect.push(coordInfo1);
        var coordInfo2 = new _CoordInfo();
        coordInfo2.coord = transect[1];
        coordInfo2.type = CoordType.CoordTypeSurveyEdge;
        coordInfoTransect.push(coordInfo2);

        // For hover and capture we need points for each camera location within the transect
        // 对于悬停和捕获，我们需要为横断面内的每个摄像机位置提供点
        // 判断照相机的属性是否设置
        if (false) {//(triggerCamera() && hoverAndCaptureEnabled()) 
            //bool    triggerCamera           (void) const { return triggerDistance() != 0; }
            // bool    hoverAndCaptureEnabled  (void) const { return hoverAndCapture()->rawValue().toBool(); }
            var transectLength = distanceTo(transect[0], transect[1]);  //这里是在算距离
            var transectAzimuth = azimuthTo(transect[0], transect[1]);  //这里是在算角度

            if (__triggerDist < transectLength) {//double  triggerDistance         (void) const { return _cameraCalc.adjustedFootprintFrontal()->rawValue().toDouble(); }
                var cInnerHoverPoints = Math.floor(transectLength / __triggerDist);
                console.log("cInnerHoverPoints" + cInnerHoverPoints);
                for (var i = 0; i < cInnerHoverPoints; i++) {
                    var hoverCoord = atDistanceAndAzimuth(transect[0], __triggerDist * (i + 1), transectAzimuth); //QGeoCoordinate
                    var coordInfo = [hoverCoord, CoordType.CoordTypeInteriorHoverTrigger]; //TransectStyleComplexItem::CoordInfo_t 
                    coordInfoTransect.push(coordInfo);  //coordInfoTransect.insert(1 + i, coordInfo);
                }
            }
        }

        // Extend the transect ends for turnaround
        // 扩展样条端点以实现周转
        if (__turnaroundDist > 0) {//(_hasTurnaround) {  //_hasTurnaround()
            //QGeoCoordinate
            var turnAroundDistance = __turnaroundDist; //double

            var azimuth = azimuthTo(transect[0], transect[1]); //double
            var turnaroundCoord1 = atDistanceAndAzimuth(transect[0], -turnAroundDistance, azimuth);
            //turnaroundCoord[2] = qQNaN(); //turnaroundCoord.setAltitude(qQNaN());
            var coordInfo3 = new _CoordInfo();
            coordInfo3.coord = turnaroundCoord1
            coordInfo3.type = CoordType.CoordTypeTurnaround;  //TransectStyleComplexItem::CoordInfo_t
            coordInfoTransect.unshift(coordInfo3);   //coordInfoTransect.prepend(coordInfo);

            azimuth = azimuthTo(transect[transect.length - 1], transect[transect.length - 2]);
            var turnaroundCoord2 = atDistanceAndAzimuth(transect[transect.length - 1], -turnAroundDistance, azimuth);
            //turnaroundCoord[2] = qQNaN();
            var coordInfo4 = new _CoordInfo();
            coordInfo4.coord = turnaroundCoord2;
            coordInfo4.type = CoordType.CoordTypeTurnaround;
            coordInfoTransect.push(coordInfo4);
        }

        _transects.push(coordInfoTransect);
    }

    return _transects;
}

function rebuildTransectsPhase2() {
    //if (!isJsonString(args)) return [];
    // if (!JSON.parse(args).hasOwnProperty("visualTransectPoints")) return;
    //var argsjsonobj = JSON.parse(args);
    //_visualTransectPoints = argsjsonobj["visualTransectPoints"];
    _visualTransectPoints = [];
    for (var indi = 0; indi < _transects.length; indi++) {
        var transect = _transects[indi];
        for (var indj = 0; indj < transect.length; indj++) {
            _visualTransectPoints.push(transect[indj]);
        }
    }
    _complexDistance = 0;
    for (var i = 0; i < _visualTransectPoints.length - 1; i++) {
        //_complexDistance += _visualTransectPoints[i].value<QGeoCoordinate>().distanceTo(_visualTransectPoints[i+1].value<QGeoCoordinate>());
        //計算_visualTransectPoints所成綫的長度
        _complexDistance += distanceTo(_visualTransectPoints[i].coord, _visualTransectPoints[i + 1].coord);
    }

    // 计算拍照次数
    if (__cameraTriggerInTurnAround) {
        _photoCount = Math.ceil(_complexDistance / __triggerDist);
    } else {
        _photoCount = 0;
        for (var ind = 0; ind < _transects.length; ind++) {
            var transect = _transects[ind];
            var firstCameraCoord, lastCameraCoord;
            if (__turnaroundDist > 0) {
                firstCameraCoord = transect[1].coord;
                lastCameraCoord = transect[transect.length - 2].coord;
            } else {
                firstCameraCoord = transect[0].coord;
                lastCameraCoord = transect[transect.length - 1].coord;
            }
            _photoCount += Math.ceil(distanceTo(firstCameraCoord, lastCameraCoord) / __triggerDist);
        }
    }

    // 这里记录了飞入飞出点,如果_visualTransectPoints有值,就是他里面的第一个点，如果灭有，就是(0, 0)点，飞出同.
    if (_visualTransectPoints.length == 0) {
        _coordinate = [0, 0, 0];
        _exitCoordinate = [0, 0, 0];
    }
    else {
        _coordinate = _visualTransectPoints[0]; //_coordinate = _visualTransectPoints[0][0];
        _exitCoordinate = _visualTransectPoints[_visualTransectPoints.length - 1]; // 同上
    }
    var retval = [];
    retval.push(_coordinate);
    retval.push(_exitCoordinate);

    return retval;
}

function buildMissionItemJson(coordInfoList = _transects) {
    var seqNum = 2;//_sequenceNumber;TODO
    var imagesEverywhere = __cameraTriggerInTurnAround;
    var addTriggerAtBeginning = !__hoverANdCaptureImage && imagesEverywhere;
    var firstOverallPoint = true;
    var addTriggerAtBeginning = false;
    var mavFrame = 3; // TODO:

    var itemlist = [];

    for (var i = 0; i < coordInfoList.length; ++i) {
        var entryPoint = true;
        for (var j = 0; j < coordInfoList[i].length; ++j) {
            /*  "autoContinue": true,
                "command": 16,
                "doJumpId": 2,
                "frame": 3,
                "params": [
                    0,
                    0,
                    0,
                    null,
                    40.0178603154819,
                    116.27626663248563,
                    50
                ],
                "type": "SimpleItem" */
            var item_case1 = new _ItemCase();
            item_case1.doJumpId = seqNum++;
            item_case1.command = 16;//MAV_CMD_NAV_WAYPOINT
            item_case1.frame = mavFrame;
            item_case1.params = [__hoverANdCaptureImage ? 1 : 0,
                0.0, 0.0, 0.0,
            coordInfoList[i][j].coord.lng, coordInfoList[i][j].coord.lat, coordInfoList[i][j].coord.z];
            item_case1.autoContinue = true;
            item_case1.isCurrentItem = false;
            item_case1.type = "SimpleItem"; // confirm
            itemlist.push(item_case1);

            if (__hoverANdCaptureImage) {
                var item_case2 = new _ItemCase();
                item_case2.doJumpId = seqNum++;
                item_case2.command = 2000;//MAV_CMD_IMAGE_START_CAPTURE
                item_case2.frame = 2; //MAV_FRAME_MISSION
                item_case2.params = [0.0, 0.0, 1, 0.0, 0.0, 0.0, 0.0];
                item_case2.autoContinue = true;
                item_case2.isCurrentItem = false;
                item_case2.type = "SimpleItem"; // confirm
                itemlist.push(item_case2);
                /*item = new MissionItem(seqNum++,
                    MAV_CMD_IMAGE_START_CAPTURE,
                    MAV_FRAME_MISSION,
                    0,                           // Reserved (Set to 0)
                    0,                           // Interval (none)
                    1,                           // Take 1 photo
                    0, 0, 0, 0,          // param 4-7 reserved
                    true,                        // autoContinue
                    false,                       // isCurrentItem
                    missionItemParent);
                items.append(item);*/
            }

            if (firstOverallPoint && addTriggerAtBeginning) {
                // Start triggering
                addTriggerAtBeginning = false;

                var item_case3 = new _ItemCase();
                item_case3.doJumpId = seqNum++;
                item_case3.command = 206;//MAV_CMD_IMAGE_START_CAPTURE
                item_case3.frame = 2; //MAV_FRAME_MISSION
                item_case3.params = [0.0, 0.0, 1, 0.0, 0.0, 0.0, 0.0];
                item_case3.autoContinue = true;
                item_case3.isCurrentItem = false;
                item_case3.type = "SimpleItem"; // confirm
                itemlist.push(item_case3);
                /*item = new MissionItem(seqNum++,
                    MAV_CMD_DO_SET_CAM_TRIGG_DIST,
                    MAV_FRAME_MISSION,
                    triggerDistance(),   // trigger distance
                    0,                   // shutter integration (ignore)
                    1,                   // trigger immediately when starting
                    0, 0, 0, 0,          // param 4-7 unused
                    true,                // autoContinue
                    false,               // isCurrentItem
                    missionItemParent);
                items.append(item);*/
            }
            firstOverallPoint = false;

            if (firstOverallPoint) {//(transectCoordInfo.coordType == TransectStyleComplexItem:: CoordTypeSurveyEdge && triggerCamera() && !hoverAndCaptureEnabled() && !imagesEverywhere) {
                if (entryPoint) {
                    // Start of transect, start triggering

                    var item_case4 = new _ItemCase();
                    item_case4.doJumpId = seqNum++;
                    item_case4.command = 206;//MAV_CMD_IMAGE_START_CAPTURE
                    item_case4.frame = 2; //MAV_FRAME_MISSION
                    item_case4.params = [0.0, 0.0, 1, 0.0, 0.0, 0.0, 0.0];
                    item_case4.autoContinue = true;
                    item_case4.isCurrentItem = false;
                    item_case4.type = "SimpleItem"; // confirm
                    itemlist.push(item_case4);
                    /*item = new MissionItem(seqNum++,
                        MAV_CMD_DO_SET_CAM_TRIGG_DIST,
                        MAV_FRAME_MISSION,
                        triggerDistance(),   // trigger distance
                        0,                   // shutter integration (ignore)
                        1,                   // trigger immediately when starting
                        0, 0, 0, 0,          // param 4-7 unused
                        true,                // autoContinue
                        false,               // isCurrentItem
                        missionItemParent);
                    items.append(item);*/
                } else {
                    // End of transect, stop triggering
                    var item_case4 = new _ItemCase();
                    item_case4.doJumpId = seqNum++;
                    item_case4.command = 206;//MAV_CMD_IMAGE_START_CAPTURE
                    item_case4.frame = 2; //MAV_FRAME_MISSION
                    item_case4.params = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
                    item_case4.autoContinue = true;
                    item_case4.isCurrentItem = false;
                    item_case4.type = "SimpleItem"; // confirm
                    itemlist.push(item_case4);
                    /*item = new MissionItem(seqNum++,
                        MAV_CMD_DO_SET_CAM_TRIGG_DIST,
                        MAV_FRAME_MISSION,
                        0,           // stop triggering
                        0,           // shutter integration (ignore)
                        0,           // trigger immediately when starting
                        0, 0, 0, 0,  // param 4-7 unused
                        true,        // autoContinue
                        false,       // isCurrentItem
                        missionItemParent);
                    items.append(item);*/
                }
                entryPoint = !entryPoint;
            }
        }
    }

    return JSON.stringify(itemlist);
}

/*
    double QGCMapPolygon::area(void) const
{
    // https://www.mathopenref.com/coordpolygonarea2.html

    if (_polygonPath.count() < 3) {
        return 0;
    }

    double coveredArea = 0.0;
    QList<QPointF> nedVertices = nedPolygon();
    for (int i=0; i<nedVertices.count(); i++) {
        if (i != 0) {
            coveredArea += nedVertices[i - 1].x() * nedVertices[i].y() - nedVertices[i].x() * nedVertices[i -1].y();
        } else {
            coveredArea += nedVertices.last().x() * nedVertices[i].y() - nedVertices[i].x() * nedVertices.last().y();
        }
    }
    return 0.5 * fabs(coveredArea);
}
*/

function calcArea(polygon) {
    var area = 0.0;
    if (polygon.points.length < 3) return area;

    for (var i = 0; i < polygon.points.length; ++i) {
        if (i != 0) {
            area += polygon.points[i - 1].lng * polygon.points[i].lat - polygon.points[i].lng * polygon.points[i - 1].y;
        }
        else {
            area += polygon.points.last().lng * polygon.points[i].lat - polygon.points[i].lng * polygon.points.last().y;
        }
    }

    return area;
}

function rotateEntryPoint(args) { //TODO:旋转角点
    return null;
}

function _rotatePoint(point, origin, angle) {
    var radians = (M_PI / 180.0) * -angle;

    var lat = ((point.lat - origin.lat) * Math.cos(radians)) - ((point.lng - origin.lng) * Math.sin(radians)) + origin.lat;
    var lng = ((point.lat - origin.lat) * Math.sin(radians)) + ((point.lng - origin.lng) * Math.cos(radians)) + origin.lng;

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
    console.log(the);
    console.log(other);
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

function JSModf(val) { // rst[0] 整数部分 rst[1] 小数部分
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
    // 调整角度在-90到90之间，这可以防止横断面被旋转到相反的顺序。
    if (gridAngle > 90.0) {
        gridAngle -= 180.0;
    } else if (gridAngle < -90.0) {
        gridAngle += 180;
    }
    return gridAngle;
}

//TODO 这里不懂
function _intersectLinesWithPolygon(lineList, polygon) {
    var resultLines = new Array(_Polyline); //清除线数组
    resultLines.shift();

    for (var i = 0; i < lineList.length; i++) {
        var line = lineList[i];
        var intersections = new Array(_Point);  // QList<QPointF>
        intersections.shift();
        // Intersect the line with all the polygon edges
        // 与所有多边形边相交
        for (var j = 0; j < polygon.points.length - 1; j++) {
            var intersectPoint = new _Point(0, 0, 0); //QPointF
            var polygonLine = new _Polyline();
            polygonLine.points.push(polygon.points[j]);
            polygonLine.points.push(polygon.points[j + 1]); //QLineF
            if (lineIntersect(line, polygonLine, null) == 1) {
                intersectPoint = lineIntersect(line, polygonLine, intersectPoint);
                if (!listHasPoint(intersections, intersectPoint)) {
                    intersections.push(intersectPoint);
                }
            }

        }

        // We now have one or more intersection points all along the same line. Find the two
        // which are furthest away from each other to form the transect.
        // 我们现在在同一条直线上有一个或多个交点。找到这两个它们彼此之间距离最远，形成了横断面。
        if (intersections.length > 1) {
            var firstPoint = new _Point(0, 0, 0); //QPointF
            var secondPoint = new _Point(0, 0, 0); //QPointF
            var currentMaxDistance = 0;//double

            for (var k = 0; k < intersections.length; k++) {
                for (var j = 0; j < intersections.length; j++) {
                    var newMaxDistance = getDistBetweenPoints(intersections[k], intersections[j]); //计算两点之间的距离
                    if (newMaxDistance > currentMaxDistance) {
                        firstPoint = intersections[k];
                        secondPoint = intersections[j];
                        currentMaxDistance = newMaxDistance;
                    }
                }
            }
            var tmpLine = new _Polyline();
            tmpLine.points.push(firstPoint);
            tmpLine.points.push(secondPoint);
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
// 调整线段，使它们相对于P1-> - P2都沿着相同的方向
function _adjustLineDirection(lineList) {
    var resultLines = [];
    var firstAngle = 0;    //用来存第一条线的角度 qreal
    for (var i = 0; i < lineList.length; i++) {
        var line = lineList[i]; //const QLineF&
        var adjustedLine = new Array(); //QLineF
        var tmpAngle = angle(line);
        if (i == 0) {
            firstAngle = tmpAngle;  //如果是第一条线，将角度的值赋给firstAngle
        }

        if (Math.abs(tmpAngle - firstAngle) > 1.0) { //TODO 这里不懂  qAbs函数执行return t >= 0 ? t : -t; 取正数操作
            // adjustedLine.setP1(line.p2());
            // adjustedLine.setP2(line.p1());
            adjustedLine[0] = line[1];
            adjustedLine[1] = line[0];
        } else {
            adjustedLine = line;
        }

        resultLines.push(adjustedLine);
    }
    return resultLines;
}

function angle(line) {
    var dx = line.points[1].lat - line.points[0].lat;
    var dy = line.points[1].lng - line.points[0].lng;

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
//TODO 这里不懂   将Ned转换成Geo
function convertNedToGeo(x, y, z, origin) {
    var x_rad = x / CONSTANTS_RADIUS_OF_EARTH;
    var y_rad = y / CONSTANTS_RADIUS_OF_EARTH;
    var c = Math.sqrt(x_rad * x_rad + y_rad * y_rad);
    var sin_c = Math.sin(c);
    var cos_c = Math.cos(c);

    var ref_lon_rad = origin.lng * M_DEG_TO_RAD; //longitude 经度
    var ref_lat_rad = origin.lat * M_DEG_TO_RAD; //latitude  纬度

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
    // coord->setLatitude(lat_rad * M_RAD_TO_DEG); //纬度
    // coord->setLongitude(lon_rad * M_RAD_TO_DEG); //经度
    // coord->setAltitude(-z + origin.altitude()); //高度
    return new _Point(lon_rad * M_RAD_TO_DEG, lat_rad * M_RAD_TO_DEG, -z + origin.z);
}

//#define M_DEG_TO_RAD (M_PI / 180.0)
//#define CONSTANTS_RADIUS_OF_EARTH			6371000			/* meters (m)		*/
//epsilon  #define DBL_EPSILON      2.2204460492503131e-016 // smallest such that 1.0+DBL_EPSILON != 1.0
//将Geo转化为Ned
function convertGeoToNed(coord, origin) {
    if (coord.lat == origin.lat && coord.lng == origin.lng) {
        // Short circuit to prevent NaNs in calculation
        // 短路，防止计算中的NaNs
        return new _Point(0, 0, 0);   //按顺序依次为x,y,z  
    }

    //下面的变量均为double类型
    var lat_rad = coord.lat * M_DEG_TO_RAD;  //latitude纬度*M_DEG_TO_RAD
    var lon_rad = coord.lng * M_DEG_TO_RAD; //longitude经度*M_DEG_TO_RAD

    var ref_lon_rad = origin.lng * M_DEG_TO_RAD;//longitude经度*M_DEG_TO_RAD
    var ref_lat_rad = origin.lat * M_DEG_TO_RAD;//latitude纬度*M_DEG_TO_RAD

    var sin_lat = Math.sin(lat_rad);
    var cos_lat = Math.cos(lat_rad);
    var cos_d_lon = Math.cos(lon_rad - ref_lon_rad);

    var ref_sin_lat = Math.sin(ref_lat_rad);
    var ref_cos_lat = Math.cos(ref_lat_rad);

    var c = Math.acos(ref_sin_lat * sin_lat + ref_cos_lat * cos_lat * cos_d_lon);
    var k = (Math.abs(c) < DBL_EPSILON) ? 1.0 : (c / Math.sin(c));   //TODO 将fabs()改成Math.abs()不知道会不会有影响

    var lat = k * (ref_cos_lat * sin_lat - ref_sin_lat * cos_lat * cos_d_lon) * CONSTANTS_RADIUS_OF_EARTH;
    var lng = k * cos_lat * Math.sin(lon_rad - ref_lon_rad) * CONSTANTS_RADIUS_OF_EARTH;
    var z = -(coord.z - origin.z);

    return new _Point(lng, lat, z);
}

//调整横断面到入口点位置
function _adjustTransectsToEntryPointLocation(transects) {
    if (transects.length == 0) {
        return;
    }

    var reversePoints = false;
    var reverseTransects = false;
    var _entyrLocation;

    //TODO 这里不知道该如何改
    if (_entyrLocation == EntryLocation.type.EntryLocationBottomLeft || _entyrLocation == EntryLocation.type.EntryLocationBottomRight) {
        reversePoints = true;
    }
    if (_entyrLocation == EntryLocation.type.EntryLocationTopRight || _entyrLocation == EntryLocation.type.EntryLocationBottomRight) {
        reverseTransects = true;
    }

    if (reversePoints) {
        console.log("_adjustTransectsToEntryPointLocation Reverse Points");
        _reverseInternalTransectPoints(transects);  //颠倒点的位置
    }
    if (reverseTransects) {
        console.log("_adjustTransectsToEntryPointLocation Reverse Transects");
        _reverseTransectOrder(transects); //颠倒切面的位置
    }

    console.log("_adjustTransectsToEntryPointLocation Modified entry point:entryLocation" + transects);
}

// Reverse the order of all points withing each transect, First point becomes last and so forth.
// 将每个切面上所有点的顺序颠倒，第一点变成最后一点，依此类推。
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
// 反转横切的顺序。第一个切面成为最后一个切面，依此类推。
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
// 重新排序横断面，使第一个横断面是到指定坐标的最短距离
// 横断面内的第一点是到指定坐标的最短距离。
// @param 用来测量距离的距离坐标
// @param 横断面横断面测试和重新排序
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
        // 我们需要颠倒段的顺序
        _reverseTransectOrder(transects);
    }
    if (shortestIndex & 1) {
        // We need to reverse the points within each segment
        // 我们需要在每段中反转这些点
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


    var a = new _Point((srcline.points[1].lng - srcline.points[0].lng), (srcline.points[1].lat - srcline.points[0].lat), 0);
    var b = new _Point((cmpline.points[0].lng - cmpline.points[1].lng), (cmpline.points[0].lat - cmpline.points[1].lat), 0);
    var c = new _Point((srcline.points[0].lng - cmpline.points[0].lng), (srcline.points[0].lat - cmpline.points[0].lat), 0);

    var denominator = a.lat * b.lng - a.lng * b.lat;
    if (denominator == 0 || !isFinite(denominator))
        return 0;

    var reciprocal = 1 / denominator;
    var na = (b.lat * c.lng - b.lng * c.lat) * reciprocal;
    if (intersectPt != null) {
        var nlng = srcline.points[0].lng + a.lng * na;
        var nlat = srcline.points[0].lat + a.lat * na;
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

    // 三角形abc 面积的2倍 
    var area_abc = (a.lat - c.lat) * (b.lng - c.lng) - (a.lng - c.lng) * (b.lat - c.lat);

    // 三角形abd 面积的2倍 
    var area_abd = (a.lat - d.lat) * (b.lng - d.lng) - (a.lng - d.lng) * (b.lat - d.lat);

    // 面积符号相同则两点在线段同侧,不相交 (对点在线段上的情况,本例当作不相交处理); 
    if (area_abc * area_abd >= 0) {
        return false;
    }

    // 三角形cda 面积的2倍 
    var area_cda = (c.lat - a.lat) * (d.lng - a.lng) - (c.lng - a.lng) * (d.lat - a.lat);
    // 三角形cdb 面积的2倍 
    // 注意: 这里有一个小优化.不需要再用公式计算面积,而是通过已知的三个面积加减得出. 
    var area_cdb = area_cda + area_abc - area_abd;
    if (area_cda * area_cdb >= 0) {
        return false;
    }

    //计算交点坐标 
    var t = area_cda / (area_abd - area_abc);
    var dx = t * (b.lat - a.lat),
        dy = t * (b.lng - a.lng);
    return [a.lat + dx, a.lng + dy];
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
