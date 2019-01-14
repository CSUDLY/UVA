/**
 * 横断面复杂任务项
 */

(function () {

	this.TransectStyleComplexItem = function (options = new Options()) {
		// 巡航区域的面.
		this.surveyAreaPolygon = null
		// Camera
		this.cameraCalc = null;
		this.camera = new Object();
		this.camera.altitude = options.camera.altitude || 50
		this.camera.triggerDist = options.camera.triggerDist || 25
		this.camera.spacing = options.camera.spacing || 25

		// Transects
		this.transects = new Object();
		this.transects.angle = options.transects.angle || 0
		this.transects.turnAroundDist = options.transects.turnAroundDist || 10
		this.transects.hoverAndCapture = options.transects.hoverAndCapture || false
		this.transects.reflyAtNTDegOffset = options.transects.reflyAtNTDegOffset || false
		this.transects.imgInTurnAround = options.transects.imgInTurnAround || true
		this.transects.relativeAltitude = options.transects.relativeAltitude || true

		// Terrain
		this.terrain = new Object();
		this.terrain.vehicleFllowTerrain = options.transects.vehicleFllowTerrain || false

		// Statistics
		this.statistic = new Object();
		this.statistic.surveyArea = 0
		this.statistic.photoCount = 0
		this.statistic.photoInterval = 0
		this.statistic.triggerDist = this.camera.triggerDist
		this.statistic.flyDist = 0; // 飞行距离

		// Members
		this._transectsPathHeightInfo = null;
		this._visualTransectPoints = null;
		this._surveyAreaPolygon = null;//new _Polygon();
		//this._centerCoord = new _Point(0, 0, 0);
		this._coordinate = null;//new _Point(0, 0, 0); //entry point 
		this._exitCoordinate = null;//new _Point(0, 0, 0); // exit point
		this._transects = null;//new Array(); // fly path

		// FIXIT
		this._flyAlternateTransectsFactBool = 0
		this._loadedMissionItemsParent = false;
		this._loadedMissionItems = null;
	};


	TransectStyleComplexItem.prototype.rebuildTransects = function (refly = false) {
		this._rebuildTransectsPhase1(refly);
		this._rebuildTransectsPhase2();
	}

	TransectStyleComplexItem.prototype._rebuildTransectsPhase1 = function (refly = false) {
		console.log("TransectStyleComplexItem _rebuildTransectsPhase1");
	}

	TransectStyleComplexItem.prototype._rebuildTransectsPhase2 = function () {
		console.log("TransectStyleComplexItem _rebuildTransectsPhase2");
	}

	TransectStyleComplexItem.prototype.setViewPort = function (coord, width, height, isMec = false) {
		console.log("Setting view port.")
		this._surveyAreaPolygon = calcPolygonCornor(coord, width, height, isMec)
	}

	TransectStyleComplexItem.prototype.buildMissionItemToJson = function (index = 0) {
		console.log("Build Mission Item To Json.")
	}

	TransectStyleComplexItem.prototype.setCameraCalc = function(camera_param, isManual = false)
	{
		if (this.cameraCalc == null) {
			this.cameraCalc = new _CameraCalc(camera_param);
		}
	}
	TransectStyleComplexItem.prototype.recalcTriggerDistance = function (isManual = false) {
		
		if (this.cameraCalc == null)
		{
			return;
		}
		//this.cameraCalc instanceof _CameraCalc;
		if (!isManual || !this.cameraCalc.IsManual) {
			return JSON.parse(this.cameraCalc);
		}

		do {
			this.cameraCalc.DisableRecalc = true;
			var focalLength = this.cameraCalc.focalLength;
			var sensorWidth = this.cameraCalc.sensorWidth;
			var sensorHeight = this.cameraCalc.sensorHeight;
			var imageWidth = this.cameraCalc.imageWidth;
			var imageHeight = this.cameraCalc.imageHeight;
			var imageDensity = this.cameraCalc.imageDensity;

			if (focalLength <= 0 || sensorWidth <= 0 || sensorHeight <= 0 || imageWidth <= 0 || imageHeight <= 0 || imageDensity <= 0) {
				break;
			}

			if (this.cameraCalc.ValueSetIsDistance) {
				this.cameraCalc.imageDensity = (this.cameraCalc.DistanceToSurface * sensorWidth * 100.0) / (imageWidth * focalLength);
			} else {
				this.cameraCalc.DistanceToSurface = (imageWidth * this.cameraCalc.ImageDensity * focalLength) / (sensorWidth * 100.0);
			}

			imageDensity = this.cameraCalc.imageDensity;

			if (this.cameraCalc.LandScape) {
				this.cameraCalc.ImageFootprintSide = (imageWidth * imageDensity) / 100.0;
				this.cameraCalc.ImageFootprintFrontal = (imageHeight * imageDensity) / 100.0;
			} else {
				this.cameraCalc.ImageFootprintSide = (imageHeight * imageDensity) / 100.0;
				this.cameraCalc.ImageFootprintFrontal = (imageWidth * imageDensity) / 100.0;
			}
			this.cameraCalc.AdjustedFootprintSide = this.cameraCalc.ImageFootprintSide * ((100.0 - this.cameraCalc.SideOverlap) / 100.0);
			this.cameraCalc.AdjustedFootprintFrontal = this.cameraCalc.ImageFootprintFrontal * ((100.0 - this.cameraCalc.FrontalOverlap) / 100.0);

			this.cameraCalc.DisableRecalc = false;
		} while (1);

		return JSON.parse(this.cameraCalc);
	}

	TransectStyleComplexItem.prototype.getFlyPath = function () {
		return this._visualTransectPoints;
	}

	TransectStyleComplexItem.prototype.getStatistics = function () {
		return {
			"SurveyArea": this.statistic.surveyArea,
			"PhotoNum": this.statistic.photoCount,
			"PhotoInterval": this.statistic.photoInterval,
			"TriggerDist": this.statistic.triggerDist,
			"FlyDist": this.statistic.flyDist
		}
	}

	TransectStyleComplexItem.prototype.setSelfDefineAreaPoints = function (points) {
		if (this._surveyAreaPolygon == null) {
			this._surveyAreaPolygon = new _Polygon();
		}
		this._surveyAreaPolygon.points = points;
		this.rebuildTransects();
	}

	TransectStyleComplexItem.prototype.getAreaPoints = function () {
		return this._surveyAreaPolygon.points;
	}

	TransectStyleComplexItem.prototype.getEntryExitPoint = function () {
		return [this._coordinate.coord, this._exitCoordinate.coord];
	}

	// 控制参数修改   
	// 角度
	TransectStyleComplexItem.prototype.updateAngle = function (newAngle) {
		this.transects.angle = newAngle;
		this.rebuildTransects();
	}
	// 高度
	TransectStyleComplexItem.prototype.updateAltitude = function (altitude) {
		this.camera.altitude = altitude;
		this.rebuildTransects();
	}
	// 拍照距离
	TransectStyleComplexItem.prototype.updateTriggerDist = function (trigger) {
		this.camera.triggerDist = trigger;
		this.rebuildTransects();
	}
	// space
	TransectStyleComplexItem.prototype.updateSpace = function (spacing) {
		this.camera.spacing = spacing;
		this.rebuildTransects();
	}
	// 转向距离
	TransectStyleComplexItem.prototype.updateTurnAroundDist = function (trunAroundDist) {
		this.transects.turnAroundDist = trunAroundDist;
		this.rebuildTransects();
	}
	// hoverAndCapture固定拍照?
	TransectStyleComplexItem.prototype.updateHoverAndCap = function (hoverAndCap) {
		this.transects.hoverAndCapture = hoverAndCap;
		this.rebuildTransects();
	}
	// refly degree offset 重飞角度偏移
	TransectStyleComplexItem.prototype.updateReflyAtNtDegOffset = function (degOffset) {
		this.transects.reflyAtNTDegOffset = degOffset;
		this.rebuildTransects();
	}
	// 转向
	TransectStyleComplexItem.prototype.updateInTurnAround = function (inTurnAround) {
		this.transects.imgInTurnAround = inTurnAround;
		this.rebuildTransects();
	}
	// 相对高度
	TransectStyleComplexItem.prototype.updateRelativeAltitude = function (relativeAltitude) {
		this.transects.relativeAltitude = relativeAltitude;
		this.rebuildTransects();
	}
	// terrain
	TransectStyleComplexItem.prototype.updateFollowTerrain = function (followTerrain) {
		this.terrain.vehicleFllowTerrain = followTerrain;
		this.rebuildTransects();
	}

	window.TransectStyleComplexItem = TransectStyleComplexItem;
})();
