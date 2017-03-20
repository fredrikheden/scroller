var powerbi;
(function (powerbi) {
    var extensibility;
    (function (extensibility) {
        var visual;
        (function (visual) {
            function getMeasureIndex(dv, measureName) {
                var RetValue = -1;
                for (var i = 0; i < dv.values.length; i++) {
                    if (dv.values[i].source.roles[measureName] === true) {
                        RetValue = i;
                        break;
                    }
                }
                return RetValue;
            }
        })(visual = extensibility.visual || (extensibility.visual = {}));
    })(extensibility = powerbi.extensibility || (powerbi.extensibility = {}));
})(powerbi || (powerbi = {}));
