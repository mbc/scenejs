/**
 * Base for backends for the asset scene node. This is extended for each file type.
 */
SceneJs.assetBackend = function(cfg) {

    if (!cfg.type) {
        throw new SceneJs.exceptions.NodeConfigExpectedException("Asset backend config missing: type");
    }

    if (!cfg.parse) {
        throw new SceneJs.exceptions.NodeConfigExpectedException("Asset backend config missing: parser");
    }

    return new (function() {
        this.type = cfg.type; // File extension type

        var ctx;

        this.install = function(_ctx) {
            ctx = _ctx;

            if (!ctx.assets) {  // Lazy-create parser registry

                ctx.assets = new function() {
                    var importers = {}; // Backend extensions each create one of these
                    var entries = {}; // Nodes created by parsers, cached against file name
                    var evictionCountdown = 1000;

                    var evict = function() {
                        if (--evictionCountdown == 0) {
                            //                            var oldest = -1;
                            //                            for (var src in entries) {
                            //                                var entry = entries[src];
                            //                                if (entry.age > oldest) {
                            //                                    oldest = entries[src].age;
                            //                                }
                            //                            }
                            //                            evictionCountdown = 1000;
                        }
                    };

                    /** Installs parser function provided in extension's configs
                     */
                    this.installImporter = function(cfg) {
                        importers[cfg.type] = {
                            type: cfg.type,
                            parse: cfg.parse ,
                            serverParams:cfg.serverParams
                        };
                    };

                    var jsonp = function(fullUri, callbackName, onLoad) {
                        var head = document.getElementsByTagName("head")[0];
                        var script = document.createElement("script");
                        script.type = "text/javascript";
                        script.src = fullUri;
                        window[callbackName] = function(data) {
                            onLoad(data);
                            window[callbackName] = undefined;
                            try {
                                delete window[callbackName];
                            } catch(e) {
                            }
                            head.removeChild(script);
                        };
                        head.appendChild(script);
                    };

                    this.getAsset = function(uri) {
                        var entry = entries[uri];
                        if (entry) {
                            entry.age = 0;
                            //    evict();
                            return entry.node;
                        }
                        return null;
                    };

                    /** Loads asset and caches it against uri
                     */
                    this.loadAsset = function(proxy, uri, type, callbackName, onSuccess, onError) {
                        var importer = importers[type];
                        if (!importer) {
                            throw "Asset file type not supported: \"" + type + "\"";
                        }
                        var url = [proxy, "?callback=" , callbackName , "&uri=" + uri];
                        for (var param in importer.serverParams) { // TODO: memoize string portion that contains params
                            url.push("&", param, "=", importer.serverParams[param]);
                        }
                        jsonp(url.join(""),
                                callbackName,
                                function(data) {    // onLoad
                                    if (!data) {
                                        onError("server response is empty");
                                    } else {
                                        var assetNode = importer.parse(data, function(msg) {
                                            onError(msg);
                                        });
                                        if (assetNode) {
                                            entries[uri] = {
                                                node: assetNode,
                                                age: 0
                                            };
                                            onSuccess(assetNode);
                                        }
                                    }
                                });
                    };

                    /** Clears nodes cached from previous imports.
                     */
                    this.clearAssets = function() {
                        entries = {};
                    };
                };
            }

            /** Install parser function for backend extension
             */
            ctx.assets.installImporter(cfg);
        };

        // Methods for client asset node

        /** Looks for currently loaded asset, which may have been evicted after lack of recent use
         */
        this.getAsset = function(uri) {
            return ctx.assets.getAsset(uri);
        };

        /** Triggers asynchronous JSONP load of asset and creates new process; callback will fire with new child for the
         * client asset node. The asset node will have to then call assetLoaded to notify the backend that the
         * asset has loaded and allow backend to kill the process.
         *
         * JSON does nto handle errors, so the best we can do is manage timeouts withing SceneJS's process management.
         */
        this.loadAsset = function(proxy, uri, onSuccess, onTimeout, onError) {
            var process = ctx.scenes.createProcess({
                onTimeout: function() {  // process killed automatically on timeout
                    onTimeout();
                },
                description:"Asset load: " + uri
            });
            var callbackName = "callback" + ctx.scenes.getActiveSceneID() + process.id;
            ctx.assets.loadAsset(proxy, uri, cfg.type, callbackName,
                    onSuccess,
                    function(msg) {  // onError
                        ctx.scenes.destroyProcess(process);
                        onError(msg);
                    });
            return process;
        };

        /** Notifies backend that load has completed; backend then kills the process.
         */
        this.assetLoaded = function(process) {
            ctx.scenes.destroyProcess(process);
        };

        /** Frees resources held by this backend (ie. parsers and cached scene graph fragments)
         */
        this.reset = function() {
            ctx.assets.clearAssets();
        };
    }
            )
            ();
};