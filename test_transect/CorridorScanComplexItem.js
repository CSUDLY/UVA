/**
 * 
 */

(function () {

	var CorridorScanComplexItem = function (options) {
		this._transectsPathHeightInfo = new Array();
		this._corridorWidth = 0;
		this._corridorPolyline = new _Line();
		this._ignoreRecalc = false;
	};

	CorridorScanComplexItem.prototype = new TransectStyleComplexItem();
	CorridorScanComplexItem.prototype.name = 'CorridorScanComplexItem';

	
	CorridorScanComplexItem.prototype.setCooridorWidth = function(w)
	{
		this._corridorWidth = w;
	}

	CorridorScanComplexItem.prototype._transectCount = function () {
		var transectSpacing = this.cameraCalc.adjustedFootprintSide;
		var fullWidth = this._corridorWidth;
		return fullWidth > 0.0 ? Math.ceil(fullWidth / transectSpacing) : 1;
	}

	CorridorScanComplexItem.prototype._rebuildTransectsPhase1 = function (refly = false) {
		console.log("CorridorScanComplexItem _rebuildTransectsPhase1");
		if (this._ignoreRecalc) {
			return;
		}

		// If the transects are getting rebuilt then any previsouly loaded mission items are now invalid
		if (this._loadedMissionItemsParent) {
			this._loadedMissionItems = new Array();
			// FIXIT
			//_loadedMissionItemsParent->deleteLater();
			this._loadedMissionItemsParent = null;
		}

		this._transects = new Array;
		this._transectsPathHeightInfo = new Array(new Array(_PathHeightInfo));
		this._transectsPathHeightInfo.shift();

		var transectSpacing = this.cameraCalc.AdjustedFootprintSide;
		var fullWidth = this._corridorWidth;
		var halfWidth = fullWidth / 2.0;
		var transectCount = this._transectCount();
		var normalizedTransectPosition = transectSpacing / 2.0;

		if (this._corridorPolyline.points.length >= 2) {
			// First build up the transects all going the same direction
			//qDebug() << "_rebuildTransectsPhase1";
			for (var i = 0; i < transectCount; i++) {
				//qDebug() << "start transect";
				var offsetDistance;
				if (transectCount == 1) {
					// Single transect is flown over scan line
					offsetDistance = 0;
				} else {
					// Convert from normalized to absolute transect offset distance
					offsetDistance = halfWidth - normalizedTransectPosition;
				}

				// Turn transect into CoordInfo transect
				var transect = new Array(_CoordInfo);
				transect.shift();
				//QList<QGeoCoordinate> transectCoords = _corridorPolyline.offsetPolyline(offsetDistance);
				var transectCoords = _corridorPolyline.offsetPolyline(offsetDistance);
				for (var j = 1; j < transectCoords.length - 1; j++) {
					var coordInfo = new _CoordInfo()
					coordInfo.coord = transectCoords[j];
					coordInfo.type = CoordType.CoordTypeInterior;
					transect.push(coordInfo);
				}
				var coordInfo1 = new _CoordInfo()
				coordInfo1.coord = transectCoords.first();
				coordInfo1.type = CoordType.CoordTypeSurveyEdge;//{ transectCoords.first(), CoordTypeSurveyEdge };
				transect.prepend(coordInfo1);
				var coordInfo2 = new _CoordInfo();
				coordInfo2.coord = transectCoords.last();
				coordInfo2.type = CoordType.CoordTypeSurveyEdge;
				//coordInfo = { transectCoords.last(), CoordTypeSurveyEdge };
				transect.append(coordInfo);

				// Extend the transect ends for turnaround
				if (_hasTurnaround()) {
					//QGeoCoordinate turnaroundCoord;
					var turnAroundDistance = _turnAroundDistanceFact.rawValue().tovar();

					var azimuth = transectCoords[0].azimuthTo(transectCoords[1]);
					var turnaroundCoord1 = atDistanceAndAzimuth(transectCoords[0], -turnAroundDistance, azimuth);
					//turnaroundCoord.setAltitude(qQNaN());
					var coordInfo3 = new _CoordInfo();
					coordInfo3.coord = turnaroundCoord1;
					coordInfo3.type = CoordType.CoordTypeTurnaround;
					transect.unshift(coordInfo3);

					azimuth = transectCoords.last().azimuthTo(transectCoords[transectCoords.count() - 2]);
					var transectCoords = transectCoords.last().atDistanceAndAzimuth(-turnAroundDistance, azimuth);
					//transectCoords.setAltitude(qQNaN());
					var coordInfo4 = new _CoordInfo();
					coordInfo4.coord = transectCoords;
					coordInfo4.type = CoordType.CoordTypeTurnaround;
					transect.push(coordInfo4);
				}

				if (0) { // for debug
					console.log("transect debug");
					//foreach (const TransectStyleComplexItem::CoordInfo_t& coordInfo, transect) {
					//	qDebug() << coordInfo.coordType;
					//}
				}

				_transects.append(transect);
				normalizedTransectPosition += transectSpacing;
			}

			// Now deal with fixing up the entry point:
			//  0: Leave alone
			//  1: Start at same end, opposite side of center
			//  2: Start at opposite end, same side
			//  3: Start at opposite end, opposite side

			var reverseTransects = false;
			var reverseVertices = false;
			switch (_entryPoint) {
				case 0:
					reverseTransects = false;
					reverseVertices = false;
					break;
				case 1:
					reverseTransects = true;
					reverseVertices = false;
					break;
				case 2:
					reverseTransects = false;
					reverseVertices = true;
					break;
				case 3:
					reverseTransects = true;
					reverseVertices = true;
					break;
			}
			if (reverseTransects) {
				var reversedTransects = new Array;
				reversedTransects.shift();

				for (var ks = 0; ks < _transects.count(); ++ks) {
					reversedTransects.unshift(_transects[ks]);
				}
				//foreach (const QList<TransectStyleComplexItem::CoordInfo_t>& transect, _transects) {
				//	reversedTransects.prepend(transect);
				//}
				_transects = reversedTransects;
			}
			if (reverseVertices) {
				for (var i = 0; i < _transects.count(); i++) {
					//QList<TransectStyleComplexItem::CoordInfo_t> reversedVertices;
					var reversedVertices = new Array();
					reversedVertices.shift();
					for (var ks = 0; ks < _transects[i].count(); ++i) {
						reversedVertices.unshift(_transects[i][ks]);
					}
					//foreach (const TransectStyleComplexItem::CoordInfo_t& vertex, _transects[i]) {
					//						reversedVertices.prepend(vertex);
					//					}
					_transects[i] = reversedVertices;
				}
			}

			// Adjust to lawnmower pattern
			reverseVertices = false;
			for (var i = 0; i < _transects.count(); i++) {
				// We must reverse the vertices for every other transect in order to make a lawnmower pattern
				//QList<TransectStyleComplexItem::CoordInfo_t> transectVertices = _transects[i];
				var transectVertices = _transects[i];
				if (reverseVertices) {
					reverseVertices = false;
					//QList<TransectStyleComplexItem::CoordInfo_t> reversedVertices;
					var reversedVertices;
					for (var j = transectVertices.count() - 1; j >= 0; j--) {
						reversedVertices.append(transectVertices[j]);
					}
					transectVertices = reversedVertices;
				} else {
					reverseVertices = true;
				}
				_transects[i] = transectVertices;
			}
		}
	}

	CorridorScanComplexItem.prototype._rebuildTransectsPhase2 = function () {
		console.log("CorridorScanComplexItem _rebuildTransectsPhase1");
		// Calculate distance flown for complex item
		_complexDistance = 0;
		for (var i = 0; i < _visualTransectPoints.count() - 1; i++) {
			_complexDistance += distanceTo(_visualTransectPoints[i], _visualTransectPoints[i + 1]);
		}

		if (_cameraTriggerInTurnAroundFact.rawValue().toBool()) {
			_cameraShots = qCeil(_complexDistance / this.cameraCalc.AdjustedFootprintFrontal);
		} else {
			var singleTransectImageCount = qCeil(_corridorPolyline.length() / this.cameraCalc.AdjustedFootprintFrontal);
			_cameraShots = singleTransectImageCount * this._transectCount();
		}

		_coordinate = _visualTransectPoints.length ? _visualTransectPoints[0] : new _Point(0, 0, 0);
		_exitCoordinate = _visualTransectPoints.length ? _visualTransectPoints[_visualTransectPoints.length - 1] : new _Point(0, 0, 0);
	}

	CorridorScanComplexItem.prototype.setViewPort = function (coord, width, height, isMec = false) {
		console.log("Setting view port.")
		this._corridorPolyline = addInitionalPolyline(coord, width, height, isMec)
	}

	window.CorridorScanComplexItem = CorridorScanComplexItem;
})();

