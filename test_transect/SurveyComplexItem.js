/**
 * 巡航复杂任务
 */

(function () {

	var SurveyComplexItem = function (options) {

	};

	SurveyComplexItem.prototype = new TransectStyleComplexItem();
	SurveyComplexItem.prototype.name = 'SurveyComplexItem';

	SurveyComplexItem.prototype.rebuildTransects = function (refly = false) {
		this._rebuildTransectsPhase1(refly);
		this._rebuildTransectsPhase2();
	}

	SurveyComplexItem.prototype._rebuildTransectsPhase1 = function (refly = false) {
		console.log("SurveyComplexItem _rebuildTransectsPhase1");
		if (this._surveyAreaPolygon == null) return this._transects;

		var polygonPoints = new Array(_Point);
		polygonPoints.shift();
		var tangentOrigin = this._surveyAreaPolygon.points[0];
		var calcAreaPoly = new _Polygon();
		//console.log("_rebuildTransectsPhase1 Convert polygon to NED - this._surveyAreaPolygon.length:tangentOrigin" + this._surveyAreaPolygon.length + tangentOrigin);
		for (var i = 0; i < this._surveyAreaPolygon.points.length; i++) {
			var geoToNedResult;
			var vertex = this._surveyAreaPolygon.points[i];
			if (i == 0) {

				geoToNedResult = new _Point(0, 0, 0);
			} else {
				geoToNedResult = convertGeoToNed(vertex, tangentOrigin);
			}
			polygonPoints.push(geoToNedResult);  //polygonPoints点数组中添加转换后的点
			calcAreaPoly.points.push(geoToNedResult);
			if (polygonPoints.length != (i + 1)) {
				console.log("Convert Geo to NED failed.");
				return this._transects;
			}
			console.log("_rebuildTransectsPhase1 vertex:x:y" + vertex + polygonPoints[polygonPoints.length - 1]);
		}

		this.statistic.surveyArea = calcArea(calcAreaPoly);

		// Generate transects
		this.transects.angle = _clampGridAngle90(this.transects.angle);  //这里调用格式化角度的函数
		this.transects.angle += refly ? 90 : 0;    //根据refly的值来调整角度的值
		//console.log("_rebuildTransectsPhase1 Clamped grid angle" + this.transects.angle);
		//console.log("_rebuildTransectsPhase1 gridSpacing:gridAngle:refly" + this.camera.spacing + this.transects.angle + refly);
		// Convert polygon to bounding rect
		// 将多边形转换为包围矩形
		console.log("_rebuildTransectsPhase1 Polygon");
		var polygon = new _Polygon;
		for (var i = 0; i < polygonPoints.length; i++) {
			console.log("Vertex" + polygonPoints[i]);
			polygon.points.push(polygonPoints[i]);
		}
		polygon.points.push(polygonPoints[0]); //这里是为了形成闭合的图形
		// 这里需要算出矩形的宽度、高度和中心点
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
		var lineList = new Array(_Line);   //线数组  QList<QLineF>  结构类似于  [[[23.1,111],[23.4,102]],[[23.2,100],[34.7,130]],[[12.2,131],[42.4,121]]]
		lineList.shift();

		// Transects are generated to be as long as the largest width/height of the bounding rect plus some fudge factor.
		// This way they will always be guaranteed to intersect with a polygon edge no matter what angle they are rotated to.
		// They are initially generated with the transects flowing from west to east and then points within the transect north to south.
		// 生成的横断面与边界矩形的最大宽度/高度一样长，加上一些模糊因子。
		// 这样，无论旋转到什么角度，它们都保证与多边形边缘相交。
		// 它们最初是由横断面由西向东流动产生的，然后在横断面内由北向南指向点。
		var maxWidth = qMax(boundingRect[0], boundingRect[1]) + 2000.0; // 最大宽度，qMax函数是执行 return (a < b) ? b : a; 查找最大值
		var halfWidth = maxWidth / 2.0;
		var transectX = boundingCenter.lng - halfWidth;
		var transectXMax = transectX + maxWidth;
		while (transectX < transectXMax) {
			var transectYTop = boundingCenter.lat - halfWidth;
			var transectYBottom = boundingCenter.lat + halfWidth;
			var tmpLine = new _Line;

			tmpLine.p1  = _rotatePoint(new _Point(transectX, transectYTop, 0), boundingCenter, this.transects.angle);
			tmpLine.p2 = _rotatePoint(new _Point(transectX, transectYBottom, 0), boundingCenter, this.transects.angle);

			transectX += this.camera.spacing;
			lineList.push(tmpLine);
		}


		// Now intersect the lines with the polygon
		var intersectLines = _intersectLinesWithPolygon(lineList, polygon);


		// Less than two transects intersected with the polygon:
		//      Create a single transect which goes through the center of the polygon
		//      Intersect it with the polygon

		// FIXIT
		if (intersectLines.length < 2) {
			var firstLine = lineList[0]; //QLineF  取第一条线
			var lineCenter = new _Point((firstLine.p1.lng + firstLine.p2.lng) / 2, (firstLine.p1.lat + firstLine.p2.lat) / 2, 0);
			var centerOffset = new _Point(boundingCenter.lng - lineCenter.lng, boundingCenter.lat - lineCenter.lat, 0);
			firstLine.p1.lng += centerOffset.lng;
			firstLine.p2.lng += centerOffset.lng;
			firstLine.p1.lat += centerOffset.lat;
			firstLine.p2.lat += centerOffset.lat;
			
			lineList = new Array(); //清理
			lineList.push(firstLine);
			intersectLines = lineList;
			intersectLines = _intersectLinesWithPolygon(lineList, polygon);
		}

		// Make sure all lines are going the same direction. Polygon intersection leads to lines which
		// can be in varied directions depending on the order of the intesecting sides.
		var resultLines = _adjustLineDirection(intersectLines);


		// Convert from NED to Geo
		var transects = [];//new _Array(_Line);
		//transects.shift();
		for (var ind = 0; ind < resultLines.length; ind++) {  //遍历线数组resultLines
			var tmpLine = resultLines[ind];  //QGeoCoordinate
			var transect = [];//QList<QGeoCoordinate>
			transect.push(convertNedToGeo(tmpLine.p1.lat, tmpLine.p1.lng, 0, tangentOrigin)); //将Ned转换成Geo
			transect.push(convertNedToGeo(tmpLine.p2.lat, tmpLine.p2.lng, 0, tangentOrigin)); //将Ned转换成Geo
			transects.push(transect);
		}

		_adjustTransectsToEntryPointLocation(transects); //调整横断面到入口点位置

		if (refly) {
			_optimizeTransectsForShortestDistance(this._transects[this._transects.length - 1][this._transects[this._transects.length - 1].length - 1], transects);
		}

		if (this._flyAlternateTransectsFactBool) { // 
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
			var transectVertices = transects[i];
			if (reverseVertices) {
				reverseVertices = false;
				var reversedVertices = [];
				for (var j = transectVertices.length - 1; j >= 0; j--) {
					reversedVertices.push(transectVertices[j]);
				}
				transectVertices = reversedVertices;
			} else {
				reverseVertices = true;
			}
			transects[i] = transectVertices;
		}

		// Convert to CoordInfo transects and append to this._transects
		this._transects = new Array(new Array(_CoordInfo));
		this._transects.shift();
		// 转换为坐标横断面和追加到_transect
		for (var ind = 0; ind < transects.length; ind++) {
			var coordInfoTransect = new Array(_CoordInfo);
			coordInfoTransect.shift();
			var coordInfo1 = new _CoordInfo();
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
			if (this.camera.triggerDist && this.transects.hoverAndCapture) {//(triggerCamera() && hoverAndCaptureEnabled()) 
				//bool    triggerCamera           (void) const { return triggerDistance() != 0; }
				// bool    hoverAndCaptureEnabled  (void) const { return hoverAndCapture()->rawValue().toBool(); }
				var transectLength = distanceTo(transect[0], transect[1]);  //这里是在算距离
				var transectAzimuth = azimuthTo(transect[0], transect[1]);  //这里是在算角度

				if (this.camera.triggerDist < transectLength) {//double  triggerDistance         (void) const { return _cameraCalc.adjustedFootprintFrontal()->rawValue().toDouble(); }
					var cInnerHoverPoints = Math.floor(transectLength / this.camera.triggerDist);
					console.log("cInnerHoverPoints" + cInnerHoverPoints);
					for (var i = 0; i < cInnerHoverPoints; i++) {
						var hoverCoord = atDistanceAndAzimuth(transect[0], this.camera.triggerDist * (i + 1), transectAzimuth); //QGeoCoordinate
						var coordInfo = [hoverCoord, CoordType.CoordTypeInteriorHoverTrigger]; //TransectStyleComplexItem::CoordInfo_t 
						coordInfoTransect.push(coordInfo);  //coordInfoTransect.insert(1 + i, coordInfo);
					}
				}
			}

			// Extend the transect ends for turnaround
			if (this.transects.turnAroundDist > 0) {//(_hasTurnaround) {  //_hasTurnaround()
				//QGeoCoordinate
				var turnAroundDistance = this.transects.turnAroundDist; //double

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

			this._transects.push(coordInfoTransect);
		}

		return this._transects;
	}

	SurveyComplexItem.prototype._rebuildTransectsPhase2 = function () {
		console.log("SurveyComplexItem _rebuildTransectsPhase2");
		this._visualTransectPoints = new Array(_Point)
		this._visualTransectPoints.shift();

		for (var indi = 0; indi < this._transects.length; indi++) {
			var transect = this._transects[indi];
			for (var indj = 0; indj < transect.length; indj++) {
				this._visualTransectPoints.push(transect[indj]);
			}
		}
		this.statistic.flyDist = 0;
		for (var i = 0; i < this._visualTransectPoints.length - 1; i++) {
			//計算this._visualTransectPoints 所成綫的長度
			this.statistic.flyDist += distanceTo(this._visualTransectPoints[i].coord, this._visualTransectPoints[i + 1].coord);
		}

		// 计算拍照次数
		if (this.camera.triggerDist) {
			this.statistic.photoCount = Math.ceil(this.statistic.flyDist / this.camera.triggerDist);
		} else {
			this.statistic.photoCount = 0;
			for (var ind = 0; ind < this._transects.length; ind++) {
				var transect = this._transects[ind];
				var firstCameraCoord, lastCameraCoord;
				if (this.transects.turnAroundDist > 0) {
					firstCameraCoord = transect[1].coord;
					lastCameraCoord = transect[transect.length - 2].coord;
				} else {
					firstCameraCoord = transect[0].coord;
					lastCameraCoord = transect[transect.length - 1].coord;
				}
				this.statistic.photoCount += Math.ceil(distanceTo(firstCameraCoord, lastCameraCoord) / this.camera.triggerDist);
			}
		}

		// 这里记录了飞入飞出点,如果this._visualTransectPoints有值,就是他里面的第一个点，如果灭有，就是(0, 0)点，飞出同.
		if (this._visualTransectPoints.length == 0) {
			this._coordinate = new _Point(0, 0, 0);
			this._exitCoordinate = new _Point(0, 0, 0);
		}
		else {
			this._coordinate = this._visualTransectPoints[0];
			this._exitCoordinate = this._visualTransectPoints[this._visualTransectPoints.length - 1]; // 同上
		}
		var retval = new Array();
		retval.shift();
		retval.push(this._coordinate);
		retval.push(this._exitCoordinate);

		return retval;
	}

	SurveyComplexItem.prototype.buildMissionItemToJson = function (index = 0) {
		console.log("Build Mission Item To Json.")

		if (this._transects == null || this._transects.length == 0)  return [];
		var seqNum = index;//_sequenceNumber;TODO
		var imagesEverywhere = this.camera.triggerDist;
		var addTriggerAtBeginning = !this.transects.hoverAndCapture && imagesEverywhere;
		var firstOverallPoint = true;
		var addTriggerAtBeginning = false;
		var mavFrame = 3; // TODO:

		var itemlist = [];

		for (var i = 0; i < this._transects.length; ++i) {
			var entryPoint = true;
			for (var j = 0; j < this._transects[i].length; ++j) {
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
				item_case1.params = [this.transects.hoverAndCapture ? 1 : 0,
					0.0, 0.0, 0.0,
					this._transects[i][j].coord.lng, this._transects[i][j].coord.lat, this._transects[i][j].coord.z];
				item_case1.autoContinue = true;
				item_case1.isCurrentItem = false;
				item_case1.type = "SimpleItem"; // confirm
				itemlist.push(item_case1);

				if (this.transects.hoverAndCapture) {
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

	SurveyComplexItem.prototype.setViewPort = function (coord, width, height, isMec = false) {
		console.log("Setting view port.")
		this._surveyAreaPolygon = calcPolygonCornor(coord, width, height, isMec)
	}

	window.SurveyComplexItem = SurveyComplexItem;
})();
