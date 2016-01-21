var _  = require('underscore');
var io = require('socket.io-client')("http://websocket.synchronise.io", {
    reconnect                : true,
    'try multiple transports': true,
    path                     : "/socket.io",
    "force new connection"   : false,
    'log level'              : 0
});

/**
 * Initialises the library
 *
 * @param  {String}api_key
 */
var Synchronise = function(api_key){
    var target = this;

    this.public_key = api_key;
    this.connectionStatusCallbacks = [];

    io.on('connect', function(){
        _.each(target.connectionStatusCallbacks, function(row){
            if(row.hasOwnProperty("connected")) {
                row.connected();
            }
        });
        isConnected = true;
    });

    io.on('event', function(data){

    });

    io.on('disconnect', function(data){
        _.each(this.connectionStatusCallbacks, function(row){
            if(row.hasOwnProperty("lost")) {
                row.lost();
            }
        });
        isConnected = false;
    });

    var isConnected = false;

    // Converts and order the parameters to be used for the callback signature
    function paramsToStringOrderedAlphabetically(params, ignore) {
        var fieldsToIgnore = Array();
        if(typeof(ignore) != "undefined"){
            if(Array.isArray(ignore)){
                fieldsToIgnore = ignore;
            }else{
                fieldsToIgnore = [ignore];
            }
        }

        var fieldsFiltered = _.filter(Object.keys(params), function(key){
            return (fieldsToIgnore.indexOf(key) == -1);
        });

        var orderedList = _.sortBy(fieldsFiltered, function(key){
            return key;
        });

        var string = "";
        _.each(orderedList, function(item){
            if(item != "realtime"){
                string+=item+params[item];
            }
        });

        return string;
    }

    // Creates a new callback signature
    var CallbackSignature = function(functionName, params, realtime){
        this.functionName = functionName;
        this.params       = params;
        this.firstCalled  = false;
        this.realtime     = realtime;
        this.callbacks    = {};
        this.identifier   = functionName + paramsToStringOrderedAlphabetically(params, realtime.ignore);
        this.timestamp    = new Date();
        this.callbacks    = {};
    };

    // Contains the callbacks
    // Structure :
    // |> Channel (Ex : Cloud.run)
    // |---------> Identifier (Ex : functionNameParam1ValueParam1, parameters orderered alphabetically and stringified)
    // |---------------------> functionName
    // |---------------------> params
    // |---------------------> callbacks
    // |---------------------> firstCalled (boolean[Default: false] : whether the callbacks have been fired already once)
    // |---------------------> realtime (boolean : if false it does not fire the events on the second call)
    var callbacks = {};

    // Keeps track of all the requests
    var requests  = {};

    io.on('Cloud.run', function(result){
        if(callbacks.hasOwnProperty('Cloud.run')){
            // Contains list of callbacks
            var callbackList = callbacks['Cloud.run'][result.identifier];

            _.each(Object.keys(callbackList), function(currentKey){
                var callback = callbackList[currentKey];

                var shouldFire = false;
                if(!callback.firstCalled && !callback.shouldAbort){ // This is the first call of the callbacks
                    shouldFire = true;
                }else{
                    // We already fired the callbacks but we accept realtime updates
                    if(callback.identity.realtime && !callback.shouldAbort){
                        shouldFire = true;
                    }
                }

                // Reset the should abort setting
                callbacks['Cloud.run'][result.identifier][currentKey].shouldAbort = false;

                // We have the right to fire the callbacks
                if(shouldFire){
                    callback.firstCalled = true;

                    callbacks['Cloud.run'][result.identifier][currentKey].stepsDone  = result.stepsDone;
                    callbacks['Cloud.run'][result.identifier][currentKey].totalSteps = result.steps;

                    callbacks['Cloud.run'][result.identifier][currentKey].identity.progress = {
                        percentage : Math.round((result.stepsDone/result.steps)*100),
                        totalSteps  : result.steps,
                        currentStep : result.stepsDone
                    };

                    // Result is not a progress of the current request
                    if(result.status != 206){
                        callbacks['Cloud.run'][result.identifier][currentKey].identity.amountOfCalls = callbacks['Cloud.run'][result.identifier][currentKey].identity.amountOfCalls+1;

                        // Current request temporary storage for timing
                        var reqTempStore = requests['Cloud.run'][result.identifier][currentKey][result.uniqueRealtimeID];

                        if(reqTempStore){
                            reqTempStore.endCommunication  = new Date();
                            reqTempStore.executionTime     = result.executionTime;
                            reqTempStore.communicationTime = reqTempStore.endCommunication.getTime()-reqTempStore.startCommunication;

                            callbacks['Cloud.run'][result.identifier][currentKey].identity.executions.push({
                                measurement       : "milliseconds",
                                communicationTime : reqTempStore.communicationTime,
                                executionTime     : reqTempStore.executionTime
                            });

                            var listOfPreviousExecutions = callbacks['Cloud.run'][result.identifier][currentKey].identity.executions;

                            callbacks['Cloud.run'][result.identifier][currentKey].identity.lastRequest  = listOfPreviousExecutions[listOfPreviousExecutions.length-1];
                            callbacks['Cloud.run'][result.identifier][currentKey].identity.firstRequest = listOfPreviousExecutions[0];
                            callbacks['Cloud.run'][result.identifier][currentKey].identity.allRequests  = listOfPreviousExecutions;

                            callbacks['Cloud.run'][result.identifier][currentKey].identity.longestRequest = _.max(listOfPreviousExecutions, function(item){
                                return item.executionTime+item.communicationTime;
                            });

                            callbacks['Cloud.run'][result.identifier][currentKey].identity.shortestRequest = _.min(listOfPreviousExecutions, function(item){
                                return item.executionTime+item.communicationTime;
                            });

                            callbacks['Cloud.run'][result.identifier][currentKey].identity.averageRequestTime = _.reduce(listOfPreviousExecutions, function(previousSum, item){
                                return previousSum+item.executionTime+item.communicationTime;
                            }, 0) / (listOfPreviousExecutions === 0 ? 1 : listOfPreviousExecutions.length);
                        }
                    }

                    if(result.status == 200){
                        if(typeof(callback.callbacks.success) != "undefined"){
                            callback.callbacks.success(JSON.parse(result.message));
                        }
                    }

                    if(result.status == 500){
                        if(typeof(callback.callbacks.error) != "undefined"){
                            callback.callbacks.error(JSON.parse(result.message));
                        }
                    }

                    if(typeof(callback.callbacks.progress) != "undefined"){
                        if(result.status == 206){
                            callback.callbacks.progress(callbacks['Cloud.run'][result.identifier][currentKey].identity.progress, JSON.parse(result.message));
                        }
                    }

                    if(result.status == 100){
                        if(typeof(callback.callbacks.log) != "undefined"){
                            if(callback.uniqueRequestID == result.uniqueRequestID){
                                callback.firstCalled = false;
                                callback.callbacks.log(JSON.parse(result.message).log);
                            }
                        }
                    }

                    // If request is not a progress ping
                    if(typeof(callback.callbacks.always) != "undefined" && // Callback defined
                       result.status != 206 && // Progress
                       result.status != 100){ // Log
                        callback.callbacks.always();
                    }
                }
            });
        }
    });

    io.on('Cloud.dataUpdate', function(result){
        var channel    = result.channel;
        var identifier = result.identifier;

        if(callbacks.hasOwnProperty("Cloud.run")){
          if(callbacks["Cloud.run"].hasOwnProperty(identifier)){
                // We only need the first one because the params are the same
                // Only the callbacks are different but they will be dispatched automatically when pong received
                var item = callbacks[channel][identifier][Object.keys(callbacks[channel][identifier])[0]];
                    item.params.realtime = false; // We avoid resubscribing the callback

                sendRequest({
                    channel         : channel,
                    uniqueRequestID : item.uniqueRequestID,
                    data            : {
                        params     : item.params,
                        room       : item.functionName,
                        identifier : identifier
                    }
                });
          }
        }
    });

    var sendRequest = function(request) {
        var intervalRequest = setInterval(function(){
            if(isConnected){
                clearInterval(intervalRequest);

                var date = new Date();
                var realtimeRequestID = request.data.identifier+date.getTime(); // ID of the current execution (not the actual request)

                // Initialise analytics
                if(request.channel == "Cloud.run"){
                    _.each(callbacks[request.channel][request.data.identifier], function(item){
                        var willFire = false;
                        if(!item.firstCalled){ // This is the first call of the callbacks
                            willFire = true;
                        }else{
                            // We already fired the callbacks but we accept realtime updates
                            if(item.realtime){
                                willFire = true;
                            }
                        }

                        if(willFire){
                            if(typeof(requests[request.channel]) == "undefined"){
                                requests[request.channel] = {};
                            }

                            if(typeof(requests[request.channel][request.data.identifier]) == "undefined"){
                                requests[request.channel][request.data.identifier] = {};
                            }

                            if(typeof(requests[request.channel][request.data.identifier][item.uniqueRequestID]) == "undefined"){
                                requests[request.channel][request.data.identifier][item.uniqueRequestID] = {};
                            }

                            requests[request.channel][request.data.identifier][item.uniqueRequestID][realtimeRequestID] = {
                                startCommunication : new Date(),
                                endCommunication   : undefined,
                                executionTime      : undefined
                            };
                        }
                    });
                }

                io.emit(request.channel, _.extend(request.data, {
                    realtimeRequestID : realtimeRequestID,
                    uniqueRequestID   : request.uniqueRequestID
                }));
            }
        }, 1);
    };

    var Cloud = {
        run: function(functionName, params, response){
            var realtime = false;
            if(typeof(params.realtime) != "undefined"){
                realtime = params.realtime;
                // Realtime messes-up with the generation of the unique identifier header of the function
                // It is re-added later on bellow
                delete params.realtime;
            }

            var channel = 'Cloud.run';

            var hasCallbacks = true;

            if(typeof(response) == "undefined"){
                hasCallbacks = false;
            }else{
                if(typeof(response.success) == "undefined" &&
                   typeof(response.error) == "undefined" &&
                   typeof(response.abort) == "undefined"){
                       hasCallbacks = false;
                }
            }

            var callbackSignature = new CallbackSignature(functionName, params, realtime);

            // Generate a uniqueID for the realtime subscribtion
            var date = new Date().getTime().toString();
            var uniqueRequestID;

            // We have been given an object
            if((typeof realtime === "object") && (realtime !== null)){
                if(typeof(realtime.ignore) != "undefined"){
                    uniqueRequestID = functionName+paramsToStringOrderedAlphabetically(params, realtime.ignore)+date;
                }
            }else{ // We have been given a boolean
                uniqueRequestID = functionName+paramsToStringOrderedAlphabetically(params)+date;
            }

            callbackSignature.uniqueRequestID = uniqueRequestID;

            // Contains the property and methods that are revealed to the dev
            callbackSignature.identity = {
                abort: function(){
                    this.shouldAbort = true;
                },
                setRealtime: function(realtime){
                    // We are not currently subscribed and we are asked to subscribe
                    if(!this.realtime && realtime){
                        this.realtime = true;
                        callbackSignature.params.realtime = true;

                        // We have to subscribe
                        sendRequest({
                            channel    : channel,
                            data       : {
                                params        : callbackSignature.params,
                                room          : callbackSignature.functionName,
                                identifier    : callbackSignature.identifier,
                                skipExecution : true,
                                realtime      : true
                            }
                        });
                    }

                    // We are currently subscribed and we are asked to unsubscribe
                    if(this.realtime && !realtime){
                        // We have to unsubscribe
                        sendRequest({
                            channel    : "Cloud.unsubscribeRealtime",
                            data       : {
                                uniqueID   : this.uniqueRequestID
                            }
                        });

                        this.realtime = false;
                    }
                },
                isRealtime : function(){
                    return this.realtime;
                },
                hasStarted : function(){
                    return this.hasStarted;
                },
                hasFailed : function(){
                    return this.failed;
                },
                hasSucceeded : function(){
                    return this.succeeded;
                },
                hasAborted : function(){
                    return this.aborted;
                },
                hasFinished: function(){
                    return this.finished;
                },
                run        : function(){
                    // We have to set it realtime to receive the future pings
                    if(!this.realtime){
                        this.setRealtime(true);
                    }

                    // Reset to default settings
                    this.failed = false;
                    this.succeeded = false;
                    this.aborted = false;
                    this.hasFinished = false;
                    this.hasStarted = true;

                    sendRequest({
                        channel         : channel,
                        uniqueRequestID : callbackSignature.uniqueRequestID,
                        data       : {
                            realtime   : this.realtime,
                            pk         : public_key,
                            params     : callbackSignature.params,
                            room       : callbackSignature.functionName,
                            identifier : callbackSignature.identifier
                        }
                    });
                },
                amountOfCalls : 0, // Default calls made is 0
                progress      : 0
            };

            callbackSignature.callbacks = {
                success  : function(data){
                    callbackSignature.identity.succeeded = true;

                    if(typeof(response) != "undefined"){
                        if(typeof(response.success) != "undefined"){
                            response.success(data);
                        }
                    }
                },
                error    : function(data){
                    callbackSignature.identity.failed = true;

                    if(typeof(response) != "undefined"){
                        if(typeof(response.error) != "undefined"){
                            if(typeof(data) == "string"){
                                response.error(JSON.parse(data));
                            }else{
                                response.error(data);
                            }
                        }
                    }
                },
                always   : function(){
                    callbackSignature.identity.finished = true;

                    if(typeof(response) != "undefined"){
                        if(typeof(response.always) != "undefined"){
                            response.always();
                        }
                    }
                },
                abort    : function(){
                    callbackSignature.identity.aborted = true;

                    if(typeof(response) != "undefined"){
                        if(typeof(response.abort) != "undefined"){
                            response.abort();
                        }
                    }
                },
                progress : function(progress, message){
                    if(typeof(response) != "undefined"){
                        if(typeof(response.progress) != "undefined"){
                            response.progress(progress, message);
                        }
                    }
                },
                log      : function(log){
                    if(typeof(response) != "undefined"){
                        if(typeof(response.log) != "undefined"){
                            response.log(log);
                        }
                    }
                }
            };

            // Containes the states of the callback
            var states = {
                realtime          : realtime,
                stepsDone         : 0,
                totalSteps        : 1, // Default steps to do is 1
                failed            : false,
                succeeded         : false,
                aborted           : false,
                finished          : false,
                started           : false,
                executing         : false,
                shouldAbort       : true,
                executions        : Array(),
                longestRequest    : undefined,
                shortestRequest   : undefined,
                uniqueRequestID   : callbackSignature.uniqueRequestID
            };

            // Set the current states of the callback
            if(typeof(Object.defineProperty) != "undefined"){
                _.each(Object.keys(states), function(key){
                    Object.defineProperty(callbackSignature.identity, key, {
                        enumerable: false,
                        writable: true
                    });

                    callbackSignature.identity[key] = states[key];
                });
            }else{
                callbackSignature = _.extend(callbackSignature, states);
            }

            if(!callbacks.hasOwnProperty(channel)){
                callbacks[channel] = {};
            }

            if(!callbacks[channel].hasOwnProperty(callbackSignature.identifier)){
                callbacks[channel][callbackSignature.identifier] = {};
            }

            // Register the callback signature
            callbacks[channel][callbackSignature.identifier][callbackSignature.uniqueRequestID] = callbackSignature;

            // Hide some functions
            Object.defineProperty(callbackSignature.identity, "setRealtime", {
                enumerable: false,
                writable: true
            });

            Object.defineProperty(callbackSignature.identity, "isRealtime", {
                enumerable: false,
                writable: true
            });

            return (function(){
                callbacks[channel][callbackSignature.identifier][callbackSignature.uniqueRequestID].identity.run();
                return callbacks[channel][callbackSignature.identifier][callbackSignature.uniqueRequestID].identity;
            })();
        }
    };

    return {
        /**
         * Set the API KEY for the current environment. All the future calls to Synchronise will be made using the given key
         *
         * @param  {String}api_key
         * @return {undefined}
         */
        init: function(api_key){
            if(!api_key.length){
                throw new Error('You must provide a PUBLIC KEY. You can find your PUBLIC KEY by going to synchronise.io/public-key');
            }else{
                target.public_key = api_key;
            }
        },
        /**
         * Utility functions to get the connection/disconnection events
         *
         * @return {Object}
         */
        Connection: {
            /**
             * Register a callback to be triggered when the connection with Synchronise is lost
             *
             * @param  {Object}callback
             * @return {undefined}
             */
            Lost: function(callback){
                target.connectionStatusCallbacks.push({
                    lost: callback
                });
            },
            /**
             * Register a callback to be triggered when the connection with Synchronise is re-established (or first established)
             *
             * @param  {Object}callback
             * @return {undefined}
             */
            Connected: function(callback){
                target.connectionStatusCallbacks.push({
                    connected: callback
                });
            }
        },
        /**
         * Utility functions to communicate with the "Component" API of Synchronise
         *
         * @return {Object}
         */
        Component: {
            /**
             * Run a component on Synchronise and returns its the answers
             *
             * @param  {String}idComponent
             * @param  {Object}params
             * @param  {Object}response
             * @return {Object}
             */
            run: function(idComponent, params, response){
                return Cloud.run("executeComponent", _.extend(params, {id_component: idComponent}), response);
            }
        },
        /**
         * Utility functions to communicate with the "Workflow" API of Synchronise
         *
         * @return {Object}
         */
        /*Workflow: {
            run: function(){

            }
        }*/
    };
};
module.exports = Synchronise;
