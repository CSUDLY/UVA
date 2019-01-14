/**
 * 
 */

(function() {

	var StructureScanComplexItem = function(options) {
		this.options = options;
	};

	StructureScanComplexItem.prototype = new TransectStyleComplexItem();
	StructureScanComplexItem.prototype.name = 'StructureScanComplexItem';

	StructureScanComplexItem.prototype._rebuildTransectsPhase1 = function(refly = false) {
		console.log("StructureScanComplexItem _rebuildTransectsPhase1");
	}

	StructureScanComplexItem.prototype._rebuildTransectsPhase2 = function() {
		console.log("StructureScanComplexItem _rebuildTransectsPhase1");
	}

	window.StructureScanComplexItem = StructureScanComplexItem;
})();
