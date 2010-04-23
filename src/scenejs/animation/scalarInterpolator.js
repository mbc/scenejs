/**
 * Scene node that defines an interpolated animation sequence for a scalar property of a node. Takes a key value
 * from the current data scope and creates a child scope containing an output value that is interpolated within the
 * configured keyframe sequence.
 *
 * @class SceneJS.scalarInterpolator
 * @extends SceneJS.node
 */
SceneJS.scalarInterpolator = function() {
    var errorBackend = SceneJS._error;
    var cfg = SceneJS._utils.getNodeConfig(arguments);

    var NOT_FOUND = 0;
    var BEFORE_FIRST = 1;
    var AFTER_LAST = 2;
    var FOUND = 3;


    return SceneJS._utils.createNode(
            "scalarInterpolator",
            cfg.children,

            new (function() {

                var params;
                var outputValue;

                this._render = function(traversalContext, data) {
                    if (!params) {
                        params = cfg.getParams(data);

                        // Validate

                        if (!params.input) {
                            errorBackend.fatalError(
                                    new SceneJS.exceptions.NodeConfigExpectedException(
                                            "SceneJS.scalarInterpolator property missing: input"));
                        }

                        if (!params.output) {
                            errorBackend.fatalError(
                                    new SceneJS.exceptions.NodeConfigExpectedException(
                                            "SceneJS.scalarInterpolator property missing: output"));
                        }

                        if (params.keys) {
                            if (!params.values) {
                                errorBackend.fatalError(
                                        new SceneJS.exceptions.InvalidNodeConfigException(
                                                "SceneJS.scalarInterpolator configuration incomplete: " +
                                                "keys supplied but no values - must supply a value for each key"));
                            }
                        } else if (params.values) {
                            errorBackend.fatalError(
                                    new SceneJS.exceptions.InvalidNodeConfigException("SceneJS.scalarInterpolator configuration incomplete: " +
                                                                                      "values supplied but no keys - must supply a key for each value"));
                        }

                        for (var i = 1; i < params.keys.length; i++) {
                            if (params.keys[i - 1] >= params.keys[i]) {
                                errorBackend.fatalError(
                                        new SceneJS.exceptions.InvalidNodeConfigException("SceneJS.scalarInterpolator configuration invalid: " +
                                                                                          "two invalid keys found ("
                                                + i - 1 + " and " + i + ") - key list should contain distinct values in ascending order"));
                            }
                        }

                        params.type = params.type || 'linear';

                        switch (params.type) {
                            case 'linear':
                                break;
                            case 'constant':
                                break;
                            case 'cosine':
                                break;
                            case 'cubic':
                                if (params.keys.length < 4) {
                                    errorBackend.fatalError(
                                            new SceneJS.exceptions.InvalidNodeConfigException(
                                                    "SceneJS.scalarInterpolator configuration invalid: minimum of four keyframes " +
                                                    "required for cubic - only "
                                                            + params.keys.length
                                                            + " are specified"));
                                }
                                break;
                            default:
                                errorBackend.fatalError(
                                        new SceneJS.exceptions.InvalidNodeConfigException(
                                                "SceneJS.scalarInterpolator configuration invalid:  type not supported - " +
                                                "only 'linear', 'cosine', 'cubic' and 'constant' are supported"));
                            /*


                             case 'hermite':
                             break;
                             */
                        }
                    }

                    var key = data.get(params.input);

                    if (!key && key != 0) {
                        errorBackend.fatalError(
                                new SceneJS.exceptions.DataExpectedException(
                                        "SceneJS.scalarInterpolator failed to find input on data: '" + params.input + "'"));
                    }

                    var key1 = 0;
                    var key2 = 1;

                    var linearInterpolate = function(k) {
                        var u = params.keys[key2] - params.keys[key1];
                        var v = k - params.keys[key1];
                        var w = params.values[key2] - params.values[key1];
                        return params.values[key1] + ((v / u) * w);
                    } ;

                    var constantInterpolate = function(k) {
                        if (Math.abs((k - params.keys[key1])) < Math.abs((k - params.keys[key2]))) {
                            return params.keys[key1];
                        } else
                        {
                            return params.keys[key2];
                        }
                    };

                    var cosineInterpolate = function(k) {
                        var mu2 = (1 - Math.cos(k * Math.PI) / 2.0);
                        return (params.keys[key1] * (1 - mu2) + params.keys[key2] * mu2);
                    };

                    var cubicInterpolate = function(k) {
                        if (key1 == 0 || key2 == (params.keys.length - 1)) {
                            /* Between first or last pair of keyframes - need four keyframes for cubic, so fall back on cosine
                             */
                            return cosineInterpolate(k);
                        }
                        var y0 = params.keys[key1 - 1];
                        var y1 = params.keys[key1];
                        var y2 = params.keys[key2];
                        var y3 = params.keys[key2 + 1];
                        var mu2 = k * k;
                        var a0 = y3 - y2 - y0 + y1;
                        var a1 = y0 - y1 - a0;
                        var a2 = y2 - y0;
                        var a3 = y1;
                        return (a0 * k * mu2 + a1 * mu2 + a2 * k + a3);
                    };

                    var findEnclosingFrame = function(key) {
                        if (params.keys.length == 0) {
                            return NOT_FOUND;
                        }
                        if (key < params.keys[0]) {
                            return BEFORE_FIRST;
                        }
                        if (key > params.keys[params.keys.length - 1]) {
                            return AFTER_LAST;
                        }
                        while (params.keys[key1] > key) {
                            key1--;
                            key2--;
                        }
                        while (params.keys[key2] < key) {
                            key1++;
                            key2++;
                        }
                        return FOUND;
                    } ;

                    var interpolate = function(k) {
                        switch (params.type) {
                            case 'linear':
                                return linearInterpolate(k);
                            case 'cosine':
                                return cosineInterpolate(k);
                            case 'cubic':
                                return cubicInterpolate(k);
                            case 'constant':
                                return constantInterpolate(k);
                            default:
                                errorBackend.fatalError("SceneJS.scalarInterpolator internal error - interpolation type not switched: '"
                                        + params.type + "'");
                        }
                    };

                    var update = function() {
                        switch (findEnclosingFrame(key)) {
                            case NOT_FOUND:
                                break;
                            case BEFORE_FIRST:
                                break; // time delay before interpolation begins
                            case AFTER_LAST:
                                outputValue = params.values[params.values.length - 1];
                                break;
                            case FOUND:
                                outputValue = interpolate((key));
                                break;
                            default:
                                break;
                        }
                    };

                    update();

                    var childData = SceneJS._utils.newScope(data, cfg.fixed);
                    childData.put(params.output, outputValue);

                    this._renderChildren(traversalContext, childData);
                };
            })());
};




